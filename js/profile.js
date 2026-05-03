/* ============================================================
   profile.js — Tela de perfil do usuário
   ============================================================ */

function renderProfile() {
  const u = currentUser();
  if (!u) { showView('auth'); return; }

  const totalReservations = window.db.reservations.filter(r => r.userId === u.id).length;
  const approvedReservations = window.db.reservations.filter(r =>
    r.userId === u.id && ['approved','in_use','returned','completed'].includes(r.status)
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
          <label class="profile-avatar-edit" title="Trocar foto">
            <input type="file" accept="image/*" onchange="onProfileAvatarChange(event)">
            ✎
          </label>
        </div>
        <div class="profile-name">${escapeHtml(u.name)}</div>
        <div class="profile-role">
          ${CATEGORY_LABELS[u.category]}
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
              <input type="text" value="${CATEGORY_LABELS[u.category]}" disabled>
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
            <div class="field"><label>Senha atual</label>
              <input type="password" id="pfPwdCurrent">
            </div>
            <div class="field-row">
              <div class="field"><label>Nova senha</label>
                <input type="password" id="pfPwdNew">
              </div>
              <div class="field"><label>Confirme a nova senha</label>
                <input type="password" id="pfPwdConfirm">
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
  fileToDataURL(file).then(dataUrl => {
    const u = currentUser();
    if (!u) return;
    u.avatar = dataUrl;
    saveDB();
    refreshAuthUI();
    renderProfile();
    toast('Foto de perfil atualizada.', 'success');
  });
}

async function saveProfile() {
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

  await saveDB();
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
  if (next.length < 6) return toast('Nova senha deve ter pelo menos 6 caracteres.', 'error');
  if (next !== confirm) return toast('A confirmação não confere.', 'error');

  try {
    const authUser = window.firebaseAuth?.currentUser;
    if (!authUser) return toast('Sessão inválida. Faça login novamente.', 'error');
    const credential = firebase.auth.EmailAuthProvider.credential(authUser.email, current);
    await authUser.reauthenticateWithCredential(credential);
    await authUser.updatePassword(next);

    document.getElementById('pfPwdCurrent').value = '';
    document.getElementById('pfPwdNew').value = '';
    document.getElementById('pfPwdConfirm').value = '';
    toast('Senha alterada com sucesso.', 'success');
  } catch (err) {
    console.error(err);
    const msg = err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential'
      ? 'Senha atual incorreta.'
      : 'Erro ao alterar senha: ' + (err.message || err.code);
    toast(msg, 'error');
  }
}

window.renderProfile = renderProfile;
window.onProfileAvatarChange = onProfileAvatarChange;
window.saveProfile = saveProfile;
window.changePassword = changePassword;
