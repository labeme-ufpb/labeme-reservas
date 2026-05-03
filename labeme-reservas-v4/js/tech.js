/* ============================================================
   tech.js — Dashboard do técnico (v4)
   Agora com 3 abas: Pendentes / Hoje / Próximos 7 dias
   Pendentes têm botões de aprovar/recusar diretamente.
   ============================================================ */

let techRange = 'pending';

function setTechRange(r) {
  techRange = r;
  document.querySelectorAll('#view-tech .view-toggle button').forEach(b =>
    b.classList.toggle('active', b.dataset.range === r)
  );
  renderTechDashboard();
}

function renderTechDashboard() {
  const u = currentUser();
  if (!u || !['technician','admin'].includes(u.role)) {
    showView('calendar');
    return;
  }

  const today = todayISO();
  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndISO = weekEnd.toISOString().slice(0,10);

  // Estatísticas globais (sempre exibidas)
  const pendingApproval = window.db.reservations.filter(r => r.status === 'pending').length;
  const todayCount = window.db.reservations.filter(r =>
    r.date === today && ['approved','in_use','awaiting_return'].includes(r.status)
  ).length;
  const week7Count = window.db.reservations.filter(r =>
    ['approved','in_use','awaiting_return'].includes(r.status) &&
    r.date >= today && r.date <= weekEndISO
  ).length;
  const presenceRequiredAll = window.db.reservations.filter(r => {
    if (!['approved','in_use','awaiting_return'].includes(r.status)) return false;
    if (r.date < today || r.date > weekEndISO) return false;
    const res = getResource(r.resourceId);
    return res?.requiresTechnicianPresence;
  }).length;
  const awaitingReturn = window.db.reservations.filter(r => r.status === 'awaiting_return').length;

  document.getElementById('techStats').innerHTML = `
    <div class="stat-card accent-amber">
      <div class="stat-label">Pendentes</div>
      <div class="stat-value">${pendingApproval}</div>
      <div class="stat-foot">aguardando aprovação</div>
    </div>
    <div class="stat-card accent-green">
      <div class="stat-label">Hoje</div>
      <div class="stat-value">${todayCount}</div>
      <div class="stat-foot">reservas ativas</div>
    </div>
    <div class="stat-card accent-steel">
      <div class="stat-label">Sua presença</div>
      <div class="stat-value">${presenceRequiredAll}</div>
      <div class="stat-foot">obrigatória nos próximos dias</div>
    </div>
    <div class="stat-card accent-navy">
      <div class="stat-label">Devoluções</div>
      <div class="stat-value">${awaitingReturn}</div>
      <div class="stat-foot">a confirmar</div>
    </div>
  `;

  // Atualiza badge da aba "Pendentes"
  const pendingBadge = document.getElementById('techPendingBadge');
  if (pendingBadge) {
    pendingBadge.textContent = pendingApproval;
    pendingBadge.style.display = pendingApproval > 0 ? 'inline-grid' : 'none';
  }

  // Renderiza conteúdo da aba ativa
  const mount = document.getElementById('techContent');
  if (techRange === 'pending') {
    mount.innerHTML = renderTechPending();
  } else if (techRange === 'today') {
    mount.innerHTML = renderTechRangeList(today, today, 'Reservas de hoje');
  } else {
    mount.innerHTML = renderTechRangeList(today, weekEndISO, 'Próximos 7 dias');
  }
}

function renderTechPending() {
  const list = window.db.reservations
    .filter(r => r.status === 'pending')
    .sort((a,b) => a.date.localeCompare(b.date));

  if (list.length === 0) {
    return `<div class="panel">
      <div class="panel-head"><div><div class="panel-title">Solicitações pendentes</div><div class="panel-sub">Aguardando aprovação de técnicos ou coordenação.</div></div></div>
      <div class="empty"><div class="empty-icon">✓</div>Nenhuma solicitação pendente — você está em dia!</div>
    </div>`;
  }

  return `<div class="panel">
    <div class="panel-head"><div><div class="panel-title">Solicitações pendentes</div><div class="panel-sub">${list.length} aguardando aprovação. Clique em ✓ para aprovar ou ✕ para recusar.</div></div></div>
    <div style="padding: 8px;">
      ${list.map(r => renderTechPendingCard(r)).join('')}
    </div>
  </div>`;
}

function renderTechPendingCard(r) {
  const res = getResource(r.resourceId);
  const u = getUser(r.userId);
  const sText = slotText(r, window.db.settings);
  const qty = r.quantity > 1 ? ` ×${r.quantity}` : '';
  const presenceTag = res?.requiresTechnicianPresence
    ? '<span class="pill tech-required" style="margin-left:6px;">Sua presença obrigatória</span>'
    : '';

  return `<div style="display:flex;gap:14px;padding:14px;border:1px solid var(--line-100);border-radius:var(--radius-sm);margin-bottom:8px;align-items:flex-start;background:white;">
    ${res?.photo ? `<img src="${res.photo}" style="width:60px;height:60px;object-fit:cover;border-radius:6px;flex-shrink:0;">` : `<div class="resource-thumb-empty" style="width:60px;height:60px;font-size:24px;flex-shrink:0;">⚙</div>`}
    <div style="flex:1;min-width:0;">
      <div style="display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:4px;">
        <strong style="font-size:15px;color:var(--ink-900);">${escapeHtml(res?.name||'?')}${qty}</strong>
        ${presenceTag}
      </div>
      <div style="font-size:13px;color:var(--ink-700);margin-bottom:4px;">
        <strong>${fmtDate(r.date)}</strong> · ${sText}
      </div>
      <div style="font-size:13px;color:var(--ink-500);margin-bottom:6px;">
        Solicitante: <strong>${escapeHtml(u?.name||'?')}</strong> (${CATEGORY_LABELS[u?.category]||''})
        ${u?.advisor ? ` · Orientador: ${escapeHtml(u.advisor)}` : ''}
      </div>
      ${r.purpose ? `<div style="font-size:13px;color:var(--ink-700);font-style:italic;background:var(--paper-warm);padding:8px 10px;border-radius:6px;border-left:3px solid var(--line-300);">"${escapeHtml(r.purpose)}"</div>` : ''}
    </div>
    <div style="display:flex;gap:6px;flex-shrink:0;">
      <button class="icon-btn success" onclick="setReservationStatus('${r.id}','approved')" title="Aprovar">✓</button>
      <button class="icon-btn danger" onclick="setReservationStatus('${r.id}','denied')" title="Recusar">✕</button>
      <button class="icon-btn" onclick="showResDetail('${r.id}')" title="Ver detalhes">👁</button>
      ${currentUser() && currentUser().id !== u?.id ? `<button class="icon-btn" onclick="openConversation('${u?.id}');showView('messages')" title="Mensagem">💬</button>` : ''}
    </div>
  </div>`;
}

function renderTechRangeList(startISO, endISO, title) {
  const list = window.db.reservations
    .filter(r => {
      if (!['approved','in_use','awaiting_return'].includes(r.status)) return false;
      return r.date >= startISO && r.date <= endISO;
    })
    .sort((a,b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      const aStart = a.mode === 'slot' ? a.slot.start : (a.slot.turno === 'manha' ? '08:00' : '14:00');
      const bStart = b.mode === 'slot' ? b.slot.start : (b.slot.turno === 'manha' ? '08:00' : '14:00');
      return aStart.localeCompare(bStart);
    });

  if (list.length === 0) {
    return `<div class="panel"><div class="empty">
      <div class="empty-icon">○</div>
      Nenhuma reserva ativa em ${title.toLowerCase()}.
    </div></div>`;
  }

  // Agrupa por dia
  const byDay = {};
  list.forEach(r => {
    if (!byDay[r.date]) byDay[r.date] = [];
    byDay[r.date].push(r);
  });

  return Object.keys(byDay).sort().map(date => {
    const evs = byDay[date];
    return `<div class="tech-day-card">
      <h3>${fmtDateLong(date)}</h3>
      ${evs.map(r => renderTechEventRow(r)).join('')}
    </div>`;
  }).join('');
}

function renderTechEventRow(r) {
  const res = getResource(r.resourceId);
  const u = getUser(r.userId);
  const time = r.mode === 'slot' ? `${r.slot.start}–${r.slot.end}` : TURNO_LABELS[r.slot.turno];
  const presenceTag = res?.requiresTechnicianPresence
    ? '<span class="pill tech-required">Sua presença obrigatória</span>'
    : (res?.requiresTechnicianAssist ? '<span class="pill auto">Acompanhamento</span>' : '');
  const qty = r.quantity > 1 ? ` ×${r.quantity}` : '';
  const photoHtml = res?.photo
    ? `<img src="${res.photo}" style="width:48px;height:48px;object-fit:cover;border-radius:4px;margin-right:6px;">`
    : '';

  return `<div class="tech-event-row" onclick="showResDetail('${r.id}')" style="cursor:pointer;">
    <div class="tev-time">${time}</div>
    ${photoHtml}
    <div class="tev-info">
      <strong>${escapeHtml(res?.name||'?')}${qty} ${presenceTag}</strong>
      <small>${escapeHtml(u?.name||'?')} · ${CATEGORY_LABELS[u?.category]||''}${res?.location ? ' · 📍 '+escapeHtml(res.location) : ''}</small>
      ${r.purpose ? `<small style="display:block;margin-top:4px;font-style:italic;">"${escapeHtml(r.purpose)}"</small>` : ''}
    </div>
    <span class="pill ${r.status}">${RES_STATUS[r.status]}</span>
  </div>`;
}

window.techRange = techRange;
window.setTechRange = setTechRange;
window.renderTechDashboard = renderTechDashboard;
