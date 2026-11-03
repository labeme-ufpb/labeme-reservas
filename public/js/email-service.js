/* ============================================================
   email-service.js — Envio de e-mails via EmailJS (v10)
   Sem configuração, nada é exibido a quem solicitou: o pedido
   fica na fila da coordenação (Admin → Senhas).
   ============================================================ */

let _emailJsInitialized = false;
function initEmailJs() {
  if (_emailJsInitialized) return true;
  if (typeof window.emailjs === 'undefined' || !isEmailConfigured()) return false;
  try { window.emailjs.init({ publicKey: EMAIL_CONFIG.publicKey }); _emailJsInitialized = true; return true; }
  catch (e) { console.error('Falha ao inicializar EmailJS:', e); return false; }
}

async function sendPasswordResetEmail({ toEmail, toName, resetLink }) {
  if (!isEmailConfigured() || !initEmailJs()) return { success: false, simulated: true };
  try {
    await window.emailjs.send(EMAIL_CONFIG.serviceId, EMAIL_CONFIG.templateId, {
      to_email: toEmail, to_name: toName, reset_link: resetLink,
      lab_name: window.db?.settings?.labName || 'LABEME — UFPB'
    });
    return { success: true };
  } catch (err) {
    console.error('Erro EmailJS:', err);
    return { success: false, error: err?.text || err?.message || 'Falha no envio' };
  }
}
