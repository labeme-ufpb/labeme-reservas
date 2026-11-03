/* ============================================================
   tech.js — Painel da equipe técnica (v10)
   Abas: Pendentes · Hoje · Próximos 7 dias · Devoluções
   Ações rápidas na linha: aprovar, recusar, iniciar uso, concluir, conferir.
   ============================================================ */

let techRange = 'pending';
function setTechRange(r) { techRange = r; renderTechDashboard(); }

function renderTechDashboard() {
  const u = currentUser();
  if (!u || !['technician','admin'].includes(u.role)) return showView('calendar');
  const today = todayISO(), weekEnd = addDaysISO(today, 7);
  const R = window.db.reservations;
  const pending = R.filter(r => r.status === 'pending').sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
  const todayList = R.filter(r => r.date === today && ['approved','in_use','awaiting_return'].includes(r.status));
  const week = R.filter(r => ['approved','in_use','awaiting_return'].includes(r.status) && r.date >= today && r.date <= weekEnd);
  const presence = week.filter(r => getResource(r.resourceId)?.requiresTechnicianPresence);
  const returns = R.filter(r => r.status === 'awaiting_return' || isOverdueReturn(r));
  const byTime = (a, b) => (a.date + reservationRange(a).start).localeCompare(b.date + reservationRange(b).start);

  document.getElementById('techStats').innerHTML = `
    <button class="stat-card accent-amber" onclick="setTechRange('pending')"><div class="stat-label">Pendentes</div><div class="stat-value">${pending.length}</div><div class="stat-foot">aguardando análise</div></button>
    <button class="stat-card accent-green" onclick="setTechRange('today')"><div class="stat-label">Hoje</div><div class="stat-value">${todayList.length}</div><div class="stat-foot">usos previstos</div></button>
    <button class="stat-card accent-steel" onclick="setTechRange('week')"><div class="stat-label">Presença técnica</div><div class="stat-value">${presence.length}</div><div class="stat-foot">nos próximos 7 dias</div></button>
    <button class="stat-card accent-navy" onclick="setTechRange('returns')"><div class="stat-label">Devoluções</div><div class="stat-value">${returns.length}</div><div class="stat-foot">a conferir / atrasadas</div></button>`;

  const tabs = [['pending','Pendentes',pending.length],['today','Hoje',todayList.length],['week','Próximos 7 dias',week.length],['returns','Devoluções',returns.length]];
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
    week.sort(byTime).forEach(r => (byDay[r.date] ||= []).push(r));
    mount.innerHTML = Object.keys(byDay).length ? Object.entries(byDay).map(([d, list]) =>
      `<section class="agenda-day"><h3>${fmtDateLong(d)}</h3><div class="res-list">${list.map(r => reservationRow(r, { quick: true })).join('')}</div></section>`).join('')
      : empty('Nenhuma reserva nos próximos 7 dias.');
  } else {
    mount.innerHTML = returns.length ? `<div class="res-list">${returns.sort(byTime).map(r => reservationRow(r, { quick: true })).join('')}</div>` : empty('Nenhuma devolução pendente.');
  }
}
