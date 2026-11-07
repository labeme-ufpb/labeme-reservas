/* ============================================================
   reservations.js — Modal, reservas, ciclo de vida e devoluções (v10)
   Ciclo: pendente → aprovada → em uso → (aguardando conferência) → devolvida/concluída
          pendente → recusada · pendente/aprovada → cancelada
   Toda mudança de status fica registrada no histórico (auditoria)
   e o solicitante recebe uma mensagem automática.
   ============================================================ */

/* ---------------- Modal genérico (acessível) ---------------- */
let _lastFocus = null;
function openModal(html, wide = false) {
  const modal = document.getElementById('modal');
  const overlay = document.getElementById('modalOverlay');
  if (!overlay.classList.contains('show')) _lastFocus = document.activeElement;
  modal.className = 'modal' + (wide ? ' wide' : '');
  modal.innerHTML = html;
  overlay.classList.add('show');
  document.body.classList.add('modal-open');
  const t = modal.querySelector('.modal-title');
  if (t) { t.id = 'modalTitle'; modal.setAttribute('aria-labelledby', 'modalTitle'); }
  setTimeout(() => {
    const f = modal.querySelector('[autofocus], input:not([type=hidden]):not([disabled]), select, textarea, .modal-foot .btn.dark');
    (f || modal).focus({ preventScroll: true });
  }, 30);
}
function closeModal() {
  const overlay = document.getElementById('modalOverlay');
  if (!overlay.classList.contains('show')) return;
  overlay.classList.remove('show');
  document.body.classList.remove('modal-open');
  window._prefill = null;
  if (_lastFocus && document.contains(_lastFocus)) _lastFocus.focus({ preventScroll: true });
}
// Mantém o foco do teclado dentro do modal
document.addEventListener('keydown', e => {
  if (e.key !== 'Tab' || !document.getElementById('modalOverlay')?.classList.contains('show')) return;
  const items = [...document.getElementById('modal').querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])')].filter(el => el.offsetParent !== null);
  if (!items.length) return;
  const first = items[0], last = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});

/* Diálogo de confirmação (substitui window.confirm) — opcionalmente pede justificativa */
function askConfirm({ title, body = '', okLabel = 'Confirmar', danger = false, reason = false, reasonLabel = 'Justificativa', reasonRequired = false }) {
  return new Promise(resolve => {
    window._confirmResolve = val => { window._confirmResolve = null; closeModal(); resolve(val); };
    openModal(`
      <div class="modal-head"><div><div class="modal-title">${escapeHtml(title)}</div></div>
        <button class="modal-close" onclick="_confirmResolve(null)" aria-label="Fechar">${icon('x')}</button></div>
      <div class="modal-body">
        ${body ? `<p class="confirm-body">${body}</p>` : ''}
        ${reason ? `<div class="field"><label for="confirmReason">${escapeHtml(reasonLabel)}${reasonRequired ? ' <span class="req">*</span>' : ''}</label>
          <textarea id="confirmReason" rows="3" autofocus></textarea></div>` : ''}
      </div>
      <div class="modal-foot">
        <button class="btn" onclick="_confirmResolve(null)">Voltar</button>
        <button class="btn ${danger ? 'danger-solid' : 'dark'}" onclick="(function(){
          const r=document.getElementById('confirmReason');
          if(${reasonRequired} && r && !r.value.trim()){toast('Informe a justificativa.','error');r.focus();return;}
          _confirmResolve({ok:true, reason: r ? r.value.trim() : ''});
        })()">${escapeHtml(okLabel)}</button>
      </div>`);
  });
}

/* ---------------- Disponibilidade ---------------- */
function rangesOverlap(a, b) { return a.start < b.end && b.start < a.end; }

function reservedQuantityIn(resourceId, date, range, ignoreId = null) {
  return window.db.reservations
    .filter(x => x.id !== ignoreId && x.resourceId === resourceId && resCovers(x, date) && ACTIVE_STATUSES.includes(x.status))
    .filter(x => rangesOverlap(reservationRange(x), range))
    .reduce((s, x) => s + (x.quantity || 1), 0);
}

// Regras de data: retorna mensagem de erro ou null
function dateProblem(date) {
  const s = window.db.settings;
  if (!date) return 'Escolha uma data.';
  if (date < todayISO()) return 'A data já passou.';
  if (!s.allowWeekends && isWeekendISO(date)) return 'O laboratório não funciona aos fins de semana.';
  if ((s.closedDates || []).includes(date)) return 'Laboratório fechado nesta data (feriado/recesso).';
  const maxDate = addDaysISO(todayISO(), s.maxAdvanceDays || 30);
  if (date > maxDate) return `Reservas só até ${s.maxAdvanceDays} dias à frente (${fmtDate(maxDate)}).`;
  return null;
}
function rangeProblem(date, range) {
  const s = window.db.settings;
  if (!range.start || !range.end) return 'Informe início e término.';
  if (range.end <= range.start) return 'O término deve ser depois do início.';
  if (hhmmToMin(range.end) - hhmmToMin(range.start) < 30) return 'Duração mínima de 30 minutos.';
  const inside = ['manha','tarde'].some(t => { const tr = turnoRange(t, s); return tr && range.start >= tr.start && range.end <= tr.end; });
  if (!inside) return `Horário fora do expediente (manhã ${s.turnoManha.start}–${s.turnoManha.end}, tarde ${s.turnoTarde.start}–${s.turnoTarde.end}).`;
  // Antecedência mínima (em horas) a partir de agora
  const startTs = new Date(`${date}T${range.start}:00`).getTime();
  if ((startTs - Date.now()) / 36e5 < (s.minAdvanceHours || 0) && !isTechnician()) {
    return `É preciso reservar com pelo menos ${s.minAdvanceHours} h de antecedência.`;
  }
  return null;
}
// Reserva de vários dias: valida início, fim, limite de dias do equipamento e antecedência
function daysProblem(start, end, res) {
  const s = window.db.settings;
  const p1 = dateProblem(start); if (p1) return p1;
  if (!end) return 'Escolha a data final.';
  if (end < start) return 'A data final deve ser igual ou posterior à data inicial.';
  const p2 = dateProblem(end); if (p2) return 'Data final: ' + p2.charAt(0).toLowerCase() + p2.slice(1);
  const n = daySpan(start, end).length, max = res?.maxDays || 7;
  if (n > max) return `Este equipamento pode ser reservado por no máximo ${max} dias seguidos.`;
  const startTs = new Date(`${start}T${s.turnoManha.start}:00`).getTime();
  if ((startTs - Date.now()) / 36e5 < (s.minAdvanceHours || 0) && !isTechnician()) return `É preciso reservar com pelo menos ${s.minAdvanceHours} h de antecedência.`;
  return null;
}
// Maior quantidade já reservada em qualquer dia do período
function reservedQuantityInSpan(resourceId, from, to, range, ignoreId = null) {
  return Math.max(0, ...daySpan(from, to).map(d => reservedQuantityIn(resourceId, d, range, ignoreId)));
}

function firstBookableDate() {
  let d = todayISO();
  for (let i = 0; i < 60; i++) {
    const s = window.db.settings;
    const afterMin = new Date(`${d}T${s.turnoTarde.end}:00`).getTime() - Date.now() >= (s.minAdvanceHours || 0) * 36e5;
    if (afterMin && !dateProblem(d)) return d;
    d = addDaysISO(d, 1);
  }
  return todayISO();
}
function activeFutureCount(userId) {
  return window.db.reservations.filter(r => r.userId === userId && ['pending','approved'].includes(r.status) && resEnd(r) >= todayISO()).length;
}

/* ---------------- Nova reserva ---------------- */
function reservableResources() {
  return window.db.resources.filter(r => r.active && r.status !== 'maintenance');
}
function resourceOptionsHtml(selectedId, list = reservableResources()) {
  const opt = r => `<option value="${r.id}" ${r.id === selectedId ? 'selected' : ''}>${escapeHtml(r.name)}${r.totalQuantity > 1 ? ` (${r.totalQuantity} un.)` : ''}</option>`;
  if (isMobile()) return list.slice().sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true })).map(opt).join('');
  const groups = {};
  list.forEach(r => { (groups[r.group || 'Outros'] ||= []).push(r); });
  return Object.keys(groups).sort((a, b) => a.localeCompare(b, 'pt-BR')).map(g =>
    `<optgroup label="${escapeHtml(g)}">${groups[g].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true }))
      .map(r => `<option value="${r.id}" ${r.id === selectedId ? 'selected' : ''}>${escapeHtml(r.name)}${r.totalQuantity > 1 ? ` (${r.totalQuantity} un.)` : ''}</option>`).join('')}</optgroup>`
  ).join('');
}

function openReserveModal(prefill = {}) {
  const u = currentUser();
  if (!u) { toast('Entre no sistema para reservar.', 'warn'); window._afterLogin = 'resources'; showView('auth'); return; }
  if (prefill.resourceId && getResource(prefill.resourceId)?.status === 'maintenance') {
    return toast('Este recurso está em manutenção e não pode ser reservado.', 'warn');
  }
  if (!reservableResources().length) return toast('Nenhum recurso disponível para reserva.', 'warn');
  const s = window.db.settings;
  const limit = s.maxActivePerUser || 0;
  if (limit && !isTechnician() && activeFutureCount(u.id) >= limit) {
    return toast(`Você já tem ${limit} reservas futuras ativas (limite do laboratório). Cancele ou conclua alguma antes.`, 'warn');
  }
  window._prefill = prefill;
  const date = prefill.date && !dateProblem(prefill.date) ? prefill.date : firstBookableDate();
  const auto = isAutoApprovedCategory(u.category) || isTechnician();

  openModal(`
    <div class="modal-head">
      <div><div class="modal-title">Nova reserva</div>
      <div class="modal-sub" id="resForSub">${escapeHtml(u.name)} · ${escapeHtml(CATEGORY_LABELS[u.category] || '')}</div></div>
      <button class="modal-close" onclick="closeModal()" aria-label="Fechar">${icon('x')}</button>
    </div>
    <div class="modal-body">
      ${isTechnician() ? `
      <div class="field on-behalf">
        <label for="resFor">Reservar para</label>
        <select id="resFor" onchange="onReserveForChange()">
          <option value="${u.id}">${escapeHtml(u.name)} (eu)</option>
          ${window.db.users.filter(x => x.id !== u.id && x.active !== false).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
            .map(x => `<option value="${x.id}">${escapeHtml(x.name)} · ${escapeHtml(CATEGORY_LABELS[x.category] || '')}</option>`).join('')}
        </select>
        <div class="field-help">Equipe técnica e coordenação podem reservar em nome de alunos e professores. A pessoa recebe um aviso.</div>
      </div>` : ''}
      <div class="field">
        <label for="resResource">Equipamento ou espaço <span class="req">*</span></label>
        <div class="input-icon">${icon('search', 16)}<input type="search" id="resFilter" placeholder="Filtrar lista (ex.: prensa, peneira, estufa)" oninput="filterResourceSelect(this.value)"></div>
        <select id="resResource" onchange="updateReserveModal()" style="margin-top:6px;">
          <option value="">Selecione…</option>${resourceOptionsHtml(prefill.resourceId)}
        </select>
      </div>
      <div id="resourceInfo"></div>
      <div class="field">
        <label for="resDate" id="resDateLabel">Data <span class="req">*</span></label>
        <input type="date" id="resDate" min="${todayISO()}" max="${addDaysISO(todayISO(), s.maxAdvanceDays || 30)}" value="${date}" onchange="if(document.getElementById('resEndDate')&&document.querySelector('input[name=rdays]:checked')?.value==='days')renderDaysFields();else updateAvailability();">
        <div class="field-help">Antecedência mínima de ${s.minAdvanceHours} h · até ${s.maxAdvanceDays} dias à frente${s.allowWeekends ? '' : ' · dias úteis'}</div>
      </div>
      <div id="resModeFields"></div>
      <div id="resQuantityField"></div>
      <div id="resAvailability" aria-live="polite"></div>
      <div class="field-row">
        <div class="field">
          <label for="resPurposeType">Tipo de atividade <span class="req">*</span></label>
          <select id="resPurposeType" onchange="this.dataset.touched='1'">
            <option value="">Selecione…</option>
            ${Object.entries(PURPOSE_TYPES).map(([k, v]) => `<option value="${k}" ${defaultPurposeType(u) === k ? 'selected' : ''}>${v}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label for="resProject">Projeto / disciplina</label>
          <input type="text" id="resProject" maxlength="120" placeholder="Ex.: Dissertação — argamassas com RCD">
        </div>
      </div>
      <div class="field">
        <label for="resPurpose">Descrição do uso <span class="req">*</span></label>
        <textarea id="resPurpose" rows="3" maxlength="600" placeholder="Ensaio previsto, quantidade de corpos de prova, materiais envolvidos…"></textarea>
      </div>
      <div class="info-box ${auto ? 'success' : ''}">${auto
        ? `${icon('check', 16)} Sua reserva será <strong>aprovada automaticamente</strong>.`
        : `${icon('clock', 16)} Sua reserva ficará <strong>pendente</strong> até a aprovação de um técnico ou da coordenação.`}</div>
    </div>
    <div class="modal-foot">
      <button class="btn" onclick="closeModal()">Cancelar</button>
      <button class="btn dark" id="submitResBtn" onclick="submitReservation()">Confirmar reserva</button>
    </div>`);
  if (prefill.resourceId) updateReserveModal();
}
function onReserveForChange() {
  const t = getUser(document.getElementById('resFor').value); if (!t) return;
  const me = currentUser();
  document.getElementById('resForSub').textContent = t.id === me.id ? `${t.name} · ${CATEGORY_LABELS[t.category] || ''}` : `Para ${t.name} · ${CATEGORY_LABELS[t.category] || ''} — registrada por ${me.name}`;
  const pt = document.getElementById('resPurposeType'); if (pt && !pt.dataset.touched) pt.value = defaultPurposeType(t);
}
function defaultPurposeType(u) {
  return { graduacao: 'pesquisa_tcc', graduacao_vinculo: 'pesquisa_ic', mestrado: 'pesquisa_pos', doutorado: 'pesquisa_pos', prof_depto: 'pesquisa_docente' }[u.category] || '';
}
function filterResourceSelect(term) {
  const sel = document.getElementById('resResource');
  const t = term.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const list = reservableResources().filter(r => !t || (r.name + ' ' + (r.model || '') + ' ' + (r.group || '') + ' ' + (r.location || ''))
    .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(t));
  const cur = sel.value;
  sel.innerHTML = `<option value="">${list.length ? 'Selecione…' : 'Nenhum resultado'}</option>${resourceOptionsHtml(cur, list)}`;
  if (list.length === 1) { sel.value = list[0].id; updateReserveModal(); }
}

function updateReserveModal() {
  const r = getResource(document.getElementById('resResource').value);
  const info = document.getElementById('resourceInfo');
  const modeFields = document.getElementById('resModeFields');
  const qtyField = document.getElementById('resQuantityField');
  if (!r) { info.innerHTML = modeFields.innerHTML = qtyField.innerHTML = ''; document.getElementById('resAvailability').innerHTML = ''; return; }

  const img = safeImg(r.photo);
  info.innerHTML = `
    <div class="res-summary">
      ${img ? `<img src="${img}" alt="">` : `<div class="res-summary-ph">${icon('box', 26)}</div>`}
      <div>
        <strong>${escapeHtml(r.name)}</strong>
        ${r.model ? `<div class="muted small">${escapeHtml(r.model)}</div>` : ''}
        ${r.location ? `<div class="muted small">${icon('pin', 13)} ${escapeHtml(r.location)}</div>` : ''}
        ${r.description ? `<div class="small" style="margin-top:4px;">${escapeHtml(r.description)}</div>` : ''}
      </div>
    </div>
    ${r.requiresTechnicianPresence ? `<div class="info-box warn">${icon('alert', 16)} <strong>Presença de técnico obrigatória.</strong> O uso só acontece com a equipe técnica presente.</div>`
      : r.requiresTechnicianAssist ? `<div class="info-box">${icon('info', 16)} Acompanhamento técnico recomendado para operação segura.</div>` : ''}
    ${r.requiresReturnPhoto ? `<div class="info-box warn">${icon('camera', 16)} <strong>Devolução com foto obrigatória</strong> ao final do uso.</div>` : ''}`;

  const p = window._prefill || {};
  const s = window.db.settings;
  const slotFields = `
    <div class="field-row">
      <div class="field"><label for="resStart">Início <span class="req">*</span></label>
        <input type="time" id="resStart" value="${p.startTime || s.turnoTarde.start}" step="1800" onchange="updateAvailability()"></div>
      <div class="field"><label for="resEnd">Término <span class="req">*</span></label>
        <input type="time" id="resEnd" value="${p.endTime || addMinutes(p.startTime || s.turnoTarde.start, 120)}" step="1800" onchange="updateAvailability()"></div>
    </div>`;
  const turnoFields = `
    <div class="field"><label for="resTurno">Turno <span class="req">*</span></label>
      <select id="resTurno" onchange="updateAvailability()">
        <option value="manha">Manhã (${s.turnoManha.start}–${s.turnoManha.end})</option>
        <option value="tarde" ${p.startTime && p.startTime >= s.turnoTarde.start ? 'selected' : ''}>Tarde (${s.turnoTarde.start}–${s.turnoTarde.end})</option>
      </select></div>`;
  let single;
  if (r.mode === 'both') {
    const startSlot = !!p.startTime;
    single = `
      <div class="field"><span class="label">Modo de reserva</span>
        <div class="seg">
          <label><input type="radio" name="rmode" value="turno" ${startSlot ? '' : 'checked'} onchange="renderTimeFields()"><span>Turno inteiro</span></label>
          <label><input type="radio" name="rmode" value="slot" ${startSlot ? 'checked' : ''} onchange="renderTimeFields()"><span>Horário específico</span></label>
        </div></div>
      <div id="timeFieldsMount">${startSlot ? slotFields : turnoFields}</div>`;
    window._timeTpl = { slotFields, turnoFields };
  } else {
    single = r.mode === 'slot' ? slotFields : turnoFields;
  }
  if (r.allowMultiDay) {
    // Equipamento liberado pela coordenação para reservas de vários dias (de… até…)
    const start = document.getElementById('resDate').value || todayISO();
    const max = r.maxDays || 7;
    modeFields.innerHTML = `
      <div class="field"><span class="label">Período</span>
        <div class="seg">
          <label><input type="radio" name="rdays" value="single" checked onchange="renderDaysFields()"><span>Um dia</span></label>
          <label><input type="radio" name="rdays" value="days" onchange="renderDaysFields()"><span>Vários dias</span></label>
        </div>
        <div class="field-help">Este equipamento pode ser reservado por até ${max} dias seguidos.</div></div>
      <div id="singleFields">${single}</div>
      <div id="daysFields" hidden>
        <div class="field"><label for="resEndDate">Até <span class="req">*</span></label>
          <input type="date" id="resEndDate" min="${start}" value="${addDaysISO(start, Math.min(max, 5) - 1)}" onchange="updateAvailability()">
          <div class="field-help">O equipamento fica reservado o dia todo, do primeiro ao último dia.</div></div>
      </div>`;
  } else {
    modeFields.innerHTML = single;
  }
  qtyField.innerHTML = (r.totalQuantity || 1) > 1 ? `
    <div class="field"><label for="resQuantity">Quantidade <span class="req">*</span></label>
      <input type="number" id="resQuantity" min="1" max="${r.totalQuantity}" value="1" oninput="updateAvailability()">
      <div class="field-help">Existem ${r.totalQuantity} unidades no laboratório.</div></div>` : '';
  updateAvailability();
}
function addMinutes(hhmm, mins) {
  const t = hhmmToMin(hhmm) + mins;
  return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
}
function renderDaysFields() {
  const days = document.querySelector('input[name=rdays]:checked')?.value === 'days';
  document.getElementById('singleFields').hidden = days;
  document.getElementById('daysFields').hidden = !days;
  const lbl = document.getElementById('resDateLabel'); if (lbl) lbl.innerHTML = (days ? 'De' : 'Data') + ' <span class="req">*</span>';
  const start = document.getElementById('resDate').value, end = document.getElementById('resEndDate');
  if (days && end) { end.min = start; if (!end.value || end.value < start) end.value = start; }
  updateAvailability();
}
function renderTimeFields() {
  const mode = document.querySelector('input[name=rmode]:checked')?.value;
  document.getElementById('timeFieldsMount').innerHTML = mode === 'slot' ? window._timeTpl.slotFields : window._timeTpl.turnoFields;
  updateAvailability();
}

function readReservationForm() {
  const r = getResource(document.getElementById('resResource')?.value);
  if (!r) return null;
  const date = document.getElementById('resDate').value;
  const quantity0 = parseInt(document.getElementById('resQuantity')?.value || '1', 10);
  if (r.allowMultiDay && document.querySelector('input[name=rdays]:checked')?.value === 'days') {
    const endDate = document.getElementById('resEndDate')?.value || '';
    const endEl = document.getElementById('resEndDate'); if (endEl) endEl.min = date;
    return { r, date, endDate, mode: 'days', slot: {}, quantity: quantity0, range: { start: '00:00', end: '23:59' } };
  }
  const radio = document.querySelector('input[name=rmode]:checked')?.value;
  let mode, slot;
  if (r.mode === 'slot' || (r.mode === 'both' && radio === 'slot')) {
    mode = 'slot'; slot = { start: document.getElementById('resStart')?.value, end: document.getElementById('resEnd')?.value };
  } else {
    mode = 'turno'; slot = { turno: document.getElementById('resTurno')?.value || 'manha' };
  }
  const quantity = parseInt(document.getElementById('resQuantity')?.value || '1', 10);
  return { r, date, endDate: date, mode, slot, quantity, range: mode === 'slot' ? { start: slot.start, end: slot.end } : turnoRange(slot.turno) };
}

function updateAvailability() {
  const mount = document.getElementById('resAvailability');
  const f = readReservationForm();
  if (!mount || !f) return;
  const multi = f.mode === 'days';
  const problem = multi ? daysProblem(f.date, f.endDate, f.r) : (dateProblem(f.date) || rangeProblem(f.date, f.range));
  const dayList = window.db.reservations
    .filter(x => x.resourceId === f.r.id && ACTIVE_STATUSES.includes(x.status) && (multi ? f.endDate && resOverlapsDates(x, f.date, f.endDate) : resCovers(x, f.date)))
    .sort((a, b) => (a.date + reservationRange(a).start).localeCompare(b.date + reservationRange(b).start));
  const dayHtml = dayList.length ? `<div class="day-occupancy"><div class="small muted">${multi ? 'Já reservado no período:' : 'Já reservado neste dia:'}</div>${dayList.map(x =>
    `<div class="occ-row"><span class="mono">${multi || isMultiDay(x) ? fmtDateShort(x.date) + ' · ' : ''}${slotText(x)}</span><span>${escapeHtml(shortName(userName(x.userId), 2))}${x.quantity > 1 ? ' · ' + x.quantity + ' un.' : ''}</span>${statusPill(x.status)}</div>`).join('')}</div>` : '';
  if (problem) { mount.innerHTML = `<div class="info-box danger">${icon('alert', 16)} ${escapeHtml(problem)}</div>${dayHtml}`; return; }

  const total = f.r.totalQuantity || 1;
  const available = total - (multi ? reservedQuantityInSpan(f.r.id, f.date, f.endDate, f.range) : reservedQuantityIn(f.r.id, f.date, f.range));
  let cls = 'success', text;
  if (available <= 0) { cls = 'danger'; text = multi ? `<strong>Indisponível</strong> em pelo menos um dia do período.` : `<strong>Indisponível</strong> neste período.`; }
  else if (f.quantity > available) { cls = 'warn'; text = `Só <strong>${available} de ${total}</strong> unidade(s) livre(s) — você pediu ${f.quantity}.`; }
  else text = (total > 1 ? `<strong>${available} de ${total}</strong> unidade(s) livre(s) neste período.` : `<strong>Disponível</strong> neste período.`)
    + (multi ? ` <span class="small">(${daySpan(f.date, f.endDate).length} dia(s): ${fmtDateShort(f.date)} a ${fmtDateShort(f.endDate)})</span>` : '');
  mount.innerHTML = `<div class="info-box ${cls}">${icon(cls === 'success' ? 'check' : 'alert', 16)} ${text}</div>${dayHtml}`;
}

function submitReservation() {
  const me = currentUser(); if (!me) return;
  const forSel = document.getElementById('resFor');
  const u = (isTechnician() && forSel && getUser(forSel.value)) || me;   // titular da reserva
  const onBehalf = u.id !== me.id;
  const f = readReservationForm();
  const purpose = document.getElementById('resPurpose').value.trim();
  const purposeType = document.getElementById('resPurposeType').value;
  const project = document.getElementById('resProject').value.trim();
  if (!f) return toast('Escolha o equipamento ou espaço.', 'error');
  if (!purposeType) return toast('Escolha o tipo de atividade.', 'error');
  if (purpose.length < 10) return toast('Descreva o uso (mínimo 10 caracteres).', 'error');
  if (f.r.status === 'maintenance' || !f.r.active) return toast('Recurso indisponível.', 'error');
  const multi = f.mode === 'days';
  const problem = multi ? daysProblem(f.date, f.endDate, f.r) : (dateProblem(f.date) || rangeProblem(f.date, f.range));
  if (problem) return toast(problem, 'error');
  const total = f.r.totalQuantity || 1;
  if (!(f.quantity >= 1 && f.quantity <= total)) return toast(`Quantidade inválida (1 a ${total}).`, 'error');
  const free = total - (multi ? reservedQuantityInSpan(f.r.id, f.date, f.endDate, f.range) : reservedQuantityIn(f.r.id, f.date, f.range));
  if (f.quantity > free) return toast(free > 0 ? `Só ${free} unidade(s) livre(s) neste período.` : (multi ? 'O equipamento já está reservado em algum dia do período.' : 'Período já ocupado. Escolha outro horário.'), 'error');
  // Mesmo usuário com outra reserva do mesmo recurso no mesmo período
  const dup = window.db.reservations.some(x => x.userId === u.id && x.resourceId === f.r.id && ACTIVE_STATUSES.includes(x.status)
    && resOverlapsDates(x, f.date, f.endDate) && rangesOverlap(reservationRange(x), f.range));
  if (dup) return toast(onBehalf ? `${u.name} já tem uma reserva deste recurso neste período.` : 'Você já tem uma reserva deste recurso neste período.', 'error');

  const auto = isAutoApprovedCategory(u.category) || isTechnician();   // reserva feita pela equipe já nasce aprovada
  const res = {
    id: uid('res'), userId: u.id, resourceId: f.r.id,
    date: f.date, ...(multi ? { endDate: f.endDate } : {}), mode: f.mode, slot: f.slot, quantity: f.quantity,
    purpose, purposeType, project,
    status: auto ? 'approved' : 'pending',
    createdAt: Date.now(),
    returnPhotoRequired: !!f.r.requiresReturnPhoto, returnPhoto: null, returnedAt: null,
    history: [], ...(onBehalf ? { createdBy: me.id } : {})
  };
  logReservation(res, onBehalf ? 'created_by_staff' : 'created');
  if (auto) { res.decidedAt = Date.now(); res.decidedBy = 'auto'; logReservation(res, 'auto_approved'); }
  window.db.reservations.push(res);
  if (!saveDB()) { window.db.reservations.pop(); return; }
  if (onBehalf) { notifyUser(u.id, `📅 ${me.name} registrou uma reserva para você: ${resLabel(res)}.`); saveDB(); }
  closeModal();
  toast(onBehalf ? `Reserva registrada para ${firstName(u.name)}.` : auto ? 'Reserva confirmada!' : 'Solicitação enviada — aguardando aprovação.', 'success');
  refreshCurrentView();
}

/* ---------------- Ações de ciclo de vida ---------------- */
function notifyUser(toUserId, body) {
  const me = currentUser();
  if (!window.db.settings.notifyInApp || !me || me.id === toUserId || !getUser(toUserId)) return;
  window.db.messages.push({ id: uid('msg'), fromUserId: me.id, toUserId, body, sentAt: Date.now(), readAt: null, system: true });
}
function resLabel(r) {
  return isMultiDay(r) ? `${resourceName(r.resourceId)} — de ${fmtDate(r.date)} a ${fmtDate(resEnd(r))}` : `${resourceName(r.resourceId)} — ${fmtDate(r.date)}, ${slotText(r)}`;
}

async function approveReservation(id) {
  const r = getReservation(id); if (!r || r.status !== 'pending' || !canApproveReservations()) return;
  const res = getResource(r.resourceId);
  if (res && (res.status === 'maintenance' || !res.active)) return toast('Recurso em manutenção/inativo — não é possível aprovar.', 'error');
  r.status = 'approved'; r.decidedAt = Date.now(); r.decidedBy = currentUser().id;
  logReservation(r, 'approved');
  notifyUser(r.userId, `✅ Sua reserva foi APROVADA: ${resLabel(r)}.${res?.requiresTechnicianPresence ? ' Lembre-se: este equipamento exige técnico presente.' : ''}`);
  saveDB(); closeModal(); toast('Reserva aprovada — solicitante notificado.', 'success'); refreshCurrentView();
}
async function denyReservation(id) {
  const r = getReservation(id); if (!r || r.status !== 'pending' || !canApproveReservations()) return;
  const ans = await askConfirm({ title: 'Recusar reserva', body: escapeHtml(resLabel(r)), okLabel: 'Recusar', danger: true, reason: true, reasonLabel: 'Motivo (será enviado ao solicitante)', reasonRequired: true });
  if (!ans) return;
  r.status = 'denied'; r.denyReason = ans.reason; r.decidedAt = Date.now(); r.decidedBy = currentUser().id;
  logReservation(r, 'denied', { reason: ans.reason });
  notifyUser(r.userId, `❌ Sua reserva foi RECUSADA: ${resLabel(r)}. Motivo: ${ans.reason}`);
  saveDB(); toast('Reserva recusada — solicitante notificado.', 'warn'); refreshCurrentView();
}
async function cancelReservation(id) {
  const r = getReservation(id); const me = currentUser(); if (!r || !me) return;
  const isOwner = r.userId === me.id;
  if (!(isOwner || canApproveReservations()) || !['pending','approved'].includes(r.status)) return;
  const ans = await askConfirm({ title: 'Cancelar reserva', body: escapeHtml(resLabel(r)) + (isOwner ? '<br><span class="muted small">Cancelar libera o horário para outras pessoas.</span>' : ''), okLabel: 'Cancelar reserva', danger: true, reason: true, reasonLabel: isOwner ? 'Motivo (opcional)' : 'Motivo (será enviado ao solicitante)', reasonRequired: !isOwner });
  if (!ans) return;
  r.status = 'cancelled'; r.cancelReason = ans.reason || (isOwner ? 'Cancelada pelo solicitante' : ''); r.cancelledAt = Date.now(); r.cancelledBy = me.id;
  logReservation(r, 'cancelled', { reason: r.cancelReason });
  if (!isOwner) notifyUser(r.userId, `⚠️ Sua reserva foi CANCELADA pela equipe do laboratório: ${resLabel(r)}. Motivo: ${ans.reason}`);
  saveDB(); toast('Reserva cancelada.', 'warn'); refreshCurrentView();
}
function checkInReservation(id) {
  const r = getReservation(id); if (!r || r.status !== 'approved' || !canApproveReservations()) return;
  r.status = 'in_use'; r.checkInAt = Date.now(); r.checkInBy = currentUser().id;
  logReservation(r, 'check_in'); saveDB(); closeModal(); toast('Uso iniciado (check-in registrado).', 'success'); refreshCurrentView();
}
function completeReservation(id) {
  const r = getReservation(id); if (!r || !['approved','in_use','awaiting_return'].includes(r.status) || !canApproveReservations()) return;
  const wasReturn = r.status === 'awaiting_return' || r.returnPhotoRequired;
  r.status = wasReturn ? 'returned' : 'completed'; r.completedAt = Date.now(); r.completedBy = currentUser().id;
  logReservation(r, wasReturn ? 'return_confirmed' : 'completed');
  if (wasReturn) notifyUser(r.userId, `📦 Devolução conferida e aceita: ${resLabel(r)}. Obrigado!`);
  saveDB(); closeModal(); toast(wasReturn ? 'Devolução confirmada.' : 'Uso concluído.', 'success'); refreshCurrentView();
}
async function rejectReturn(id) {
  const r = getReservation(id); if (!r || r.status !== 'awaiting_return' || !canApproveReservations()) return;
  const ans = await askConfirm({ title: 'Devolução com pendência', body: 'A reserva volta para "em uso" e o solicitante é avisado para regularizar.', okLabel: 'Registrar pendência', danger: true, reason: true, reasonLabel: 'O que está pendente?', reasonRequired: true });
  if (!ans) return;
  r.status = 'in_use'; r.returnIssue = ans.reason; logReservation(r, 'return_rejected', { reason: ans.reason });
  notifyUser(r.userId, `⚠️ Pendência na devolução de ${resLabel(r)}: ${ans.reason}. Procure a equipe técnica.`);
  saveDB(); toast('Pendência registrada.', 'warn'); refreshCurrentView();
}
// compatibilidade com chamadas antigas
function setReservationStatus(id, status) {
  if (status === 'approved') return approveReservation(id);
  if (status === 'denied') return denyReservation(id);
  if (status === 'in_use') return checkInReservation(id);
}
function confirmReturn(id) { return completeReservation(id); }

/* ---------------- Detalhe ---------------- */
const HISTORY_LABELS = {
  created: 'Solicitação criada', created_by_staff: 'Registrada pela equipe em nome do usuário', auto_approved: 'Aprovada automaticamente', approved: 'Aprovada', denied: 'Recusada',
  cancelled: 'Cancelada', check_in: 'Uso iniciado', completed: 'Uso concluído', return_sent: 'Foto de devolução enviada',
  return_confirmed: 'Devolução conferida', return_rejected: 'Pendência na devolução', auto_completed: 'Concluída automaticamente',
  auto_expired: 'Expirada sem análise', maintenance_cancel: 'Cancelada — recurso em manutenção'
};

function showDayDetail(iso, events) {
  openModal(`
    <div class="modal-head">
      <div><div class="modal-title">${fmtDateLong(iso)}</div><div class="modal-sub">${events.length} reserva(s)</div></div>
      <button class="modal-close" onclick="closeModal()" aria-label="Fechar">${icon('x')}</button>
    </div>
    <div class="modal-body">
      ${events.sort((a, b) => reservationRange(a).start.localeCompare(reservationRange(b).start)).map(e => `
        <button class="list-card" onclick="showResDetail('${e.id}')">
          <div class="list-card-main">
            <strong>${escapeHtml(resourceName(e.resourceId))}${e.quantity > 1 ? ` <span class="muted">×${e.quantity}</span>` : ''}</strong>
            <span class="small muted">${slotText(e)} · ${escapeHtml(userName(e.userId))}</span>
          </div>${statusPill(e.status)}
        </button>`).join('')}
    </div>
    <div class="modal-foot">
      <button class="btn" onclick="closeModal()">Fechar</button>
      ${dateProblem(iso) ? '' : `<button class="btn dark" onclick="closeModal();openReserveModal({date:'${iso}'})">${icon('plus', 16)} Reservar neste dia</button>`}
    </div>`);
}

function showResDetail(id) {
  const r = getReservation(id); if (!r) return;
  const res = getResource(r.resourceId);
  const u = getUser(r.userId);
  const me = currentUser();
  const staff = canApproveReservations();
  const isOwner = me && me.id === r.userId;
  const future = resEnd(r) >= todayISO();
  const img = safeImg(res?.photo);
  const retImg = safeImg(r.returnPhoto);

  const actions = [];
  if (me && u && me.id !== u.id) actions.push(`<button class="btn" onclick="closeModal();openConversation('${u.id}');showView('messages')">${icon('chat', 16)} Mensagem</button>`);
  if ((isOwner || staff) && ['pending','approved'].includes(r.status) && future) actions.push(`<button class="btn danger" onclick="cancelReservation('${r.id}')">Cancelar reserva</button>`);
  if (staff && r.status === 'pending') actions.push(`<button class="btn danger" onclick="denyReservation('${r.id}')">Recusar</button>`, `<button class="btn success" onclick="approveReservation('${r.id}')">${icon('check', 16)} Aprovar</button>`);
  if (staff && r.status === 'approved' && r.date <= todayISO()) actions.push(`<button class="btn" onclick="checkInReservation('${r.id}')">${icon('play', 16)} Iniciar uso</button>`);
  if (staff && ['approved','in_use'].includes(r.status) && !r.returnPhotoRequired && r.date <= todayISO()) actions.push(`<button class="btn success" onclick="completeReservation('${r.id}')">${icon('flag', 16)} Concluir</button>`);
  if (isOwner && r.returnPhotoRequired && ['approved','in_use'].includes(r.status) && r.date <= todayISO()) actions.push(`<button class="btn green" onclick="openReturnPhotoModal('${r.id}')">${icon('camera', 16)} Enviar foto de devolução</button>`);
  if (staff && r.status === 'awaiting_return') actions.push(`<button class="btn danger" onclick="rejectReturn('${r.id}')">Pendência</button>`, `<button class="btn success" onclick="completeReservation('${r.id}')">${icon('check', 16)} Conferir devolução</button>`);
  if (staff && ['approved','in_use'].includes(r.status) && r.returnPhotoRequired && resEnd(r) < todayISO()) actions.push(`<button class="btn" onclick="completeReservation('${r.id}')">Receber sem foto</button>`);

  const reasonBox = r.denyReason ? `<div class="info-box danger"><strong>Motivo da recusa:</strong> ${escapeHtml(r.denyReason)}</div>`
    : r.cancelReason ? `<div class="info-box warn"><strong>Cancelamento:</strong> ${escapeHtml(r.cancelReason)}</div>` : '';

  openModal(`
    <div class="modal-head">
      <div><div class="modal-title">${escapeHtml(res?.name || 'Recurso removido')}${r.quantity > 1 ? ` <span class="muted">×${r.quantity}</span>` : ''}</div>
      <div class="modal-sub">${isMultiDay(r) ? `De ${fmtDateLong(r.date)} a ${fmtDateLong(resEnd(r))} · ${resDayCount(r)} dia(s)` : `${fmtDateLong(r.date)} · ${slotText(r)}`}</div></div>
      <button class="modal-close" onclick="closeModal()" aria-label="Fechar">${icon('x')}</button>
    </div>
    <div class="modal-body">
      ${img ? `<img src="${img}" alt="" class="detail-photo">` : ''}
      ${isOverdueReturn(r) ? `<div class="info-box danger">${icon('alert', 16)} <strong>Devolução atrasada</strong> — a foto de devolução ainda não foi enviada.</div>` : ''}
      ${reasonBox}
      <dl class="res-meta">
        <div><dt>Status</dt><dd>${statusPill(r.status)}</dd></div>
        <div><dt>Solicitante</dt><dd>${escapeHtml(u?.name || 'Usuário removido')}</dd></div>
        <div><dt>Categoria</dt><dd>${escapeHtml(CATEGORY_LABELS[u?.category] || '—')}</dd></div>
        ${staff ? `<div><dt>Contato</dt><dd>${escapeHtml(u?.email || '—')}${u?.phone ? '<br>' + escapeHtml(u.phone) : ''}</dd></div>` : ''}
        ${u?.advisor ? `<div><dt>Orientador(a)</dt><dd>${escapeHtml(u.advisor)}</dd></div>` : ''}
        ${res?.location ? `<div><dt>Local</dt><dd>${escapeHtml(res.location)}</dd></div>` : ''}
        ${r.purposeType ? `<div><dt>Atividade</dt><dd>${escapeHtml(PURPOSE_TYPES[r.purposeType] || r.purposeType)}</dd></div>` : ''}
        ${r.project ? `<div><dt>Projeto</dt><dd>${escapeHtml(r.project)}</dd></div>` : ''}
      </dl>
      <div class="field"><span class="label">Descrição do uso</span><div class="quote">${escapeHtml(r.purpose || '—')}</div></div>
      ${retImg ? `<div class="field"><span class="label">Foto de devolução</span><img src="${retImg}" alt="Foto de devolução" class="detail-photo">${r.returnNotes ? `<div class="small muted">${escapeHtml(r.returnNotes)}</div>` : ''}</div>` : ''}
      ${r.returnIssue ? `<div class="info-box warn"><strong>Pendência registrada:</strong> ${escapeHtml(r.returnIssue)}</div>` : ''}
      ${(staff || isOwner) && r.history?.length ? `
        <details class="history"><summary>Histórico (${r.history.length})</summary>
          <ol>${r.history.map(h => `<li><span class="mono small">${fmtDateTime(h.at)}</span> ${escapeHtml(HISTORY_LABELS[h.action] || h.action)}${h.by && h.by !== 'system' && h.by !== r.userId ? ` · ${escapeHtml(userName(h.by))}` : ''}${h.reason ? ` — <em>${escapeHtml(h.reason)}</em>` : ''}</li>`).join('')}</ol>
        </details>` : ''}
    </div>
    <div class="modal-foot">${actions.join('')}<button class="btn" onclick="closeModal()">Fechar</button></div>`);
}

/* ---------------- Devolução com foto ---------------- */
function openReturnPhotoModal(id) {
  const r = getReservation(id); if (!r) return;
  window._returnPhotoData = null;
  openModal(`
    <div class="modal-head">
      <div><div class="modal-title">Foto de devolução</div><div class="modal-sub">${escapeHtml(resLabel(r))}</div></div>
      <button class="modal-close" onclick="closeModal()" aria-label="Fechar">${icon('x')}</button>
    </div>
    <div class="modal-body">
      <div class="info-box">Fotografe o(s) item(ns) limpo(s) e no local de guarda. A equipe técnica confere antes de encerrar a reserva.</div>
      <label class="file-upload" id="returnPhotoLabel">
        <input type="file" id="returnPhotoInput" accept="image/*" onchange="onReturnPhotoChange(event)">
        <div id="returnPhotoText">${icon('camera')} Tirar ou escolher foto</div>
      </label>
      <img id="returnPhotoPreview" class="file-preview" hidden alt="Prévia">
      <div class="field" style="margin-top:14px;"><label for="returnNotes">Observações</label>
        <textarea id="returnNotes" rows="2" placeholder="Ex.: tudo em perfeitas condições; peneira 75 µm com tela levemente deformada…"></textarea></div>
    </div>
    <div class="modal-foot">
      <button class="btn" onclick="closeModal()">Cancelar</button>
      <button class="btn green" onclick="submitReturnPhoto('${r.id}')">Enviar devolução</button>
    </div>`);
}
function onReturnPhotoChange(e) {
  const file = e.target.files[0]; if (!file) return;
  fileToDataURL(file, 1024, 0.75).then(d => {
    window._returnPhotoData = d;
    const p = document.getElementById('returnPhotoPreview'); p.src = d; p.hidden = false;
    document.getElementById('returnPhotoText').textContent = 'Foto carregada — toque para trocar';
    document.getElementById('returnPhotoLabel').classList.add('has-file');
  }).catch(err => toast(err.message, 'error'));
}
function submitReturnPhoto(id) {
  const r = getReservation(id); if (!r) return;
  if (!window._returnPhotoData) return toast('Envie a foto da devolução.', 'error');
  r.returnPhoto = window._returnPhotoData;
  r.returnNotes = document.getElementById('returnNotes').value.trim();
  r.returnedAt = Date.now(); r.status = 'awaiting_return'; r.returnIssue = null;
  logReservation(r, 'return_sent');
  if (!saveDB()) return;
  window._returnPhotoData = null;
  closeModal(); toast('Devolução enviada — aguardando conferência.', 'success'); refreshCurrentView();
}

/* ---------------- Minhas reservas ---------------- */
let myResFilter = 'upcoming';
function setMyResFilter(f) { myResFilter = f; renderMyReservations(); }
function renderMyReservations() {
  const u = currentUser(); if (!u) return showView('auth');
  const all = window.db.reservations.filter(r => r.userId === u.id);
  const today = todayISO();
  const groups = {
    upcoming: all.filter(r => resEnd(r) >= today && ACTIVE_STATUSES.includes(r.status)).sort((a, b) => a.date.localeCompare(b.date)),
    action: all.filter(r => isOverdueReturn(r) || (r.returnPhotoRequired && r.status === 'in_use')),
    history: all.filter(r => !(resEnd(r) >= today && ACTIVE_STATUSES.includes(r.status))).sort((a, b) => b.date.localeCompare(a.date))
  };
  const list = groups[myResFilter];
  const tabs = [['upcoming', 'Próximas'], ['action', 'Devoluções pendentes'], ['history', 'Histórico']];
  document.getElementById('myResContent').innerHTML = `
    <div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" aria-selected="${myResFilter === k}" class="${myResFilter === k ? 'active' : ''}" onclick="setMyResFilter('${k}')">${l}${groups[k].length ? ` <span class="count">${groups[k].length}</span>` : ''}</button>`).join('')}</div>
    ${list.length === 0 ? `<div class="empty">${icon('calendar', 28)}<div>${myResFilter === 'upcoming' ? 'Nenhuma reserva futura.' : myResFilter === 'action' ? 'Nenhuma devolução pendente.' : 'Sem histórico ainda.'}</div>
      ${myResFilter === 'upcoming' ? `<button class="btn dark mt-4" onclick="openReserveModal()">${icon('plus', 16)} Nova reserva</button>` : ''}</div>`
    : `<div class="res-list">${list.map(r => reservationRow(r, { showUser: false })).join('')}</div>`}`;
}

/* Linha de reserva reutilizável (minhas reservas, técnico, admin) */
function reservationRow(r, { showUser = true, quick = false } = {}) {
  const res = getResource(r.resourceId);
  const img = safeImg(res?.photo);
  const overdue = isOverdueReturn(r);
  const q = [];
  if (quick && canApproveReservations()) {
    if (r.status === 'pending') q.push(`<button class="icon-btn success" title="Aprovar" aria-label="Aprovar" onclick="event.stopPropagation();approveReservation('${r.id}')">${icon('check', 16)}</button>`, `<button class="icon-btn danger" title="Recusar" aria-label="Recusar" onclick="event.stopPropagation();denyReservation('${r.id}')">${icon('x', 16)}</button>`);
    if (r.status === 'approved' && r.date <= todayISO()) q.push(`<button class="icon-btn" title="Iniciar uso" aria-label="Iniciar uso" onclick="event.stopPropagation();checkInReservation('${r.id}')">${icon('play', 16)}</button>`);
    if (['approved','in_use'].includes(r.status) && !r.returnPhotoRequired && r.date <= todayISO()) q.push(`<button class="icon-btn success" title="Concluir" aria-label="Concluir" onclick="event.stopPropagation();completeReservation('${r.id}')">${icon('flag', 16)}</button>`);
    if (r.status === 'awaiting_return') q.push(`<button class="icon-btn success" title="Conferir devolução" aria-label="Conferir devolução" onclick="event.stopPropagation();completeReservation('${r.id}')">${icon('check', 16)}</button>`);
  }
  return `<div class="res-row ${overdue ? 'overdue' : ''}" role="button" tabindex="0" onclick="showResDetail('${r.id}')" onkeydown="if(event.key==='Enter')showResDetail('${r.id}')">
    <div class="res-row-date"><span class="d">${parseISO(r.date).getDate()}</span><span class="m">${parseISO(r.date).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</span></div>
    ${img ? `<img src="${img}" alt="" class="res-row-img" loading="lazy">` : `<div class="res-row-img ph">${icon('box', 20)}</div>`}
    <div class="res-row-main">
      <strong>${escapeHtml(res?.name || 'Recurso removido')}${r.quantity > 1 ? ` <span class="muted">×${r.quantity}</span>` : ''}</strong>
      <span class="small muted">${slotText(r)}${showUser ? ' · ' + escapeHtml(userName(r.userId)) : ''}${res?.location ? ' · ' + escapeHtml(res.location) : ''}</span>
      ${showUser && r.purpose ? `<span class="small clamp1">${escapeHtml(r.purpose)}</span>` : ''}
    </div>
    <div class="res-row-side">
      ${res?.requiresTechnicianPresence && ['approved','pending'].includes(r.status) ? `<span class="pill tech-required">Técnico obrig.</span>` : ''}
      ${overdue ? `<span class="pill denied">Devolução atrasada</span>` : statusPill(r.status)}
      ${q.length ? `<div class="row-actions">${q.join('')}</div>` : ''}
    </div>
  </div>`;
}
