/* ============================================================
   security.js — Política de senha e validação de e-mail (v11)
   As senhas agora ficam com o Firebase Authentication (servidor
   do Google); este arquivo só valida o que o usuário digita.
   ============================================================ */

function passwordProblem(pwd) {
  if (!pwd || pwd.length < 8) return 'A senha deve ter pelo menos 8 caracteres.';
  if (!/[A-Za-z]/.test(pwd) || !/\d/.test(pwd)) return 'Use letras e números na senha.';
  return null;
}
function validEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e); }
