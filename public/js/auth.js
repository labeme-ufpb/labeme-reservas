/* ============================================================
   auth.js — Autenticação, cadastro e sessão (v10)
   - Senhas com hash (security.js)
   - Bloqueio após 5 tentativas
   - Contas desativadas não entram
   - Aceite das normas do laboratório no cadastro
   ============================================================ */

// Sessão: mantida pelo Firebase Authentication (continua aberta ao fechar o navegador)
function authUid() { return (fb && fb.auth.currentUser) ? fb.auth.currentUser.uid : null; }
function currentUser() {
  const id = authUid(); if (!id) return null;
  const u = getUser(id);
  if (!u || u.active === false) return null;
  return u;
}
function isAdmin() { return currentUser()?.role === 'admin'; }
function isTechnician() { const r = currentUser()?.role; return r === 'technician' || r === 'admin'; }
function canApproveReservations() { return isTechnician(); }
function homeViewFor(u) { return u?.role === 'admin' ? 'admin' : u?.role === 'technician' ? 'tech' : 'calendar'; }

// Mensagens de erro do Firebase em português
function authErrorMessage(e) {
  const m = {
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/wrong-password': 'E-mail ou senha incorretos.',
    'auth/user-not-found': 'E-mail ou senha incorretos.',
    'auth/invalid-email': 'E-mail inválido.',
    'auth/user-disabled': 'Conta desativada. Procure a coordenação do LABEME.',
    'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos ou use "Esqueci minha senha".',
    'auth/email-already-in-use': 'E-mail já cadastrado. Use "Esqueci minha senha".',
    'auth/weak-password': 'Senha fraca: use pelo menos 8 caracteres, com letras e números.',
    'auth/network-request-failed': 'Sem conexão com a internet.',
    'auth/requires-recent-login': 'Por segurança, saia e entre de novo antes de trocar a senha.'
  };
  if (e && /requests-from-referer|api-key-not-valid|unauthorized-domain/.test(e.code || '')) return 'O site ainda não está autorizado no Firebase. Avise a coordenação do LABEME.';
  return m[e && e.code] || ('Não foi possível concluir: ' + (e && e.message || 'erro desconhecido'));
}

function setAuthTab(tab) {
  document.getElementById('tabLogin').classList.toggle('active', tab === 'login');
  document.getElementById('tabSignup').classList.toggle('active', tab === 'signup');
  document.getElementById('tabLogin').setAttribute('aria-selected', tab === 'login');
  document.getElementById('tabSignup').setAttribute('aria-selected', tab === 'signup');
  document.getElementById('loginForm').hidden = tab !== 'login';
  document.getElementById('signupForm').hidden = tab !== 'signup';
  if (tab === 'signup') {
    const rules = document.getElementById('suRulesText');
    if (rules) rules.innerHTML = rulesHtml(window.db.settings.labRules || '');
  }
}

function onCategoryChange() {
  const cat = document.getElementById('suCategory').value;
  document.getElementById('advisorField').hidden = !ADVISOR_CATEGORIES.includes(cat);
  document.getElementById('institutionField').hidden = !EXTERNAL_CATEGORIES.includes(cat);
}

function onSignupAvatarChange(e) {
  cropAvatarFile(e.target).then(dataUrl => {
    if (!dataUrl) return;
    window._signupAvatar = dataUrl;
    const prev = document.getElementById('suAvatarPreview');
    prev.src = dataUrl; prev.hidden = false;
    document.getElementById('suAvatarText').textContent = 'Foto carregada — clique para trocar';
    document.getElementById('suAvatarLabel').classList.add('has-file');
  }).catch(err => toast(err.message, 'error'));
}

async function doLogin(ev) {
  ev?.preventDefault?.();
  const email = document.getElementById('loginEmail').value.trim().toLowerCase();
  const pwd = document.getElementById('loginPwd').value;
  if (!email || !pwd) return toast('Informe e-mail e senha.', 'error');
  const btn = document.getElementById('loginBtn'); if (btn) { btn.disabled = true; btn.textContent = 'Entrando…'; }
  try {
    await fb.auth.signInWithEmailAndPassword(email, pwd);
    document.getElementById('loginPwd').value = '';
    // o restante (carregar dados, abrir a tela inicial) acontece em onAuthChanged (app.js)
  } catch (e) {
    toast(authErrorMessage(e), 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Entrar'; }
  }
}

async function doSignup(ev) {
  ev?.preventDefault?.();
  const val = id => document.getElementById(id).value.trim();
  const name = val('suName'), email = val('suEmail').toLowerCase(), phone = val('suPhone');
  const category = val('suCategory'), advisor = val('suAdvisor'), institution = val('suInstitution');
  const pwd = document.getElementById('suPwd').value, pwdConfirm = document.getElementById('suPwdConfirm').value;
  const accepted = document.getElementById('suAcceptRules').checked;

  if (!name || !email || !phone || !category || !pwd) return toast('Preencha todos os campos obrigatórios (*).', 'error');
  if (name.split(/\s+/).length < 2) return toast('Informe nome e sobrenome.', 'error');
  if (!validEmail(email)) return toast('E-mail inválido.', 'error');
  if (!validPhone(phone)) return toast('Informe o WhatsApp com DDD, por exemplo (83) 99999-9999.', 'error');
  if (!SELF_CATEGORIES.includes(category)) return toast('Selecione o seu vínculo.', 'error');
  const prob = passwordProblem(pwd); if (prob) return toast(prob, 'error');
  if (pwd !== pwdConfirm) return toast('As senhas não coincidem.', 'error');
  if (ADVISOR_CATEGORIES.includes(category) && !advisor) return toast('Informe o(a) orientador(a).', 'error');
  if (EXTERNAL_CATEGORIES.includes(category) && !institution) return toast('Informe a instituição.', 'error');
  if (!accepted) return toast('É preciso aceitar as normas de uso do laboratório.', 'error');

  // Auto-cadastro NUNCA concede papel elevado — a coordenação promove manualmente (e as regras do servidor garantem).
  window._signupProfile = {
    name, email, phone, category, advisor, institution,
    role: 'user', active: true,
    avatar: window._signupAvatar || null,
    profileReminderShown: !!window._signupAvatar,
    rulesAcceptedAt: Date.now(),
    createdAt: Date.now()
  };
  const btn = document.querySelector('#signupForm button[type=submit]'); if (btn) btn.disabled = true;
  try {
    await fb.auth.createUserWithEmailAndPassword(email, pwd);
    window._signupAvatar = null;
    ['suName','suEmail','suPhone','suAdvisor','suInstitution','suPwd','suPwdConfirm'].forEach(id => document.getElementById(id).value = '');
    // o perfil é gravado em onAuthChanged (app.js), assim que a conta existe
  } catch (e) {
    if (e && e.code === 'auth/email-already-in-use') { await handleExistingAccount(email, pwd); return; }
    window._signupProfile = null;
    toast(authErrorMessage(e), 'error');
  } finally { if (btn) btn.disabled = false; }
}

/* O e-mail já tem conta (criada pela coordenação em "Cadastrar usuário" ou num cadastro anterior).
   v11.12: em vez de só dizer "já cadastrado", tenta entrar com a senha digitada; se não der,
   explica e oferece "Entrar" ou o link para criar a senha. Os dados preenchidos completam
   o perfil ao entrar (só campos vazios — nada do que a coordenação definiu é trocado). */
async function handleExistingAccount(email, pwd) {
  window._signupMerge = Object.assign({}, window._signupProfile);   // _signupProfile fica: recria o perfil se ele tiver sido excluído
  try {
    await fb.auth.signInWithEmailAndPassword(email, pwd);   // mesma senha: entra direto (onAuthChanged completa os dados)
    window._existingLogin = true;
    return;
  } catch (e) {
    const wrongPwd = ['auth/invalid-credential', 'auth/wrong-password', 'auth/invalid-login-credentials', 'auth/user-not-found'].includes(e && e.code);
    if (!wrongPwd && e && e.code !== 'auth/too-many-requests') { window._signupMerge = null; return toast(authErrorMessage(e), 'error'); }
  }
  showExistingAccountModal(email);
}
function showExistingAccountModal(email) {
  openModal(`
    <div class="modal-head"><div><div class="modal-title">Este e-mail já tem conta</div>
      <div class="modal-sub">Não é preciso criar outra.</div></div>
      <button class="modal-close" onclick="closeModal()" aria-label="Fechar">${icon('x')}</button></div>
    <div class="modal-body">
      <div class="info-box"><strong>${escapeHtml(email)}</strong> já está cadastrado no LABEME. A conta pode ter sido criada pela coordenação do laboratório ou num cadastro anterior seu.</div>
      <p style="margin-top:12px;"><strong>Sabe a senha?</strong> Toque em <strong>Entrar</strong>.</p>
      <p><strong>Não sabe ou nunca criou uma senha?</strong> Receba um link por e-mail para criar a sua e depois entre normalmente.</p>
      <p class="small muted">Ao entrar, o sistema pede o que ainda estiver faltando no cadastro (WhatsApp, vínculo…).</p>
      <p class="small muted">Se a coordenação excluiu sua conta há pouco, aguarde uns 15 minutos e tente criar a conta de novo.</p>
    </div>
    <div class="modal-foot">
      <button class="btn" onclick="goToLoginWith('${escapeHtml(email)}')">Entrar</button>
      <button class="btn dark" onclick="sendExistingAccountLink('${escapeHtml(email)}')">${icon('key', 16)} Enviar link para criar senha</button>
    </div>`);
}
function goToLoginWith(email) {
  closeModal(); setAuthTab('login');
  const le = document.getElementById('loginEmail'); if (le) le.value = email;
  setTimeout(() => document.getElementById('loginPwd')?.focus(), 50);
}
async function sendExistingAccountLink(email) {
  closeModal();
  try { await sendResetEmail(email); }
  catch (e) { if (e.code !== 'auth/user-not-found') { console.error(e); return toast(authErrorMessage(e), 'error'); } }
  showGenericResetResponse(email);
  setAuthTab('login');
  const le = document.getElementById('loginEmail'); if (le) le.value = email;
}

/* Completa o perfil com o que a pessoa preencheu no formulário de cadastro (só o que estiver vazio) */
async function applySignupMerge(u, m) {
  const ch = {};
  if ((!u.name || String(u.name).trim().split(/\s+/).length < 2) && m.name) ch.name = m.name;
  if (!validPhone(u.phone) && validPhone(m.phone)) ch.phone = m.phone;
  if (!u.category && SELF_CATEGORIES.includes(m.category)) ch.category = m.category;
  const cat = ch.category || u.category;
  if (ADVISOR_CATEGORIES.includes(cat) && !String(u.advisor || '').trim() && m.advisor) ch.advisor = m.advisor;
  if (EXTERNAL_CATEGORIES.includes(cat) && !String(u.institution || '').trim() && m.institution) ch.institution = m.institution;
  if (!u.rulesAcceptedAt && m.rulesAcceptedAt) ch.rulesAcceptedAt = m.rulesAcceptedAt;
  if (!Object.keys(ch).length) return false;
  const prev = {}; Object.keys(ch).forEach(k => { prev[k] = u[k]; });
  const wasIncomplete = u.incomplete;
  Object.assign(u, ch);
  if (u.incomplete && !profileMissing(u).length) delete u.incomplete;
  try { await writeDocNow('users', u); }
  catch (e) {
    console.warn('Dados do cadastro não aplicados:', e);
    Object.assign(u, prev); if (wasIncomplete) u.incomplete = wasIncomplete;
    return false;
  }
  if (!u.avatar && m.avatar && /^data:image\//.test(m.avatar)) {
    try { const ref = await storePhoto(m.avatar); u.avatar = ref; u.profileReminderShown = true; await fb.fs.collection('users').doc(u.id).update({ avatar: ref, profileReminderShown: true }); }
    catch (e) { console.warn('Foto do cadastro não gravada:', e); }
  }
  return true;
}

function doLogout() {
  closeMobileNav();
  forgetPhotoReminder();   // na próxima entrada (mesmo nesta aba) o lembrete da foto volta
  window._afterLogin = null;
  fb.auth.signOut().then(() => toast('Sessão encerrada.'));
}

function refreshAuthUI() {
  const u = currentUser();
  const show = (id, cond) => { const el = document.getElementById(id); if (el) el.hidden = !cond; };
  show('nav-auth', !u);
  show('nav-logout', !!u);
  show('nav-myres', !!u);
  show('nav-profile', !!u);
  show('nav-messages', !!u);
  show('nav-stock', !!u);
  show('nav-tech', u && (u.role === 'technician' || u.role === 'admin'));
  show('nav-admin', u && u.role === 'admin');
  document.body.classList.toggle('logged-in', !!u);
  // Tema por perfil: vale para TODAS as abas (a coordenação mantém o próprio tema até no Painel técnico)
  document.body.classList.toggle('role-admin', u?.role === 'admin');
  document.body.classList.toggle('role-technician', u?.role === 'technician');
  const chip = document.getElementById('roleChip');
  if (chip) { chip.hidden = !u || u.role === 'user'; chip.textContent = u?.role === 'admin' ? 'Coordenação' : u?.role === 'technician' ? 'Equipe técnica' : ''; }
  const meta = document.querySelector('meta[name=theme-color]');
  if (meta) meta.content = u?.role === 'technician' ? '#04592c' : '#092B4D';

  const slot = document.getElementById('userAvatarSlot');
  if (slot) slot.innerHTML = u ? renderAvatar(u, 'small', { zoom: false }) : '';
  const label = document.getElementById('userNameLabel');
  if (label) label.textContent = u ? shortName(u.name, 3) : '';
  const prof = document.getElementById('nav-profile');
  if (prof && u) prof.title = `${u.name} — ${ROLE_LABELS[u.role] || ''}`;
  updateNavBadges();
  if (typeof fitNav === 'function') fitNav();
}

function updateNavBadges() {
  const u = currentUser();
  const setBadge = (id, n) => {
    const el = document.getElementById(id); if (!el) return;
    el.textContent = n; el.hidden = !n;
  };
  if (!u) {
    setBadge('msgNavBadge', 0); setBadge('techNavBadge', 0); setBadge('adminNavBadge', 0);
    const d = document.getElementById('adminNavBadgeMobile'); if (d) d.hidden = true;
    return;
  }
  const unread = window.db.messages.filter(m => m.toUserId === u.id && !m.readAt).length;
  setBadge('msgNavBadge', unread);
  const pending = window.db.reservations.filter(r => r.status === 'pending').length;
  const awaiting = window.db.reservations.filter(r => r.status === 'awaiting_return').length;
  setBadge('techNavBadge', isTechnician() ? pending + awaiting : 0);
  setBadge('adminNavBadge', isAdmin() ? pending + awaiting : 0);
  const dot = document.getElementById('adminNavBadgeMobile');
  if (dot) dot.hidden = !(unread || (isTechnician() && pending + awaiting));
}

/* ---------- Lembrete de foto ----------
   v11.17: quem está sem foto de perfil é lembrado a cada entrada no sistema (uma vez por sessão:
   abrir o site/app de novo ou entrar após "Sair" conta como nova entrada). */
const _PHOTO_REMINDER_KEY = 'labemePhotoReminder';
let _photoRemindedUid = null;   // reserva, se o navegador bloquear o sessionStorage
function photoReminderDue(u) {
  if (!u || u.avatar) return false;
  try { return sessionStorage.getItem(_PHOTO_REMINDER_KEY) !== u.id; } catch { return _photoRemindedUid !== u.id; }
}
function markPhotoReminded(u) {
  _photoRemindedUid = u.id;
  try { sessionStorage.setItem(_PHOTO_REMINDER_KEY, u.id); } catch {}
}
function forgetPhotoReminder() {
  _photoRemindedUid = null;
  try { sessionStorage.removeItem(_PHOTO_REMINDER_KEY); } catch {}
}
function maybeShowPhotoReminder() {
  const u = currentUser();
  if (currentView === 'painel' || modalIsOpen() || !photoReminderDue(u)) return;
  showProfilePhotoReminder();
}
function showProfilePhotoReminder() {
  const u = currentUser();
  if (!u || u.avatar) return;
  markPhotoReminded(u);
  openModal(`
    <div class="modal-head">
      <div><div class="modal-title">Adicione uma foto de perfil</div>
      <div class="modal-sub">Ajuda a equipe técnica a identificar você no laboratório</div></div>
      <button class="modal-close" onclick="dismissProfileReminder()" aria-label="Fechar">${icon('x')}</button>
    </div>
    <div class="modal-body">
      <div class="info-box">A foto facilita o reconhecimento na retirada de equipamentos e materiais. Enquanto o seu perfil estiver sem foto, este lembrete aparece a cada entrada no sistema.</div>
      <label class="file-upload" id="reminderPhotoLabel">
        <input type="file" id="reminderPhotoInput" accept="image/*" onchange="onReminderPhotoChange(event)">
        <div id="reminderPhotoText">${icon('camera')} Escolher foto</div>
      </label>
      <img id="reminderPhotoPreview" class="file-preview" hidden alt="Prévia">
    </div>
    <div class="modal-foot">
      <button class="btn" onclick="dismissProfileReminder()">Mais tarde</button>
      <button class="btn dark" id="reminderSaveBtn" onclick="saveReminderPhoto()" disabled>Salvar foto</button>
    </div>`);
}
function onReminderPhotoChange(e) {
  cropAvatarFile(e.target).then(dataUrl => {
    if (!dataUrl) return;
    window._reminderPhoto = dataUrl;
    const p = document.getElementById('reminderPhotoPreview'); p.src = dataUrl; p.hidden = false;
    document.getElementById('reminderPhotoText').textContent = 'Foto selecionada';
    document.getElementById('reminderPhotoLabel').classList.add('has-file');
    document.getElementById('reminderSaveBtn').disabled = false;
  }).catch(err => toast(err.message, 'error'));
}
function saveReminderPhoto() {
  const u = currentUser(); if (!u || !window._reminderPhoto) return;
  u.avatar = window._reminderPhoto; u.profileReminderShown = true;
  saveDB(); window._reminderPhoto = null;
  closeModal(); toast('Foto de perfil salva!', 'success'); refreshAuthUI();
}
function dismissProfileReminder() {
  const u = currentUser(); if (u) { u.profileReminderShown = true; saveDB(); }
  closeModal();
}
