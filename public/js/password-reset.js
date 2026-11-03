/* ============================================================
   password-reset.js — "Esqueci minha senha" (v11 — Firebase)
   O Firebase Authentication envia o e-mail de redefinição
   (modelo em português, configurado no console). A resposta na
   tela é sempre a mesma, sem revelar se o e-mail está cadastrado.
   ============================================================ */

function openForgotPasswordModal() {
  const prefilled = document.getElementById('loginEmail')?.value || '';
  openModal(`
    <div class="modal-head">
      <div><div class="modal-title">Esqueci minha senha</div>
      <div class="modal-sub">Informe o e-mail cadastrado.</div></div>
      <button class="modal-close" onclick="closeModal()" aria-label="Fechar">${icon('x')}</button>
    </div>
    <div class="modal-body">
      <div class="info-box">Enviaremos um link para você criar uma nova senha.</div>
      <div class="field">
        <label for="fpEmail">E-mail <span class="req">*</span></label>
        <input type="email" id="fpEmail" value="${escapeHtml(prefilled)}" placeholder="seu.email@ufpb.br" autocomplete="email"
          onkeydown="if(event.key==='Enter')submitForgotPassword()">
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn" onclick="closeModal()">Cancelar</button>
      <button class="btn dark" onclick="submitForgotPassword()">Enviar link</button>
    </div>`);
  setTimeout(() => document.getElementById('fpEmail')?.focus(), 50);
}

async function submitForgotPassword() {
  const email = document.getElementById('fpEmail')?.value.trim().toLowerCase();
  if (!email || !validEmail(email)) return toast('Informe um e-mail válido.', 'error');
  closeModal();
  try { await fb.auth.sendPasswordResetEmail(email, { url: location.origin + location.pathname }); }
  catch (e) {
    if (e.code === 'auth/too-many-requests') return toast(authErrorMessage(e), 'error');
    if (e.code === 'auth/network-request-failed') return toast(authErrorMessage(e), 'error');
    // e-mail inexistente: mesma resposta, sem revelar
  }
  showGenericResetResponse(email);
}

function showGenericResetResponse(email) {
  openModal(`
    <div class="modal-head">
      <div><div class="modal-title">Verifique seu e-mail</div></div>
      <button class="modal-close" onclick="closeModal()" aria-label="Fechar">${icon('x')}</button>
    </div>
    <div class="modal-body">
      <div class="info-box success">Se <strong>${escapeHtml(email)}</strong> estiver cadastrado, o link para criar uma nova senha chega em alguns minutos.</div>
      <p class="muted small">Procure também na caixa de spam. O link vale por tempo limitado — use-o assim que recebê-lo.</p>
    </div>
    <div class="modal-foot"><button class="btn dark" onclick="closeModal()">Entendi</button></div>`);
}

/* Coordenação: envia o e-mail de redefinição para um usuário (ex.: pedido presencial) */
async function adminGenerateResetLink(userId) {
  if (!isAdmin()) return;
  const u = getUser(userId); if (!u) return;
  try {
    await fb.auth.sendPasswordResetEmail(u.email, { url: location.origin + location.pathname });
    toast(`Link de nova senha enviado para ${u.email}.`, 'success');
  } catch (e) { toast(authErrorMessage(e), 'error'); }
}

function copyText(text) {
  (navigator.clipboard?.writeText(text) || Promise.reject()).then(
    () => toast('Copiado para a área de transferência.', 'success'),
    () => { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); toast('Copiado.', 'success'); }
  );
}

function handleResetUrlOnLoad() { /* a página de nova senha é a do próprio Firebase */ }
