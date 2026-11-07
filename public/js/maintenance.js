/* ============================================================
   maintenance.js — Manutenção e calibração (v11.7)
   - Ficha de cada equipamento: problemas relatados, manutenções,
     calibrações (com certificado, empresa e próxima data)
   - Qualquer usuário pode RELATAR um problema (também pelo QR code)
   - Equipe técnica e coordenação registram manutenções/calibrações,
     resolvem problemas e colocam/retiram o equipamento de manutenção
   - Alertas: problemas em aberto e calibrações vencidas ou a vencer
   ============================================================ */

const MAINT_KINDS = { problema: 'Problema relatado', manutencao: 'Manutenção', calibracao: 'Calibração', outro: 'Outro registro' };
const CAL_SOON_DAYS = 30;

function maintEntries(resourceId) {
  return (window.db.maintenance || []).filter(m => !resourceId || m.resourceId === resourceId)
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || 0) - (a.createdAt || 0));
}
function openProblems(resourceId) { return maintEntries(resourceId).filter(m => m.status === 'aberto'); }
function daysUntilISO(iso) { return Math.round((parseISO(iso) - parseISO(todayISO())) / 864e5); }
function addMonthsISO(iso, n) { const d = parseISO(iso); d.setMonth(d.getMonth() + n); return localISO(d); }

/* Situação da calibração: null (não controla), ok, soon, overdue */
function calibrationState(r) {
  if (!r || !r.calibrationDue) return null;
  const d = daysUntilISO(r.calibrationDue);
  return d < 0 ? 'overdue' : d <= CAL_SOON_DAYS ? 'soon' : 'ok';
}
function calibrationText(r) {
  const st = calibrationState(r); if (!st) return '';
  const d = daysUntilISO(r.calibrationDue);
  return st === 'overdue' ? `Calibração vencida há ${-d} dia(s) (${fmtDate(r.calibrationDue)})`
    : st === 'soon' ? `Calibração vence em ${d} dia(s) (${fmtDate(r.calibrationDue)})`
    : `Calibração em dia — próxima em ${fmtDate(r.calibrationDue)}`;
}
function calibrationAlerts() {
  return window.db.resources.filter(r => r.active && ['overdue', 'soon'].includes(calibrationState(r)))
    .sort((a, b) => a.calibrationDue.localeCompare(b.calibrationDue));
}
function maintenanceBadgeCount() {
  return openProblems().length + window.db.resources.filter(r => r.active && calibrationState(r) === 'overdue').length;
}

/* ---------- Ficha do equipamento (dentro de "Ver ficha" / QR code) ---------- */
function maintenanceSectionHtml(r) {
  const staff = isTechnician();
  const open = openProblems(r.id);
  const recent = maintEntries(r.id).slice(0, staff ? 4 : 3);
  const cal = calibrationState(r);
  return `<div class="field maint-section"><span class="label">Manutenção e calibração</span>
    ${cal ? `<div class="info-box ${cal === 'overdue' ? 'danger' : cal === 'soon' ? 'warn' : 'success'}">${icon('gauge', 16)} ${calibrationText(r)}</div>` : ''}
    ${open.length ? `<div class="info-box warn">${icon('alert', 16)} <strong>${open.length} problema(s) relatado(s) em aberto.</strong> A equipe técnica já foi avisada.</div>` : ''}
    ${recent.length ? recent.map(m => maintRowHtml(m, { compact: true })).join('') : '<div class="small muted">Nenhum registro ainda.</div>'}
    <div class="flex-row wrap" style="margin-top:8px;">
      <button class="btn" onclick="openReportProblemModal('${r.id}')">${icon('alert', 16)} Relatar problema</button>
      ${staff ? `<button class="btn" onclick="openMaintRecordModal('${r.id}')">${icon('wrench', 16)} Registrar manutenção/calibração</button>` : ''}
      ${maintEntries(r.id).length > recent.length ? `<button class="btn ghost" onclick="openMaintHistory('${r.id}')">Ver histórico completo</button>` : ''}
    </div></div>`;
}

function maintRowHtml(m, { compact = false, showResource = false } = {}) {
  const staff = isTechnician();
  const st = m.status === 'aberto' ? `<span class="pill ${m.kind === 'problema' ? 'denied' : 'pending'}">${m.kind === 'problema' ? 'Em aberto' : 'Em andamento'}</span>` : '';
  const who = staff || m.by === currentUser()?.id ? ` · ${escapeHtml(shortName(userName(m.by), 2))}` : '';
  const img = safeImg(m.photo);
  return `<div class="maint-row ${m.status === 'aberto' ? 'open' : ''}">
    <div class="maint-kind k-${m.kind}">${icon(m.kind === 'calibracao' ? 'gauge' : m.kind === 'problema' ? 'alert' : 'wrench', 16)}</div>
    <div class="maint-main">
      <div><strong>${MAINT_KINDS[m.kind] || 'Registro'}</strong>${showResource ? ` · <a href="#" onclick="event.preventDefault();showResourceDetail('${m.resourceId}')">${escapeHtml(resourceName(m.resourceId))}</a>` : ''} ${st}</div>
      <div class="small muted">${fmtDate(m.date)}${who}${m.provider ? ' · ' + escapeHtml(m.provider) : ''}${m.certificate ? ' · Cert. ' + escapeHtml(m.certificate) : ''}${m.nextDue ? ' · próxima: ' + fmtDate(m.nextDue) : ''}</div>
      <div class="small ${compact ? 'clamp2' : ''}">${escapeHtml(m.description)}</div>
      ${m.resolution ? `<div class="small maint-res">${icon('check', 13)} ${escapeHtml(m.resolution)}${m.resolvedAt ? ` <span class="muted">(${fmtDateTime(m.resolvedAt)})</span>` : ''}</div>` : ''}
      ${img && !compact ? `<img src="${img}" class="maint-photo" alt="Foto do problema">` : ''}
    </div>
    ${staff && m.status === 'aberto' && !compact ? `<div class="row-actions"><button class="btn small" onclick="resolveMaint('${m.id}')">${icon('check', 15)} Resolver</button></div>` : ''}
  </div>`;
}

function openMaintHistory(resourceId) {
  const r = getResource(resourceId); if (!r) return;
  const list = maintEntries(resourceId);
  openModal(`
    <div class="modal-head"><div><div class="modal-title">Histórico de manutenção</div><div class="modal-sub">${escapeHtml(r.name)}${r.patrimonio ? ' · Pat. ' + escapeHtml(r.patrimonio) : ''}</div></div>
      <button class="modal-close" onclick="closeModal()" aria-label="Fechar">${icon('x')}</button></div>
    <div class="modal-body">
      ${calibrationState(r) ? `<div class="info-box">${icon('gauge', 16)} ${calibrationText(r)}${r.calibrationEveryMonths ? ` · periodicidade: ${r.calibrationEveryMonths} meses` : ''}</div>` : ''}
      ${list.length ? list.map(m => maintRowHtml(m)).join('') : '<div class="small muted">Nenhum registro.</div>'}
    </div>
    <div class="modal-foot">
      ${isTechnician() ? `<button class="btn" onclick="exportMaintCSV('${r.id}')">${icon('download', 16)} CSV</button>` : ''}
      <button class="btn" onclick="showResourceDetail('${r.id}')">Voltar à ficha</button>
    </div>`, true);
}

/* ---------- Relatar problema (qualquer usuário) ---------- */
function openReportProblemModal(resourceId) {
  const r = getResource(resourceId); if (!r) return;
  if (!currentUser()) { toast('Entre no sistema para relatar um problema.', 'warn'); return; }
  window._maintPhoto = null;
  openModal(`
    <div class="modal-head"><div><div class="modal-title">Relatar problema</div><div class="modal-sub">${escapeHtml(r.name)}</div></div>
      <button class="modal-close" onclick="closeModal()" aria-label="Fechar">${icon('x')}</button></div>
    <div class="modal-body">
      <div class="field"><label for="mpDesc">O que aconteceu? <span class="req">*</span></label>
        <textarea id="mpDesc" rows="4" maxlength="2000" placeholder="Ex.: a prensa não está aplicando carga; peneira com a tela rasgada; estufa não aquece…"></textarea></div>
      <div class="field"><span class="label">Foto (opcional)</span>
        <label class="file-upload" id="mpPhotoLabel"><input type="file" accept="image/*" onchange="onMaintPhotoChange(event)">
          <div id="mpPhotoText">${icon('camera')} Adicionar foto</div></label>
        <img id="mpPhotoPreview" class="file-preview" hidden alt="Prévia"></div>
      <div class="info-box">${icon('info', 16)} A equipe técnica e a coordenação recebem o relato. Em caso de risco, interrompa o uso e avise um técnico pessoalmente.</div>
    </div>
    <div class="modal-foot"><button class="btn" onclick="showResourceDetail('${r.id}')">Voltar</button>
      <button class="btn dark" onclick="submitProblemReport('${r.id}')">Enviar relato</button></div>`);
}
function onMaintPhotoChange(e) {
  const file = e.target.files[0]; if (!file) return;
  fileToDataURL(file, 900, 0.75).then(d => {
    window._maintPhoto = d;
    const p = document.getElementById('mpPhotoPreview'); p.src = d; p.hidden = false;
    document.getElementById('mpPhotoText').textContent = 'Foto carregada — clique para trocar';
    document.getElementById('mpPhotoLabel').classList.add('has-file');
  }).catch(err => toast(err.message, 'error'));
}
function submitProblemReport(resourceId) {
  const me = currentUser(); if (!me) return;
  const desc = document.getElementById('mpDesc').value.trim();
  if (desc.length < 10) return toast('Descreva o problema (mínimo 10 caracteres).', 'error');
  const m = { id: uid('mt'), resourceId, kind: 'problema', status: 'aberto', date: todayISO(), description: desc,
    by: me.id, createdAt: Date.now(), ...(window._maintPhoto ? { photo: window._maintPhoto } : {}) };
  if (!window.db.maintenance) window.db.maintenance = [];
  window.db.maintenance.push(m);
  window._maintPhoto = null;
  saveDB();
  toast('Problema relatado — a equipe técnica foi avisada. Obrigado!', 'success');
  showResourceDetail(resourceId);
}

/* ---------- Registrar manutenção / calibração (equipe) ---------- */
function openMaintRecordModal(resourceId, kind = 'manutencao') {
  const r = getResource(resourceId); if (!r || !isTechnician()) return;
  const today = todayISO();
  const nextDefault = r.calibrationEveryMonths ? addMonthsISO(today, r.calibrationEveryMonths) : addMonthsISO(today, 12);
  openModal(`
    <div class="modal-head"><div><div class="modal-title">Registrar manutenção ou calibração</div><div class="modal-sub">${escapeHtml(r.name)}</div></div>
      <button class="modal-close" onclick="closeModal()" aria-label="Fechar">${icon('x')}</button></div>
    <div class="modal-body">
      <div class="field-row">
        <div class="field"><label for="mrKind">Tipo</label><select id="mrKind" onchange="onMaintKindChange()">
          ${['manutencao', 'calibracao', 'outro'].map(k => `<option value="${k}" ${k === kind ? 'selected' : ''}>${MAINT_KINDS[k]}</option>`).join('')}</select></div>
        <div class="field"><label for="mrDate">Data</label><input type="date" id="mrDate" value="${today}" max="${today}" onchange="onMaintKindChange(true)"></div>
      </div>
      <div class="field"><label for="mrDesc">Descrição <span class="req">*</span></label>
        <textarea id="mrDesc" rows="3" maxlength="2000" placeholder="O que foi feito: troca de peça, ajuste, limpeza, verificação…"></textarea></div>
      <div class="field-row">
        <div class="field"><label for="mrProvider">Empresa / responsável</label><input type="text" id="mrProvider" maxlength="200" placeholder="Ex.: assistência técnica, laboratório acreditado"></div>
        <div class="field" id="mrCertField"><label for="mrCert">Nº do certificado</label><input type="text" id="mrCert" maxlength="200"></div>
      </div>
      <div class="field" id="mrNextField"><label for="mrNext">Próxima calibração</label><input type="date" id="mrNext" value="${nextDefault}" data-every="${r.calibrationEveryMonths || 12}">
        <div class="field-help">Atualiza a data de vencimento do equipamento e gera alerta ${CAL_SOON_DAYS} dias antes.</div></div>
      <div class="field" id="mrStatusField"><label for="mrStatus">Situação</label><select id="mrStatus">
        <option value="resolvido">Concluída</option><option value="aberto">Em andamento</option></select></div>
      ${r.status === 'maintenance'
        ? `<label class="checkbox-field"><input type="checkbox" id="mrRelease"><div class="cf-text"><strong>Liberar o equipamento para reservas</strong>Ele está marcado como "em manutenção".</div></label>`
        : `<label class="checkbox-field"><input type="checkbox" id="mrBlock"><div class="cf-text"><strong>Colocar o equipamento em manutenção</strong>Bloqueia novas reservas e cancela as futuras, avisando os usuários.</div></label>`}
    </div>
    <div class="modal-foot"><button class="btn" onclick="showResourceDetail('${r.id}')">Voltar</button>
      <button class="btn dark" onclick="submitMaintRecord('${r.id}')">Salvar registro</button></div>`);
  onMaintKindChange();
}
function onMaintKindChange(dateChanged) {
  const k = document.getElementById('mrKind').value;
  document.getElementById('mrNextField').hidden = k !== 'calibracao';
  document.getElementById('mrCertField').hidden = k !== 'calibracao';
  document.getElementById('mrStatusField').hidden = k !== 'manutencao';
  if (dateChanged) { const n = document.getElementById('mrNext'); n.value = addMonthsISO(document.getElementById('mrDate').value || todayISO(), +n.dataset.every || 12); }
}
function submitMaintRecord(resourceId) {
  const r = getResource(resourceId); const me = currentUser(); if (!r || !me || !isTechnician()) return;
  const v = id => (document.getElementById(id)?.value || '').trim();
  const kind = v('mrKind'), date = v('mrDate') || todayISO(), desc = v('mrDesc');
  if (desc.length < 5) return toast('Descreva o que foi feito.', 'error');
  if (date > todayISO()) return toast('A data não pode ser futura.', 'error');
  const m = { id: uid('mt'), resourceId, kind, status: kind === 'manutencao' ? v('mrStatus') : 'resolvido', date, description: desc,
    by: me.id, createdAt: Date.now(), ...(v('mrProvider') ? { provider: v('mrProvider') } : {}) };
  if (kind === 'calibracao') {
    const next = v('mrNext');
    if (next && next <= date) return toast('A próxima calibração deve ser depois da data registrada.', 'error');
    if (v('mrCert')) m.certificate = v('mrCert');
    if (next) { m.nextDue = next; r.calibrationDue = next; }
    r.lastCalibration = date;
  }
  if (!window.db.maintenance) window.db.maintenance = [];
  window.db.maintenance.push(m);
  let msg = 'Registro salvo.';
  if (document.getElementById('mrRelease')?.checked) { r.status = 'available'; msg = 'Registro salvo — equipamento liberado para reservas.'; }
  if (document.getElementById('mrBlock')?.checked) {
    const n = cancelFutureReservationsOf(r.id, 'Equipamento entrou em manutenção');
    r.status = 'maintenance'; r.conditionNote = desc.slice(0, 200);
    msg = `Registro salvo — equipamento em manutenção${n ? `, ${n} reserva(s) futura(s) cancelada(s)` : ''}.`;
  }
  saveDB(); toast(msg, 'success');
  showResourceDetail(resourceId); refreshCurrentView();
}
async function resolveMaint(id) {
  const m = (window.db.maintenance || []).find(x => x.id === id); if (!m || !isTechnician()) return;
  const r = getResource(m.resourceId);
  const ans = await askConfirm({ title: 'Resolver', body: `${escapeHtml(resourceName(m.resourceId))}: ${escapeHtml(m.description.slice(0, 160))}`,
    okLabel: 'Marcar como resolvido', reason: true, reasonLabel: 'O que foi feito?', reasonRequired: true });
  if (!ans) return;
  m.status = 'resolvido'; m.resolution = ans.reason; m.resolvedAt = Date.now(); m.resolvedBy = currentUser().id;
  if (m.kind === 'problema' && m.by !== currentUser().id) notifyUser(m.by, `🔧 O problema que você relatou em ${resourceName(m.resourceId)} foi resolvido: ${ans.reason}`);
  saveDB();
  toast(r?.status === 'maintenance' ? 'Resolvido. O equipamento continua "em manutenção" — libere na ficha quando puder.' : 'Marcado como resolvido.', 'success');
  refreshCurrentView();
}

/* ---------- Painel (Coordenação → Manutenção e Painel técnico → Manutenção) ---------- */
function maintenanceOverviewHtml() {
  const open = openProblems();
  const cal = calibrationAlerts();
  const tracked = window.db.resources.filter(r => r.active && r.calibrationDue).sort((a, b) => a.calibrationDue.localeCompare(b.calibrationDue));
  const inMaint = window.db.resources.filter(r => r.active && r.status === 'maintenance');
  const recent = maintEntries().filter(m => m.status !== 'aberto').slice(0, 15);
  const box = (title, sub, body) => `<div class="panel"><div class="panel-head"><div><div class="panel-title">${title}</div>${sub ? `<div class="panel-sub">${sub}</div>` : ''}</div></div>${body}</div>`;
  const resLine = r => `<div class="maint-row"><div class="maint-kind k-calibracao">${icon('gauge', 16)}</div><div class="maint-main">
      <div><a href="#" onclick="event.preventDefault();showResourceDetail('${r.id}')"><strong>${escapeHtml(r.name)}</strong></a> ${calibrationState(r) === 'overdue' ? '<span class="pill denied">Vencida</span>' : calibrationState(r) === 'soon' ? '<span class="pill pending">A vencer</span>' : '<span class="pill approved">Em dia</span>'}</div>
      <div class="small muted">${calibrationText(r)}${r.lastCalibration ? ' · última: ' + fmtDate(r.lastCalibration) : ''}</div></div>
      <div class="row-actions"><button class="btn small" onclick="openMaintRecordModal('${r.id}','calibracao')">Registrar calibração</button></div></div>`;
  return box('Problemas em aberto', open.length ? `${open.length} aguardando a equipe técnica` : '',
      open.length ? `<div class="panel-body">${open.map(m => maintRowHtml(m, { showResource: true })).join('')}</div>` : emptyBox('Nenhum problema em aberto.'))
    + (inMaint.length ? box('Equipamentos em manutenção', `${inMaint.length} bloqueado(s) para reserva`, `<div class="panel-body">${inMaint.map(r => `<div class="maint-row"><div class="maint-kind">${icon('wrench', 16)}</div><div class="maint-main">
        <a href="#" onclick="event.preventDefault();showResourceDetail('${r.id}')"><strong>${escapeHtml(r.name)}</strong></a><div class="small muted">${escapeHtml(r.conditionNote || '')}</div></div>
        <div class="row-actions"><button class="btn small" onclick="openMaintRecordModal('${r.id}')">Registrar / liberar</button></div></div>`).join('')}</div>`) : '')
    + box('Calibrações', cal.length ? `${cal.length} vencida(s) ou a vencer em até ${CAL_SOON_DAYS} dias` : `${tracked.length} equipamento(s) com calibração controlada`,
      tracked.length ? `<div class="panel-body">${tracked.map(resLine).join('')}</div>`
        : emptyBox('Nenhum equipamento com calibração controlada. Defina a periodicidade em Recursos → Editar, ou registre uma calibração na ficha do equipamento.', 'gauge'))
    + box('Registros recentes', '', recent.length ? `<div class="panel-body">${recent.map(m => maintRowHtml(m, { showResource: true, compact: true })).join('')}</div>` : emptyBox('Nenhum registro ainda.', 'wrench'));
}

function exportMaintCSV(resourceId) {
  const rows = [['Equipamento', 'Patrimônio', 'Tipo', 'Data', 'Situação', 'Descrição', 'Empresa/responsável', 'Certificado', 'Próxima calibração', 'Registrado por', 'Solução']];
  maintEntries(resourceId).forEach(m => { const r = getResource(m.resourceId);
    rows.push([r?.name || '', r?.patrimonio || '', MAINT_KINDS[m.kind] || m.kind, m.date, m.status === 'aberto' ? 'Em aberto' : 'Concluído', m.description, m.provider || '', m.certificate || '', m.nextDue || '', userName(m.by), m.resolution || '']); });
  downloadFile(`labeme-manutencao-${todayISO()}.csv`, toCSV(rows), 'text/csv');
}
