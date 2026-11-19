/* ============================================================
   panel.js — Painel ao vivo "Hoje no LABEME" (v11.11)
   Tela cheia para TV ou monitor na entrada do laboratório.
   Abre em …/#painel com qualquer conta ativa (recomendado: uma conta
   só para o painel). Atualiza sozinho: os dados chegam em tempo real
   pelo Firestore, a lista é refeita a cada 30 s e o relógio a cada 1 s.
   Mostra só o primeiro nome e a inicial do sobrenome de quem reservou.
   ============================================================ */

let _panelTick = null, _panelClock = null, _panelWake = null, _panelReloadAt = 0;

function panelName(id) {
  const w = String(userName(id) || '').trim().split(/\s+/).filter(x => x && !NAME_LINKS.test(x));
  return w.length > 1 ? `${w[0]} ${w[w.length - 1][0]}.` : (w[0] || '—');
}

/* Tudo o que acontece hoje: reservas confirmadas e horários fixos das salas */
function panelItemsToday() {
  const today = todayISO();
  const out = [];
  window.db.reservations.forEach(x => {
    if (!resCovers(x, today) || !['approved', 'in_use'].includes(x.status)) return;
    const r = getResource(x.resourceId); if (!r) return;
    const rg = isMultiDay(x) ? { start: '00:00', end: '23:59' } : reservationRange(x);
    out.push({ kind: 'res', id: x.id, r, start: rg.start, end: rg.end, multi: isMultiDay(x), until: resEnd(x),
               who: panelName(x.userId), qty: x.quantity || 1, inUse: x.status === 'in_use' });
  });
  fixedEventsOn(today, { all: true }).forEach(f => out.push({ kind: 'fixed', id: f.id, r: f.r, start: f.b.start, end: f.b.end, label: f.b.label }));
  return out.sort((a, b) => a.start.localeCompare(b.start) || a.r.name.localeCompare(b.r.name, 'pt-BR'));
}

function panelTimeText(it) {
  if (it.multi) return it.until > todayISO() ? `o dia todo · até ${fmtDateShort(it.until)}` : 'o dia todo';
  return `${it.start}–${it.end}`;
}
function panelCard(it, now) {
  const img = safeImg(it.r.photo);
  const live = it.kind === 'res' && (it.inUse || (it.start <= now && now < it.end));
  const tag = it.kind === 'fixed' ? '<span class="pp-tag fixed">Aula</span>'
    : it.inUse ? '<span class="pp-tag live">Em uso</span>' : live ? '<span class="pp-tag live">Agora</span>' : '';
  return `<div class="pp-card ${it.kind === 'fixed' ? 'is-fixed' : ''}">
    ${img ? `<img class="pp-thumb" src="${img}" alt="">` : `<span class="pp-thumb pp-ico">${icon(it.kind === 'fixed' ? 'lock' : 'box', 26)}</span>`}
    <div class="pp-card-main">
      <div class="pp-card-title">${escapeHtml(it.r.name)}${it.qty > 1 ? ` <span class="pp-qty">×${it.qty}</span>` : ''}</div>
      <div class="pp-card-sub">${it.kind === 'fixed' ? escapeHtml(it.label) : escapeHtml(it.who)}${it.r.location ? ` · ${escapeHtml(it.r.location)}` : ''}</div>
    </div>
    <div class="pp-card-time">${tag}<span>${panelTimeText(it)}</span></div>
  </div>`;
}

function renderPanel() {
  const mount = document.getElementById('panelMount'); if (!mount) return;
  const u = currentUser(); if (!u) return;
  const s = window.db.settings, today = todayISO(), now = nowHHMM();
  const closed = (!s.allowWeekends && isWeekendISO(today)) || (s.closedDates || []).includes(today);
  const items = panelItemsToday();
  const nowList = items.filter(it => (it.kind === 'res' && it.inUse) || (it.start <= now && now < it.end));
  const nowIds = new Set(nowList.map(it => it.id));
  const next = items.filter(it => !nowIds.has(it.id) && it.start > now);
  const done = items.filter(it => it.kind === 'res' && !nowIds.has(it.id) && it.end <= now).length;
  const active = window.db.resources.filter(r => r.active);
  const maint = active.filter(r => r.status === 'maintenance');
  const openProb = (window.db.maintenance || []).filter(m => m.status === 'aberto');
  const anns = typeof activeAnnouncements === 'function' ? activeAnnouncements().slice(0, 3) : [];
  const spaces = active.filter(r => r.type === 'space');
  // Amanhã (prévia quando o dia já acabou)
  let tomorrowHtml = '';
  if (!nowList.length && !next.length) {
    let d = addDaysISO(today, 1);
    for (let i = 0; i < 7 && ((!s.allowWeekends && isWeekendISO(d)) || (s.closedDates || []).includes(d)); i++) d = addDaysISO(d, 1);
    const t = window.db.reservations.filter(x => resCovers(x, d) && ['approved', 'in_use'].includes(x.status)).length + fixedEventsOn(d, { all: true }).length;
    tomorrowHtml = `<div class="pp-empty-sub">${capitalize(fmtDateLong(d))}: ${t ? `${t} uso(s) previsto(s)` : 'nenhum uso previsto até agora'}.</div>`;
  }

  mount.innerHTML = `
    <header class="pp-head">
      <img src="assets/labeme-logo-white.png" alt="LABEME" class="pp-logo">
      <div class="pp-title"><div class="pp-eyebrow"><span class="pp-dot"></span> ao vivo</div><h1>Hoje no LABEME</h1></div>
      <div class="pp-clock"><div id="ppTime">${now}</div><div class="pp-date">${capitalize(new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }))}</div></div>
    </header>
    <div class="pp-stats">
      <div><b>${nowList.length}</b><span>em uso agora</span></div>
      <div><b>${next.length}</b><span>ainda hoje</span></div>
      <div><b>${done}</b><span>concluído(s) hoje</span></div>
      <div><b>${active.length - maint.length}</b><span>de ${active.length} recursos disponíveis</span></div>
    </div>
    <div class="pp-grid">
      <div class="pp-col">
        <section class="pp-box">
          <h2>${icon('clock', 22)} Agora</h2>
          ${closed && !nowList.length ? `<div class="pp-empty">Laboratório fechado hoje.</div>`
            : nowList.length ? `<div class="pp-cards">${nowList.slice(0, 8).map(it => panelCard(it, now)).join('')}</div>${nowList.length > 8 ? `<div class="pp-more">+ ${nowList.length - 8} em uso</div>` : ''}`
            : `<div class="pp-empty">Nenhum equipamento em uso neste momento.</div>`}
        </section>
        <section class="pp-box">
          <h2>${icon('calendar', 22)} Próximos de hoje</h2>
          ${next.length ? `<div class="pp-timeline">${next.slice(0, 9).map(it => `
            <div class="pp-tl ${it.kind === 'fixed' ? 'is-fixed' : ''}"><span class="pp-tl-time">${it.multi ? 'dia' : it.start}</span>
              <span class="pp-tl-name">${escapeHtml(it.r.name)}</span>
              <span class="pp-tl-who">${it.kind === 'fixed' ? escapeHtml(it.label) : escapeHtml(it.who)}</span></div>`).join('')}</div>
            ${next.length > 9 ? `<div class="pp-more">+ ${next.length - 9} mais tarde</div>` : ''}`
            : `<div class="pp-empty">Nada mais previsto para hoje.</div>${tomorrowHtml}`}
        </section>
      </div>
      <div class="pp-col side">
        ${spaces.length ? `<section class="pp-box">
          <h2>${icon('pin', 22)} Salas e espaços</h2>
          ${spaces.map(r => {
            const its = items.filter(it => it.r.id === r.id);
            const cur = its.find(it => nowIds.has(it.id));
            const nx = its.find(it => !nowIds.has(it.id) && it.start > now);
            return `<div class="pp-room ${cur ? 'busy' : 'free'}"><div><strong>${escapeHtml(r.name)}</strong>
              <span>${cur ? `${cur.kind === 'fixed' ? escapeHtml(cur.label) : 'Reservada'} até ${cur.end}` : nx ? `Livre · próximo uso às ${nx.start}` : r.status === 'maintenance' ? 'Em manutenção' : 'Livre pelo resto do dia'}</span></div>
              <i>${cur ? 'Ocupada' : 'Livre'}</i></div>`;
          }).join('')}</section>` : ''}
        ${maint.length || openProb.length ? `<section class="pp-box">
          <h2>${icon('wrench', 22)} Manutenção</h2>
          ${maint.slice(0, 6).map(r => `<div class="pp-line"><span class="pp-bullet warn"></span>${escapeHtml(r.name)}</div>`).join('')}
          ${maint.length > 6 ? `<div class="pp-more">+ ${maint.length - 6}</div>` : ''}
          ${openProb.length ? `<div class="pp-line muted">${openProb.length} problema(s) relatado(s) em análise pela equipe técnica</div>` : ''}
        </section>` : ''}
        ${anns.length ? `<section class="pp-box">
          <h2>${icon('megaphone', 22)} Avisos</h2>
          ${anns.map(a => `<div class="pp-ann ${a.level === 'important' ? 'important' : ''}"><strong>${escapeHtml(a.title)}</strong><span>${escapeHtml(String(a.body || '').slice(0, 220))}${String(a.body || '').length > 220 ? '…' : ''}</span></div>`).join('')}
        </section>` : ''}
        <section class="pp-box pp-qrbox">
          <div class="pp-qr">${qrSvg(location.origin + location.pathname)}</div>
          <div><strong>Reserve pelo celular</strong><span>${escapeHtml(location.host)}</span><small>Aponte a câmera para o código</small></div>
        </section>
      </div>
    </div>
    <footer class="pp-foot">
      <span>Atualizado às <b id="ppUpdated">${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</b>${isSynced() ? '' : ' · <b class="warn">sem conexão — tentando reconectar</b>'}</span>
      <span class="pp-actions">
        ${document.fullscreenElement ? '' : `<button class="pp-btn" onclick="panelFullscreen()">${icon('maximize', 16)} Tela cheia</button>`}
        <button class="pp-btn" onclick="exitPanel()">Sair do painel</button>
      </span>
    </footer>`;
  startPanelTimers();
}

function startPanelTimers() {
  if (!_panelClock) _panelClock = setInterval(() => {
    if (currentView !== 'painel') return stopPanelTimers();
    const el = document.getElementById('ppTime'); if (el) el.textContent = nowHHMM();
  }, 1000);
  if (!_panelTick) _panelTick = setInterval(() => {
    if (currentView !== 'painel') return stopPanelTimers();
    // recarrega a página de madrugada para pegar versões novas do sistema
    if (!_panelReloadAt) { const t = new Date(); t.setDate(t.getDate() + 1); t.setHours(3, 30, 0, 0); _panelReloadAt = t.getTime(); }
    if (Date.now() > _panelReloadAt) { location.reload(); return; }
    renderPanel();
  }, 30000);
  panelKeepAwake();
}
function stopPanelTimers() {
  clearInterval(_panelClock); clearInterval(_panelTick); _panelClock = _panelTick = null;
  try { _panelWake?.release(); } catch (_) {}
  _panelWake = null;
}
/* Mantém a tela acesa (navegadores com suporte a Wake Lock) */
async function panelKeepAwake() {
  if (_panelWake || !('wakeLock' in navigator) || document.hidden) return;
  try { _panelWake = await navigator.wakeLock.request('screen'); _panelWake.addEventListener?.('release', () => { _panelWake = null; }); } catch (_) {}
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && currentView === 'painel') { panelKeepAwake(); renderPanel(); } });
document.addEventListener('fullscreenchange', () => { if (currentView === 'painel') renderPanel(); });
function panelFullscreen() { document.documentElement.requestFullscreen?.().catch(() => toast('Use a tecla F11 para tela cheia.', 'info')); }
function exitPanel() {
  stopPanelTimers();
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  showView(homeViewFor(currentUser()));
}
function openPanelWindow() { window.open(location.pathname + '#painel', '_blank', 'noopener'); }
