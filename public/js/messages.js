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
  document.body.classList.toggle('thread-open', !!activeConversationUserId);

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
  const body = conv.lastBody || '';
  const preview = (conv.lastFromMe ? 'Você: ' : '') + (body.length > 60 ? body.slice(0,60) + '…' : body);

  return `<div class="${cls}" role="button" tabindex="0" onclick="openConversation('${conv.otherId}')" onkeydown="if(event.key==='Enter')openConversation('${conv.otherId}')">
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
      <button class="conv-back" onclick="closeConversation()" aria-label="Voltar">${icon('arrowLeft', 18)}</button>
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
      <label for="msgInput" class="sr-only">Mensagem</label>
      <textarea id="msgInput" placeholder="Escreva uma mensagem" onkeydown="onMsgKeydown(event)" rows="1" maxlength="2000"></textarea>
      <button onclick="sendMessage()" aria-label="Enviar">${icon('arrowRight', 18)}<span class="btn-label">Enviar</span></button>
    </div>
  `;
}

function renderMessageBubble(m, myId) {
  const isMine = m.fromUserId === myId;
  return `<div class="msg-bubble ${isMine?'mine':'theirs'} ${m.system?'system':''}">
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

  // Qualquer usuário cadastrado e ativo pode conversar com qualquer outro.
  // Equipe técnica e coordenação aparecem primeiro na lista.
  const staffFirst = x => (x.role === 'admin' ? 0 : x.role === 'technician' ? 1 : 2);
  const availableUsers = window.db.users
    .filter(x => x.id !== u.id && x.active !== false)
    .sort((a, b) => staffFirst(a) - staffFirst(b) || a.name.localeCompare(b.name, 'pt-BR'));

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
      <button class="modal-close" onclick="closeModal()" aria-label="Fechar">${icon('x')}</button>
    </div>
    <div class="modal-body">
      ${newUsers.length > 8 ? `<div class="input-icon" style="margin-bottom:10px;">${icon('search', 16)}<input type="search" id="newConvSearch" placeholder="Buscar pelo nome" oninput="filterNewConversation(this.value)" autofocus></div>` : ''}
      <div id="newConvList">
      ${newUsers.map(usr => {
        const roleLabel = usr.role === 'admin' ? 'Coordenação'
                         : usr.role === 'technician' ? 'Técnico'
                         : CATEGORY_LABELS[usr.category] || '';
        // e-mail só aparece para a equipe; entre usuários, só nome e vínculo
        const extra = isTechnician() ? ' · ' + escapeHtml(usr.email) : '';
        return `<button class="list-card" data-name="${escapeHtml(normalizeTxt(usr.name))}" onclick="closeModal();openConversation('${usr.id}')">
          ${renderAvatar(usr)}
          <div class="list-card-main">
            <strong>${escapeHtml(usr.name)}</strong>
            <span class="small muted">${escapeHtml(roleLabel)}${extra}</span>
          </div>
        </button>`;
      }).join('')}
      </div>
    </div>
  `;
  openModal(html);
}
function filterNewConversation(term) {
  const t = normalizeTxt(term.trim());
  document.querySelectorAll('#newConvList .list-card').forEach(b => { b.hidden = !!t && !b.dataset.name.includes(t); });
}

