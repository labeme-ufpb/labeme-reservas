/* ============================================================
   calendar.js — Calendário (v3)
   Sem turno noite — apenas manhã (08:00-12:00) e tarde (14:00-18:00)
   ============================================================ */

let calView = 'month';
let calDate = new Date();
calDate.setDate(1);
let activeResourceFilter = 'all';

const RESOURCE_COLORS = ['green', 'navy', 'steel', 'amber'];

function setCalView(v) {
  calView = v;
  document.getElementById('viewMonthBtn').classList.toggle('active', v === 'month');
  document.getElementById('viewWeekBtn').classList.toggle('active', v === 'week');
  renderCalendar();
}

function navCal(dir) {
  if (dir === 0) {
    calDate = new Date();
    if (calView === 'month') calDate.setDate(1);
  } else if (calView === 'month') {
    calDate.setMonth(calDate.getMonth() + dir);
  } else {
    calDate.setDate(calDate.getDate() + dir * 7);
  }
  renderCalendar();
}

function setResourceFilter(id) {
  activeResourceFilter = id;
  renderCalendar();
}

function renderResourceFilter() {
  const filter = document.getElementById('resourceFilter');
  if (window.db.resources.filter(r => r.active).length === 0) {
    filter.innerHTML = '<div class="muted" style="font-size:13px;">Nenhum recurso cadastrado ainda. Faça login como administrador para começar.</div>';
    return;
  }
  const chips = [
    `<button class="resource-chip ${activeResourceFilter==='all'?'active':''}" onclick="setResourceFilter('all')">Todos</button>`
  ];
  window.db.resources.filter(r => r.active).forEach((r, idx) => {
    const color = r.color || RESOURCE_COLORS[idx % RESOURCE_COLORS.length];
    const colorMap = {
      green: 'var(--labeme-green)',
      navy: 'var(--labeme-navy)',
      steel: 'var(--labeme-steel)',
      amber: '#d4a72c'
    };
    const active = activeResourceFilter === r.id ? 'active' : '';
    chips.push(
      `<button class="resource-chip ${active}" onclick="setResourceFilter('${r.id}')">
        <span class="dot" style="background:${colorMap[color]}"></span>${escapeHtml(r.name)}
      </button>`
    );
  });
  filter.innerHTML = chips.join('');
}

function visibleReservations() {
  return window.db.reservations.filter(r => {
    if (r.status === 'denied') return false;
    if (activeResourceFilter !== 'all' && r.resourceId !== activeResourceFilter) return false;
    return true;
  });
}

function eventClassFor(reservation) {
  if (reservation.status === 'pending') return 'pending';
  const r = getResource(reservation.resourceId);
  return r?.color || 'green';
}

function renderCalendar() {
  renderResourceFilter();
  const mount = document.getElementById('calendarMount');
  if (calView === 'month') {
    mount.innerHTML = renderMonthGrid();
    document.getElementById('calPeriod').textContent =
      calDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  } else {
    mount.innerHTML = renderWeekGrid();
    const ws = weekStart(calDate);
    const we = new Date(ws);
    we.setDate(ws.getDate() + 4);
    document.getElementById('calPeriod').textContent =
      `${ws.getDate()} ${ws.toLocaleDateString('pt-BR',{month:'short'})} – ${we.getDate()} ${we.toLocaleDateString('pt-BR',{month:'short', year:'numeric'})}`;
  }
}

function renderMonthGrid() {
  const year = calDate.getFullYear();
  const month = calDate.getMonth();
  const first = new Date(year, month, 1);
  const startOffset = first.getDay();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const heads = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
    .map(d => `<div>${d}</div>`).join('');

  let cells = '';
  const prevDays = new Date(year, month, 0).getDate();
  for (let i = startOffset - 1; i >= 0; i--) {
    cells += `<div class="day-cell outside"><div class="day-num">${prevDays - i}</div></div>`;
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(year, month, d);
    const iso = dt.toISOString().slice(0,10);
    const isToday = dt.getTime() === today.getTime();
    const isWeekend = dt.getDay() === 0 || dt.getDay() === 6;
    const events = visibleReservations().filter(r => r.date === iso);
    const evHtml = events.slice(0, 3).map(r => {
      const res = getResource(r.resourceId);
      const cls = eventClassFor(r);
      return `<div class="day-event ${cls}" title="${escapeHtml(res?.name || '')}">${escapeHtml(res?.name || '?')}</div>`;
    }).join('');
    const more = events.length > 3
      ? `<div class="day-event" style="background:var(--line-200);color:var(--ink-700);border-left-color:var(--ink-500)">+${events.length-3} mais</div>`
      : '';
    cells += `<div class="day-cell ${isToday?'today':''} ${isWeekend?'weekend':''}" onclick="onDayClick('${iso}')">
      <div class="day-num">${d}</div>
      <div class="day-events">${evHtml}${more}</div>
    </div>`;
  }
  const totalCells = startOffset + daysInMonth;
  const trailing = (7 - (totalCells % 7)) % 7;
  for (let i = 1; i <= trailing; i++) {
    cells += `<div class="day-cell outside"><div class="day-num">${i}</div></div>`;
  }

  return `<div class="month-grid">
    <div class="month-head">${heads}</div>
    <div class="month-body">${cells}</div>
  </div>`;
}

function weekStart(d) {
  const x = new Date(d);
  const day = x.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function renderWeekGrid() {
  const ws = weekStart(calDate);
  const days = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(ws);
    d.setDate(ws.getDate() + i);
    days.push(d);
  }
  const dayNames = ['Seg','Ter','Qua','Qui','Sex'];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const head = `<div></div>` + days.map((d, i) => {
    const isToday = d.getTime() === today.getTime();
    return `<div>
      <div style="font-size:11px;letter-spacing:0.06em;color:${isToday?'var(--labeme-green-dark)':'var(--ink-500)'};text-transform:uppercase;font-weight:600;">${dayNames[i]}</div>
      <div class="week-day-num ${isToday?'today-marker':''}">${d.getDate()}</div>
    </div>`;
  }).join('');

  // Slots: apenas manhã (08-12) e tarde (14-18). Sem noite.
  const slots = [
    { label: '08:00<br>10:00', start: '08:00', end: '10:00' },
    { label: '10:00<br>12:00', start: '10:00', end: '12:00' },
    { label: '14:00<br>16:00', start: '14:00', end: '16:00' },
    { label: '16:00<br>18:00', start: '16:00', end: '18:00' },
  ];

  let body = '';
  slots.forEach(slot => {
    body += `<div class="time-label">${slot.label}</div>`;
    days.forEach(d => {
      const iso = d.toISOString().slice(0,10);
      const events = visibleReservations().filter(r => {
        if (r.date !== iso) return false;
        if (r.mode === 'slot') {
          return !(r.slot.end <= slot.start || r.slot.start >= slot.end);
        } else {
          // turno: mapeia para slots da grade (sem noite)
          const turnoMap = {
            manha: ['08:00', '10:00'],
            tarde: ['14:00', '16:00']
          };
          return (turnoMap[r.slot.turno] || []).includes(slot.start);
        }
      });
      const evHtml = events.slice(0,1).map(r => {
        const res = getResource(r.resourceId);
        const cls = eventClassFor(r);
        const u = getUser(r.userId);
        const qtyText = r.quantity && r.quantity > 1 ? ` (×${r.quantity})` : '';
        return `<div class="week-event ${cls}" onclick="event.stopPropagation();showResDetail('${r.id}')">
          <strong>${escapeHtml(res?.name||'?')}${qtyText}</strong>
          <small>${escapeHtml(u?.name?.split(' ')[0]||'')}</small>
        </div>`;
      }).join('');
      const moreCount = events.length > 1 ? `<div style="position:absolute;top:2px;right:4px;font-size:10px;color:var(--ink-500);font-weight:600;">+${events.length-1}</div>` : '';
      body += `<div class="week-slot" onclick="onSlotClick('${iso}','${slot.start}','${slot.end}')">${evHtml}${moreCount}</div>`;
    });
  });

  return `<div class="week-grid">
    <div class="week-head">${head}</div>
    <div class="week-body">${body}</div>
  </div>`;
}

function onDayClick(iso) {
  const events = visibleReservations().filter(r => r.date === iso);
  if (events.length > 0) {
    showDayDetail(iso, events);
  } else {
    openReserveModal({ date: iso });
  }
}

function onSlotClick(iso, start, end) {
  const events = visibleReservations().filter(r => {
    if (r.date !== iso) return false;
    if (r.mode === 'slot') return !(r.slot.end <= start || r.slot.start >= end);
    return false;
  });
  if (events.length > 0) {
    showDayDetail(iso, events);
  } else {
    openReserveModal({ date: iso, startTime: start, endTime: end });
  }
}

window.calView = calView;
window.calDate = calDate;
window.setCalView = setCalView;
window.navCal = navCal;
window.setResourceFilter = setResourceFilter;
window.renderCalendar = renderCalendar;
window.weekStart = weekStart;
window.visibleReservations = visibleReservations;
window.onDayClick = onDayClick;
window.onSlotClick = onSlotClick;
