/* ============================================================
   db.js — Camada de persistência em Firebase (v5)
   - GitHub Pages + Firebase Auth + Firestore + Storage
   - Mantém window.db em memória para preservar a interface atual
   ============================================================ */

const DEFAULT_SETTINGS = {
  minAdvanceHours: 24,
  maxAdvanceDays: 30,
  notifyEmail: true,
  labName: 'LABEME — UFPB',
  adminEmail: 'labeme@ct.ufpb.br',
  turnoManha: { start: '08:00', end: '12:00' },
  turnoTarde: { start: '14:00', end: '17:00' }
};

const EMPTY_DB = {
  users: [],
  resources: [],
  reservations: [],
  messages: [],
  stock: [],
  settings: { ...DEFAULT_SETTINGS }
};

window.db = structuredCloneSafe(EMPTY_DB);

let fbApp = null;
let fbAuth = null;
let fbStore = null;
let fbStorage = null;
let publicUnsubs = [];
let privateUnsubs = [];
let privateSyncStarted = false;
let publicSyncStarted = false;
let saveInProgress = false;
let lastSynced = {
  users: [], resources: [], reservations: [], messages: [], stock: [],
  settings: { ...DEFAULT_SETTINGS }
};

function structuredCloneSafe(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function sanitizeForFirestore(obj, collectionName = '') {
  const copy = structuredCloneSafe(obj || {});
  Object.keys(copy).forEach(k => {
    if (copy[k] === undefined) delete copy[k];
  });
  // Senhas nunca devem ser salvas no Firestore.
  if (collectionName === 'users') delete copy.password;
  return copy;
}

function deepEqual(a, b) {
  return JSON.stringify(a || null) === JSON.stringify(b || null);
}

function ensureFirebase() {
  if (fbApp) return true;
  if (!window.firebase || !window.firebaseConfig) {
    console.error('Firebase SDK/config não carregados.');
    return false;
  }
  try {
    fbApp = firebase.apps.length ? firebase.app() : firebase.initializeApp(window.firebaseConfig);
    fbAuth = firebase.auth();
    fbStore = firebase.firestore();
    fbStorage = firebase.storage();
    window.firebaseApp = fbApp;
    window.firebaseAuth = fbAuth;
    window.firebaseStore = fbStore;
    window.firebaseStorage = fbStorage;
    return true;
  } catch (err) {
    console.error('Erro ao iniciar Firebase:', err);
    return false;
  }
}

function loadDB() {
  ensureFirebase();
  startPublicDataSync();
  return window.db;
}

function startPublicDataSync() {
  if (!ensureFirebase() || publicSyncStarted) return;
  publicSyncStarted = true;

  // Recursos ficam disponíveis para a tela pública de equipamentos.
  publicUnsubs.push(
    fbStore.collection('resources').onSnapshot(snapshot => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      window.db.resources = data;
      lastSynced.resources = structuredCloneSafe(data);
      refreshVisibleUI('resources');
    }, err => console.warn('Sem permissão/leitura para resources:', err.message))
  );

  // Configuração global.
  publicUnsubs.push(
    fbStore.collection('settings').doc('global').onSnapshot(doc => {
      const data = doc.exists ? doc.data() : {};
      window.db.settings = { ...DEFAULT_SETTINGS, ...data };
      lastSynced.settings = structuredCloneSafe(window.db.settings);
      refreshVisibleUI('settings');
    }, err => console.warn('Sem permissão/leitura para settings:', err.message))
  );
}

function startPrivateDataSync() {
  if (!ensureFirebase() || privateSyncStarted) return;
  if (!fbAuth.currentUser) return;
  privateSyncStarted = true;

  ['users', 'reservations', 'messages', 'stock'].forEach(collectionName => {
    const unsub = fbStore.collection(collectionName).onSnapshot(snapshot => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      window.db[collectionName] = data;
      lastSynced[collectionName] = structuredCloneSafe(data);
      refreshVisibleUI(collectionName);
    }, err => console.warn(`Sem permissão/leitura para ${collectionName}:`, err.message));
    privateUnsubs.push(unsub);
  });
}

function stopPrivateDataSync() {
  privateUnsubs.forEach(fn => { try { fn(); } catch(e) {} });
  privateUnsubs = [];
  privateSyncStarted = false;
  window.db.users = [];
  window.db.reservations = [];
  window.db.messages = [];
  window.db.stock = [];
  lastSynced.users = [];
  lastSynced.reservations = [];
  lastSynced.messages = [];
  lastSynced.stock = [];
  refreshVisibleUI('auth');
}

function refreshVisibleUI(source = '') {
  if (typeof refreshAuthUI === 'function') refreshAuthUI();

  const overlay = document.getElementById('modalOverlay');
  const modalOpen = overlay && overlay.classList.contains('show');
  if (modalOpen) return;

  const active = document.querySelector('.view.active');
  const id = active ? active.id.replace('view-', '') : '';

  try {
    if (id === 'calendar' && typeof renderCalendar === 'function') renderCalendar();
    if (id === 'resources' && typeof renderResources === 'function') renderResources();
    if (id === 'myres' && typeof renderMyReservations === 'function' && currentUser()) renderMyReservations();
    if (id === 'profile' && typeof renderProfile === 'function' && currentUser()) renderProfile();
    if (id === 'messages' && typeof renderMessages === 'function' && currentUser()) renderMessages();
    if (id === 'stock' && typeof renderStock === 'function' && currentUser()) renderStock();
    if (id === 'tech' && typeof renderTechDashboard === 'function' && currentUser()) renderTechDashboard();
    if (id === 'admin' && typeof renderAdmin === 'function' && currentUser()) renderAdmin();
  } catch (err) {
    console.warn('Falha ao atualizar UI após snapshot Firebase:', source, err);
  }
}

async function syncCollection(collectionName) {
  if (!ensureFirebase()) return;
  const current = window.db[collectionName] || [];
  const previous = lastSynced[collectionName] || [];
  const colRef = fbStore.collection(collectionName);
  const batch = fbStore.batch();
  let ops = 0;

  const currentMap = new Map(current.filter(x => x && x.id).map(x => [x.id, sanitizeForFirestore(x, collectionName)]));
  const previousMap = new Map(previous.filter(x => x && x.id).map(x => [x.id, sanitizeForFirestore(x, collectionName)]));

  currentMap.forEach((doc, id) => {
    if (!deepEqual(doc, previousMap.get(id))) {
      batch.set(colRef.doc(id), doc);
      ops++;
    }
  });

  previousMap.forEach((doc, id) => {
    if (!currentMap.has(id)) {
      batch.delete(colRef.doc(id));
      ops++;
    }
  });

  if (ops > 0) await batch.commit();
}

async function saveDB() {
  if (!ensureFirebase()) return;
  if (saveInProgress) return;
  saveInProgress = true;
  try {
    await syncCollection('users');
    await syncCollection('resources');
    await syncCollection('reservations');
    await syncCollection('messages');
    await syncCollection('stock');

    const settings = sanitizeForFirestore(window.db.settings || DEFAULT_SETTINGS, 'settings');
    if (!deepEqual(settings, lastSynced.settings)) {
      await fbStore.collection('settings').doc('global').set(settings);
    }
  } catch (err) {
    console.error('Erro ao salvar no Firebase:', err);
    if (typeof toast === 'function') {
      toast('Erro ao salvar no Firebase. Verifique regras/permissões.', 'error');
    }
  } finally {
    saveInProgress = false;
  }
}

function uid(prefix='id') {
  if (window.crypto && crypto.randomUUID) return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
  return prefix + '_' + Math.random().toString(36).slice(2, 10);
}

function getResource(id) { return window.db.resources.find(r => r.id === id); }
function getUser(id) { return window.db.users.find(u => u.id === id); }
function getReservation(id) { return window.db.reservations.find(r => r.id === id); }
function getStockItem(id) { return window.db.stock.find(s => s.id === id); }

async function fetchUserDoc(uidValue) {
  if (!ensureFirebase() || !uidValue) return null;
  const snap = await fbStore.collection('users').doc(uidValue).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

async function createAuthAccount(email, password) {
  if (!ensureFirebase()) throw new Error('Firebase não inicializado.');
  const appName = 'SecondaryAuth_' + Date.now();
  const secondaryApp = firebase.initializeApp(window.firebaseConfig, appName);
  try {
    const cred = await secondaryApp.auth().createUserWithEmailAndPassword(email, password);
    return cred.user.uid;
  } finally {
    try { await secondaryApp.delete(); } catch(e) {}
  }
}

async function sendPasswordReset(email) {
  if (!ensureFirebase()) throw new Error('Firebase não inicializado.');
  return fbAuth.sendPasswordResetEmail(email);
}

async function uploadFileToStorage(file, folder='uploads') {
  if (!ensureFirebase() || !file) return null;
  const user = fbAuth.currentUser;
  if (!user) return null;
  const safeName = (file.name || 'arquivo.jpg').replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${folder}/${user.uid}/${Date.now()}_${safeName}`;
  const ref = fbStorage.ref(path);
  const snapshot = await ref.put(file, { contentType: file.type || 'application/octet-stream' });
  return snapshot.ref.getDownloadURL();
}

async function wipeFirestoreData() {
  if (!ensureFirebase()) return;
  if (!confirm('Apagar recursos, reservas, mensagens, estoque e configurações do Firestore? Esta ação não remove usuários do Authentication.')) return;
  for (const collectionName of ['resources', 'reservations', 'messages', 'stock']) {
    const snap = await fbStore.collection(collectionName).get();
    const batch = fbStore.batch();
    snap.docs.forEach(doc => batch.delete(doc.ref));
    if (!snap.empty) await batch.commit();
  }
  await fbStore.collection('settings').doc('global').set({ ...DEFAULT_SETTINGS });
  if (typeof toast === 'function') toast('Dados operacionais apagados. Usuários foram preservados.', 'warn');
}

window.DEFAULT_SETTINGS = DEFAULT_SETTINGS;
window.loadDB = loadDB;
window.saveDB = saveDB;
window.startPublicDataSync = startPublicDataSync;
window.startPrivateDataSync = startPrivateDataSync;
window.stopPrivateDataSync = stopPrivateDataSync;
window.uid = uid;
window.getResource = getResource;
window.getUser = getUser;
window.getReservation = getReservation;
window.getStockItem = getStockItem;
window.fetchUserDoc = fetchUserDoc;
window.createAuthAccount = createAuthAccount;
window.sendPasswordReset = sendPasswordReset;
window.uploadFileToStorage = uploadFileToStorage;
window.wipeFirestoreData = wipeFirestoreData;
