/* ============================================================
   auth.js — Autenticação Firebase e cadastro (v5)
   ============================================================ */

let firebaseUser = null;
let authInitialized = false;
let pendingInitialRoute = true;

function currentUser() {
  return firebaseUser ? getUser(firebaseUser.uid) : null;
}

function currentUserId() {
  return firebaseUser ? firebaseUser.uid : null;
}

function isAdmin() {
  const u = currentUser();
  return !!(u && u.role === 'admin');
}

function isTechnician() {
  const u = currentUser();
  return !!(u && (u.role === 'technician' || u.role === 'admin'));
}

function canApproveReservations() {
  return isTechnician();
}

function waitForUserProfile(uid, timeoutMs = 6000) {
  return new Promise(resolve => {
    const existing = getUser(uid);
    if (existing) return resolve(existing);
    const start = Date.now();
    const timer = setInterval(() => {
      const u = getUser(uid);
      if (u || Date.now() - start > timeoutMs) {
        clearInterval(timer);
        resolve(u || null);
      }
    }, 150);
  });
}

function initAuthListener() {
  if (!window.firebaseAuth || authInitialized) return;
  authInitialized = true;
  firebaseAuth.onAuthStateChanged(async user => {
    firebaseUser = user || null;
    if (user) {
      startPrivateDataSync();
      await waitForUserProfile(user.uid, 2500);
    } else {
      stopPrivateDataSync();
    }
    refreshAuthUI();

    if (pendingInitialRoute) {
      pendingInitialRoute = false;
      const u = currentUser();
      if (u?.role === 'technician') showView('tech');
      else if (u?.role === 'admin') showView('admin');
      else showView('calendar');
    }
  });
}

function setAuthTab(tab) {
  document.getElementById('tabLogin').classList.toggle('active', tab === 'login');
  document.getElementById('tabSignup').classList.toggle('active', tab === 'signup');
  document.getElementById('loginForm').style.display = tab === 'login' ? 'block' : 'none';
  document.getElementById('signupForm').style.display = tab === 'signup' ? 'block' : 'none';
}

function onCategoryChange() {
  const cat = document.getElementById('suCategory').value;
  const needsAdvisor = ['graduacao','mestrado','doutorado'].includes(cat);
  const needsInstitution = ['prof_externo','externo'].includes(cat);
  document.getElementById('advisorField').style.display = needsAdvisor ? 'block' : 'none';
  document.getElementById('institutionField').style.display = needsInstitution ? 'block' : 'none';
}

function onSignupAvatarChange(e) {
  const file = e.target.files[0];
  if (!file) return;
  // Antes do cadastro o usuário ainda não está autenticado; usa base64 provisório.
  fileToDataURL(file).then(dataUrl => {
    window._signupAvatar = dataUrl;
    document.getElementById('suAvatarPreview').src = dataUrl;
    document.getElementById('suAvatarPreview').style.display = 'block';
    document.getElementById('suAvatarText').textContent = '✓ Foto carregada — clique para trocar';
    document.getElementById('suAvatarLabel').classList.add('has-file');
  });
}

async function doLogin() {
  const email = document.getElementById('loginEmail').value.trim().toLowerCase();
  const pwd = document.getElementById('loginPwd').value;
  if (!email || !pwd) return toast('Informe e-mail e senha.', 'error');

  try {
    const cred = await firebaseAuth.signInWithEmailAndPassword(email, pwd);
    firebaseUser = cred.user;
    startPrivateDataSync();
    let u = await waitForUserProfile(cred.user.uid, 5000);

    if (!u) {
      // Caso excepcional: conta existe no Auth, mas ainda não há perfil no Firestore.
      const profile = await fetchUserDoc(cred.user.uid);
      if (profile) {
        window.db.users.push(profile);
        u = profile;
      }
    }

    if (!u) {
      toast('Login realizado, mas o perfil ainda não está cadastrado no Firestore. Cadastre o usuário na coleção users.', 'warn');
      showView('calendar');
      return;
    }

    toast(`Bem-vindo, ${u.name.split(' ')[0]}!`, 'success');
    refreshAuthUI();

    if (!u.avatar && !u.profileReminderShown) {
      setTimeout(() => showProfilePhotoReminder(), 600);
    } else {
      if (u.role === 'admin') showView('admin');
      else if (u.role === 'technician') showView('tech');
      else showView('calendar');
    }
  } catch (err) {
    console.error(err);
    const msg = err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential'
      ? 'E-mail ou senha incorretos.'
      : 'Erro no login: ' + (err.message || err.code);
    toast(msg, 'error');
  }
}

async function doSignup() {
  const name = document.getElementById('suName').value.trim();
  const email = document.getElementById('suEmail').value.trim().toLowerCase();
  const phone = document.getElementById('suPhone').value.trim();
  const category = document.getElementById('suCategory').value;
  const advisor = document.getElementById('suAdvisor').value.trim();
  const institution = document.getElementById('suInstitution').value.trim();
  const pwd = document.getElementById('suPwd').value;
  const pwdConfirm = document.getElementById('suPwdConfirm').value;

  if (!name || !email || !category || !pwd) return toast('Preencha todos os campos obrigatórios.', 'error');
  if (pwd.length < 6) return toast('Senha deve ter pelo menos 6 caracteres.', 'error');
  if (pwd !== pwdConfirm) return toast('As senhas não coincidem.', 'error');
  if (['graduacao','mestrado','doutorado'].includes(category) && !advisor) return toast('Informe o orientador.', 'error');
  if (['prof_externo','externo'].includes(category) && !institution) return toast('Informe a instituição.', 'error');

  try {
    const cred = await firebaseAuth.createUserWithEmailAndPassword(email, pwd);
    firebaseUser = cred.user;

    const u = {
      id: cred.user.uid,
      name, email,
      category, advisor, institution, phone,
      role: 'user', // autocadastro nunca cria técnico/admin
      avatar: window._signupAvatar || null,
      profileReminderShown: !!window._signupAvatar,
      createdAt: Date.now()
    };

    window.db.users.push(u);
    await saveDB();
    window._signupAvatar = null;
    startPrivateDataSync();
    toast('Cadastro realizado com sucesso!', 'success');
    refreshAuthUI();

    if (!u.avatar) setTimeout(() => showProfilePhotoReminder(), 600);
    else showView('calendar');
  } catch (err) {
    console.error(err);
    const msg = err.code === 'auth/email-already-in-use'
      ? 'E-mail já cadastrado.'
      : 'Erro no cadastro: ' + (err.message || err.code);
    toast(msg, 'error');
  }
}

async function doLogout() {
  try {
    await firebaseAuth.signOut();
  } catch (err) {
    console.warn(err);
  }
  firebaseUser = null;
  stopPrivateDataSync();
  refreshAuthUI();
  showView('calendar');
  toast('Sessão encerrada.');
}

function refreshAuthUI() {
  const u = currentUser();
  const navAuth = document.getElementById('nav-auth');
  if (!navAuth) return;
  document.getElementById('nav-auth').style.display = u ? 'none' : 'inline-flex';
  document.getElementById('nav-logout').style.display = firebaseUser ? 'inline-flex' : 'none';
  document.getElementById('nav-myres').style.display = u ? 'inline-flex' : 'none';
  document.getElementById('nav-profile').style.display = u ? 'inline-flex' : 'none';
  document.getElementById('nav-messages').style.display = u ? 'inline-flex' : 'none';
  document.getElementById('nav-stock').style.display = u ? 'inline-flex' : 'none';
  document.getElementById('nav-tech').style.display = (u && (u.role === 'technician' || u.role === 'admin')) ? 'inline-flex' : 'none';
  document.getElementById('nav-admin').style.display = (u && u.role === 'admin') ? 'inline-flex' : 'none';

  const avatarSlot = document.getElementById('userAvatarSlot');
  if (avatarSlot) {
    if (u) {
      avatarSlot.innerHTML = renderAvatar(u, 'small');
      avatarSlot.style.display = 'inline-flex';
      avatarSlot.style.cursor = 'pointer';
      avatarSlot.title = u.name + (u.role === 'admin' ? ' (admin)' : u.role === 'technician' ? ' (técnico)' : '');
      avatarSlot.onclick = () => showView('profile');
    } else {
      avatarSlot.style.display = 'none';
    }
  }
  updateNavBadges();
}

function updateNavBadges() {
  const u = currentUser();
  const msgBadge = document.getElementById('msgNavBadge');
  if (!u || !msgBadge) return;
  const unread = (window.db.messages || []).filter(m => m.toUserId === u.id && !m.readAt).length;
  if (unread > 0) {
    msgBadge.textContent = unread;
    msgBadge.style.display = 'grid';
  } else {
    msgBadge.style.display = 'none';
  }
}

function showProfilePhotoReminder() {
  const u = currentUser();
  if (!u || u.avatar) return;
  const html = `
    <div class="modal-head">
      <div>
        <div class="modal-title">📷 Adicione uma foto de perfil</div>
        <div class="modal-sub">Ajuda técnicos e coordenação a identificá-lo no laboratório</div>
      </div>
      <button class="modal-close" onclick="dismissProfileReminder()">✕</button>
    </div>
    <div class="modal-body" style="text-align:center;">
      <div class="info-box">
        Uma foto facilita o reconhecimento durante a retirada de equipamentos e materiais. É opcional, mas recomendamos fortemente.
      </div>
      <label class="file-upload" id="reminderPhotoLabel" style="margin-top:14px;">
        <input type="file" id="reminderPhotoInput" accept="image/*" capture="user" onchange="onReminderPhotoChange(event)">
        <div id="reminderPhotoText">📷 Clique aqui para escolher uma foto</div>
      </label>
      <img id="reminderPhotoPreview" class="file-preview" style="display:none;margin:12px auto 0;">
    </div>
    <div class="modal-foot">
      <button class="btn" onclick="dismissProfileReminder()">Mais tarde</button>
      <button class="btn dark" id="reminderSaveBtn" onclick="saveReminderPhoto()" disabled>Salvar foto</button>
    </div>`;
  openModal(html);
}

function onReminderPhotoChange(e) {
  const file = e.target.files[0];
  if (!file) return;
  fileToDataURL(file).then(dataUrl => {
    window._reminderPhoto = dataUrl;
    document.getElementById('reminderPhotoPreview').src = dataUrl;
    document.getElementById('reminderPhotoPreview').style.display = 'block';
    document.getElementById('reminderPhotoText').textContent = '✓ Foto selecionada';
    document.getElementById('reminderPhotoLabel').classList.add('has-file');
    document.getElementById('reminderSaveBtn').disabled = false;
  });
}

async function saveReminderPhoto() {
  const u = currentUser();
  if (!u || !window._reminderPhoto) return;
  u.avatar = window._reminderPhoto;
  u.profileReminderShown = true;
  await saveDB();
  window._reminderPhoto = null;
  closeModal();
  toast('Foto de perfil salva!', 'success');
  refreshAuthUI();
  if (u.role === 'admin') showView('admin');
  else if (u.role === 'technician') showView('tech');
  else showView('calendar');
}

async function dismissProfileReminder() {
  const u = currentUser();
  if (u) {
    u.profileReminderShown = true;
    await saveDB();
  }
  closeModal();
  if (u?.role === 'admin') showView('admin');
  else if (u?.role === 'technician') showView('tech');
  else showView('calendar');
}

window.currentUser = currentUser;
window.currentUserId = currentUserId;
window.isAdmin = isAdmin;
window.isTechnician = isTechnician;
window.canApproveReservations = canApproveReservations;
window.initAuthListener = initAuthListener;
window.setAuthTab = setAuthTab;
window.onCategoryChange = onCategoryChange;
window.onSignupAvatarChange = onSignupAvatarChange;
window.doLogin = doLogin;
window.doSignup = doSignup;
window.doLogout = doLogout;
window.refreshAuthUI = refreshAuthUI;
window.updateNavBadges = updateNavBadges;
window.showProfilePhotoReminder = showProfilePhotoReminder;
window.onReminderPhotoChange = onReminderPhotoChange;
window.saveReminderPhoto = saveReminderPhoto;
window.dismissProfileReminder = dismissProfileReminder;
