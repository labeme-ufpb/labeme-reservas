/* ============================================================
   profile.js — Tela de perfil do usuário
   ============================================================ */

function renderProfile() {
  const u = currentUser();
  if (!u) { showView('auth'); return; }

  const totalReservations = window.db.reservations.filter(r => r.userId === u.id).length;
  const approvedReservations = window.db.reservations.filter(r =>
    r.userId === u.id && ['approved','in_use','awaiting_return','returned','completed'].includes(r.status)
  ).length;
  const pendingReservations = window.db.reservations.filter(r =>
    r.userId === u.id && r.status === 'pending'
  ).length;

  const advisorOrInstitution = u.advisor || u.institution || '—';

  const mount = document.getElementById('profileContent');
  mount.innerHTML = `
    <div class="profile-grid">
      <div class="profile-card">
        <div class="profile-avatar-wrap">
          ${renderAvatar(u, 'large')}
          <label class="profile-avatar-edit" for="pfAvatarInput" title="Trocar foto">${icon('camera', 16)}</label>
        </div>
        <input type="file" id="pfAvatarInput" class="visually-hidden-input" accept="image/*" onchange="onProfileAvatarChange(event)">
        <label for="pfAvatarInput" class="btn small-btn">${icon('camera', 16)} ${u.avatar ? 'Trocar foto' : 'Adicionar foto'}</label>
        <div class="profile-name">${escapeHtml(u.name)}</div>
        <div class="profile-role">
          ${escapeHtml(CATEGORY_LABELS[u.category] || '')}
          ${u.role === 'admin' ? ' · <span style="color:var(--labeme-navy);font-weight:600;">Coordenação</span>' : ''}
          ${u.role === 'technician' ? ' · <span style="color:var(--labeme-green-dark);font-weight:600;">Técnico</span>' : ''}
        </div>
        <div class="profile-stat">
          <span class="profile-stat-label">Total de reservas</span>
          <span class="profile-stat-value">${totalReservations}</span>
        </div>
        <div class="profile-stat">
          <span class="profile-stat-label">Aprovadas</span>
          <span class="profile-stat-value">${approvedReservations}</span>
        </div>
        <div class="profile-stat">
          <span class="profile-stat-label">Pendentes</span>
          <span class="profile-stat-value">${pendingReservations}</span>
        </div>
      </div>

      <div>
        <div class="panel" style="margin-bottom:18px;">
          <div class="panel-head">
            <div>
              <div class="panel-title">Informações pessoais</div>
              <div class="panel-sub">Mantenha seus dados atualizados.</div>
            </div>
          </div>
          <div class="panel-body" style="padding:20px 24px;">
            <div class="field-row">
              <div class="field"><label>Nome completo</label>
                <input type="text" id="pfName" value="${escapeHtml(u.name)}">
              </div>
              <div class="field"><label>WhatsApp${u.role === 'user' ? ' <span class="req">*</span>' : ''}</label>
                <input type="tel" id="pfPhone" value="${escapeHtml(u.phone||'')}" placeholder="(83) 9XXXX-XXXX">
              </div>
            </div>
            <div class="field"><label>E-mail</label>
              <input type="email" value="${escapeHtml(u.email)}" disabled>
              <div class="field-help">O e-mail não pode ser alterado.</div>
            </div>
            <div class="field"><label>Categoria</label>
              <input type="text" value="${escapeHtml(CATEGORY_LABELS[u.category] || '')}" disabled>
              <div class="field-help">Para alterar a categoria, entre em contato com a coordenação.</div>
            </div>
            ${u.advisor !== undefined && STUDENT_CATEGORIES.includes(u.category) ? `
              <div class="field"><label>Orientador</label>
                <input type="text" id="pfAdvisor" value="${escapeHtml(u.advisor||'')}">
              </div>
            ` : ''}
            ${['prof_externo','externo'].includes(u.category) ? `
              <div class="field"><label>Instituição</label>
                <input type="text" id="pfInstitution" value="${escapeHtml(u.institution||'')}">
              </div>
            ` : ''}
            <button class="btn dark" onclick="saveProfile()">Salvar alterações</button>
          </div>
        </div>

        <div class="panel">
          <div class="panel-head">
            <div>
              <div class="panel-title">Alterar senha</div>
              <div class="panel-sub">Use uma senha forte e única.</div>
            </div>
          </div>
          <div class="panel-body" style="padding:20px 24px;">
            <div class="field"><label for="pfPwdCurrent">Senha atual</label>
              <input type="password" id="pfPwdCurrent" autocomplete="current-password">
            </div>
            <div class="field-row">
              <div class="field"><label for="pfPwdNew">Nova senha</label>
                <input type="password" id="pfPwdNew" autocomplete="new-password">
                <div class="field-help">Mínimo 8 caracteres, com letras e números.</div>
              </div>
              <div class="field"><label for="pfPwdConfirm">Confirme a nova senha</label>
                <input type="password" id="pfPwdConfirm" autocomplete="new-password">
              </div>
            </div>
            <button class="btn dark" onclick="changePassword()">Alterar senha</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function onProfileAvatarChange(e) {
  const file = e.target.files[0];
  if (!file) return;
  fileToDataURL(file, 320, 0.82).then(dataUrl => {
    const u = currentUser();
    if (!u) return;
    u.avatar = dataUrl;
    saveDB();
    refreshAuthUI();
    renderProfile();
    toast('Foto de perfil atualizada.', 'success');
  }).catch(err => toast(err.message, 'error'));
}

function saveProfile() {
  const u = currentUser();
  if (!u) return;

  const name = document.getElementById('pfName').value.trim();
  if (!name) return toast('Nome não pode ficar em branco.', 'error');

  const phone = document.getElementById('pfPhone').value.trim();
  if (u.role === 'user' && !validPhone(phone)) return toast('Informe o WhatsApp com DDD, por exemplo (83) 99999-9999.', 'error');
  const advField = document.getElementById('pfAdvisor');
  if (advField && u.role === 'user' && !advField.value.trim()) return toast('Informe o(a) orientador(a).', 'error');
  const instField = document.getElementById('pfInstitution');
  if (instField && u.role === 'user' && !instField.value.trim()) return toast('Informe a instituição.', 'error');

  u.name = name;
  u.phone = phone;
  if (advField) u.advisor = advField.value.trim();
  if (instField) u.institution = instField.value.trim();
  delete u.incomplete;

  saveDB();
  refreshAuthUI();
  toast('Perfil atualizado.', 'success');
}

async function changePassword() {
  const u = currentUser();
  if (!u) return;

  const current = document.getElementById('pfPwdCurrent').value;
  const next = document.getElementById('pfPwdNew').value;
  const confirm = document.getElementById('pfPwdConfirm').value;

  if (!current || !next || !confirm) return toast('Preencha todos os campos de senha.', 'error');
  const prob = passwordProblem(next); if (prob) return toast(prob, 'error');
  if (next !== confirm) return toast('A confirmação não confere.', 'error');
  try {
    const cred = firebase.auth.EmailAuthProvider.credential(fb.auth.currentUser.email, current);
    await fb.auth.currentUser.reauthenticateWithCredential(cred);
    await fb.auth.currentUser.updatePassword(next);
  } catch (e) {
    return toast(['auth/invalid-credential','auth/wrong-password'].includes(e.code) ? 'Senha atual incorreta.' : authErrorMessage(e), 'error');
  }

  document.getElementById('pfPwdCurrent').value = '';
  document.getElementById('pfPwdNew').value = '';
  document.getElementById('pfPwdConfirm').value = '';
  toast('Senha alterada com sucesso.', 'success');
}


/* ============================================================
   Cadastro incompleto (v11.10): tela obrigatória por cima de tudo.
   Acontece com contas antigas sem WhatsApp e com contas cujo perfil
   não foi gravado no cadastro (ex.: a página fechou logo depois de
   criar a conta) e por isso ficaram sem vínculo/orientador.
   ============================================================ */
function profileGateOpen() { return !!document.getElementById('profileGate'); }
function showProfileGate() {
  const u = currentUser(); if (!u || profileGateOpen()) return;
  const needCat = !u.category;
  const gate = document.createElement('div');
  gate.id = 'profileGate'; gate.className = 'profile-gate';
  gate.setAttribute('role', 'dialog'); gate.setAttribute('aria-modal', 'true'); gate.setAttribute('aria-labelledby', 'pgTitle');
  gate.innerHTML = `
    <div class="profile-gate-box">
      <img src="assets/labeme-logo.png" alt="LABEME" class="profile-gate-logo">
      <div class="modal-title" id="pgTitle">Complete seu cadastro</div>
      <div class="modal-sub">Para usar o sistema, precisamos destes dados. A equipe técnica usa o WhatsApp para falar com você sobre as suas reservas.</div>
      <div class="field"><label for="pgName">Nome completo <span class="req">*</span></label><input type="text" id="pgName" value="${escapeHtml(u.name || '')}" autocomplete="name"></div>
      <div class="field"><label for="pgPhone">WhatsApp <span class="req">*</span></label><input type="tel" id="pgPhone" value="${escapeHtml(u.phone || '')}" placeholder="(83) 9XXXX-XXXX" autocomplete="tel" inputmode="tel"></div>
      ${needCat ? `<div class="field"><label for="pgCategory">Vínculo <span class="req">*</span></label>
        <select id="pgCategory" onchange="onGateCategoryChange()"><option value="">Selecione…</option>
          ${SELF_CATEGORIES.map(k => `<option value="${k}">${escapeHtml(CATEGORY_LABELS[k])}</option>`).join('')}</select></div>`
        : `<div class="field"><label>Vínculo</label><input type="text" value="${escapeHtml(CATEGORY_LABELS[u.category] || '')}" disabled></div>`}
      <div class="field" id="pgAdvisorField" ${STUDENT_CATEGORIES.includes(u.category) ? '' : 'hidden'}><label for="pgAdvisor">Orientador(a) <span class="req">*</span></label><input type="text" id="pgAdvisor" value="${escapeHtml(u.advisor || '')}" placeholder="Prof. Dr. …"></div>
      <div class="field" id="pgInstitutionField" ${EXTERNAL_CATEGORIES.includes(u.category) ? '' : 'hidden'}><label for="pgInstitution">Instituição de origem <span class="req">*</span></label><input type="text" id="pgInstitution" value="${escapeHtml(u.institution || '')}"></div>
      <div class="profile-gate-foot">
        <button type="button" class="btn" onclick="doLogout()">Sair</button>
        <button type="button" class="btn dark" id="pgSave" onclick="submitProfileGate()">${icon('check', 16)} Salvar e continuar</button>
      </div>
    </div>`;
  document.body.appendChild(gate);
  document.body.classList.add('modal-open');
  setTimeout(() => gate.querySelector('input:not([disabled]),select')?.focus(), 30);
}
function onGateCategoryChange() {
  const cat = document.getElementById('pgCategory')?.value || '';
  document.getElementById('pgAdvisorField').hidden = !STUDENT_CATEGORIES.includes(cat);
  document.getElementById('pgInstitutionField').hidden = !EXTERNAL_CATEGORIES.includes(cat);
}
function closeProfileGate() {
  document.getElementById('profileGate')?.remove();
  if (!document.getElementById('modalOverlay')?.classList.contains('show')) document.body.classList.remove('modal-open');
}
async function submitProfileGate() {
  const u = currentUser(); if (!u) return;
  const val = id => (document.getElementById(id)?.value || '').trim();
  const name = val('pgName'), phone = val('pgPhone');
  const category = u.category || val('pgCategory');
  const advisor = val('pgAdvisor'), institution = val('pgInstitution');
  if (name.split(/\s+/).length < 2) return toast('Informe nome e sobrenome.', 'error');
  if (!validPhone(phone)) return toast('Informe o WhatsApp com DDD, por exemplo (83) 99999-9999.', 'error');
  if (!category) return toast('Selecione o seu vínculo.', 'error');
  if (!u.category && !SELF_CATEGORIES.includes(category)) return toast('Selecione o seu vínculo.', 'error');
  if (STUDENT_CATEGORIES.includes(category) && !advisor) return toast('Informe o(a) orientador(a).', 'error');
  if (EXTERNAL_CATEGORIES.includes(category) && !institution) return toast('Informe a instituição.', 'error');
  const prev = { name: u.name, phone: u.phone, category: u.category, advisor: u.advisor, institution: u.institution, incomplete: u.incomplete };
  Object.assign(u, { name, phone, category });
  if (STUDENT_CATEGORIES.includes(category)) u.advisor = advisor;
  if (EXTERNAL_CATEGORIES.includes(category)) u.institution = institution;
  delete u.incomplete;
  const btn = document.getElementById('pgSave'); if (btn) btn.disabled = true;
  try {
    await writeDocNow('users', u);
  } catch (e) {
    console.error(e);
    Object.assign(u, prev); if (prev.incomplete === undefined) delete u.incomplete;
    if (btn) btn.disabled = false;
    return toast('Não foi possível salvar. Verifique a internet e tente de novo.', 'error');
  }
  closeProfileGate();
  refreshAuthUI();
  toast('Cadastro completo. Obrigado!', 'success');
  if (currentView === 'profile' || currentView === 'auth') showView(homeViewFor(u));
  else if (typeof refreshCurrentView === 'function') refreshCurrentView();
  setTimeout(() => { checkAnnouncements(); if (!u.avatar && !u.profileReminderShown && !modalIsOpen()) showProfilePhotoReminder(); }, 400);
}
