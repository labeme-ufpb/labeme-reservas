/* ============================================================
   tech.js — Painel da equipe técnica (v10)
   Abas: Pendentes · Hoje · Próximos 7 dias · Devoluções
   Ações rápidas na linha: aprovar, recusar, iniciar uso, concluir, conferir.
   ============================================================ */

let techRange = 'pending';
const LIVE_STATUSES = ['approved', 'in_use', 'awaiting_return'];
const FUTURE_DAYS = 60;   // v11.16: "Reservas futuras" = próximos 60 dias
/* reservas confirmadas de `from` até `from + days - 1`, em ordem de horário */
function upcomingReservations(from, days) {
  const to = addDaysISO(from, days - 1);
  return window.db.reservations.filter(r => LIVE_STATUSES.includes(r.status) && resOverlapsDates(r, from, to))
    .sort((a, b) => (a.date + reservationRange(a).start).localeCompare(b.date + reservationRange(b).start));
}
/* agrupa por dia (reserva de vários dias que começou antes aparece no primeiro dia da lista) */
function agendaByDayHtml(list, from) {
  const byDay = {};
  list.forEach(r => (byDay[r.date < from ? from : r.date] ||= []).push(r));
  return Object.entries(byDay).map(([d, l]) =>
    `<section class="agenda-day"><h3>${fmtDateLong(d)} <span class="agenda-count">${l.length}</span></h3><div class="res-list">${l.map(r => reservationRow(r, { quick: true })).join('')}</div></section>`).join('');
}
function setTechRange(r) { techRange = r; renderTechDashboard(); }

function renderTechDashboard() {
  const u = currentUser();
  if (!u || !['technician','admin'].includes(u.role)) return showView('calendar');
  const today = todayISO(), weekEnd = addDaysISO(today, 7);
  const R = window.db.reservations;
  const pending = R.filter(r => r.status === 'pending').sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
  const todayList = R.filter(r => resCovers(r, today) && ['approved','in_use','awaiting_return'].includes(r.status));
  const week = R.filter(r => ['approved','in_use','awaiting_return'].includes(r.status) && resOverlapsDates(r, today, weekEnd));
  const presence = week.filter(r => getResource(r.resourceId)?.requiresTechnicianPresence);
  const returns = R.filter(r => r.status === 'awaiting_return' || isOverdueReturn(r));
  const future = upcomingReservations(today, FUTURE_DAYS);
  const byTime = (a, b) => (a.date + reservationRange(a).start).localeCompare(b.date + reservationRange(b).start);

  document.getElementById('techStats').innerHTML = `
    <button class="stat-card accent-amber" onclick="setTechRange('pending')"><div class="stat-label">Pendentes</div><div class="stat-value">${pending.length}</div><div class="stat-foot">aguardando análise</div></button>
    <button class="stat-card accent-green" onclick="setTechRange('today')"><div class="stat-label">Hoje</div><div class="stat-value">${todayList.length}</div><div class="stat-foot">usos previstos</div></button>
    <button class="stat-card accent-steel" onclick="setTechRange('week')"><div class="stat-label">Presença técnica</div><div class="stat-value">${presence.length}</div><div class="stat-foot">nos próximos 7 dias</div></button>
    <button class="stat-card accent-navy" onclick="setTechRange('returns')"><div class="stat-label">Devoluções</div><div class="stat-value">${returns.length}</div><div class="stat-foot">a conferir / atrasadas</div></button>`;

  const tabs = [['pending','Pendentes',pending.length],['today','Hoje',todayList.length],['week','Próximos 7 dias',week.length],['future','Reservas futuras',future.length],['returns','Devoluções',returns.length],['maint','Manutenção',maintenanceBadgeCount()]];
  document.getElementById('techTabs').innerHTML = tabs.map(([k, l, n]) =>
    `<button role="tab" aria-selected="${techRange === k}" class="${techRange === k ? 'active' : ''}" onclick="setTechRange('${k}')">${l}${n ? ` <span class="count">${n}</span>` : ''}</button>`).join('');

  const mount = document.getElementById('techContent');
  const empty = msg => `<div class="panel"><div class="empty">${icon('check', 28)}<div>${msg}</div></div></div>`;
  if (techRange === 'pending') {
    mount.innerHTML = pending.length ? `<div class="res-list">${pending.map(r => reservationRow(r, { quick: true })).join('')}</div>` : empty('Nenhuma solicitação pendente — tudo em dia!');
  } else if (techRange === 'today') {
    mount.innerHTML = todayList.length ? `<div class="res-list">${todayList.sort(byTime).map(r => reservationRow(r, { quick: true })).join('')}</div>` : empty('Nenhum uso previsto para hoje.');
  } else if (techRange === 'week') {
    const byDay = {};
    week.sort(byTime).forEach(r => (byDay[r.date < today ? today : r.date] ||= []).push(r));
    mount.innerHTML = Object.keys(byDay).length ? Object.entries(byDay).map(([d, list]) =>
      `<section class="agenda-day"><h3>${fmtDateLong(d)}</h3><div class="res-list">${list.map(r => reservationRow(r, { quick: true })).join('')}</div></section>`).join('')
      : empty('Nenhuma reserva nos próximos 7 dias.');
  } else if (techRange === 'future') {
    mount.innerHTML = future.length ? `<p class="small muted" style="margin:0 0 10px;">${future.length} reserva(s) confirmada(s) nos próximos ${FUTURE_DAYS} dias (até ${fmtDateLong(addDaysISO(today, FUTURE_DAYS - 1))}).</p>` + agendaByDayHtml(future, today)
      : empty(`Nenhuma reserva confirmada nos próximos ${FUTURE_DAYS} dias.`);
  } else if (techRange === 'maint') {
    mount.innerHTML = `<div class="flex-row" style="margin-bottom:12px;justify-content:flex-end;"><button class="btn" onclick="openQrLabelsModal()">${icon('qr', 16)} Etiquetas QR</button></div>` + maintenanceOverviewHtml();
  } else {
    mount.innerHTML = returns.length ? `<div class="res-list">${returns.sort(byTime).map(r => reservationRow(r, { quick: true })).join('')}</div>` : empty('Nenhuma devolução pendente.');
  }
}
