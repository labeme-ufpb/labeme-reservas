/* ============================================================
   waitlist.js — Lista de espera (v11.7)
   - Quando o horário está cheio, o usuário entra na fila daquele período
   - Se alguém cancelar (ou a equipe recusar), o primeiro da fila recebe
     uma janela "Vaga liberada" e reserva com um clique
   - Se o primeiro não responder em 2 h, o próximo também é avisado
     (quem confirmar primeiro fica com a vaga)
   - Tudo é calculado no navegador de quem está na fila: não precisa de servidor
   ============================================================ */

const WAITLIST_WINDOW_H = 2;          // horas de prioridade de cada posição da fila
const WAITLIST_MAX_PER_USER = 5;

function waitRange(w) { return w.mode === 'days' ? { start: '00:00', end: '23:59' } : reservationRange(w); }
function waitEnd(w) { return w.mode === 'days' ? (w.endDate || w.date) : w.date; }
function waitLabel(w) {
  return w.mode === 'days' ? `${resourceName(w.resourceId)} — de ${fmtDate(w.date)} a ${fmtDate(waitEnd(w))}` : `${resourceName(w.resourceId)} — ${fmtDate(w.date)}, ${slotText(w)}`;
}
function waitOverlaps(a, b) {
  return a.resourceId === b.resourceId && a.date <= waitEnd(b) && b.date <= waitEnd(a) && rangesOverlap(waitRange(a), waitRange(b));
}
// Ainda dá para usar? (o início não passou)
function waitStillValid(w) {
  const start = w.mode === 'days' ? `${w.date}T${window.db.settings.turnoManha.start}` : `${w.date}T${waitRange(w).start}`;
  return new Date(start + ':00').getTime() > Date.now();
}
function waitFree(w) {
  const r = getResource(w.resourceId); if (!r || !r.active || r.status === 'maintenance') return 0;
  const range = waitRange(w);
  return (r.totalQuantity || 1) - (w.mode === 'days' ? reservedQuantityInSpan(r.id, w.date, waitEnd(w), range) : reservedQuantityIn(r.id, w.date, range));
}
function waitingEntries() { return (window.db.waitlist || []).filter(w => w.status === 'waiting' && waitStillValid(w)); }

/* Posição na fila: quantas pessoas, antes desta, esperam o mesmo período */
function waitPosition(w) {
  return waitingEntries().filter(o => o.id !== w.id && o.userId !== w.userId && o.createdAt < w.createdAt && waitOverlaps(o, w)).length;
}
/* Quando a vaga abriu: último cancelamento/recusa no período depois que a pessoa entrou na fila */
function waitFreedAt(w) {
  let t = 0;
  window.db.reservations.forEach(x => {
    if (x.resourceId !== w.resourceId || !['cancelled', 'denied'].includes(x.status)) return;
    if (!(x.date <= waitEnd(w) && w.date <= resEnd(x) && rangesOverlap(reservationRange(x), waitRange(w)))) return;
    const at = x.cancelledAt || x.decidedAt || 0;
    if (at > w.createdAt && at > t) t = at;
  });
  return t || w.createdAt;
}
/* A vaga está disponível para esta pessoa agora? */
function waitOffer(w) {
  if (w.status !== 'waiting' || !waitStillValid(w)) return false;
  const free = waitFree(w);
  if (free < (w.quantity || 1)) return false;
  // à frente: só quem caberia na vaga atual
  const ahead = waitingEntries().filter(o => o.id !== w.id && o.userId !== w.userId && o.createdAt < w.createdAt && waitOverlaps(o, w) && (o.quantity || 1) <= free).length;
  return ahead === 0 || Date.now() >= waitFreedAt(w) + ahead * WAITLIST_WINDOW_H * 36e5;
}
function myWaitlist(u = currentUser()) {
  if (!u) return [];
  return (window.db.waitlist || []).filter(w => w.userId === u.id).sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
}

/* ---------- Entrar na fila (pelo formulário de reserva) ---------- */
function waitlistHintHtml(f) {
  const me = currentUser(); if (!me) return '';
  const forSel = document.getElementById('resFor');
  if (forSel && forSel.value !== me.id) return '';
  const n = waitingEntries().filter(o => waitOverlaps(o, { resourceId: f.r.id, date: f.date, endDate: f.endDate, mode: f.mode, slot: f.slot })).length;
  return `<div class="wl-hint"><button type="button" class="btn small" onclick="joinWaitlistFromForm()">${icon('clock', 15)} Entrar na lista de espera</button>
    <span class="small">${n ? `${n} pessoa(s) já na fila deste período.` : 'Você será avisado se o horário for liberado.'}</span></div>`;
}
function offerWaitlistFromForm() {
  const me = currentUser(); const forSel = document.getElementById('resFor');
  if (forSel && forSel.value !== me.id) return toast('Período já ocupado. Escolha outro horário.', 'error');
  const f = readWaitForm();
  if (typeof f === 'string') return toast('Período já ocupado. ' + f, 'error');
  window._lastResForm = f;   // o formulário fecha ao abrir a confirmação
  askConfirm({ title: 'Período ocupado', body: 'Este horário já está reservado. Quer entrar na <strong>lista de espera</strong>? Se a vaga for liberada, você recebe um aviso para reservar com um clique.', okLabel: 'Entrar na lista' })
    .then(ok => { if (ok) joinWaitlistFromForm(true); });
}
function joinWaitlistFromForm(formAlreadyClosed = false) {
  const me = currentUser(); if (!me) return;
  const f = window._lastResForm && formAlreadyClosed ? window._lastResForm : readWaitForm();
  if (!f) return;
  if (typeof f === 'string') return toast(f, 'error');
  const mine = myWaitlist(me).filter(w => w.status === 'waiting' && waitStillValid(w));
  if (mine.length >= WAITLIST_MAX_PER_USER) return toast(`Você já está em ${WAITLIST_MAX_PER_USER} listas de espera. Saia de alguma em "Minhas reservas".`, 'warn');
  const entry = {
    id: uid('wl'), userId: me.id, resourceId: f.r.id, date: f.date, ...(f.mode === 'days' ? { endDate: f.endDate } : {}),
    mode: f.mode, slot: f.mode === 'days' ? {} : f.slot, quantity: f.quantity,
    purpose: f.purpose, purposeType: f.purposeType, project: f.project, status: 'waiting', createdAt: Date.now()
  };
  if (mine.some(w => waitOverlaps(w, entry))) return toast('Você já está na lista de espera deste período.', 'warn');
  if (!window.db.waitlist) window.db.waitlist = [];
  window.db.waitlist.push(entry);
  saveDB();
  window._lastResForm = null;
  closeModal();
  const pos = waitPosition(entry);
  toast(pos ? `Você entrou na lista de espera (${pos + 1}º da fila).` : 'Você entrou na lista de espera — é o 1º da fila.', 'success');
  refreshCurrentView();
}
// Lê o formulário e confere o que a reserva exigiria (exceto a vaga)
function readWaitForm() {
  const f = readReservationForm();
  if (!f) return 'Escolha o equipamento ou espaço.';
  const purpose = document.getElementById('resPurpose').value.trim();
  const purposeType = document.getElementById('resPurposeType').value;
  const project = document.getElementById('resProject').value.trim();
  if (!purposeType) return 'Para entrar na fila, escolha o tipo de atividade.';
  if (purpose.length < 10) return 'Para entrar na fila, descreva o uso (mínimo 10 caracteres).';
  const problem = f.mode === 'days' ? daysProblem(f.date, f.endDate, f.r) : (dateProblem(f.date) || rangeProblem(f.date, f.range));
  if (problem) return problem;
  return Object.assign(f, { purpose, purposeType, project });
}

/* ---------- Aviso de vaga liberada ---------- */
const _wlShown = new Set();
function checkWaitlistOffers() {
  const u = currentUser();
  if (!u || modalIsOpen() || currentView === 'auth') return false;
  const offers = myWaitlist(u).filter(w => waitOffer(w) && !_wlShown.has(w.id));
  if (!offers.length) return false;
  showWaitlistOffer(offers[0].id);
  return true;
}
function showWaitlistOffer(id) {
  const w = (window.db.waitlist || []).find(x => x.id === id); if (!w) return;
  _wlShown.add(id);
  const r = getResource(w.resourceId);
  openModal(`
    <div class="modal-head ann-head wl-head">
      <div class="ann-icon">${icon('check', 22)}</div>
      <div><div class="modal-title">Vaga liberada!</div><div class="modal-sub">Lista de espera</div></div>
    </div>
    <div class="modal-body">
      <p>O período que você estava esperando ficou livre:</p>
      <div class="wl-card"><strong>${escapeHtml(r?.name || 'Recurso')}</strong>
        <div>${w.mode === 'days' ? `De ${fmtDate(w.date)} a ${fmtDate(waitEnd(w))}` : `${fmtDateLong(w.date)} · ${slotText(w)}`}${w.quantity > 1 ? ` · ${w.quantity} un.` : ''}</div>
        ${w.purpose ? `<div class="small muted">${escapeHtml(w.purpose)}</div>` : ''}</div>
      <div class="info-box">${icon('info', 16)} Outras pessoas da fila também podem ser avisadas. Quem confirmar primeiro fica com a vaga.</div>
    </div>
    <div class="modal-foot">
      <button class="btn" onclick="leaveWaitlist('${w.id}', true)">Não quero mais</button>
      <button class="btn" onclick="closeModal()">Depois</button>
      <button class="btn dark" onclick="acceptWaitlistOffer('${w.id}')">${icon('check', 16)} Reservar agora</button>
    </div>`);
}
function acceptWaitlistOffer(id) {
  const w = (window.db.waitlist || []).find(x => x.id === id); const u = currentUser();
  if (!w || !u || w.userId !== u.id) return closeModal();
  const out = createReservation({ u, r: getResource(w.resourceId), date: w.date, endDate: waitEnd(w), mode: w.mode, slot: w.slot || {},
    quantity: w.quantity || 1, purpose: w.purpose || '', purposeType: w.purposeType || '', project: w.project || '' });
  if (typeof out === 'string') {
    closeModal();
    if (out === 'OCCUPIED') return toast('Que pena — outra pessoa da fila reservou primeiro. Você continua na lista.', 'warn');
    return toast(out, 'error');
  }
  w.status = 'done'; w.closedAt = Date.now();
  saveDB(); closeModal();
  toast(out.auto ? 'Reserva confirmada!' : 'Solicitação enviada — aguardando aprovação.', 'success');
  refreshCurrentView();
}
async function leaveWaitlist(id, fromOffer = false) {
  const w = (window.db.waitlist || []).find(x => x.id === id); if (!w) return;
  if (!fromOffer) {
    const ok = await askConfirm({ title: 'Sair da lista de espera', body: escapeHtml(waitLabel(w)), okLabel: 'Sair da lista', danger: true });
    if (!ok) return;
  }
  w.status = 'left'; w.closedAt = Date.now();
  saveDB(); closeModal(); toast('Você saiu da lista de espera.', 'warn'); refreshCurrentView();
}

/* ---------- "Minhas reservas" → Lista de espera ---------- */
function renderMyWaitlist() {
  const list = myWaitlist().filter(w => w.status === 'waiting' && waitStillValid(w));
  if (!list.length) return `<div class="empty">${icon('clock', 28)}<div>Você não está em nenhuma lista de espera.<br><span class="small muted">Quando um horário estiver ocupado, use "Entrar na lista de espera" no formulário de reserva.</span></div></div>`;
  return `<div class="res-list">${list.map(w => {
    const offer = waitOffer(w), pos = waitPosition(w);
    return `<div class="res-row">
      <div class="res-row-date"><span class="d">${parseISO(w.date).getDate()}</span><span class="m">${parseISO(w.date).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</span></div>
      <div class="res-row-main"><strong>${escapeHtml(resourceName(w.resourceId))}${w.quantity > 1 ? ` <span class="muted">×${w.quantity}</span>` : ''}</strong>
        <span class="small muted">${w.mode === 'days' ? `até ${fmtDateShort(waitEnd(w))}` : slotText(w)} · na fila desde ${fmtDateTime(w.createdAt)}</span></div>
      <div class="res-row-side">
        ${offer ? `<span class="pill approved">Vaga livre</span><button class="btn dark small" onclick="showWaitlistOffer('${w.id}')">Reservar</button>`
                : `<span class="pill pending">${pos + 1}º da fila</span>`}
        <button class="icon-btn danger" title="Sair da fila" aria-label="Sair da lista de espera" onclick="leaveWaitlist('${w.id}')">${icon('x', 16)}</button>
      </div></div>`; }).join('')}</div>`;
}

/* Fila de um equipamento (para a equipe, na ficha do equipamento) */
function waitlistForResource(resourceId) {
  return waitingEntries().filter(w => w.resourceId === resourceId).sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
}
/* Quantas pessoas esperam o período desta reserva (aviso ao cancelar) */
function waitlistCountFor(r) {
  return waitingEntries().filter(w => w.userId !== r.userId && waitOverlaps(w, { resourceId: r.resourceId, date: r.date, endDate: resEnd(r), mode: r.mode, slot: r.slot })).length;
}
