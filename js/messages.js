/* ============================================================
   messages.js — Sistema de mensagens internas
   - Usuário comum: pode iniciar conversa apenas com técnicos/admin
   - Técnico/admin: pode iniciar conversa com qualquer usuário
   ============================================================ */

let activeConversationUserId = null;

function renderMessages() {
  const u = currentUser();
  if (!u) { showView('auth'); return; }

  const conversations = getConversationsList(u.id);
  const mount = document.getElementById('messagesContent');
  const hasThread = activeConversationUserId ? 'has-thread' : '';

  mount.innerHTML = `
    <div class="messages-grid ${hasThread}">
      <div class="conv-list">
        <div class="conv-list-head">
          <div class="conv-list-title">Conversas</div>
          <button class="btn dark" style="padding:6px 12px;font-size:13px;" onclick="openNewConversationModal()">+ Nova</button>
        </div>
        <div id="convList">
          ${conversations.length === 0
            ? '<div class="empty"><div class="empty-icon">○</div>Nenhuma conversa ainda.</div>'
            : conversations.map(c => renderConversationItem(c, u.id)).join('')
          }
        </div>
      </div>
      <div class="conv-thread" id="convThread">
        ${activeConversationUserId
          ? renderConversationThread(activeConversationUserId, u.id)
          : '<div class="conv-empty">Selecione uma conversa para visualizar as mensagens.</div>'
        }
      </div>
    </div>
  `;

  // Auto-scroll para o final
  setTimeout(() => {
    const msgs = document.getElementById('convMessages');
    if (msgs) msgs.scrollTop = msgs.scrollHeight;
  }, 50);
}

function getConversationsList(myId) {
  // Agrupa mensagens por contraparte
  const partners = new Map();
  (window.db.messages || []).forEach(m => {
    if (m.fromUserId !== myId && m.toUserId !== myId) return;
    const otherId = m.fromUserId === myId ? m.toUserId : m.fromUserId;
    const existing = partners.get(otherId);
    if (!existing || m.sentAt > existing.lastAt) {
      partners.set(otherId, {
        otherId,
        lastAt: m.sentAt,
        lastBody: m.body,
        lastFromMe: m.fromUserId === myId
      });
    }
  });

  // Conta não lidas por parceiro
  partners.forEach((conv, otherId) => {
    conv.unreadCount = (window.db.messages || []).filter(m =>
      m.fromUserId === otherId && m.toUserId === myId && !m.readAt
    ).length;
  });

  return Array.from(partners.values()).sort((a,b) => b.lastAt - a.lastAt);
}

function renderConversationItem(conv, myId) {
  const other = getUser(conv.otherId);
  if (!other) return '';
  const isActive = activeConversationUserId === conv.otherId;
  const unread = conv.unreadCount > 0;
  const cls = `conv-item ${isActive?'active':''} ${unread && !isActive?'unread':''}`;
  const preview = (conv.lastFromMe ? 'Você: ' : '') + (conv.lastBody.length > 60 ? conv.lastBody.slice(0,60) + '…' : conv.lastBody);

  return `<div class="${cls}" onclick="openConversation('${conv.otherId}')">
    ${renderAvatar(other)}
    <div class="conv-item-info">
      <div class="conv-item-name">
        <span>${escapeHtml(other.name)}</span>
        <span class="conv-item-time">${fmtTime(conv.lastAt)}</span>
      </div>
      <div class="conv-item-preview">${escapeHtml(preview)}</div>
    </div>
    ${unread && !isActive ? '<div class="conv-unread-dot"></div>' : ''}
  </div>`;
}

function renderConversationThread(otherId, myId) {
  const other = getUser(otherId);
  if (!other) return '<div class="conv-empty">Usuário não encontrado.</div>';

  // Marcar como lidas todas as mensagens recebidas deste usuário
  (window.db.messages || []).forEach(m => {
    if (m.fromUserId === otherId && m.toUserId === myId && !m.readAt) {
      m.readAt = Date.now();
    }
  });
  saveDB();
  updateNavBadges();

  // Filtra mensagens da conversa
  const messages = (window.db.messages || [])
    .filter(m =>
      (m.fromUserId === myId && m.toUserId === otherId) ||
      (m.fromUserId === otherId && m.toUserId === myId)
    )
    .sort((a,b) => a.sentAt - b.sentAt);

  const roleLabel = other.role === 'admin' ? 'Coordenação'
                   : other.role === 'technician' ? 'Técnico'
                   : CATEGORY_LABELS[other.category] || '';

  return `
    <div class="conv-head">
      <button class="conv-back" onclick="closeConversation()">‹</button>
      ${renderAvatar(other)}
      <div>
        <div class="conv-head-name">${escapeHtml(other.name)}</div>
        <div class="conv-head-meta">${roleLabel}</div>
      </div>
    </div>
    <div class="conv-messages" id="convMessages">
      ${messages.length === 0
        ? '<div style="text-align:center;color:var(--ink-500);padding:30px;font-size:13px;">Comece a conversa enviando uma mensagem abaixo.</div>'
        : messages.map(m => renderMessageBubble(m, myId)).join('')
      }
    </div>
    <div class="conv-input">
      <textarea id="msgInput" placeholder="Escreva uma mensagem..." onkeydown="onMsgKeydown(event)" rows="1"></textarea>
      <button onclick="sendMessage()">Enviar</button>
    </div>
  `;
}

function renderMessageBubble(m, myId) {
  const isMine = m.fromUserId === myId;
  return `<div class="msg-bubble ${isMine?'mine':'theirs'}">
    ${escapeHtml(m.body).replace(/\n/g,'<br>')}
    <span class="msg-time">${fmtDateTime(m.sentAt)}</span>
  </div>`;
}

function openConversation(otherId) {
  activeConversationUserId = otherId;
  renderMessages();
}

function closeConversation() {
  activeConversationUserId = null;
  renderMessages();
}

function onMsgKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

function sendMessage() {
  const u = currentUser();
  if (!u || !activeConversationUserId) return;
  const input = document.getElementById('msgInput');
  const body = input.value.trim();
  if (!body) return;

  if (!window.db.messages) window.db.messages = [];
  window.db.messages.push({
    id: uid('msg'),
    fromUserId: u.id,
    toUserId: activeConversationUserId,
    body,
    sentAt: Date.now(),
    readAt: null
  });
  saveDB();
  input.value = '';
  renderMessages();
}

function openNewConversationModal() {
  const u = currentUser();
  if (!u) return;

  // Decide quem o usuário pode contactar
  let availableUsers;
  if (u.role === 'admin' || u.role === 'technician') {
    // Pode falar com todos exceto consigo mesmo
    availableUsers = window.db.users.filter(x => x.id !== u.id);
  } else {
    // Usuário comum só pode falar com técnicos/admins
    availableUsers = window.db.users.filter(x =>
      x.id !== u.id && (x.role === 'admin' || x.role === 'technician')
    );
  }

  // Remove os que já têm conversa ativa
  const existingPartners = new Set(getConversationsList(u.id).map(c => c.otherId));
  const newUsers = availableUsers.filter(x => !existingPartners.has(x.id));

  if (newUsers.length === 0) {
    return toast('Você já tem conversa com todos os contatos disponíveis.', 'warn');
  }

  const html = `
    <div class="modal-head">
      <div>
        <div class="modal-title">Nova conversa</div>
        <div class="modal-sub">Escolha com quem deseja conversar</div>
      </div>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      ${newUsers.map(usr => {
        const roleLabel = usr.role === 'admin' ? 'Coordenação'
                         : usr.role === 'technician' ? 'Técnico'
                         : CATEGORY_LABELS[usr.category] || '';
        return `<div onclick="closeModal();openConversation('${usr.id}')"
          style="display:flex;gap:12px;align-items:center;padding:12px;border:1px solid var(--line-200);border-radius:6px;margin-bottom:8px;cursor:pointer;transition:background 0.15s;"
          onmouseover="this.style.background='var(--paper-warm)'"
          onmouseout="this.style.background='white'">
          ${renderAvatar(usr)}
          <div style="flex:1;">
            <div style="font-weight:600;">${escapeHtml(usr.name)}</div>
            <div style="font-size:12px;color:var(--ink-500);">${roleLabel} · ${escapeHtml(usr.email)}</div>
          </div>
        </div>`;
      }).join('')}
    </div>
  `;
  openModal(html);
}

window.activeConversationUserId = activeConversationUserId;
window.renderMessages = renderMessages;
window.openConversation = openConversation;
window.closeConversation = closeConversation;
window.onMsgKeydown = onMsgKeydown;
window.sendMessage = sendMessage;
window.openNewConversationModal = openNewConversationModal;
