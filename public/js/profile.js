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
              <div class="field"><label>WhatsApp</label>
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
            ${u.advisor !== undefined && ['graduacao','mestrado','doutorado'].includes(u.category) ? `
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

  u.name = name;
  u.phone = document.getElementById('pfPhone').value.trim();

  const advField = document.getElementById('pfAdvisor');
  if (advField) u.advisor = advField.value.trim();

  const instField = document.getElementById('pfInstitution');
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

