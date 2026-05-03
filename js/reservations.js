/* ============================================================
   reservations.js — Reservas (v3)
   - Sem turno noite (apenas manhã e tarde)
   - Técnicos também podem aprovar/recusar reservas
   ============================================================ */

function openModal(html, wide=false) {
  const modal = document.getElementById('modal');
  modal.className = 'modal' + (wide ? ' wide' : '');
  modal.innerHTML = html;
  document.getElementById('modalOverlay').classList.add('show');
}
function closeModal() {
  document.getElementById('modalOverlay').classList.remove('show');
}

function reservedQuantityIn(resourceId, date, mode, slot) {
  const conflicting = window.db.reservations.filter(x => {
    if (x.resourceId !== resourceId) return false;
    if (x.date !== date) return false;
    if (['denied', 'returned', 'completed'].includes(x.status)) return false;
    if (mode === 'slot' && x.mode === 'slot') {
      return !(x.slot.end <= slot.start || x.slot.start >= slot.end);
    }
    if (mode === 'turno' && x.mode === 'turno') {
      return x.slot.turno === slot.turno;
    }
    if (mode === 'slot' && x.mode === 'turno') {
      return slotOverlapsTurno(slot, x.slot.turno);
    }
    if (mode === 'turno' && x.mode === 'slot') {
      return slotOverlapsTurno(x.slot, slot.turno);
    }
    return false;
  });
  return conflicting.reduce((sum, x) => sum + (x.quantity || 1), 0);
}

function slotOverlapsTurno(slot, turno) {
  const settings = window.db.settings;
  const t = settings[`turno${turno.charAt(0).toUpperCase()+turno.slice(1)}`];
  if (!t) return false;
  return !(slot.end <= t.start || slot.start >= t.end);
}

function openReserveModal(prefill = {}) {
  if (!currentUser()) {
    toast('Faça login para reservar.', 'warn');
    showView('auth'); return;
  }
  if (window.db.resources.filter(r => r.active).length === 0) {
    toast('Nenhum recurso disponível para reserva ainda.', 'warn');
    return;
  }
  const u = currentUser();
  const today = new Date();
  const minHours = window.db.settings.minAdvanceHours || 0;
  const maxDays = window.db.settings.maxAdvanceDays || 30;
  const minDate = new Date(today.getTime() + minHours*3600*1000).toISOString().slice(0,10);
  const maxDate = new Date(today.getTime() + maxDays*24*3600*1000).toISOString().slice(0,10);

  const html = `
    <div class="modal-head">
      <div>
        <div class="modal-title">Nova reserva</div>
        <div class="modal-sub">Solicitante: ${escapeHtml(u.name)} · ${CATEGORY_LABELS[u.category]}</div>
      </div>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="field">
        <label>Recurso <span class="req">*</span></label>
        <select id="resResource" onchange="updateReserveModal()">
          <option value="">Selecione um recurso...</option>
          ${window.db.resources.filter(r=>r.active).map(r =>
            `<option value="${r.id}">${r.type==='equipment'?'⚙':r.type==='consumable'?'⊟':'▢'} ${escapeHtml(r.name)}</option>`
          ).join('')}
        </select>
      </div>
      <div id="resourceInfo"></div>
      <div class="field">
        <label>Data <span class="req">*</span></label>
        <input type="date" id="resDate" min="${minDate}" max="${maxDate}" value="${prefill.date || minDate}" onchange="updateAvailability()">
        <div class="field-help">Mínimo ${minHours}h antes · Máximo ${maxDays} dias à frente</div>
      </div>
      <div id="resModeFields"></div>
      <div id="resQuantityField"></div>
      <div id="resAvailability"></div>
      <div class="field">
        <label>Finalidade da reserva <span class="req">*</span></label>
        <textarea id="resPurpose" rows="3" placeholder="Descreva brevemente o uso (pesquisa, ensino, TCC, etc.)"></textarea>
      </div>
      <div id="approvalNote"></div>
    </div>
    <div class="modal-foot">
      <button class="btn" onclick="closeModal()">Cancelar</button>
      <button class="btn dark" onclick="submitReservation()">Confirmar reserva</button>
    </div>
  `;
  openModal(html);

  // Pré-preenche o RECURSO se foi clicado num card
  if (prefill.resourceId) {
    const select = document.getElementById('resResource');
    if (select) {
      select.value = prefill.resourceId;
      updateReserveModal();
    }
  }

  if (prefill.startTime) {
    window._prefillStart = prefill.startTime;
    window._prefillEnd = prefill.endTime;
  }
}

function updateReserveModal() {
  const resourceId = document.getElementById('resResource').value;
  const info = document.getElementById('resourceInfo');
  const modeFields = document.getElementById('resModeFields');
  const qtyField = document.getElementById('resQuantityField');
  const approvalNote = document.getElementById('approvalNote');

  if (!resourceId) {
    info.innerHTML = '';
    modeFields.innerHTML = '';
    qtyField.innerHTML = '';
    approvalNote.innerHTML = '';
    return;
  }

  const r = getResource(resourceId);
  const photoHtml = r.photo
    ? `<img src="${r.photo}" alt="${escapeHtml(r.name)}" style="width:100%;max-height:160px;object-fit:cover;border-radius:6px;margin-bottom:10px;">`
    : '';
  const techWarn = r.requiresTechnicianPresence
    ? `<div class="info-box warn"><strong>⚠ Presença de técnico obrigatória.</strong> Esta reserva só pode ocorrer com técnico de laboratório presente. Confirme disponibilidade com a coordenação.</div>`
    : (r.requiresTechnicianAssist
        ? `<div class="info-box"><strong>ℹ Acompanhamento técnico recomendado</strong> para operação segura.</div>`
        : '');
  const returnWarn = r.requiresReturnPhoto
    ? `<div class="info-box warn"><strong>📷 Devolução com foto obrigatória.</strong> Ao final do uso, você precisará enviar foto comprovando devolução em bom estado.</div>`
    : '';
  const locText = r.location ? `<div style="font-size:12px;color:var(--ink-500);margin-bottom:8px;">📍 ${escapeHtml(r.location)}</div>` : '';

  info.innerHTML = `
    ${photoHtml}
    <div style="background:var(--paper-warm);padding:12px 14px;border-radius:6px;margin-bottom:14px;font-size:13px;color:var(--ink-700);">
      <strong>${escapeHtml(r.name)}</strong>
      ${locText}
      <div style="margin-top:6px;line-height:1.5;">${escapeHtml(r.description || '')}</div>
    </div>
    ${techWarn}
    ${returnWarn}
  `;

  if (r.mode === 'both') {
    modeFields.innerHTML = `
      <div class="field">
        <label>Modo de reserva <span class="req">*</span></label>
        <div style="display:flex;gap:8px;">
          <label style="flex:1;cursor:pointer;">
            <input type="radio" name="rmode" value="turno" checked onchange="renderTimeFields()"> Por turno
          </label>
          <label style="flex:1;cursor:pointer;">
            <input type="radio" name="rmode" value="slot" onchange="renderTimeFields()"> Por horário específico
          </label>
        </div>
      </div>
      <div id="timeFieldsMount"></div>
    `;
    renderTimeFields();
  } else if (r.mode === 'slot') {
    modeFields.innerHTML = `<div id="timeFieldsMount"></div>`;
    renderTimeFields('slot');
  } else {
    modeFields.innerHTML = `<div id="timeFieldsMount"></div>`;
    renderTimeFields('turno');
  }

  if ((r.totalQuantity || 1) > 1) {
    qtyField.innerHTML = `
      <div class="field">
        <label>Quantidade desejada <span class="req">*</span></label>
        <input type="number" id="resQuantity" min="1" max="${r.totalQuantity}" value="1" onchange="updateAvailability()">
        <div class="field-help">Total disponível no laboratório: ${r.totalQuantity} unidades</div>
      </div>
    `;
  } else {
    qtyField.innerHTML = '';
  }

  const u = currentUser();
  const auto = AUTO_APPROVE_CATEGORIES.includes(u.category);
  approvalNote.innerHTML = auto
    ? '<div class="info-box success">✓ Sua reserva será <strong>aprovada automaticamente</strong> conforme sua categoria.</div>'
    : '<div class="info-box">⏱ Sua reserva ficará <strong>pendente</strong> aguardando aprovação da coordenação ou de um técnico.</div>';

  setTimeout(updateAvailability, 50);
}

function renderTimeFields(forcedMode) {
  const r = getResource(document.getElementById('resResource').value);
  if (!r) return;
  const mode = forcedMode || (document.querySelector('input[name=rmode]:checked')?.value) || 'turno';
  const mount = document.getElementById('timeFieldsMount');
  if (!mount) return;

  if (mode === 'slot') {
    const start = window._prefillStart || '14:00';
    const end = window._prefillEnd || '16:00';
    mount.innerHTML = `
      <div class="field-row">
        <div class="field">
          <label>Início <span class="req">*</span></label>
          <input type="time" id="resStart" value="${start}" step="1800" onchange="updateAvailability()">
        </div>
        <div class="field">
          <label>Término <span class="req">*</span></label>
          <input type="time" id="resEnd" value="${end}" step="1800" onchange="updateAvailability()">
        </div>
      </div>
    `;
  } else {
    const s = window.db.settings;
    // Apenas manhã e tarde
    mount.innerHTML = `
      <div class="field">
        <label>Turno <span class="req">*</span></label>
        <select id="resTurno" onchange="updateAvailability()">
          <option value="manha">Manhã (${s.turnoManha.start} às ${s.turnoManha.end})</option>
          <option value="tarde">Tarde (${s.turnoTarde.start} às ${s.turnoTarde.end})</option>
        </select>
      </div>
    `;
  }
  setTimeout(updateAvailability, 50);
}

function updateAvailability() {
  const resourceId = document.getElementById('resResource')?.value;
  const date = document.getElementById('resDate')?.value;
  const availMount = document.getElementById('resAvailability');
  if (!resourceId || !date || !availMount) return;

  const r = getResource(resourceId);
  if (!r) return;

  let mode, slot;
  const radioMode = document.querySelector('input[name=rmode]:checked')?.value;
  if (r.mode === 'slot' || radioMode === 'slot') {
    mode = 'slot';
    const start = document.getElementById('resStart')?.value;
    const end = document.getElementById('resEnd')?.value;
    if (!start || !end) { availMount.innerHTML = ''; return; }
    slot = { start, end };
  } else {
    mode = 'turno';
    slot = { turno: document.getElementById('resTurno')?.value || 'manha' };
  }

  const reserved = reservedQuantityIn(resourceId, date, mode, slot);
  const total = r.totalQuantity || 1;
  const available = total - reserved;
  const desired = parseInt(document.getElementById('resQuantity')?.value || '1');

  let cls = 'success', icon = '✓', text;
  if (available <= 0) {
    cls = 'danger'; icon = '✕';
    text = `<strong>Indisponível</strong> — todas as ${total} unidade(s) já reservadas neste período.`;
  } else if (desired > available) {
    cls = 'warn'; icon = '⚠';
    text = `Apenas <strong>${available} de ${total}</strong> unidade(s) disponível(is) — você está pedindo ${desired}.`;
  } else if (total > 1) {
    text = `<strong>${available} de ${total}</strong> unidade(s) disponível(is) neste período.`;
  } else {
    text = `<strong>Disponível</strong> neste período.`;
  }

  availMount.innerHTML = `<div class="info-box ${cls}" style="margin-top:-4px;">${icon} ${text}</div>`;
}

function submitReservation() {
  const resourceId = document.getElementById('resResource').value;
  const date = document.getElementById('resDate').value;
  const purpose = document.getElementById('resPurpose').value.trim();
  if (!resourceId || !date || !purpose) {
    return toast('Preencha todos os campos obrigatórios.', 'error');
  }

  const r = getResource(resourceId);
  let mode, slot;
  const radioMode = document.querySelector('input[name=rmode]:checked')?.value;

  if (r.mode === 'slot' || radioMode === 'slot') {
    const start = document.getElementById('resStart').value;
    const end = document.getElementById('resEnd').value;
    if (!start || !end || end <= start) return toast('Verifique os horários.', 'error');
    mode = 'slot';
    slot = { start, end };
  } else {
    mode = 'turno';
    slot = { turno: document.getElementById('resTurno').value };
  }

  const desired = parseInt(document.getElementById('resQuantity')?.value || '1');
  const total = r.totalQuantity || 1;
  if (desired < 1 || desired > total) {
    return toast(`Quantidade inválida (1 a ${total}).`, 'error');
  }

  const reserved = reservedQuantityIn(resourceId, date, mode, slot);
  if (reserved + desired > total) {
    const available = total - reserved;
    return toast(`Apenas ${available} unidade(s) disponível(is) neste período.`, 'error');
  }

  const u = currentUser();
  const auto = AUTO_APPROVE_CATEGORIES.includes(u.category);
  const reservation = {
    id: uid('res'),
    userId: u.id,
    resourceId, date, mode, slot, purpose,
    quantity: desired,
    status: auto ? 'approved' : 'pending',
    createdAt: Date.now(),
    returnPhotoRequired: !!r.requiresReturnPhoto,
    returnPhoto: null,
    returnedAt: null
  };
  window.db.reservations.push(reservation);
  saveDB();
  closeModal();
  window._prefillStart = null;
  window._prefillEnd = null;
  toast(auto ? 'Reserva aprovada automaticamente!' : 'Reserva enviada — aguardando aprovação.', 'success');
  renderCalendar();
}

function showDayDetail(iso, events) {
  const html = `
    <div class="modal-head">
      <div>
        <div class="modal-title">${fmtDateLong(iso)}</div>
        <div class="modal-sub">${events.length} reserva(s) neste dia</div>
      </div>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      ${events.map(e => {
        const r = getResource(e.resourceId);
        const u = getUser(e.userId);
        const sText = slotText(e, window.db.settings);
        const qty = e.quantity > 1 ? ` <span class="muted">×${e.quantity}</span>` : '';
        return `<div onclick="closeModal();showResDetail('${e.id}')" style="padding:14px;border:1px solid var(--line-200);border-radius:6px;margin-bottom:8px;cursor:pointer;transition:background 0.15s;" onmouseover="this.style.background='var(--paper-warm)'" onmouseout="this.style.background='white'">
          <div style="display:flex;justify-content:space-between;align-items:start;gap:10px;">
            <div style="flex:1;">
              <div style="font-weight:600;">${escapeHtml(r?.name||'?')}${qty}</div>
              <div style="font-size:13px;color:var(--ink-500);margin-top:2px;">${sText} · ${escapeHtml(u?.name||'?')}</div>
            </div>
            <span class="pill ${e.status}">${RES_STATUS[e.status]||e.status}</span>
          </div>
          ${e.purpose ? `<div style="font-size:13px;color:var(--ink-700);margin-top:8px;font-style:italic;">"${escapeHtml(e.purpose)}"</div>` : ''}
        </div>`;
      }).join('')}
    </div>
    <div class="modal-foot">
      <button class="btn" onclick="closeModal()">Fechar</button>
      <button class="btn dark" onclick="closeModal();openReserveModal({date:'${iso}'})">+ Nova reserva neste dia</button>
    </div>
  `;
  openModal(html);
}

function showResDetail(id) {
  const r = getReservation(id);
  if (!r) return;
  const res = getResource(r.resourceId);
  const u = getUser(r.userId);
  const sText = slotText(r, window.db.settings);
  const cur = currentUser();
  // Técnicos E admins podem aprovar/recusar (mudança v3)
  const canManage = canApproveReservations() && r.status === 'pending';
  const isOwner = cur && cur.id === r.userId;
  const canReturn = isOwner && r.returnPhotoRequired && (r.status === 'approved' || r.status === 'in_use');
  const canMarkUsed = canApproveReservations() && r.status === 'approved';

  const photoHtml = res?.photo
    ? `<img src="${res.photo}" alt="${escapeHtml(res.name)}" style="width:100%;max-height:180px;object-fit:cover;border-radius:6px;margin-bottom:14px;">`
    : '';
  const returnPhotoHtml = r.returnPhoto
    ? `<div class="field"><label>Foto de devolução</label><img src="${r.returnPhoto}" style="max-width:100%;max-height:240px;border-radius:6px;border:1px solid var(--line-200);"></div>`
    : '';

  const html = `
    <div class="modal-head">
      <div>
        <div class="modal-title">${escapeHtml(res?.name || '?')}${r.quantity > 1 ? ` <span class="muted">×${r.quantity}</span>` : ''}</div>
        <div class="modal-sub">${fmtDateLong(r.date)} · ${sText}</div>
      </div>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      ${photoHtml}
      <dl class="res-meta">
        <div><dt>Solicitante</dt><dd>${escapeHtml(u?.name||'?')}</dd></div>
        <div><dt>Categoria</dt><dd>${CATEGORY_LABELS[u?.category]||'?'}</dd></div>
        <div><dt>E-mail</dt><dd>${escapeHtml(u?.email||'?')}</dd></div>
        <div><dt>Status</dt><dd><span class="pill ${r.status}">${RES_STATUS[r.status]}</span></dd></div>
        ${res?.location ? `<div><dt>Localização</dt><dd>📍 ${escapeHtml(res.location)}</dd></div>` : ''}
        ${res?.requiresTechnicianPresence ? `<div><dt>Técnico</dt><dd><span class="pill tech-required">Presença obrigatória</span></dd></div>` : ''}
      </dl>
      <div class="field"><label>Finalidade</label>
        <div style="padding:10px;background:var(--paper-warm);border-radius:6px;font-size:14px;">${escapeHtml(r.purpose)}</div>
      </div>
      ${returnPhotoHtml}
      ${r.returnPhotoRequired && !r.returnPhoto ? `<div class="info-box warn"><strong>📷 Devolução com foto obrigatória.</strong> Ao terminar de usar este recurso, envie foto da devolução.</div>` : ''}
    </div>
    <div class="modal-foot">
      ${cur && cur.id !== u.id ? `<button class="btn" onclick="closeModal();openConversation('${u.id}');showView('messages')">💬 Mensagem</button>` : ''}
      ${canManage ? `<button class="btn danger" onclick="setReservationStatus('${r.id}','denied')">Recusar</button>
        <button class="btn success" onclick="setReservationStatus('${r.id}','approved')">Aprovar</button>` : ''}
      ${canMarkUsed ? `<button class="btn" onclick="setReservationStatus('${r.id}','in_use')">Marcar em uso</button>` : ''}
      ${canReturn ? `<button class="btn green" onclick="openReturnPhotoModal('${r.id}')">📷 Enviar foto de devolução</button>` : ''}
      ${canApproveReservations() && r.status === 'awaiting_return' ? `<button class="btn success" onclick="confirmReturn('${r.id}')">Confirmar devolução</button>` : ''}
      <button class="btn" onclick="closeModal()">Fechar</button>
    </div>
  `;
  openModal(html);
}

function setReservationStatus(id, status) {
  const r = getReservation(id);
  if (!r) return;
  r.status = status;
  saveDB();
  closeModal();
  const messages = {
    approved: 'Reserva aprovada — e-mail enviado ao solicitante.',
    denied: 'Reserva recusada.',
    in_use: 'Reserva marcada como em uso.'
  };
  const types = { approved: 'success', denied: 'warn', in_use: '' };
  toast(messages[status] || 'Status atualizado.', types[status] || '');
  renderCalendar();
  if (document.getElementById('view-admin').classList.contains('active')) renderAdmin();
  if (document.getElementById('view-tech').classList.contains('active')) renderTechDashboard();
}

function openReturnPhotoModal(reservationId) {
  const r = getReservation(reservationId);
  if (!r) return;
  const res = getResource(r.resourceId);
  const html = `
    <div class="modal-head">
      <div>
        <div class="modal-title">Foto de devolução</div>
        <div class="modal-sub">${escapeHtml(res?.name||'')} · ${fmtDate(r.date)}</div>
      </div>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="info-box">Envie uma foto clara mostrando o(s) item(ns) devolvido(s) em bom estado. A coordenação ou técnico irá validar antes de encerrar a reserva.</div>
      <div class="field">
        <label>Foto da devolução <span class="req">*</span></label>
        <label class="file-upload" id="returnPhotoLabel">
          <input type="file" id="returnPhotoInput" accept="image/*" capture="environment" onchange="onReturnPhotoChange(event)">
          <div id="returnPhotoText">📷 Clique aqui ou arraste a foto</div>
        </label>
        <img id="returnPhotoPreview" class="file-preview" style="display:none;">
      </div>
      <div class="field">
        <label>Observações (opcional)</label>
        <textarea id="returnNotes" rows="2" placeholder="Ex.: equipamento em perfeitas condições..."></textarea>
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn" onclick="closeModal()">Cancelar</button>
      <button class="btn green" onclick="submitReturnPhoto('${reservationId}')">Enviar devolução</button>
    </div>
  `;
  openModal(html);
}

function onReturnPhotoChange(e) {
  const file = e.target.files[0];
  if (!file) return;
  fileToDataURL(file).then(dataUrl => {
    window._returnPhotoData = dataUrl;
    document.getElementById('returnPhotoPreview').src = dataUrl;
    document.getElementById('returnPhotoPreview').style.display = 'block';
    document.getElementById('returnPhotoText').textContent = '✓ Foto carregada — clique para trocar';
    document.getElementById('returnPhotoLabel').classList.add('has-file');
  });
}

function submitReturnPhoto(reservationId) {
  const r = getReservation(reservationId);
  if (!r) return;
  if (!window._returnPhotoData) return toast('Envie a foto da devolução.', 'error');
  r.returnPhoto = window._returnPhotoData;
  r.returnNotes = document.getElementById('returnNotes').value.trim();
  r.returnedAt = Date.now();
  r.status = 'awaiting_return';
  saveDB();
  window._returnPhotoData = null;
  closeModal();
  toast('Foto de devolução enviada — aguardando confirmação.', 'success');
  renderCalendar();
  if (document.getElementById('view-myres').classList.contains('active')) renderMyReservations();
}

function confirmReturn(reservationId) {
  const r = getReservation(reservationId);
  if (!r) return;
  r.status = 'returned';
  saveDB();
  closeModal();
  toast('Devolução confirmada.', 'success');
  renderCalendar();
  if (document.getElementById('view-admin').classList.contains('active')) renderAdmin();
  if (document.getElementById('view-tech').classList.contains('active')) renderTechDashboard();
}

function renderMyReservations() {
  const u = currentUser();
  if (!u) { showView('auth'); return; }
  const mine = window.db.reservations
    .filter(r => r.userId === u.id)
    .sort((a,b) => b.date.localeCompare(a.date));
  const content = document.getElementById('myResContent');
  if (mine.length === 0) {
    content.innerHTML = `<div class="empty"><div class="empty-icon">○</div>Você ainda não tem reservas. Clique em "+ Nova reserva" para começar.</div>`;
    return;
  }
  content.innerHTML = `
    <table>
      <thead><tr><th>Data</th><th>Recurso</th><th>Horário</th><th>Qtd</th><th>Status</th><th></th></tr></thead>
      <tbody>${mine.map(r => {
        const res = getResource(r.resourceId);
        const sText = slotText(r, window.db.settings);
        return `<tr>
          <td>${fmtDate(r.date)}</td>
          <td>${escapeHtml(res?.name||'?')}</td>
          <td>${sText}</td>
          <td>${r.quantity || 1}</td>
          <td><span class="pill ${r.status}">${RES_STATUS[r.status]}</span></td>
          <td><button class="icon-btn" onclick="showResDetail('${r.id}')" title="Ver">👁</button></td>
        </tr>`;
      }).join('')}</tbody>
    </table>`;
}

window.openModal = openModal;
window.closeModal = closeModal;
window.openReserveModal = openReserveModal;
window.updateReserveModal = updateReserveModal;
window.renderTimeFields = renderTimeFields;
window.updateAvailability = updateAvailability;
window.submitReservation = submitReservation;
window.showDayDetail = showDayDetail;
window.showResDetail = showResDetail;
window.setReservationStatus = setReservationStatus;
window.openReturnPhotoModal = openReturnPhotoModal;
window.onReturnPhotoChange = onReturnPhotoChange;
window.submitReturnPhoto = submitReturnPhoto;
window.confirmReturn = confirmReturn;
window.renderMyReservations = renderMyReservations;
window.reservedQuantityIn = reservedQuantityIn;
