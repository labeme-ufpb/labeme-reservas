/* ============================================================
   db.js — Camada de persistência (v11 — Firebase)
   - Firestore como banco único (todos os usuários veem os mesmos dados)
   - window.db continua sendo o espelho em memória usado pelas telas;
     saveDB() descobre o que mudou e grava só esses documentos
   - Fotos (data:image/…) vão para o Cloud Storage e o documento
     guarda apenas o link
   - Atualização em tempo real: mudanças feitas em outro aparelho
     chegam por onSnapshot e redesenham a tela atual
   ============================================================ */

const SESSION_KEY = 'labeme_session_v10';   // mantido por compatibilidade (sessão agora é do Firebase Auth)
const SCHEMA_VERSION = 11;
const COLLECTIONS = ['users', 'resources', 'reservations', 'stock', 'messages'];

const DEFAULT_SETTINGS = {
  minAdvanceHours: 24,
  maxAdvanceDays: 30,
  maxActivePerUser: 6,          // reservas futuras simultâneas por usuário (0 = sem limite)
  allowWeekends: false,
  closedDates: [],              // feriados / recessos (AAAA-MM-DD)
  notifyInApp: true,
  labName: 'LABEME — UFPB',
  adminEmail: 'labeme.ufpb@gmail.com',
  turnoManha: { start: '08:00', end: '12:00' },
  turnoTarde: { start: '14:00', end: '17:00' },
  autoApproveCategories: ['mestrado','doutorado','prof_depto','prof_externo','tecnico'],
  labRules: 'Uso obrigatório de EPI (jaleco, óculos, calçado fechado). Equipamentos de grande porte somente com técnico presente. Limpe e devolva o equipamento e a bancada nas mesmas condições em que recebeu. Comunique imediatamente qualquer dano ou mau funcionamento à equipe técnica.'
};

function emptyDB() {
  return {
    schema: SCHEMA_VERSION,
    users: [], resources: [], reservations: [], messages: [], stock: [], passwordResets: [],
    settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS))
  };
}

function normalizeSettings(s) {
  const out = Object.assign(JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), s || {});
  if (!Array.isArray(out.closedDates)) out.closedDates = [];
  if (!Array.isArray(out.autoApproveCategories)) out.autoApproveCategories = DEFAULT_SETTINGS.autoApproveCategories.slice();
  return out;
}
// Valores padrão por coleção (aplicados antes de comparar, para não gerar gravações fantasmas)
function normalizeDoc(c, d) {
  if (c === 'resources') {
    if (!d.status) d.status = 'available';
    if (d.active === undefined) d.active = true;
    if (!d.totalQuantity) d.totalQuantity = 1;
  } else if (c === 'users') {
    if (d.active === undefined) d.active = true;
    if (!d.role) d.role = 'user';
  } else if (c === 'reservations') {
    if (!Array.isArray(d.history)) d.history = [{ at: d.createdAt || Date.now(), by: d.userId, action: 'created', status: d.status }];
    if (!d.quantity) d.quantity = 1;
  }
  return d;
}
function normalizeDB(d) {
  const out = Object.assign(emptyDB(), d || {});
  ['users','resources','reservations','messages','stock','passwordResets'].forEach(k => { if (!Array.isArray(out[k])) out[k] = []; });
  out.settings = normalizeSettings(out.settings);
  COLLECTIONS.forEach(c => out[c].forEach(x => normalizeDoc(c, x)));
  out.schema = SCHEMA_VERSION;
  return out;
}

/* ---------- Firebase ---------- */
let fb = null;
function initFirebase() {
  if (fb) return fb;
  const app = firebase.initializeApp(FIREBASE_CONFIG);
  const auth = firebase.auth();
  auth.languageCode = 'pt-BR';
  fb = { app, auth, fs: firebase.firestore(), st: firebase.storage() };
  return fb;
}

// JSON com chaves ordenadas: compara documentos sem depender da ordem dos campos
function stableStringify(v) {
  return JSON.stringify(v, (k, val) => (val && typeof val === 'object' && !Array.isArray(val))
    ? Object.keys(val).sort().reduce((o, key) => { o[key] = val[key]; return o; }, {})
    : val);
}

const _sync = { unsubs: [], known: {}, pending: {}, settingsKnown: null, ready: false, uid: null, msg: { to: new Map(), from: new Map() } };
const _refreshSoon = debounce(() => { if (typeof onExternalDataChange === 'function') onExternalDataChange(); }, 120);

/* Configurações públicas (normas exibidas no cadastro, antes do login) */
async function loadPublicSettings() {
  try {
    const snap = await fb.fs.doc('settings/global').get();
    window.db.settings = normalizeSettings(snap.exists ? snap.data() : {});
  } catch (e) { console.warn('Configurações indisponíveis:', e.message); }
}

/* Liga os ouvintes em tempo real. Resolve quando todas as coleções chegaram pela 1ª vez. */
function startSync(uid) {
  stopSync();
  _sync.uid = uid; _sync.ready = false;
  COLLECTIONS.forEach(c => { _sync.known[c] = new Map(); _sync.pending[c] = new Map(); });
  _sync.msg = { to: new Map(), from: new Map() };
  const firsts = [];
  const watch = (key, ref, apply) => firsts.push(new Promise(resolve => {
    let first = true;
    _sync.unsubs.push(ref.onSnapshot(snap => {
      apply(snap);
      if (first) { first = false; resolve(); } else if (_sync.ready) _refreshSoon();
    }, err => {
      console.error('Sincronização (' + key + '):', err);
      if (first) { first = false; resolve(); }
      if (err.code === 'permission-denied' && _sync.ready) toast('Sem permissão para ler parte dos dados. Entre novamente.', 'error');
    }));
  }));

  watch('settings', fb.fs.doc('settings/global'), snap => {
    window.db.settings = normalizeSettings(snap.exists ? snap.data() : {});
    _sync.settingsKnown = stableStringify(window.db.settings);
  });
  ['users', 'resources', 'reservations', 'stock'].forEach(c =>
    watch(c, fb.fs.collection(c), snap => _applyCollection(c, snap.docs.map(d => Object.assign({}, d.data(), { id: d.id })))));
  // Mensagens: cada pessoa só lê as próprias (enviadas e recebidas)
  const applyMsgs = () => _applyCollection('messages', [...new Map([..._sync.msg.from, ..._sync.msg.to]).values()]);
  watch('msg-to', fb.fs.collection('messages').where('toUserId', '==', uid), snap => {
    _sync.msg.to = new Map(snap.docs.map(d => [d.id, Object.assign({}, d.data(), { id: d.id })])); applyMsgs();
  });
  watch('msg-from', fb.fs.collection('messages').where('fromUserId', '==', uid), snap => {
    _sync.msg.from = new Map(snap.docs.map(d => [d.id, Object.assign({}, d.data(), { id: d.id })])); applyMsgs();
  });
  return Promise.all(firsts).then(() => { _sync.ready = true; });
}

/* Defesa extra no navegador: documentos com ID ou campos fora do formato esperado são ignorados
   (as regras do servidor já recusam, mas dados antigos ou adulterados não chegam à tela). */
const _HHMM = /^[0-2]\d:[0-5]\d$/, _ISO = /^\d{4}-[0-1]\d-[0-3]\d$/;
function sanitizeDoc(c, d) {
  if (!d || !isSafeId(d.id)) return null;
  if (c === 'reservations') {
    if (!isSafeId(d.userId) || !isSafeId(d.resourceId) || !_ISO.test(d.date || '')) return null;
    if (!['turno', 'slot', 'days'].includes(d.mode)) return null;
    d.slot = d.slot && typeof d.slot === 'object' ? d.slot : {};
    if (d.mode === 'slot' && !(_HHMM.test(d.slot.start || '') && _HHMM.test(d.slot.end || ''))) return null;
    if (d.mode === 'turno' && !['manha', 'tarde'].includes(d.slot.turno)) d.slot = { turno: 'manha' };
    if (d.mode === 'days' && !_ISO.test(d.endDate || '')) return null;
    d.quantity = Math.max(1, Math.min(1000, parseInt(d.quantity, 10) || 1));
    if (!RES_STATUS[d.status]) return null;
    if (!Array.isArray(d.history)) d.history = [];
  } else if (c === 'messages') {
    if (!isSafeId(d.fromUserId) || !isSafeId(d.toUserId)) return null;
    d.body = String(d.body == null ? '' : d.body).slice(0, 4000);
    d.sentAt = Number(d.sentAt) || 0;
    if ('system' in d) d.system = d.system === true;
  } else if (c === 'stock') {
    if (d.quantity != null && !Number.isFinite(Number(d.quantity))) d.quantity = null;
    ['name', 'type', 'unit', 'location', 'notes', 'professorName', 'advisee'].forEach(k => { if (d[k] != null) d[k] = String(d[k]); });
  } else if (c === 'resources') {
    d.totalQuantity = Math.max(1, parseInt(d.totalQuantity, 10) || 1);
    if (d.maxDays != null) d.maxDays = Math.max(1, Math.min(90, parseInt(d.maxDays, 10) || 7));
    d.name = String(d.name || '');
  } else if (c === 'users') {
    d.name = String(d.name || '');
    d.email = String(d.email || '');
  }
  return d;
}

function _applyCollection(c, docs) {
  docs = docs.map(d => sanitizeDoc(c, d)).filter(Boolean);
  docs.forEach(d => normalizeDoc(c, d));
  _sync.known[c] = new Map(docs.map(d => [d.id, stableStringify(d)]));
  // Documentos ainda enviando foto continuam visíveis com a versão local
  _sync.pending[c].forEach((obj, id) => {
    const i = docs.findIndex(d => d.id === id);
    if (i >= 0) docs[i] = obj; else docs.push(obj);
    _sync.known[c].set(id, stableStringify(obj));
  });
  window.db[c] = docs;
}

function stopSync() {
  _sync.unsubs.forEach(u => { try { u(); } catch (_) {} });
  _sync.unsubs = []; _sync.ready = false; _sync.uid = null;
}
function isSynced() { return _sync.ready; }

/* Grava o que mudou desde o último estado conhecido do servidor */
function saveDB() {
  if (!fb || !_sync.ready) { console.warn('saveDB antes da sincronização — ignorado'); return true; }
  COLLECTIONS.forEach(c => {
    const known = _sync.known[c], seen = new Set();
    (window.db[c] || []).forEach(obj => {
      if (!obj || !obj.id || !isSafeId(obj.id)) return;
      seen.add(obj.id);
      const s = stableStringify(obj);
      if (known.get(obj.id) !== s) { known.set(obj.id, s); _writeDoc(c, obj); }
    });
    [...known.keys()].forEach(id => {
      if (seen.has(id)) return;
      known.delete(id);
      fb.fs.collection(c).doc(id).delete().catch(_reportWriteError);
    });
  });
  const s = stableStringify(window.db.settings);
  if (s !== _sync.settingsKnown) {
    _sync.settingsKnown = s;
    fb.fs.doc('settings/global').set(JSON.parse(JSON.stringify(window.db.settings))).catch(_reportWriteError);
  }
  return true;
}

async function _writeDoc(c, obj) {
  const id = obj.id;
  try {
    let data = JSON.parse(JSON.stringify(obj));   // remove undefined e referências
    if (_hasDataUrl(data)) {
      _sync.pending[c].set(id, obj);
      await _uploadImages(`uploads/${c}/${id}`, data, obj);
      _sync.pending[c].delete(id);
      _sync.known[c].set(id, stableStringify(obj));
    }
    await fb.fs.collection(c).doc(id).set(data);
  } catch (e) {
    _sync.pending[c].delete(id);
    _reportWriteError(e);
  }
}

function _hasDataUrl(v) {
  if (typeof v === 'string') return v.startsWith('data:image/');
  if (v && typeof v === 'object') return Object.values(v).some(_hasDataUrl);
  return false;
}
// Envia cada foto embutida para o Storage e troca, no dado e no objeto da tela, pelo link
async function _uploadImages(folder, data, live) {
  for (const k of Object.keys(data)) {
    const v = data[k];
    if (typeof v === 'string' && v.startsWith('data:image/')) {
      const url = await uploadImage(folder, v);
      data[k] = url;
      if (live && live[k] === v) live[k] = url;
    } else if (v && typeof v === 'object') {
      await _uploadImages(folder, v, live && typeof live[k] === 'object' ? live[k] : null);
    }
  }
}
async function uploadImage(folder, dataUrl) {
  const ref = fb.st.ref(`${folder}/${Date.now()}-${uid('f').slice(2)}.jpg`);
  await ref.putString(dataUrl, 'data_url', { contentType: 'image/jpeg', cacheControl: 'public,max-age=31536000' });
  return ref.getDownloadURL();
}

let _lastWriteErr = 0;
function _reportWriteError(e) {
  console.error('Falha ao gravar:', e);
  if (Date.now() - _lastWriteErr < 3000) return;
  _lastWriteErr = Date.now();
  toast(e && e.code === 'permission-denied'
    ? 'Você não tem permissão para esta alteração — ela foi desfeita.'
    : 'Não foi possível salvar no servidor. Verifique a internet e tente de novo.', 'error');
}

// Grava um documento direto (cadastro do próprio perfil, contas criadas pela coordenação)
async function writeDocNow(c, obj) {
  const data = JSON.parse(JSON.stringify(obj));
  if (_hasDataUrl(data)) await _uploadImages(`uploads/${c}/${obj.id}`, data, obj);
  await fb.fs.collection(c).doc(obj.id).set(data);
  if (_sync.known[c]) _sync.known[c].set(obj.id, stableStringify(normalizeDoc(c, Object.assign({}, data))));
}

/* Carga inicial: inventário real e configurações completas (só a coordenação grava) */
async function ensureInitialData() {
  if (!isAdmin()) return;
  if (!window.db.resources.length && (window.LABEME_CATALOG || []).length) {
    const batch = fb.fs.batch();
    window.LABEME_CATALOG.forEach(c => batch.set(fb.fs.collection('resources').doc(c.id), JSON.parse(JSON.stringify(normalizeDoc('resources', { ...c })))));
    await batch.commit();
    toast(`Inventário carregado: ${window.LABEME_CATALOG.length} equipamentos.`, 'success');
  }
  // Grava os campos de configuração que ainda não existiam no banco
  const snap = await fb.fs.doc('settings/global').get();
  const cur = snap.exists ? snap.data() : {};
  const missing = Object.keys(DEFAULT_SETTINGS).filter(k => cur[k] === undefined);
  if (missing.length) await fb.fs.doc('settings/global').set(JSON.parse(JSON.stringify(window.db.settings)), { merge: true });
  // Migração única: a nova categoria "Graduação com vínculo" entra na lista de aprovação automática
  const done = Array.isArray(cur.migrations) ? cur.migrations : [];
  if (!done.includes('graduacao_vinculo')) {
    const list = Array.isArray(cur.autoApproveCategories) ? cur.autoApproveCategories.slice() : AUTO_APPROVE_CATEGORIES.slice();
    if (!list.includes('graduacao_vinculo')) list.unshift('graduacao_vinculo');
    await fb.fs.doc('settings/global').set({ autoApproveCategories: list, migrations: done.concat('graduacao_vinculo') }, { merge: true });
  }
}

/* Conta criada pela coordenação sem trocar a sessão atual (instância secundária do Firebase) */
async function createAuthAccount(email, password) {
  const sec = firebase.apps.find(a => a.name === 'secondary') || firebase.initializeApp(FIREBASE_CONFIG, 'secondary');
  const auth = sec.auth();
  await auth.setPersistence(firebase.auth.Auth.Persistence.NONE);
  const cred = await auth.createUserWithEmailAndPassword(email, password);
  const id = cred.user.uid;
  await auth.signOut();
  return id;
}

function storageUsage() { return { bytes: 0, kb: 0, pct: 0 }; }

function uid(prefix = 'id') {
  const a = new Uint8Array(6);
  (window.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach((_, i) => a[i] = Math.random() * 256);
  return prefix + '_' + Array.from(a, b => b.toString(36).padStart(2, '0')).join('').slice(0, 10);
}

function getResource(id) { return window.db.resources.find(r => r.id === id); }
function getUser(id) { return window.db.users.find(u => u.id === id); }
function getReservation(id) { return window.db.reservations.find(r => r.id === id); }
function getStockItem(id) { return window.db.stock.find(s => s.id === id); }

/* ---------- Auditoria ---------- */
function logReservation(r, action, extra = {}) {
  if (!Array.isArray(r.history)) r.history = [];
  r.history.push({ at: Date.now(), by: (typeof currentUser === 'function' && currentUser()?.id) || 'system', action, status: r.status, ...extra });
}

/* ---------- Manutenção automática (equipe técnica e coordenação, ao abrir o sistema) ----------
   - Pendentes cuja data já passou → canceladas (expiradas sem análise)
   - Aprovadas/em uso de dias anteriores sem foto obrigatória → concluídas
   - Com foto obrigatória e sem devolução → permanecem (aparecem como "devolução atrasada") */
function runHousekeeping() {
  if (typeof isTechnician !== 'function' || !isTechnician()) return 0;
  const today = todayISO();
  let changed = 0;
  window.db.reservations.forEach(r => {
    if (resEnd(r) >= today) return;
    if (r.status === 'pending') {
      r.status = 'cancelled'; r.cancelReason = 'Expirada sem análise';
      logReservation(r, 'auto_expired'); changed++;
    } else if (['approved','in_use'].includes(r.status) && !r.returnPhotoRequired) {
      r.status = 'completed'; logReservation(r, 'auto_completed'); changed++;
    }
  });
  if (changed) saveDB();
  return changed;
}
function isOverdueReturn(r) {
  return r.returnPhotoRequired && ['approved','in_use'].includes(r.status) && resEnd(r) < todayISO();
}

/* ---------- Backup (cópia local de segurança) ---------- */
function exportBackup() {
  const { passwordResets, ...data } = window.db;
  const json = JSON.stringify({ exportedAt: new Date().toISOString(), app: 'labeme-reservas', schema: SCHEMA_VERSION, db: data }, null, 1);
  downloadFile(`labeme-backup-${todayISO()}.json`, json, 'application/json');
  window.db.settings.lastBackupAt = Date.now();
  saveDB();
}

function sanitizeImported(d) {
  const clean = normalizeDB(d);
  const keep = (arr, ...idFields) => arr.filter(x => x && idFields.every(f => x[f] === undefined || x[f] === null || x[f] === '' || x[f] === 'custom' || x[f] === 'auto' || isSafeId(x[f])));
  clean.resources = keep(clean.resources, 'id');
  clean.reservations = keep(clean.reservations, 'id', 'userId', 'resourceId');
  clean.messages = keep(clean.messages, 'id', 'fromUserId', 'toUserId');
  clean.stock = keep(clean.stock, 'id', 'addedBy', 'professorId');
  return clean;
}

// Restaura recursos, reservas, estoque e configurações. As contas de usuário NÃO são alteradas
// (elas vivem no Firebase Authentication).
function importBackupFile(file, onDone) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const parsed = JSON.parse(e.target.result);
      const payload = parsed.db || parsed;
      if (!Array.isArray(payload.resources) || !Array.isArray(payload.reservations)) throw new Error('Arquivo não parece um backup do sistema.');
      const clean = sanitizeImported(payload);
      ['resources', 'reservations', 'stock'].forEach(c => { window.db[c] = clean[c]; });
      window.db.settings = clean.settings;
      saveDB();
      onDone && onDone(true);
    } catch (err) {
      toast('Falha ao importar: ' + err.message, 'error');
      onDone && onDone(false);
    }
  };
  reader.readAsText(file);
}

function hasLegacyData() { return false; }
async function importLegacyData() { return false; }
