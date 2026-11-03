/* ============================================================
   email-config.js — Configuração do serviço de e-mail (EmailJS)
   ============================================================

   COMO CONFIGURAR (faça depois de criar conta gratuita em emailjs.com):

   1. Crie uma conta em https://www.emailjs.com (plano Free = 200 e-mails/mês)

   2. Conecte um serviço de e-mail (Gmail, Outlook, ou SMTP) e copie o SERVICE ID

   3. Crie um Template com os seguintes parâmetros dinâmicos:
        - {{to_email}}    → destinatário
        - {{to_name}}     → nome do usuário
        - {{reset_link}}  → link de redefinição (gerado pelo sistema)
        - {{lab_name}}    → "LABEME — UFPB"
      Copie o TEMPLATE ID.

   4. Em "Account → General", copie a PUBLIC KEY.

   5. Em "Account → Security", adicione o domínio do GitHub Pages
      (ex.: SEU_USUARIO.github.io) à lista "Allowed Origins" — IMPORTANTE
      para impedir uso indevido da sua chave por terceiros.

   6. Preencha os três valores abaixo e salve.

   7. Em PRODUCTION_URL, coloque a URL completa do seu sistema no GitHub Pages.
      É para lá que os links de reset apontarão. Em ambiente local fica em branco
      e o sistema usa window.location automaticamente.

   ENQUANTO NÃO CONFIGURAR:
   Os pedidos de "Esqueci minha senha" ficam na fila da coordenação
   (Admin → Senhas). A coordenação gera o link e envia ao e-mail do usuário.
   (Na v9 o link aparecia na tela de quem pedia — falha corrigida na v10.)
   ============================================================ */

const EMAIL_CONFIG = {
  // Cole as credenciais do EmailJS aqui:
  publicKey:  '',  // ex.: 'abcDEF123_xyz'
  serviceId:  '',  // ex.: 'service_a1b2c3'
  templateId: '',  // ex.: 'template_x9y8z7'

  // URL pública do sistema. Deixe em branco para usar window.location.origin
  // (útil durante o desenvolvimento). Em produção, defina explicitamente:
  // ex.: 'https://prof-jose-augusto.github.io/labeme-reservas'
  productionUrl: '',

  // Tempo de validade do token de reset (em minutos)
  tokenValidityMinutes: 60,

  // Limite anti-abuso: minutos mínimos entre solicitações sucessivas
  // para o MESMO e-mail (impede flood de mensagens)
  rateLimitMinutes: 5
};

// Checa se a configuração está completa. Se não, os pedidos vão para a fila da coordenação.
function isEmailConfigured() {
  return !!(EMAIL_CONFIG.publicKey && EMAIL_CONFIG.serviceId && EMAIL_CONFIG.templateId);
}


