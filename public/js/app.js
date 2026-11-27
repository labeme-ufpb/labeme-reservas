/* ============================================================
   app.js — Roteamento (com #hash), navegação móvel e inicialização (v10)
   ============================================================ */

const VIEWS = ['calendar','resources','stock','myres','messages','tech','admin','profile','auth','painel'];
const PROTECTED = { myres: 'user', profile: 'user', messages: 'user', stock: 'user', tech: 'tech', admin: 'admin', painel: 'user' };
let currentView = 'calendar';

function showView(name, { push = true } = {}) {
  if (!VIEWS.includes(name)) name = 'calendar';
  if (!currentUser() && name === 'auth' && equipFromHash()) window._afterLoginEquip = equipFromHash();
  const u = currentUser();
  const need = PROTECTED[name];
  // Nada é exibido sem login: visitante sempre cai na página de boas-vindas
  if (!u && name !== 'auth') { window._afterLogin = name; name = 'auth'; }
  else if (u && name === 'auth') name = homeViewFor(u);
  else if (need === 'tech' && !isTechnician()) { toast('Acesso restrito à equipe técnica.', 'warn'); name = 'calendar'; }
  else if (need === 'admin' && !isAdmin()) { toast('Acesso restrito à coordenação.', 'warn'); name = 'calendar'; }

  if (name !== 'painel' && typeof stopPanelTimers === 'function') stopPanelTimers();
  currentView = name;
  VIEWS.forEach(v => document.body.classList.toggle('view-' + v, v === name));
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + name));
  document.querySelectorAll('.nav-links a[data-view]').forEach(a => {
    const on = a.dataset.view === name;
    a.classList.toggle('active', on);
    on ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current');
  });
  closeMobileNav();
  if (push && location.hash !== '#' + name) { try { history.pushState(null, '', '#' + name); } catch (_) {} }
  renderView(name);
  const titles = { calendar: 'Calendário', resources: 'Equipamentos', stock: 'Estoque', myres: 'Minhas reservas', messages: 'Mensagens', tech: 'Painel técnico', admin: 'Coordenação', profile: 'Meu perfil', auth: 'Bem-vindo', painel: 'Hoje no LABEME' };
  document.title = `${titles[name]} · LABEME Reservas`;
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}

function renderView(name) {
  ({
    calendar: renderCalendar, resources: renderResources, stock: renderStock, myres: renderMyReservations,
    messages: renderMessages, tech: renderTechDashboard, admin: renderAdmin, profile: renderProfile, painel: renderPanel,
    auth: () => setAuthTab('login')
  })[name]?.();
}
function refreshCurrentView() {
  updateNavBadges();
  if (currentView !== 'auth' && currentView !== 'profile') renderView(currentView);
}
// Chamado quando outra aba altera os dados
function onExternalDataChange() {
  if (!document.getElementById('modalOverlay').classList.contains('show')) {
    const el = document.activeElement;   // só conta como digitando se o campo estiver visível
    const typing = el && ['INPUT','TEXTAREA'].includes(el.tagName) && el.offsetParent !== null;
    if (!typing || currentView === 'painel') refreshCurrentView(); else updateNavBadges();
  } else updateNavBadges();
  checkAnnouncements();   // aviso publicado enquanto o usuário está com o sistema aberto
}

/* ---------- Navegação móvel ---------- */
function toggleMobileNav() {
  const open = document.body.classList.toggle('nav-open');
  document.getElementById('navToggle').setAttribute('aria-expanded', open);
}
// Usa a gaveta quando o menu não cabe (depende do papel do usuário e da largura)
function fitNav() {
  const body = document.body, bar = document.querySelector('.topbar-inner');
  if (!bar) return;
  if (window.innerWidth <= 720) { body.classList.add('nav-compact'); return; }
  body.classList.remove('nav-compact');
  if (bar.scrollWidth > bar.clientWidth + 1) body.classList.add('nav-compact');
  else closeMobileNav();
}
function closeMobileNav() {
  document.body.classList.remove('nav-open');
  document.getElementById('navToggle')?.setAttribute('aria-expanded', 'false');
}
function dismissDemoBanner() {
  document.getElementById('demoBanner').hidden = true;
  try { sessionStorage.setItem('labeme_demo_dismissed', '1'); } catch (_) {}
}

/* ---------- Inicialização ---------- */
window.db = emptyDB();

// Garante o perfil (users/{uid}) ANTES de ligar a sincronização: sem perfil, as regras bloqueiam a leitura
async function ensureOwnProfile(fbUser) {
  const ref = fb.fs.collection('users').doc(fbUser.uid);
  const snap = await ref.get();
  if (snap.exists) return false;
  const p = window._signupProfile && window._signupProfile.email === (fbUser.email || '').toLowerCase()
    ? window._signupProfile
    : { name: (fbUser.email || 'Usuário').split('@')[0], email: (fbUser.email || '').toLowerCase(), phone: '', category: '', advisor: '', institution: '',
        role: 'user', active: true, avatar: null, profileReminderShown: false, createdAt: Date.now(), incomplete: true };
  window._signupProfile = null;
  // O perfil é gravado ANTES da foto: as regras só aceitam fotos de quem já tem perfil.
  // (Até a v11.9 a foto ia primeiro, era recusada e o cadastro se perdia: a conta ficava sem vínculo,
  //  orientador, instituição e WhatsApp.)
  const avatar = p.avatar; p.avatar = null;
  await writeDocNow('users', Object.assign({ id: fbUser.uid }, p));
  if (avatar && /^data:image\//.test(avatar)) {
    try {
      const ref = await storePhoto(avatar);
      await fb.fs.collection('users').doc(fbUser.uid).update({ avatar: ref, profileReminderShown: true });
    } catch (e) { console.warn('Foto do cadastro não gravada:', e); }   // sem foto: o lembrete pede depois
  }
  return true;
}

let _bootDone = false;
async function onAuthChanged(fbUser) {
  if (!fbUser) {
    if (typeof closeProfileGate === 'function') closeProfileGate();
    // link direto para uma tela (ex.: …/#painel na TV): abre depois de entrar
    { const h = (location.hash || '').slice(1); if (!_bootDone && VIEWS.includes(h) && h !== 'auth') window._afterLogin = h; }
    stopSync();
    const settings = window.db.settings;
    window.db = emptyDB(); window.db.settings = settings;
    refreshAuthUI();
    showView('auth', { push: _bootDone });
    finishBoot();
    return;
  }
  document.body.classList.add('loading-data');
  try {
    const isNew = await ensureOwnProfile(fbUser);
    await startSync(fbUser.uid);
    const u = getUser(fbUser.uid);
    if (!u) throw new Error('perfil não encontrado');
    if (u.active === false) {
      toast('Conta desativada. Procure a coordenação do LABEME.', 'error');
      await fb.auth.signOut();
      return;
    }
    let merged = false;
    if (window._signupMerge) {
      const m = window._signupMerge; window._signupMerge = null; window._signupProfile = null;
      if (m.email === (fbUser.email || '').toLowerCase()) merged = await applySignupMerge(u, m);
    }
    const existingLogin = window._existingLogin; window._existingLogin = false;
    await ensureInitialData();
    runHousekeeping();
    // último acesso (no máximo 1 gravação por hora)
    if (!u.lastLoginAt || Date.now() - u.lastLoginAt > 36e5) { u.lastLoginAt = Date.now(); saveDB(); }
    resetCalendarPrefs(u);
    refreshAuthUI();
    if (_bootDone) toast(isNew ? 'Cadastro realizado!'
      : existingLogin ? `Você já tinha conta no LABEME — entramos nela${merged ? ' e completamos seus dados' : ''}. Bem-vindo(a), ${firstName(u.name)}!`
      : `Bem-vindo(a), ${firstName(u.name)}!`, 'success');
    const fromHash = (location.hash || '').slice(1);
    const equip = window._afterLoginEquip || equipFromHash(); window._afterLoginEquip = null;
    const pending = window._afterLogin; window._afterLogin = null;
    const target = pending || (!_bootDone && VIEWS.includes(fromHash) && fromHash !== 'auth' ? fromHash : null) || (u.incomplete ? 'profile' : homeViewFor(u));
    if (equip) openEquipFromLink(equip);          // veio pelo QR code do equipamento
    else showView(target, { push: _bootDone });
    _annShown.clear(); _wlShown.clear();
    if (currentView === 'painel') { /* modo TV: sem janelas por cima do painel */ }
    else if (profileMissing(u).length) { closeModal(); showProfileGate(); }   // cadastro incompleto: completar antes de usar
    else setTimeout(() => {
      checkAnnouncements();   // avisos da coordenação têm prioridade
      maybeShowPhotoReminder();
    }, 500);
  } catch (e) {
    console.error(e);
    toast('Não foi possível carregar os dados: ' + (e.message || e), 'error');
  } finally {
    document.body.classList.remove('loading-data');
    finishBoot();
  }
}
function finishBoot() {
  if (_bootDone) return;
  _bootDone = true;
  fitNav();
  document.body.classList.add('ready');
}

window.addEventListener('DOMContentLoaded', async () => {
  initFirebase();
  document.getElementById('demoBanner').hidden = true;
  document.getElementById('demoCreds').hidden = true;

  document.getElementById('modalOverlay').addEventListener('mousedown', e => { if (e.target.id === 'modalOverlay') { window._confirmResolve ? _confirmResolve(null) : closeModal(); } });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (document.getElementById('modalOverlay').classList.contains('show')) { window._confirmResolve ? _confirmResolve(null) : closeModal(); }
    else closeMobileNav();
  });
  window.addEventListener('popstate', () => {
    const equip = equipFromHash();
    if (equip && currentUser()) return openEquipFromLink(equip);
    showView((location.hash || '#calendar').slice(1), { push: false });
  });
  // vaga da lista de espera que abre por tempo (prioridade do 1º da fila venceu)
  setInterval(() => { if (currentUser() && isSynced() && !document.hidden) checkAnnouncements(); }, 5 * 60 * 1000);
  window.matchMedia('(max-width: 720px)').addEventListener?.('change', e => { if (e.matches && calView === 'month') { calView = 'agenda'; calDate = new Date(); if (currentView === 'calendar') renderCalendar(); } });
  window.addEventListener('resize', debounce(fitNav, 120));

  refreshAuthUI();
  loadPublicSettings();
  fb.auth.onAuthStateChanged(onAuthChanged);
});
