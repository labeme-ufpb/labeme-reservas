/* ============================================================
   auth.js — Autenticação e cadastro (v3)
   Inclui:
   - Confirmação de senha no cadastro
   - Foto de perfil opcional no cadastro
   - Categoria 'tecnico' não promove automaticamente: admin precisa promover manualmente
   - Lembrete de foto no primeiro acesso
   ============================================================ */

let session = JSON.parse(localStorage.getItem(window.SESSION_KEY) || 'null');

function currentUser() {
  return session ? getUser(session.userId) : null;
}

function isAdmin() {
  const u = currentUser();
  return u && u.role === 'admin';
}

function isTechnician() {
  const u = currentUser();
  return u && (u.role === 'technician' || u.role === 'admin');
}

// Pode aprovar reservas: técnicos e admins
function canApproveReservations() {
  return isTechnician();
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
  fileToDataURL(file).then(dataUrl => {
    window._signupAvatar = dataUrl;
    document.getElementById('suAvatarPreview').src = dataUrl;
    document.getElementById('suAvatarPreview').style.display = 'block';
    document.getElementById('suAvatarText').textContent = '✓ Foto carregada — clique para trocar';
    document.getElementById('suAvatarLabel').classList.add('has-file');
  });
}

function doLogin() {
  const email = document.getElementById('loginEmail').value.trim().toLowerCase();
  const pwd = document.getElementById('loginPwd').value;
  const u = window.db.users.find(x =>
    x.email.toLowerCase() === email && x.password === pwd
  );
  if (!u) return toast('E-mail ou senha incorretos.', 'error');
  session = { userId: u.id };
  localStorage.setItem(window.SESSION_KEY, JSON.stringify(session));
  toast(`Bem-vindo, ${u.name.split(' ')[0]}!`, 'success');
  refreshAuthUI();

  // Lembrete de foto: mostra UMA vez se ainda não tem avatar
  if (!u.avatar && !u.profileReminderShown) {
    setTimeout(() => showProfilePhotoReminder(), 600);
  } else {
    if (u.role === 'admin') showView('admin');
    else if (u.role === 'technician') showView('tech');
    else showView('calendar');
  }
}

function doSignup() {
  const name = document.getElementById('suName').value.trim();
  const email = document.getElementById('suEmail').value.trim();
  const phone = document.getElementById('suPhone').value.trim();
  const category = document.getElementById('suCategory').value;
  const advisor = document.getElementById('suAdvisor').value.trim();
  const institution = document.getElementById('suInstitution').value.trim();
  const pwd = document.getElementById('suPwd').value;
  const pwdConfirm = document.getElementById('suPwdConfirm').value;

  if (!name || !email || !category || !pwd) {
    return toast('Preencha todos os campos obrigatórios.', 'error');
  }
  if (pwd.length < 6) {
    return toast('Senha deve ter pelo menos 6 caracteres.', 'error');
  }
  if (pwd !== pwdConfirm) {
    return toast('As senhas não coincidem.', 'error');
  }
  if (window.db.users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
    return toast('E-mail já cadastrado.', 'error');
  }
  if (['graduacao','mestrado','doutorado'].includes(category) && !advisor) {
    return toast('Informe o orientador.', 'error');
  }
  if (['prof_externo','externo'].includes(category) && !institution) {
    return toast('Informe a instituição.', 'error');
  }

  // IMPORTANTE: Auto-cadastro NUNCA dá privilégios elevados
  // Mesmo categoria 'tecnico' começa como user comum; admin precisa promover manualmente
  const role = 'user';

  const u = {
    id: uid('u'),
    name, email, password: pwd,
    category, advisor, institution, phone,
    role,
    avatar: window._signupAvatar || null,
    profileReminderShown: !!window._signupAvatar,  // se já enviou foto, não precisa lembrete
    createdAt: Date.now()
  };
  window.db.users.push(u);
  saveDB();
  window._signupAvatar = null;
  session = { userId: u.id };
  localStorage.setItem(window.SESSION_KEY, JSON.stringify(session));
  toast('Cadastro realizado com sucesso!', 'success');
  refreshAuthUI();

  if (!u.avatar) {
    setTimeout(() => showProfilePhotoReminder(), 600);
  } else {
    showView('calendar');
  }
}

function doLogout() {
  session = null;
  localStorage.removeItem(window.SESSION_KEY);
  refreshAuthUI();
  showView('calendar');
  toast('Sessão encerrada.');
}

function refreshAuthUI() {
  const u = currentUser();
  document.getElementById('nav-auth').style.display = u ? 'none' : 'inline-flex';
  document.getElementById('nav-logout').style.display = u ? 'inline-flex' : 'none';
  document.getElementById('nav-myres').style.display = u ? 'inline-flex' : 'none';
  document.getElementById('nav-profile').style.display = u ? 'inline-flex' : 'none';
  document.getElementById('nav-messages').style.display = u ? 'inline-flex' : 'none';
  document.getElementById('nav-stock').style.display = u ? 'inline-flex' : 'none';
  document.getElementById('nav-tech').style.display = (u && (u.role === 'technician' || u.role === 'admin')) ? 'inline-flex' : 'none';
  document.getElementById('nav-admin').style.display = (u && u.role === 'admin') ? 'inline-flex' : 'none';

  // Avatar + nome no topbar
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

  // Atualiza badges (mensagens não lidas)
  updateNavBadges();
}

function updateNavBadges() {
  const u = currentUser();
  if (!u) return;
  const msgBadge = document.getElementById('msgNavBadge');
  if (msgBadge) {
    const unread = (window.db.messages || []).filter(m =>
      m.toUserId === u.id && !m.readAt
    ).length;
    if (unread > 0) {
      msgBadge.textContent = unread;
      msgBadge.style.display = 'grid';
    } else {
      msgBadge.style.display = 'none';
    }
  }
}

// ========== PROFILE PHOTO REMINDER ==========
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
    </div>
  `;
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

function saveReminderPhoto() {
  const u = currentUser();
  if (!u || !window._reminderPhoto) return;
  u.avatar = window._reminderPhoto;
  u.profileReminderShown = true;
  saveDB();
  window._reminderPhoto = null;
  closeModal();
  toast('Foto de perfil salva!', 'success');
  refreshAuthUI();
  if (u.role === 'admin') showView('admin');
  else if (u.role === 'technician') showView('tech');
  else showView('calendar');
}

function dismissProfileReminder() {
  const u = currentUser();
  if (u) {
    u.profileReminderShown = true;
    saveDB();
  }
  closeModal();
  if (u?.role === 'admin') showView('admin');
  else if (u?.role === 'technician') showView('tech');
  else showView('calendar');
}

window.session = session;
window.currentUser = currentUser;
window.isAdmin = isAdmin;
window.isTechnician = isTechnician;
window.canApproveReservations = canApproveReservations;
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
