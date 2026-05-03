/* ============================================================
   app.js — Roteamento e bootstrap (v3)
   ============================================================ */

function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const v = document.getElementById('view-' + name);
  if (v) v.classList.add('active');

  document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
  const link = document.getElementById('nav-' + name);
  if (link) link.classList.add('active');

  if (name === 'calendar') renderCalendar();
  if (name === 'resources') renderResources();
  if (name === 'auth') {
    // Sempre que entrar nesta view, força a aba "Entrar"
    setAuthTab('login');
  }
  if (name === 'myres') {
    if (!currentUser()) { showView('auth'); return; }
    renderMyReservations();
  }
  if (name === 'profile') {
    if (!currentUser()) { showView('auth'); return; }
    renderProfile();
  }
  if (name === 'messages') {
    if (!currentUser()) { showView('auth'); return; }
    renderMessages();
  }
  if (name === 'stock') {
    if (!currentUser()) { showView('auth'); return; }
    renderStock();
  }
  if (name === 'tech') {
    const u = currentUser();
    if (!u || !['technician','admin'].includes(u.role)) {
      toast('Acesso restrito a técnicos.', 'warn');
      showView('auth'); return;
    }
    renderTechDashboard();
  }
  if (name === 'admin') {
    if (!isAdmin()) {
      toast('Acesso restrito à coordenação.', 'warn');
      showView('auth'); return;
    }
    renderAdmin();
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderResources() {
  const grid = document.getElementById('resourcesGrid');
  const list = window.db.resources.filter(r => r.active);
  if (list.length === 0) {
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1;">
      <div class="empty-icon">⚙</div>
      Nenhum recurso cadastrado ainda.
      ${isAdmin() ? '<br><button class="btn dark mt-4" onclick="showView(\'admin\');setAdminTab(\'resources\')">Cadastrar primeiro recurso</button>' : ''}
    </div>`;
    return;
  }
  grid.innerHTML = list.map(r => {
    const upcoming = window.db.reservations.filter(x =>
      x.resourceId === r.id &&
      ['approved','in_use','pending'].includes(x.status) &&
      x.date >= todayISO()
    ).length;
    const photo = r.photo
      ? `<img src="${r.photo}" alt="${escapeHtml(r.name)}">`
      : `${r.type==='equipment'?'⚙':r.type==='consumable'?'⊟':'▢'}`;
    return `<div class="resource-card">
      <div class="card-photo">${photo}</div>
      <div class="card-body">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap;">
          <span class="pill ${r.type==='equipment'?'equip':r.type==='consumable'?'consumable':'space'}">${r.type==='equipment'?'Equipamento':r.type==='consumable'?'Item múltiplo':'Espaço'}</span>
          ${r.requiresTechnicianPresence ? '<span class="pill tech-required">Técnico obrig.</span>' : ''}
        </div>
        <h3>${escapeHtml(r.name)}</h3>
        ${r.location ? `<div class="card-loc">📍 ${escapeHtml(r.location)}</div>` : ''}
        <p class="card-desc">${escapeHtml(r.description||'')}</p>
        <div class="card-footer">
          <span>${r.totalQuantity > 1 ? r.totalQuantity + ' unidades' : (r.mode==='slot'?'Por horário':r.mode==='turno'?'Por turno':'Turno ou horário')}</span>
          <span>${upcoming} próx.</span>
        </div>
        <button class="btn dark card-reserve-btn" onclick="openReserveModal({resourceId:'${r.id}'})">Reservar</button>
      </div>
    </div>`;
  }).join('');
}

window.addEventListener('DOMContentLoaded', () => {
  window.db = loadDB();

  // Aplica dados de demonstração no primeiro acesso
  if (typeof applySeedData === 'function') {
    applySeedData();
  }

  document.getElementById('modalOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'modalOverlay') closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  refreshAuthUI();

  // Polling leve para atualizar badges de mensagens (a cada 5s)
  setInterval(() => {
    if (currentUser()) {
      // Recarrega DB caso outra aba tenha alterado (no protótipo localStorage)
      const fresh = loadDB();
      window.db.messages = fresh.messages;
      updateNavBadges();
      // Se está na tela de mensagens, atualiza — MAS só se o usuário NÃO estiver digitando
      const msgInput = document.getElementById('msgInput');
      const userIsTyping = msgInput && (document.activeElement === msgInput || msgInput.value.length > 0);
      if (document.getElementById('view-messages').classList.contains('active')
          && !document.getElementById('modalOverlay').classList.contains('show')
          && !userIsTyping) {
        renderMessages();
      }
    }
  }, 5000);

  const u = currentUser();
  if (u?.role === 'technician') showView('tech');
  else if (u?.role === 'admin') showView('admin');
  else showView('calendar');
});

window.showView = showView;
window.renderResources = renderResources;
