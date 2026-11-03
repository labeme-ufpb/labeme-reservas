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
    if (rules) rules.textContent = window.db.settings.labRules || '';
  }
}

function onCategoryChange() {
  const cat = document.getElementById('suCategory').value;
  document.getElementById('advisorField').hidden = !STUDENT_CATEGORIES.includes(cat);
  document.getElementById('institutionField').hidden = !EXTERNAL_CATEGORIES.includes(cat);
}

function onSignupAvatarChange(e) {
  const file = e.target.files[0];
  if (!file) return;
  fileToDataURL(file, 320, 0.82).then(dataUrl => {
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

  if (!name || !email || !category || !pwd) return toast('Preencha todos os campos obrigatórios.', 'error');
  if (name.split(/\s+/).length < 2) return toast('Informe nome e sobrenome.', 'error');
  if (!validEmail(email)) return toast('E-mail inválido.', 'error');
  const prob = passwordProblem(pwd); if (prob) return toast(prob, 'error');
  if (pwd !== pwdConfirm) return toast('As senhas não coincidem.', 'error');
  if (STUDENT_CATEGORIES.includes(category) && !advisor) return toast('Informe o(a) orientador(a).', 'error');
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
    window._signupProfile = null;
    toast(authErrorMessage(e), 'error');
  } finally { if (btn) btn.disabled = false; }
}

function doLogout() {
  closeMobileNav();
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
  if (slot) slot.innerHTML = u ? renderAvatar(u, 'small') : '';
  const label = document.getElementById('userNameLabel');
  if (label) label.textContent = u ? u.name.split(' ')[0] : '';
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

/* ---------- Lembrete de foto ---------- */
function showProfilePhotoReminder() {
  const u = currentUser();
  if (!u || u.avatar) return;
  openModal(`
    <div class="modal-head">
      <div><div class="modal-title">Adicione uma foto de perfil</div>
      <div class="modal-sub">Ajuda a equipe técnica a identificar você no laboratório</div></div>
      <button class="modal-close" onclick="dismissProfileReminder()" aria-label="Fechar">${icon('x')}</button>
    </div>
    <div class="modal-body">
      <div class="info-box">A foto facilita o reconhecimento na retirada de equipamentos e materiais. É opcional.</div>
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
  const file = e.target.files[0]; if (!file) return;
  fileToDataURL(file, 320, 0.82).then(dataUrl => {
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
