/* ============================================================
   calendar.js — Calendário mensal, semanal e agenda (v10)
   - Datas no fuso local (bug de UTC corrigido)
   - Filtro por recurso com busca (escala para ~100 itens)
   - "Só minhas reservas"
   - Grade semanal derivada dos turnos configurados
   - Cores por STATUS (com 90+ recursos, cor por recurso perde sentido)
   - Visão "Agenda" (lista) — padrão no celular
   ============================================================ */

let calView = isMobile() ? 'agenda' : 'month';
let calDate = new Date(); if (calView === 'month') calDate.setDate(1);
let activeResourceFilter = 'all';
let calOnlyMine = false;

function setCalView(v) {
  calView = v;
  if (v !== 'month') calDate = new Date(); // semana/agenda começam hoje
  if (v === 'month') calDate.setDate(1);
  renderCalendar();
}
function navCal(dir) {
  if (dir === 0) { calDate = new Date(); if (calView === 'month') calDate.setDate(1); }
  else if (calView === 'month') calDate.setMonth(calDate.getMonth() + dir);
  else calDate.setDate(calDate.getDate() + dir * 7);
  renderCalendar();
}
function setResourceFilter(id) { activeResourceFilter = id || 'all'; renderCalendar(); }
function toggleOnlyMine(v) { calOnlyMine = v; renderCalendar(); }
// Ao entrar: usuários comuns veem só as próprias reservas; equipe vê todas
function resetCalendarPrefs(u) { calOnlyMine = !!u && u.role === 'user'; activeResourceFilter = 'all'; }

/* Seletor de equipamento em lista (o <select> nativo desalinhava nomes longos no celular) */
function openResourcePicker() {
  const used = new Set(window.db.reservations.map(r => r.resourceId));
  window._pickerList = window.db.resources.filter(r => r.active || used.has(r.id))
    .sort((a, b) => groupRank(a.group) - groupRank(b.group) || a.name.localeCompare(b.name, 'pt-BR', { numeric: true }));
  openModal(`
    <div class="modal-head">
      <div><div class="modal-title">Filtrar por equipamento</div><div class="modal-sub">Mostra na agenda só as reservas do item escolhido</div></div>
      <button class="modal-close" onclick="closeModal()" aria-label="Fechar">${icon('x')}</button>
    </div>
    <div class="modal-body picker-body">
      <div class="input-icon">${icon('search', 16)}<input type="search" id="pickerSearch" placeholder="Digite parte do nome" oninput="renderPickerList(this.value)" autocomplete="off"></div>
      <div id="pickerList" class="picker-list"></div>
    </div>`);
  renderPickerList('');
}
function renderPickerList(term) {
  const t = normalizeTxt(term);
  const list = window._pickerList.filter(r => !t || normalizeTxt([r.name, r.model, r.group, r.location].join(' ')).includes(t));
  let last = null, html = '';
  if (!t) html += `<button class="picker-row ${activeResourceFilter === 'all' ? 'on' : ''}" onclick="pickResource('all')"><span class="picker-thumb all">${icon('grid', 18)}</span><span class="picker-text"><strong>Todos os equipamentos</strong></span>${activeResourceFilter === 'all' ? icon('check', 18) : ''}</button>`;
  list.forEach(r => {
    const g = r.group || 'Outros';
    if (g !== last) { html += `<div class="picker-group">${escapeHtml(g)}</div>`; last = g; }
    const img = safeImg(r.photo);
    html += `<button class="picker-row ${activeResourceFilter === r.id ? 'on' : ''}" onclick="pickResource('${r.id}')">
      ${img ? `<img class="picker-thumb" src="${img}" alt="" loading="lazy">` : `<span class="picker-thumb">${icon('box', 18)}</span>`}
      <span class="picker-text"><strong>${escapeHtml(r.name)}</strong><small>${escapeHtml([r.location, r.status === 'maintenance' ? 'em manutenção' : ''].filter(Boolean).join(' · '))}</small></span>
      ${activeResourceFilter === r.id ? icon('check', 18) : ''}</button>`;
  });
  if (!list.length) html += '<div class="small muted" style="padding:12px 4px;">Nenhum equipamento encontrado.</div>';
  document.getElementById('pickerList').innerHTML = html;
}
function pickResource(id) { closeModal(); setResourceFilter(id); }

function visibleReservations() {
  const me = currentUser();
  return window.db.reservations.filter(r => {
    if (!ACTIVE_STATUSES.includes(r.status) && !['returned','completed'].includes(r.status)) return false;
    if (activeResourceFilter !== 'all' && r.resourceId !== activeResourceFilter) return false;
    if (calOnlyMine && me && r.userId !== me.id) return false;
    return true;
  });
}
function eventsOn(iso) {
  return visibleReservations().filter(r => r.date === iso)
    .sort((a, b) => reservationRange(a).start.localeCompare(reservationRange(b).start));
}
function eventClassFor(r) {
  return { pending: 'ev-pending', approved: 'ev-approved', in_use: 'ev-inuse', awaiting_return: 'ev-return', returned: 'ev-done', completed: 'ev-done' }[r.status] || 'ev-approved';
}

function renderCalendarToolbar() {
  const me = currentUser();
  const sel = activeResourceFilter !== 'all' ? getResource(activeResourceFilter) : null;
  document.getElementById('calFilters').innerHTML = `
    <div class="cal-filter">
      <div class="fctl"><span id="calResLbl">Filtrar por equipamento</span>
        <div class="picker-field">
          <button type="button" class="picker-btn" id="calResFilter" aria-labelledby="calResLbl calResFilter" onclick="openResourcePicker()">
            <span class="picker-btn-text">${sel ? escapeHtml(sel.name) : 'Todos os equipamentos'}</span>${icon('arrowRight', 16, 'picker-chev')}
          </button>
          ${sel ? `<button type="button" class="icon-btn" aria-label="Limpar filtro" title="Limpar filtro" onclick="setResourceFilter('all')">${icon('x', 16)}</button>` : ''}
        </div>
      </div>
      ${me ? `<label class="switch-toggle"><input type="checkbox" id="calOnlyMine" ${calOnlyMine ? 'checked' : ''} onchange="toggleOnlyMine(this.checked)"><span class="track" aria-hidden="true"></span><span>Só as minhas reservas</span></label>` : ''}
    </div>
    <div class="cal-legend" aria-label="Legenda">
      <span><i class="ev-approved"></i>Aprovada</span><span><i class="ev-pending"></i>Pendente</span>
      <span><i class="ev-inuse"></i>Em uso</span><span><i class="ev-done"></i>Encerrada</span>
    </div>`;
  ['month','week','agenda'].forEach(v => {
    const b = document.getElementById('calBtn-' + v);
    if (b) { b.classList.toggle('active', calView === v); b.setAttribute('aria-pressed', calView === v); }
  });
}

function renderCalendar() {
  renderCalendarToolbar();
  renderCalendarSummary();
  const mount = document.getElementById('calendarMount');
  const period = document.getElementById('calPeriod');
  if (calView === 'month') {
    mount.innerHTML = renderMonthGrid();
    period.textContent = capitalize(calDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }));
  } else if (calView === 'week') {
    mount.innerHTML = renderWeekGrid();
    const ws = weekStart(calDate), we = new Date(ws); we.setDate(ws.getDate() + weekDays().length - 1);
    period.textContent = `${ws.getDate()} ${ws.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')} – ${we.getDate()} ${we.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace('.', '')}`;
  } else {
    mount.innerHTML = renderAgenda();
    const start = localISO(calDate);
    period.textContent = `A partir de ${fmtDate(start)}`;
  }
}

/* Resumo pessoal acima do calendário */
function renderCalendarSummary() {
  const el = document.getElementById('calSummary'); if (!el) return;
  const u = currentUser();
  if (!u) {
    el.innerHTML = `<div class="welcome-card">
      <div><strong>Consulte a disponibilidade sem login.</strong><span class="muted"> Para reservar, entre com sua conta institucional.</span></div>
      <div class="flex-row"><button class="btn" onclick="showView('resources')">${icon('grid', 16)} Ver equipamentos</button><button class="btn dark" onclick="showView('auth')">Entrar</button></div>
    </div>`;
    return;
  }
  const mine = window.db.reservations.filter(r => r.userId === u.id);
  const next = mine.filter(r => r.date >= todayISO() && ['approved','pending','in_use'].includes(r.status)).sort((a, b) => (a.date + reservationRange(a).start).localeCompare(b.date + reservationRange(b).start));
  const overdue = mine.filter(isOverdueReturn);
  el.innerHTML = `<div class="summary-strip">
    <div class="sum-item"><span class="sum-n">${next.length}</span><span class="sum-l">reserva(s) futura(s)</span></div>
    <div class="sum-item"><span class="sum-n">${mine.filter(r => r.status === 'pending').length}</span><span class="sum-l">aguardando aprovação</span></div>
    ${overdue.length ? `<button class="sum-item alert" onclick="showView('myres');setMyResFilter('action')"><span class="sum-n">${overdue.length}</span><span class="sum-l">devolução atrasada</span></button>` : ''}
    <div class="sum-next">${next[0] ? `<span class="small muted">Próxima:</span> <button class="linklike" onclick="showResDetail('${next[0].id}')"><strong>${escapeHtml(resourceName(next[0].resourceId))}</strong> · ${fmtDateShort(next[0].date)} · ${slotText(next[0])}</button>` : '<span class="small muted">Nenhuma reserva futura.</span>'}</div>
  </div>`;
}

function renderMonthGrid() {
  const year = calDate.getFullYear(), month = calDate.getMonth();
  const startOffset = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = todayISO();
  const s = window.db.settings;
  const heads = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(d => `<div>${d}</div>`).join('');
  let cells = '';
  const prevDays = new Date(year, month, 0).getDate();
  for (let i = startOffset - 1; i >= 0; i--) cells += `<div class="day-cell outside" aria-hidden="true"><div class="day-num">${prevDays - i}</div></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = localISO(new Date(year, month, d));
    const closed = (!s.allowWeekends && isWeekendISO(iso)) || (s.closedDates || []).includes(iso);
    const past = iso < today;
    const events = eventsOn(iso);
    const evHtml = events.slice(0, 3).map(r => `<div class="day-event ${eventClassFor(r)}" title="${escapeHtml(resourceName(r.resourceId))} · ${slotText(r)}">${escapeHtml(resourceName(r.resourceId))}</div>`).join('');
    const more = events.length > 3 ? `<div class="day-more">+${events.length - 3} mais</div>` : '';
    const label = `${d} — ${events.length} reserva(s)${closed ? ', laboratório fechado' : ''}`;
    cells += `<div class="day-cell ${iso === today ? 'today' : ''} ${closed ? 'weekend' : ''} ${past ? 'past' : ''}" role="button" tabindex="0" aria-label="${label}"
      onclick="onDayClick('${iso}')" onkeydown="if(event.key==='Enter')onDayClick('${iso}')">
      <div class="day-num">${d}</div>
      ${events.length ? `<span class="day-dot-count">${events.length}</span>` : ''}
      <div class="day-events">${evHtml}${more}</div>
    </div>`;
  }
  const trailing = (7 - ((startOffset + daysInMonth) % 7)) % 7;
  for (let i = 1; i <= trailing; i++) cells += `<div class="day-cell outside" aria-hidden="true"><div class="day-num">${i}</div></div>`;
  return `<div class="month-grid"><div class="month-head">${heads}</div><div class="month-body">${cells}</div></div>`;
}

function weekStart(d) {
  const x = new Date(d); const day = x.getDay();
  x.setDate(x.getDate() + ((day === 0 ? -6 : 1) - day)); x.setHours(0, 0, 0, 0);
  return x;
}
function weekDays() { return window.db.settings.allowWeekends ? [0,1,2,3,4,5] : [0,1,2,3,4]; }
// Blocos de 2 h dentro de cada turno configurado
function weekSlots() {
  const s = window.db.settings; const out = [];
  ['manha','tarde'].forEach(t => {
    const tr = turnoRange(t, s); if (!tr) return;
    let a = hhmmToMin(tr.start); const end = hhmmToMin(tr.end);
    while (a < end) {
      const b = Math.min(a + 120, end);
      const f = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
      out.push({ start: f(a), end: f(b), turno: t }); a = b;
    }
  });
  return out;
}
function renderWeekGrid() {
  const ws = weekStart(calDate);
  const names = ['Seg','Ter','Qua','Qui','Sex','Sáb'];
  const days = weekDays().map(i => { const d = new Date(ws); d.setDate(ws.getDate() + i); return d; });
  const today = todayISO();
  const cols = days.length;
  const head = `<div></div>` + days.map((d, i) => `<div class="${localISO(d) === today ? 'is-today' : ''}"><div class="wd">${names[i]}</div><div class="week-day-num ${localISO(d) === today ? 'today-marker' : ''}">${d.getDate()}</div></div>`).join('');
  let body = '';
  weekSlots().forEach((slot, idx, arr) => {
    const gap = idx > 0 && arr[idx - 1].turno !== slot.turno;
    body += `<div class="time-label ${gap ? 'gap' : ''}">${slot.start}<br>${slot.end}</div>`;
    days.forEach(d => {
      const iso = localISO(d);
      const events = eventsOn(iso).filter(r => rangesOverlap(reservationRange(r), slot));
      const ev = events.slice(0, 2).map(r => `<button class="week-event ${eventClassFor(r)}" onclick="event.stopPropagation();showResDetail('${r.id}')">
          <strong>${escapeHtml(resourceName(r.resourceId))}${r.quantity > 1 ? ` ×${r.quantity}` : ''}</strong><small>${escapeHtml(shortName(userName(r.userId), 2))}</small></button>`).join('');
      const more = events.length > 2 ? `<button class="week-more" onclick="event.stopPropagation();showDayDetail('${iso}', eventsOn('${iso}'))">+${events.length - 2}</button>` : '';
      body += `<div class="week-slot ${gap ? 'gap' : ''} ${iso < today ? 'past' : ''}" role="button" tabindex="0" aria-label="${fmtDateShort(iso)} ${slot.start} às ${slot.end}"
        onclick="onSlotClick('${iso}','${slot.start}','${slot.end}')" onkeydown="if(event.key==='Enter')onSlotClick('${iso}','${slot.start}','${slot.end}')">${ev}${more}</div>`;
    });
  });
  return `<div class="week-grid" style="--cols:${cols}"><div class="week-head">${head}</div><div class="week-body">${body}</div></div>`;
}

function renderAgenda() {
  const start = localISO(calDate);
  const days = [];
  for (let i = 0; i < 14; i++) {
    const iso = addDaysISO(start, i);
    const ev = eventsOn(iso);
    if (ev.length) days.push([iso, ev]);
  }
  if (!days.length) return `<div class="panel"><div class="empty">${icon('calendar', 28)}<div>${calOnlyMine ? 'Você não tem reservas' : 'Nenhuma reserva'} nos próximos 14 dias${activeResourceFilter !== 'all' ? ' para este equipamento' : ''}.</div>
    <div class="flex-row" style="justify-content:center;">${calOnlyMine ? `<button class="btn mt-4" onclick="toggleOnlyMine(false)">Ver reservas de todos</button>` : ''}<button class="btn dark mt-4" onclick="openReserveModal()">${icon('plus', 16)} Nova reserva</button></div></div></div>`;
  return days.map(([iso, ev]) => `
    <section class="agenda-day">
      <h3>${fmtDateLong(iso)}${iso === todayISO() ? ' <span class="pill auto">Hoje</span>' : ''}</h3>
      <div class="res-list">${ev.map(r => reservationRow(r, { showUser: true })).join('')}</div>
    </section>`).join('') + `<div class="center mt-4"><button class="btn" onclick="navCal(1)">Próximos dias ${icon('arrowRight', 16)}</button></div>`;
}

function onDayClick(iso) {
  const events = eventsOn(iso);
  if (events.length) return showDayDetail(iso, events);
  const prob = dateProblem(iso);
  if (prob && iso >= todayISO()) return toast(prob, 'warn');
  if (iso < todayISO()) return;
  openReserveModal({ date: iso, resourceId: activeResourceFilter !== 'all' ? activeResourceFilter : undefined });
}
function onSlotClick(iso, start, end) {
  const events = eventsOn(iso).filter(r => rangesOverlap(reservationRange(r), { start, end }));
  if (events.length) return showDayDetail(iso, events);
  if (iso < todayISO()) return;
  const prob = dateProblem(iso); if (prob) return toast(prob, 'warn');
  openReserveModal({ date: iso, startTime: start, endTime: end, resourceId: activeResourceFilter !== 'all' ? activeResourceFilter : undefined });
}
