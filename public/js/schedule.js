/* ============================================================
   schedule.js — Horários fixos dos espaços (v11.11)
   Salas de aula e outros espaços com aulas em dias e horários fixos
   durante um período (ex.: o semestre). Esses horários ficam
   bloqueados na agenda e não aceitam reserva.

   Formato (no próprio recurso):
     r.fixedBlocks = [{ id, days: [1,3], start: '07:00', end: '09:00',
                        label: 'Aula — MCC II', from: '2026-11-24', to: '2027-03-31' }]
     days: 0 = domingo … 6 = sábado
   ============================================================ */

const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const WEEKDAY_LONG = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const MAX_FIXED_BLOCKS = 40;

function isoWeekday(iso) { return new Date(iso + 'T12:00:00').getDay(); }
const _FB_HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/* Limpa e valida os horários fixos vindos do banco (descarta o que estiver malformado) */
function cleanFixedBlocks(list) {
  if (!Array.isArray(list)) return [];
  return list.filter(b => b && typeof b === 'object'
      && Array.isArray(b.days) && b.days.length && b.days.every(d => Number.isInteger(d) && d >= 0 && d <= 6)
      && _FB_HHMM.test(b.start || '') && _FB_HHMM.test(b.end || '') && b.end > b.start
      && /^\d{4}-\d{2}-\d{2}$/.test(b.from || '') && /^\d{4}-\d{2}-\d{2}$/.test(b.to || '') && b.to >= b.from)
    .slice(0, MAX_FIXED_BLOCKS)
    .map(b => ({ id: String(b.id || uid('fb')).slice(0, 64), days: [...new Set(b.days)].sort(), start: b.start, end: b.end,
                 label: String(b.label || 'Horário fixo').slice(0, 120), from: b.from, to: b.to }));
}

/* Horários fixos de um recurso que valem numa data */
function fixedBlocksOn(r, iso) {
  if (!r || !Array.isArray(r.fixedBlocks) || !r.fixedBlocks.length) return [];
  const wd = isoWeekday(iso);
  return r.fixedBlocks.filter(b => b.from <= iso && iso <= b.to && b.days.includes(wd))
    .sort((a, b) => a.start.localeCompare(b.start));
}
/* Primeiro horário fixo que conflita com um pedido (datas de/até + faixa de horário) */
function fixedBlockConflict(r, from, to, range) {
  if (!r || !r.fixedBlocks?.length) return null;
  for (const d of daySpan(from, to || from)) {
    const b = fixedBlocksOn(r, d).find(b => rangesOverlap(b, range));
    if (b) return { block: b, date: d };
  }
  return null;
}
function fixedDaysText(b) {
  const d = b.days.slice().sort((x, y) => ((x + 6) % 7) - ((y + 6) % 7));   // segunda primeiro
  return d.map(i => WEEKDAY_SHORT[i]).join(', ');
}
function fixedBlockText(b) { return `${b.label} — ${fixedDaysText(b)}, ${b.start}–${b.end} (até ${fmtDateShort(b.to)})`; }
function fixedConflictMessage(c) {
  return `Horário fixo neste espaço: ${c.block.label} (${WEEKDAY_LONG[isoWeekday(c.date)]}, ${c.block.start}–${c.block.end}). Escolha outro horário.`;
}

/* Agenda: horários fixos visíveis numa data (respeita o filtro de equipamento) */
function fixedEventsOn(iso, { all = false } = {}) {
  const filterId = typeof activeResourceFilter !== 'undefined' ? activeResourceFilter : 'all';
  if (!all && filterId === 'all' && typeof calOnlyMine !== 'undefined' && calOnlyMine) return [];
  const s = window.db.settings;
  if ((s.closedDates || []).includes(iso)) return [];
  const out = [];
  window.db.resources.forEach(r => {
    if (!r.active || (!all && filterId !== 'all' && r.id !== filterId)) return;
    fixedBlocksOn(r, iso).forEach(b => out.push({ fixed: true, r, b, id: r.id + ':' + b.id }));
  });
  return out.sort((a, b) => a.b.start.localeCompare(b.b.start) || a.r.name.localeCompare(b.r.name, 'pt-BR'));
}
function fixedRowHtml(f) {
  return `<div class="list-card fixed-card" role="note">
    <div class="list-card-main"><strong>${icon('lock', 15)} ${escapeHtml(f.r.name)}</strong>
      <span class="small muted">${f.b.start}–${f.b.end} · ${escapeHtml(f.b.label)}</span></div>
    <span class="pill fixed">Horário fixo</span></div>`;
}

/* ---------- Edição (coordenação) ---------- */
let _fixedDraft = [];
function fixedBlocksEditorHtml(r) {
  _fixedDraft = cleanFixedBlocks(r.fixedBlocks || []);
  const from = todayISO(), to = addDaysISO(from, 120);
  return `
    <div id="rFixedSection" ${r.type === 'space' ? '' : 'hidden'}>
      <div class="section-label" style="margin-top:14px;">Horários fixos (aulas e usos permanentes)</div>
      <div class="field-help" style="margin:-4px 0 10px;">Dias e horários que ficam bloqueados na agenda durante um período (ex.: o semestre). Ninguém consegue reservar o espaço nesses horários.</div>
      <div id="rFixedList" class="fixed-list"></div>
      <div class="fixed-add">
        <div class="field"><span class="label">Dias da semana</span>
          <div class="weekday-picks">${[1, 2, 3, 4, 5, 6].map(d => `<label><input type="checkbox" name="fbDay" value="${d}"><span>${WEEKDAY_SHORT[d]}</span></label>`).join('')}</div></div>
        <div class="field-row three">
          <div class="field"><label for="fbStart">Início</label><input type="time" id="fbStart" value="07:00" step="300"></div>
          <div class="field"><label for="fbEnd">Término</label><input type="time" id="fbEnd" value="09:00" step="300"></div>
          <div class="field"><label for="fbLabel">Descrição</label><input type="text" id="fbLabel" maxlength="120" placeholder="Ex.: Aula — Materiais II"></div>
        </div>
        <div class="field-row three">
          <div class="field"><label for="fbFrom">Válido de</label><input type="date" id="fbFrom" value="${from}"></div>
          <div class="field"><label for="fbTo">até</label><input type="date" id="fbTo" value="${to}"></div>
          <div class="field" style="align-self:end;"><button type="button" class="btn" onclick="addFixedBlockFromForm()">${icon('plus', 16)} Adicionar horário</button></div>
        </div>
      </div>
    </div>`;
}
function renderFixedDraft() {
  const el = document.getElementById('rFixedList'); if (!el) return;
  el.innerHTML = _fixedDraft.length ? _fixedDraft
    .slice().sort((a, b) => a.days[0] - b.days[0] || a.start.localeCompare(b.start))
    .map(b => `<div class="fixed-row ${b.to < todayISO() ? 'expired' : ''}">
      <div><strong>${escapeHtml(fixedDaysText(b))} · ${b.start}–${b.end}</strong>
        <div class="small muted">${escapeHtml(b.label)} · ${fmtDateShort(b.from)} a ${fmtDateShort(b.to)}${b.to < todayISO() ? ' · encerrado' : ''}</div></div>
      <button type="button" class="icon-btn" aria-label="Remover horário" title="Remover" onclick="removeFixedBlock('${b.id}')">${icon('trash', 16)}</button>
    </div>`).join('')
    : '<div class="small muted">Nenhum horário fixo.</div>';
}
function addFixedBlockFromForm() {
  const days = [...document.querySelectorAll('input[name=fbDay]:checked')].map(x => +x.value);
  const v = id => (document.getElementById(id)?.value || '').trim();
  const b = { id: uid('fb'), days, start: v('fbStart'), end: v('fbEnd'), label: v('fbLabel') || 'Aula', from: v('fbFrom'), to: v('fbTo') };
  if (!days.length) return toast('Marque pelo menos um dia da semana.', 'error');
  if (!_FB_HHMM.test(b.start) || !_FB_HHMM.test(b.end) || b.end <= b.start) return toast('Confira o horário: o término deve ser depois do início.', 'error');
  if (!b.from || !b.to || b.to < b.from) return toast('Confira o período de validade.', 'error');
  if (_fixedDraft.length >= MAX_FIXED_BLOCKS) return toast(`Máximo de ${MAX_FIXED_BLOCKS} horários fixos por espaço.`, 'error');
  const clash = _fixedDraft.find(x => x.days.some(d => days.includes(d)) && rangesOverlap(x, b) && x.from <= b.to && b.from <= x.to);
  if (clash) return toast(`Sobrepõe outro horário fixo: ${fixedDaysText(clash)}, ${clash.start}–${clash.end}.`, 'error');
  _fixedDraft.push(b);
  document.querySelectorAll('input[name=fbDay]').forEach(x => { x.checked = false; });
  document.getElementById('fbLabel').value = '';
  renderFixedDraft();
}
function removeFixedBlock(id) { _fixedDraft = _fixedDraft.filter(b => b.id !== id); renderFixedDraft(); }

/* Reservas ativas (de hoje em diante) que caem em algum horário fixo do recurso */
function reservationsHittingFixed(r) {
  const today = todayISO();
  return window.db.reservations.filter(x => x.resourceId === r.id && ['pending', 'approved'].includes(x.status) && resEnd(x) >= today
    && fixedBlockConflict(r, x.date < today ? today : x.date, resEnd(x), reservationRange(x)));
}
async function resolveFixedConflicts(r) {
  const list = reservationsHittingFixed(r);
  if (!list.length) return 0;
  const ans = await askConfirm({
    title: 'Reservas nesses horários',
    body: `Já existem <strong>${list.length}</strong> reserva(s) que caem nos horários fixos de <strong>${escapeHtml(r.name)}</strong>:<ul class="small" style="margin:8px 0 0 18px;">${list.slice(0, 8).map(x =>
      `<li>${fmtDateShort(x.date)} · ${slotText(x)} · ${escapeHtml(shortName(userName(x.userId), 2))}</li>`).join('')}${list.length > 8 ? `<li>… e mais ${list.length - 8}</li>` : ''}</ul>
      <p class="small" style="margin-top:8px;">Cancelar essas reservas e avisar os usuários? Para mantê-las, toque em "Voltar".</p>`,
    okLabel: 'Cancelar e avisar', danger: true
  });
  if (!ans) return 0;
  list.forEach(x => {
    const c = fixedBlockConflict(r, x.date < todayISO() ? todayISO() : x.date, resEnd(x), reservationRange(x));
    const reason = `Horário fixo do espaço: ${c ? c.block.label : 'aula'}`;
    x.status = 'cancelled'; x.cancelReason = reason; x.cancelledAt = Date.now(); x.cancelledBy = currentUser()?.id;
    logReservation(x, 'fixed_cancel', { reason });
    notifyUser(x.userId, `⚠️ Sua reserva foi cancelada: ${resLabel(x)}. Motivo: ${reason}. Procure a equipe técnica para remarcar.`);
  });
  saveDB();
  return list.length;
}

/* Ficha do espaço: horários fixos em vigor */
function fixedBlocksDetailHtml(r) {
  const list = (r.fixedBlocks || []).filter(b => b.to >= todayISO()).sort((a, b) => a.days[0] - b.days[0] || a.start.localeCompare(b.start));
  if (!list.length) return '';
  return `<div class="section-label" style="margin-top:16px;">${icon('lock', 14)} Horários fixos (não reserváveis)</div>
    <div class="fixed-list">${list.map(b => `<div class="fixed-row"><div><strong>${escapeHtml(fixedDaysText(b))} · ${b.start}–${b.end}</strong>
      <div class="small muted">${escapeHtml(b.label)} · até ${fmtDateShort(b.to)}</div></div></div>`).join('')}</div>`;
}
