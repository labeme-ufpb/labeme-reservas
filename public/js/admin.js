/* ============================================================
   admin.js — Painel da coordenação (v10)
   Abas: Pendentes · Devoluções · Recursos · Usuários · Reservas ·
         Relatórios · Configurações · Backup
   ============================================================ */

let adminTab = 'pending';
let adminResSearch = '', adminUserSearch = '';
let allResFilters = { status: 'all', from: '', to: '', q: '' };
let reportPeriod = 'semester';

const ADMIN_TABS = [
  ['pending', 'Pendentes', 'clock'], ['returns', 'Devoluções', 'camera'], ['resources', 'Recursos', 'box'],
  ['users', 'Usuários', 'users'], ['all-res', 'Reservas', 'list'], ['reports', 'Relatórios', 'chart'],
  ['settings', 'Configurações', 'settings'], ['backup', 'Backup', 'database']
];

function setAdminTab(tab) { adminTab = tab; renderAdmin(); }

function renderAdmin() {
  if (!isAdmin()) return showView('calendar');
  const R = window.db.reservations, today = todayISO();
  const pending = R.filter(r => r.status === 'pending').length;
  const returns = R.filter(r => r.status === 'awaiting_return' || isOverdueReturn(r)).length;
  const badges = { pending, returns };

  document.getElementById('adminSide').innerHTML = ADMIN_TABS.map(([k, l, ic]) =>
    `<button class="${adminTab === k ? 'active' : ''}" aria-current="${adminTab === k ? 'page' : 'false'}" onclick="setAdminTab('${k}')">${icon(ic, 17)}<span>${l}</span>${badges[k] ? `<span class="badge">${badges[k]}</span>` : ''}</button>`).join('');

  const maint = window.db.resources.filter(r => r.active && r.status === 'maintenance').length;
  document.getElementById('statsRow').innerHTML = `
    <button class="stat-card accent-amber" onclick="setAdminTab('pending')"><div class="stat-label">Pendentes</div><div class="stat-value">${pending}</div><div class="stat-foot">aguardando aprovação</div></button>
    <div class="stat-card accent-green"><div class="stat-label">Hoje</div><div class="stat-value">${R.filter(r => r.date === today && ['approved','in_use','awaiting_return'].includes(r.status)).length}</div><div class="stat-foot">${fmtDateShort(today)}</div></div>
    <button class="stat-card accent-steel" onclick="setAdminTab('returns')"><div class="stat-label">Devoluções</div><div class="stat-value">${returns}</div><div class="stat-foot">a conferir / atrasadas</div></button>
    <button class="stat-card accent-navy" onclick="setAdminTab('resources')"><div class="stat-label">Em manutenção</div><div class="stat-value">${maint}</div><div class="stat-foot">de ${window.db.resources.filter(r => r.active).length} recursos ativos</div></button>`;

  const content = document.getElementById('adminContent');
  const fn = { pending: adminPending, returns: adminReturns, resources: adminResources, users: adminUsers, 'all-res': adminAllReservations,
    reports: adminReports, settings: adminSettings, backup: adminBackup }[adminTab] || adminPending;
  content.innerHTML = fn();
}

function panel(title, sub, body, actions = '') {
  return `<div class="panel"><div class="panel-head"><div><div class="panel-title">${title}</div>${sub ? `<div class="panel-sub">${sub}</div>` : ''}</div>${actions ? `<div class="flex-row wrap">${actions}</div>` : ''}</div>${body}</div>`;
}
function emptyBox(msg, ic = 'check') { return `<div class="empty">${icon(ic, 28)}<div>${msg}</div></div>`; }

function adminPending() {
  const list = window.db.reservations.filter(r => r.status === 'pending').sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
  return panel('Reservas pendentes', list.length ? `${list.length} aguardando análise — mais próximas primeiro.` : '',
    list.length ? `<div class="panel-body"><div class="res-list">${list.map(r => reservationRow(r, { quick: true })).join('')}</div></div>` : emptyBox('Nenhuma reserva pendente — tudo em dia!'));
}
function adminReturns() {
  const list = window.db.reservations.filter(r => r.status === 'awaiting_return' || isOverdueReturn(r)).sort((a, b) => a.date.localeCompare(b.date));
  return panel('Devoluções', 'Fotos aguardando conferência e devoluções atrasadas.',
    list.length ? `<div class="panel-body"><div class="res-list">${list.map(r => reservationRow(r, { quick: true })).join('')}</div></div>` : emptyBox('Nenhuma devolução pendente.'));
}

/* ---------------- Recursos ---------------- */
function adminResources() {
  const t = normalizeTxt(adminResSearch);
  const list = window.db.resources.filter(r => !t || normalizeTxt([r.name, r.model, r.patrimonio, r.location, r.group].join(' ')).includes(t))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true }));
  const actions = `<div class="input-icon">${icon('search', 16)}<input type="search" placeholder="Buscar recurso" value="${escapeHtml(adminResSearch)}" oninput="adminResSearch=this.value;debouncedAdmin()"></div>
    <button class="btn" onclick="exportResourcesCSV()">${icon('download', 16)} CSV</button>
    <button class="btn dark" onclick="openResourceModal()">${icon('plus', 16)} Adicionar</button>`;
  return panel('Recursos', `${window.db.resources.length} cadastrados · ${window.db.resources.filter(r => r.active).length} ativos · ${window.db.resources.filter(r => r.status === 'maintenance').length} em manutenção`,
    `<div class="panel-body table-wrap"><table class="data-table">
      <thead><tr><th></th><th>Nome</th><th>Local</th><th>Qtd</th><th>Regras</th><th>Situação</th><th class="right">Ações</th></tr></thead>
      <tbody>${list.map(r => {
        const img = safeImg(r.photo);
        const st = !r.active ? '<span class="pill denied">Inativo</span>' : r.status === 'maintenance' ? '<span class="pill maintenance">Manutenção</span>' : '<span class="pill approved">Disponível</span>';
        return `<tr>
          <td>${img ? `<img src="${img}" class="resource-thumb" alt="" loading="lazy">` : `<div class="resource-thumb-empty">${icon('box', 16)}</div>`}</td>
          <td><strong>${escapeHtml(r.name)}</strong><div class="small muted">${escapeHtml([r.model, r.patrimonio && 'Pat. ' + r.patrimonio].filter(Boolean).join(' · '))}</div></td>
          <td class="small">${escapeHtml(r.location || '—')}</td>
          <td>${r.totalQuantity || 1}</td>
          <td class="small">${[r.requiresTechnicianPresence && 'Técnico', r.requiresReturnPhoto && 'Foto'].filter(Boolean).join(' · ') || '—'}</td>
          <td>${st}</td>
          <td class="right"><div class="row-actions">
            <button class="icon-btn" title="Editar" aria-label="Editar ${escapeHtml(r.name)}" onclick="openResourceModal('${r.id}')">${icon('edit', 16)}</button>
            <button class="icon-btn danger" title="Excluir" aria-label="Excluir ${escapeHtml(r.name)}" onclick="deleteResource('${r.id}')">${icon('trash', 16)}</button>
          </div></td></tr>`;
      }).join('')}</tbody></table></div>`, actions);
}
const debouncedAdmin = debounce(() => {
  const active = document.activeElement; const val = active?.value; const isSearch = active?.type === 'search';
  renderAdmin();
  if (isSearch) { const el = document.querySelector('#adminContent input[type=search]'); if (el) { el.focus(); el.setSelectionRange(val.length, val.length); } }
}, 200);

function openResourceModal(id) {
  if (!isAdmin()) return;
  const r = id ? getResource(id) : { name: '', type: 'equipment', mode: 'both', group: '', model: '', code: '', patrimonio: '', requiresTechnicianAssist: false,
    requiresTechnicianPresence: false, requiresReturnPhoto: false, description: '', active: true, status: 'available', photo: null, location: '', totalQuantity: 1, conditionNote: '' };
  const groups = [...new Set(window.db.resources.map(x => x.group).filter(Boolean))].sort();
  const locations = [...new Set(window.db.resources.map(x => x.location).filter(Boolean))].sort();
  window._resourcePhotoData = r.photo || null;
  const img = safeImg(r.photo);
  const chk = (idf, val, title, help) => `<label class="checkbox-field"><input type="checkbox" id="${idf}" ${val ? 'checked' : ''}><div class="cf-text"><strong>${title}</strong>${help}</div></label>`;
  openModal(`
    <div class="modal-head"><div><div class="modal-title">${id ? 'Editar' : 'Adicionar'} recurso</div></div>
      <button class="modal-close" onclick="closeModal()" aria-label="Fechar">${icon('x')}</button></div>
    <div class="modal-body">
      <div class="field"><span class="label">Foto</span>
        <label class="file-upload ${img ? 'has-file' : ''}" id="rPhotoLabel"><input type="file" accept="image/*" onchange="onResourcePhotoChange(event)">
          <div id="rPhotoText">${img ? 'Foto carregada — clique para trocar' : icon('camera') + ' Adicionar foto'}</div></label>
        <img id="rPhotoPreview" class="file-preview" src="${img}" ${img ? '' : 'hidden'} alt="Prévia"></div>
      <div class="field"><label for="rName">Nome <span class="req">*</span></label><input type="text" id="rName" value="${escapeHtml(r.name)}" placeholder="Ex.: Prensa hidráulica 100T"></div>
      <div class="field-row">
        <div class="field"><label for="rPatr">Patrimônio UFPB</label><input type="text" id="rPatr" value="${escapeHtml(r.patrimonio || '')}" placeholder="Ex.: 65-114.419"></div>
        <div class="field"><label for="rModel">Marca / modelo</label><input type="text" id="rModel" value="${escapeHtml(r.model || '')}"></div>
      </div>
      <div class="field-row">
        <div class="field"><label for="rGroupSel">Grupo</label>
          <select id="rGroupSel" onchange="document.getElementById('rGroupNew').hidden = this.value !== '__new__'; if (this.value === '__new__') document.getElementById('rGroupNew').focus();">
            <option value="">Selecione…</option>
            ${groups.map(g => `<option value="${escapeHtml(g)}" ${r.group === g ? 'selected' : ''}>${escapeHtml(g)}</option>`).join('')}
            <option value="__new__">+ Novo grupo…</option>
          </select>
          <input type="text" id="rGroupNew" placeholder="Nome do novo grupo" maxlength="60" hidden style="margin-top:8px;"></div>
        <div class="field"><label for="rLocation">Local</label><input type="text" id="rLocation" list="locList" value="${escapeHtml(r.location || '')}"><datalist id="locList">${locations.map(g => `<option value="${escapeHtml(g)}">`).join('')}</datalist></div>
      </div>
      <div class="field"><label for="rDesc">Descrição</label><textarea id="rDesc" rows="2" placeholder="Capacidade, normas aplicáveis, cuidados…">${escapeHtml(r.description || '')}</textarea></div>
      <div class="field-row three">
        <div class="field"><label for="rType">Tipo</label><select id="rType">${Object.entries(RESOURCE_TYPES).map(([k, v]) => `<option value="${k}" ${r.type === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
        <div class="field"><label for="rMode">Modo de reserva</label><select id="rMode">${Object.entries(RESOURCE_MODES).map(([k, v]) => `<option value="${k}" ${r.mode === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
        <div class="field"><label for="rQty">Quantidade</label><input type="number" id="rQty" value="${r.totalQuantity || 1}" min="1"></div>
      </div>
      <div class="section-label">Regras de uso</div>
      ${chk('rTechPresence', r.requiresTechnicianPresence, 'Presença de técnico obrigatória', 'Destaque ao usuário e no painel técnico.')}
      ${chk('rTechAssist', r.requiresTechnicianAssist, 'Acompanhamento técnico recomendado', 'Apenas informativo.')}
      ${chk('rReturnPhoto', r.requiresReturnPhoto, 'Devolução com foto obrigatória', 'Para itens portáteis: peneiras, ferramentas, moldes…')}
      <div class="field-row" style="margin-top:14px;">
        <div class="field"><label for="rStatus">Situação</label><select id="rStatus">
          <option value="available" ${r.status !== 'maintenance' ? 'selected' : ''}>Disponível</option>
          <option value="maintenance" ${r.status === 'maintenance' ? 'selected' : ''}>Em manutenção</option></select>
          <div class="field-help">Ao entrar em manutenção, as reservas futuras são canceladas e os usuários avisados.</div></div>
        <div class="field"><label for="rActive">Visibilidade</label><select id="rActive">
          <option value="true" ${r.active ? 'selected' : ''}>Ativo</option><option value="false" ${!r.active ? 'selected' : ''}>Inativo (inservível / baixado)</option></select></div>
      </div>
      <div class="field"><label for="rCond">Observação de estado</label><input type="text" id="rCond" value="${escapeHtml(r.conditionNote || '')}" placeholder="Ex.: falta instalação; aguardando peça"></div>
    </div>
    <div class="modal-foot"><button class="btn" onclick="closeModal()">Cancelar</button><button class="btn dark" onclick="saveResource('${id || ''}')">Salvar</button></div>`, true);
}
function onResourcePhotoChange(e) {
  const file = e.target.files[0]; if (!file) return;
  fileToDataURL(file, 900, 0.78).then(d => {
    window._resourcePhotoData = d;
    const p = document.getElementById('rPhotoPreview'); p.src = d; p.hidden = false;
    document.getElementById('rPhotoText').textContent = 'Foto carregada — clique para trocar';
    document.getElementById('rPhotoLabel').classList.add('has-file');
  }).catch(err => toast(err.message, 'error'));
}
function saveResource(id) {
  const v = x => document.getElementById(x).value.trim();
  const data = {
    name: v('rName'), description: v('rDesc'), location: v('rLocation'),
    group: v('rGroupSel') === '__new__' ? v('rGroupNew') : v('rGroupSel'), model: v('rModel'),
    patrimonio: v('rPatr'), conditionNote: v('rCond'),
    type: v('rType'), mode: v('rMode'), totalQuantity: Math.max(1, parseInt(v('rQty'), 10) || 1),
    active: v('rActive') === 'true', status: v('rStatus'),
    requiresTechnicianAssist: document.getElementById('rTechAssist').checked,
    requiresTechnicianPresence: document.getElementById('rTechPresence').checked,
    requiresReturnPhoto: document.getElementById('rReturnPhoto').checked,
    photo: window._resourcePhotoData || null
  };
  if (!data.name) return toast('Informe o nome.', 'error');
  if (!data.group) return toast(document.getElementById('rGroupSel').value === '__new__' ? 'Digite o nome do novo grupo.' : 'Escolha o grupo do equipamento.', 'error');
  { const same = window.db.resources.map(x => x.group).find(g => g && normalizeTxt(g) === normalizeTxt(data.group)); if (same) data.group = same; } // evita grupo duplicado por acento/maiúscula
  let cancelled = 0;
  const target = id ? getResource(id) : null;
  if (target && ((target.status !== 'maintenance' && data.status === 'maintenance') || (target.active && !data.active))) {
    cancelled = cancelFutureReservationsOf(id, data.status === 'maintenance' ? 'Equipamento entrou em manutenção' : 'Recurso retirado de uso');
  }
  if (target) Object.assign(target, data);
  else window.db.resources.push({ id: uid('r'), ...data, createdAt: Date.now() });
  if (!saveDB()) return;
  window._resourcePhotoData = null;
  closeModal();
  toast(cancelled ? `Salvo — ${cancelled} reserva(s) futura(s) cancelada(s) e usuários avisados.` : 'Recurso salvo.', cancelled ? 'warn' : 'success');
  refreshCurrentView();
}
function cancelFutureReservationsOf(resourceId, reason) {
  let n = 0;
  window.db.reservations.forEach(x => {
    if (x.resourceId === resourceId && x.date >= todayISO() && ['pending','approved'].includes(x.status)) {
      x.status = 'cancelled'; x.cancelReason = reason; x.cancelledAt = Date.now(); x.cancelledBy = currentUser()?.id;
      logReservation(x, 'maintenance_cancel', { reason });
      notifyUser(x.userId, `⚠️ Sua reserva foi cancelada: ${resLabel(x)}. Motivo: ${reason}. Desculpe o transtorno — procure a equipe técnica para remarcar.`);
      n++;
    }
  });
  return n;
}
async function deleteResource(id) {
  const r = getResource(id); if (!r) return;
  const used = window.db.reservations.some(x => x.resourceId === id);
  if (used) {
    const ans = await askConfirm({ title: 'Recurso com histórico', body: `<strong>${escapeHtml(r.name)}</strong> tem reservas registradas. Para preservar o histórico ele será marcado como <strong>inativo</strong> (some do catálogo) e as reservas futuras serão canceladas.`, okLabel: 'Inativar', danger: true });
    if (!ans) return;
    const n = cancelFutureReservationsOf(id, 'Recurso retirado de uso');
    r.active = false; saveDB(); toast(`Recurso inativado${n ? ` — ${n} reserva(s) cancelada(s)` : ''}.`, 'warn');
  } else {
    const ans = await askConfirm({ title: 'Excluir recurso', body: `Excluir <strong>${escapeHtml(r.name)}</strong> definitivamente?`, okLabel: 'Excluir', danger: true });
    if (!ans) return;
    window.db.resources = window.db.resources.filter(x => x.id !== id); saveDB(); toast('Recurso excluído.', 'warn');
  }
  renderAdmin();
}
function exportResourcesCSV() {
  const rows = [['Nome','Marca/modelo','Patrimônio','Grupo','Local','Quantidade','Situação','Ativo','Técnico obrigatório','Foto na devolução','Observação']];
  window.db.resources.forEach(r => rows.push([r.name, r.model, r.patrimonio, r.group, r.location, r.totalQuantity, r.status === 'maintenance' ? 'Em manutenção' : 'Disponível', r.active ? 'Sim' : 'Não', r.requiresTechnicianPresence ? 'Sim' : 'Não', r.requiresReturnPhoto ? 'Sim' : 'Não', r.conditionNote]));
  downloadFile(`labeme-recursos-${todayISO()}.csv`, toCSV(rows), 'text/csv');
}

/* ---------------- Usuários ---------------- */
function adminUsers() {
  const t = normalizeTxt(adminUserSearch);
  const list = window.db.users.filter(u => !t || normalizeTxt([u.name, u.email, u.advisor, u.institution, CATEGORY_LABELS[u.category]].join(' ')).includes(t))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  const counts = {}; window.db.reservations.forEach(r => counts[r.userId] = (counts[r.userId] || 0) + 1);
  const actions = `<div class="input-icon">${icon('search', 16)}<input type="search" placeholder="Buscar usuário" value="${escapeHtml(adminUserSearch)}" oninput="adminUserSearch=this.value;debouncedAdmin()"></div>
    <button class="btn" onclick="exportUsersCSV()">${icon('download', 16)} CSV</button>
    <button class="btn dark" onclick="openCreateUserModal()">${icon('plus', 16)} Cadastrar</button>`;
  return panel('Usuários', `${window.db.users.length} contas · ${window.db.users.filter(u => u.active === false).length} desativadas`,
    `<div class="panel-body table-wrap"><table class="data-table">
      <thead><tr><th></th><th>Nome</th><th>Categoria</th><th>Papel</th><th>Orientador / instituição</th><th>Reservas</th><th>Último acesso</th><th></th></tr></thead>
      <tbody>${list.map(u => `<tr class="${u.active === false ? 'row-muted' : ''}">
        <td>${renderAvatar(u, 'small')}</td>
        <td><strong>${escapeHtml(u.name)}</strong><div class="small muted">${escapeHtml(u.email)}</div></td>
        <td><span class="pill auto">${escapeHtml(CATEGORY_LABELS[u.category] || '—')}</span></td>
        <td>${u.role === 'admin' ? '<span class="pill approved">Coordenação</span>' : u.role === 'technician' ? '<span class="pill completed">Técnico</span>' : 'Usuário'}${u.active === false ? ' <span class="pill denied">Desativado</span>' : ''}</td>
        <td class="small">${escapeHtml(u.advisor || u.institution || '—')}</td>
        <td>${counts[u.id] || 0}</td>
        <td class="small muted">${u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : 'nunca'}</td>
        <td class="right"><button class="icon-btn" title="Editar" aria-label="Editar ${escapeHtml(u.name)}" onclick="openUserModal('${u.id}')">${icon('edit', 16)}</button></td>
      </tr>`).join('')}</tbody></table></div>`, actions);
}
function exportUsersCSV() {
  const rows = [['Nome','E-mail','WhatsApp','Categoria','Papel','Orientador','Instituição','Ativo','Cadastro','Último acesso']];
  window.db.users.forEach(u => rows.push([u.name, u.email, u.phone, CATEGORY_LABELS[u.category], ROLE_LABELS[u.role], u.advisor, u.institution, u.active === false ? 'Não' : 'Sim', u.createdAt ? fmtDateTime(u.createdAt) : '', u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : '']));
  downloadFile(`labeme-usuarios-${todayISO()}.csv`, toCSV(rows), 'text/csv');
}

function userFormFields(u = {}) {
  return `
    <div class="field"><label for="cuName">Nome completo <span class="req">*</span></label><input type="text" id="cuName" value="${escapeHtml(u.name || '')}"></div>
    <div class="field-row">
      <div class="field"><label for="cuEmail">E-mail <span class="req">*</span></label><input type="email" id="cuEmail" value="${escapeHtml(u.email || '')}" ${u.id ? 'disabled' : ''}></div>
      <div class="field"><label for="cuPhone">WhatsApp</label><input type="tel" id="cuPhone" value="${escapeHtml(u.phone || '')}" placeholder="(83) 9XXXX-XXXX"></div>
    </div>
    <div class="field-row">
      <div class="field"><label for="cuCategory">Categoria <span class="req">*</span></label>
        <select id="cuCategory" onchange="onCreateUserCategoryChange()"><option value="">Selecione…</option>
        ${CATEGORY_ORDER.map(k => `<option value="${k}" ${u.category === k ? 'selected' : ''}>${CATEGORY_LABELS[k]}</option>`).join('')}</select></div>
      <div class="field"><label for="cuRole">Papel no sistema</label>
        <select id="cuRole" ${u.id && u.id === currentUser()?.id ? 'disabled' : ''}>
          ${Object.entries(ROLE_LABELS).map(([k, v]) => `<option value="${k}" ${(u.role || 'user') === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
        ${u.id && u.id === currentUser()?.id ? '<div class="field-help">Você não pode alterar o próprio papel.</div>' : '<div class="field-help">Técnicos e coordenação aprovam reservas.</div>'}</div>
    </div>
    <div class="field" id="cuAdvisorField" ${STUDENT_CATEGORIES.includes(u.category) ? '' : 'hidden'}><label for="cuAdvisor">Orientador(a)</label><input type="text" id="cuAdvisor" value="${escapeHtml(u.advisor || '')}"></div>
    <div class="field" id="cuInstitutionField" ${EXTERNAL_CATEGORIES.includes(u.category) ? '' : 'hidden'}><label for="cuInstitution">Instituição</label><input type="text" id="cuInstitution" value="${escapeHtml(u.institution || '')}"></div>`;
}
function onCreateUserCategoryChange() {
  const cat = document.getElementById('cuCategory').value;
  document.getElementById('cuAdvisorField').hidden = !STUDENT_CATEGORIES.includes(cat);
  document.getElementById('cuInstitutionField').hidden = !EXTERNAL_CATEGORIES.includes(cat);
  if (cat === 'tecnico' && document.getElementById('cuRole').value === 'user') document.getElementById('cuRole').value = 'technician';
}
function openCreateUserModal() {
  if (!isAdmin()) return;
  openModal(`
    <div class="modal-head"><div><div class="modal-title">Cadastrar usuário</div><div class="modal-sub">Alunos, professores, técnicos ou coordenação</div></div>
      <button class="modal-close" onclick="closeModal()" aria-label="Fechar">${icon('x')}</button></div>
    <div class="modal-body">${userFormFields()}
      <div class="field-row">
        <div class="field"><label for="cuPwd">Senha inicial <span class="req">*</span></label><input type="password" id="cuPwd" autocomplete="new-password"></div>
        <div class="field"><label for="cuPwdConfirm">Confirmar <span class="req">*</span></label><input type="password" id="cuPwdConfirm" autocomplete="new-password"></div>
      </div>
      <div class="field-help">Oriente o usuário a trocar a senha no primeiro acesso (Meu perfil → Alterar senha).</div>
    </div>
    <div class="modal-foot"><button class="btn" onclick="closeModal()">Cancelar</button><button class="btn dark" onclick="submitCreateUser()">Criar usuário</button></div>`);
}
async function submitCreateUser() {
  if (!isAdmin()) return;
  const v = x => document.getElementById(x).value.trim();
  const name = v('cuName'), email = v('cuEmail').toLowerCase(), category = v('cuCategory'), role = v('cuRole');
  const pwd = document.getElementById('cuPwd').value, conf = document.getElementById('cuPwdConfirm').value;
  if (!name || !email || !category || !pwd) return toast('Preencha os campos obrigatórios.', 'error');
  if (!validEmail(email)) return toast('E-mail inválido.', 'error');
  const prob = passwordProblem(pwd); if (prob) return toast(prob, 'error');
  if (pwd !== conf) return toast('As senhas não coincidem.', 'error');
  if (window.db.users.some(u => (u.email || '').toLowerCase() === email)) return toast('E-mail já cadastrado.', 'error');
  const btn = document.querySelector('#modal .modal-foot .btn.dark'); if (btn) { btn.disabled = true; btn.textContent = 'Criando…'; }
  try {
    const id = await createAuthAccount(email, pwd);
    const u = { id, name, email, phone: v('cuPhone'), category, role, advisor: v('cuAdvisor'), institution: v('cuInstitution'),
      active: true, avatar: null, profileReminderShown: false, createdAt: Date.now(), createdBy: currentUser().id };
    await writeDocNow('users', u);
    closeModal(); toast(`Usuário ${name} criado. Informe a senha inicial a ele(a).`, 'success'); renderAdmin();
  } catch (e) {
    if (btn) { btn.disabled = false; btn.textContent = 'Criar usuário'; }
    toast(authErrorMessage(e), 'error');
  }
}
function openUserModal(id) {
  const u = getUser(id); if (!u || !isAdmin()) return;
  const self = u.id === currentUser().id;
  openModal(`
    <div class="modal-head"><div><div class="modal-title">Editar usuário</div><div class="modal-sub">Cadastro em ${u.createdAt ? fmtDate(localISO(new Date(u.createdAt))) : '—'}${u.rulesAcceptedAt ? ' · normas aceitas em ' + fmtDate(localISO(new Date(u.rulesAcceptedAt))) : ''}</div></div>
      <button class="modal-close" onclick="closeModal()" aria-label="Fechar">${icon('x')}</button></div>
    <div class="modal-body">
      <div class="center" style="margin-bottom:14px;">${renderAvatar(u, 'large')}</div>
      ${userFormFields(u)}
      <div class="section-label">Acesso</div>
      <div class="flex-row wrap">
        <button class="btn" onclick="closeModal();adminGenerateResetLink('${u.id}')">${icon('key', 16)} Enviar e-mail de nova senha</button>
        ${!self ? `<button class="btn ${u.active === false ? 'success' : 'danger'}" onclick="toggleUserActive('${u.id}')">${u.active === false ? 'Reativar conta' : 'Desativar conta'}</button>` : ''}
      </div>
    </div>
    <div class="modal-foot">
      ${!self ? `<button class="btn danger" onclick="deleteUser('${u.id}')">${icon('trash', 16)} Excluir</button>` : ''}
      <button class="btn" onclick="closeModal()">Cancelar</button><button class="btn dark" onclick="saveUser('${u.id}')">Salvar</button>
    </div>`);
}
function saveUser(id) {
  const u = getUser(id); if (!u || !isAdmin()) return;
  const v = x => document.getElementById(x).value.trim();
  if (!v('cuName')) return toast('Nome obrigatório.', 'error');
  u.name = v('cuName'); u.phone = v('cuPhone'); u.category = v('cuCategory') || u.category;
  if (!document.getElementById('cuRole').disabled) u.role = v('cuRole');
  u.advisor = STUDENT_CATEGORIES.includes(u.category) ? v('cuAdvisor') : '';
  u.institution = EXTERNAL_CATEGORIES.includes(u.category) ? v('cuInstitution') : (u.institution || '');
  saveDB(); closeModal(); toast('Usuário atualizado.', 'success'); renderAdmin(); refreshAuthUI();
}
async function toggleUserActive(id) {
  const u = getUser(id); if (!u) return;
  if (u.active !== false) {
    const future = window.db.reservations.filter(r => r.userId === id && r.date >= todayISO() && ['pending','approved'].includes(r.status));
    const ans = await askConfirm({ title: 'Desativar conta', body: `${escapeHtml(u.name)} não conseguirá mais entrar.${future.length ? ` ${future.length} reserva(s) futura(s) serão canceladas.` : ''} O histórico é preservado.`, okLabel: 'Desativar', danger: true });
    if (!ans) return;
    future.forEach(r => { r.status = 'cancelled'; r.cancelReason = 'Conta desativada'; logReservation(r, 'cancelled', { reason: 'Conta desativada' }); });
    u.active = false;
  } else u.active = true;
  saveDB(); toast(u.active ? 'Conta reativada.' : 'Conta desativada.', u.active ? 'success' : 'warn'); renderAdmin();
}
async function deleteUser(id) {
  const u = getUser(id); if (!u) return;
  const resList = window.db.reservations.filter(r => r.userId === id);
  let ans;
  if (resList.length) {
    // Contas de teste: apaga também as reservas. Para contas reais, o certo é desativar (preserva o histórico).
    ans = await askConfirm({ title: 'Excluir usuário e reservas',
      body: `<strong>${escapeHtml(u.name)}</strong> tem <strong>${resList.length} reserva(s)</strong> no histórico. Excluir a conta apaga também essas reservas e as mensagens trocadas com você — use só para contas de teste. Para quem já usou o laboratório, prefira <strong>Desativar conta</strong>.`,
      okLabel: `Excluir conta e ${resList.length} reserva(s)`, danger: true });
    if (!ans) return;
    window.db.reservations = window.db.reservations.filter(r => r.userId !== id);
    window.db.messages = window.db.messages.filter(m => m.fromUserId !== id && m.toUserId !== id);
  } else {
    ans = await askConfirm({ title: 'Excluir usuário', body: `Excluir o cadastro de <strong>${escapeHtml(u.name)}</strong>? Para impedir o acesso de vez, prefira "Desativar conta".`, okLabel: 'Excluir', danger: true });
    if (!ans) return;
  }
  window.db.users = window.db.users.filter(x => x.id !== id);
  saveDB(); closeModal(); toast('Usuário excluído.', 'warn'); renderAdmin();
}

/* ---------------- Todas as reservas ---------------- */
function filteredAllReservations() {
  const f = allResFilters; const t = normalizeTxt(f.q);
  return window.db.reservations.filter(r => {
    if (f.status !== 'all' && r.status !== f.status) return false;
    if (f.from && r.date < f.from) return false;
    if (f.to && r.date > f.to) return false;
    if (t && !normalizeTxt([resourceName(r.resourceId), userName(r.userId), r.purpose, r.project].join(' ')).includes(t)) return false;
    return true;
  }).sort((a, b) => b.date.localeCompare(a.date) || reservationRange(b).start.localeCompare(reservationRange(a).start));
}
function adminAllReservations() {
  const list = filteredAllReservations();
  const f = allResFilters;
  const actions = `<button class="btn" onclick="exportReservationsCSV()">${icon('download', 16)} Exportar CSV (${list.length})</button>`;
  return panel('Todas as reservas', 'Filtre por período, status, recurso ou pessoa.',
    `<div class="panel-body">
      <div class="filter-bar">
        <div class="input-icon grow">${icon('search', 16)}<input type="search" placeholder="Recurso, pessoa, projeto…" value="${escapeHtml(f.q)}" oninput="allResFilters.q=this.value;debouncedAdmin()"></div>
        <select onchange="allResFilters.status=this.value;renderAdmin()" aria-label="Status"><option value="all">Todos os status</option>${Object.entries(RES_STATUS).map(([k, v]) => `<option value="${k}" ${f.status === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
        <label class="inline-label">De <input type="date" value="${f.from}" onchange="allResFilters.from=this.value;renderAdmin()"></label>
        <label class="inline-label">Até <input type="date" value="${f.to}" onchange="allResFilters.to=this.value;renderAdmin()"></label>
      </div>
      ${list.length ? `<div class="res-list">${list.slice(0, 200).map(r => reservationRow(r, { quick: true })).join('')}</div>${list.length > 200 ? `<div class="small muted center mt-4">Mostrando 200 de ${list.length}. Refine os filtros ou exporte o CSV.</div>` : ''}` : emptyBox('Nenhuma reserva com esses filtros.', 'search')}
    </div>`, actions);
}
function exportReservationsCSV(list = filteredAllReservations()) {
  const rows = [['Data','Início','Fim','Horas','Recurso','Grupo','Quantidade','Solicitante','E-mail','Categoria','Orientador','Atividade','Projeto','Descrição','Status','Criada em','Decidida por','Motivo recusa/cancelamento']];
  list.forEach(r => {
    const u = getUser(r.userId), res = getResource(r.resourceId), rg = reservationRange(r);
    rows.push([r.date, rg.start, rg.end, reservationHours(r).toFixed(1).replace('.', ','), res?.name, res?.group, r.quantity, u?.name, u?.email, CATEGORY_LABELS[u?.category], u?.advisor,
      PURPOSE_TYPES[r.purposeType] || '', r.project, r.purpose, RES_STATUS[r.status], fmtDateTime(r.createdAt), r.decidedBy === 'auto' ? 'Automática' : (r.decidedBy ? userName(r.decidedBy) : ''), r.denyReason || r.cancelReason || '']);
  });
  downloadFile(`labeme-reservas-${todayISO()}.csv`, toCSV(rows), 'text/csv');
}

/* ---------------- Relatórios ---------------- */
function reportRange() {
  const today = todayISO(), d = new Date();
  if (reportPeriod === 'month') return [localISO(new Date(d.getFullYear(), d.getMonth(), 1)), today];
  if (reportPeriod === 'semester') return [localISO(new Date(d.getFullYear(), d.getMonth() < 6 ? 0 : 6, 1)), today];
  if (reportPeriod === 'year') return [`${d.getFullYear()}-01-01`, today];
  return ['0000-01-01', '9999-12-31'];
}
function barList(entries, unit = '') {
  const max = Math.max(1, ...entries.map(e => e[1]));
  return entries.length ? `<div class="bars">${entries.map(([label, val, sub]) => `<div class="bar-row"><div class="bar-label" title="${escapeHtml(label)}">${escapeHtml(label)}</div><div class="bar-track"><div class="bar-fill" style="width:${(val / max * 100).toFixed(1)}%"></div></div><div class="bar-val">${String(Math.round(val * 10) / 10).replace('.', ',')}${unit}${sub ? ` <span class="muted">${sub}</span>` : ''}</div></div>`).join('')}</div>` : '<div class="small muted">Sem dados no período.</div>';
}
function adminReports() {
  const [from, to] = reportRange();
  const inPeriod = window.db.reservations.filter(r => r.date >= from && r.date <= to);
  const used = inPeriod.filter(r => ['approved','in_use','awaiting_return','returned','completed'].includes(r.status));
  const decided = inPeriod.filter(r => r.decidedAt && r.decidedBy !== 'auto');
  const avgDecisionH = decided.length ? decided.reduce((s, r) => s + (r.decidedAt - r.createdAt), 0) / decided.length / 36e5 : 0;
  const hours = used.reduce((s, r) => s + reservationHours(r), 0);
  const users = new Set(used.map(r => r.userId)).size;
  const denied = inPeriod.filter(r => r.status === 'denied').length;
  const cancelled = inPeriod.filter(r => r.status === 'cancelled').length;

  const agg = (keyFn, valFn = () => 1) => { const m = {}; used.forEach(r => { const k = keyFn(r); if (k) m[k] = (m[k] || 0) + valFn(r); }); return Object.entries(m).sort((a, b) => b[1] - a[1]); };
  const byRes = agg(r => resourceName(r.resourceId), reservationHours).slice(0, 10);
  const byGroup = agg(r => getResource(r.resourceId)?.group || 'Outros', reservationHours);
  const byCat = agg(r => CATEGORY_LABELS[getUser(r.userId)?.category] || 'Removido');
  const byPurpose = agg(r => PURPOSE_TYPES[r.purposeType] || 'Não informado');
  const byAdvisor = agg(r => getUser(r.userId)?.advisor || null).slice(0, 8);
  const neverUsed = window.db.resources.filter(x => x.active && x.status !== 'maintenance' && !used.some(r => r.resourceId === x.id)).length;
  const maint = window.db.resources.filter(x => x.active && x.status === 'maintenance');
  const periods = [['month', 'Este mês'], ['semester', 'Semestre'], ['year', 'Ano'], ['all', 'Tudo']];

  return `
    <div class="panel">
      <div class="panel-head"><div><div class="panel-title">Relatório de uso</div><div class="panel-sub">${from === '0000-01-01' ? 'Todo o período' : `${fmtDate(from)} a ${fmtDate(to)}`} · útil para relatórios institucionais, editais e prestação de contas.</div></div>
        <div class="flex-row wrap"><div class="seg small">${periods.map(([k, l]) => `<button class="${reportPeriod === k ? 'active' : ''}" onclick="reportPeriod='${k}';renderAdmin()">${l}</button>`).join('')}</div>
        <button class="btn" onclick="exportReservationsCSV(window.db.reservations.filter(r=>r.date>='${from}'&&r.date<='${to}'))">${icon('download', 16)} CSV</button></div></div>
      <div class="panel-body">
        <div class="kpi-grid">
          <div class="kpi"><span class="kpi-n">${used.length}</span><span class="kpi-l">usos confirmados</span></div>
          <div class="kpi"><span class="kpi-n">${Math.round(hours)}</span><span class="kpi-l">horas de equipamento</span></div>
          <div class="kpi"><span class="kpi-n">${users}</span><span class="kpi-l">usuários atendidos</span></div>
          <div class="kpi"><span class="kpi-n">${avgDecisionH ? avgDecisionH.toFixed(1).replace('.', ',') + ' h' : '—'}</span><span class="kpi-l">tempo médio de aprovação</span></div>
          <div class="kpi"><span class="kpi-n">${denied}</span><span class="kpi-l">recusadas</span></div>
          <div class="kpi"><span class="kpi-n">${cancelled}</span><span class="kpi-l">canceladas</span></div>
        </div>
      </div>
    </div>
    <div class="report-grid">
      ${panel('Equipamentos mais usados', 'Horas reservadas (top 10)', `<div class="panel-body">${barList(byRes, ' h')}</div>`)}
      ${panel('Uso por grupo', 'Horas reservadas', `<div class="panel-body">${barList(byGroup, ' h')}</div>`)}
      ${panel('Por categoria de usuário', 'Nº de reservas', `<div class="panel-body">${barList(byCat)}</div>`)}
      ${panel('Por tipo de atividade', 'Nº de reservas', `<div class="panel-body">${barList(byPurpose)}</div>`)}
      ${panel('Por orientador(a)', 'Nº de reservas dos orientandos', `<div class="panel-body">${barList(byAdvisor)}</div>`)}
      ${panel('Parque de equipamentos', '', `<div class="panel-body">
        <p><strong>${maint.length}</strong> em manutenção · <strong>${neverUsed}</strong> disponíveis sem nenhum uso no período.</p>
        ${maint.length ? `<ul class="plain-list">${maint.map(m => `<li>${escapeHtml(m.name)}${m.conditionNote ? ` <span class="muted small">— ${escapeHtml(m.conditionNote)}</span>` : ''}</li>`).join('')}</ul>` : ''}
      </div>`)}
    </div>`;
}

/* ---------------- Configurações ---------------- */
function adminSettings() {
  const s = window.db.settings;
  const auto = s.autoApproveCategories || [];
  return `
    ${panel('Aprovação automática por categoria', 'Categorias marcadas têm reservas aprovadas na hora. As demais ficam pendentes para técnicos/coordenação.',
      `<div class="panel-body"><div class="check-grid">${CATEGORY_ORDER.map(c => `<label class="checkbox-field"><input type="checkbox" class="auto-approve-cat" data-cat="${c}" ${auto.includes(c) ? 'checked' : ''}><div class="cf-text"><strong>${CATEGORY_LABELS[c]}</strong></div></label>`).join('')}</div>
      <div class="info-box mt-4">Sugestão: manter <strong>Graduação</strong> e <strong>Externo à UFPB</strong> com aprovação manual.</div>
      <button class="btn dark" onclick="saveAutoApproveSettings()">Salvar critérios</button></div>`)}
    <div style="height:16px"></div>
    ${panel('Regras de agendamento', '', `<div class="panel-body">
      <div class="field-row three">
        <div class="field"><label for="setMin">Antecedência mínima (h)</label><input type="number" id="setMin" value="${s.minAdvanceHours}" min="0"></div>
        <div class="field"><label for="setMax">Antecedência máxima (dias)</label><input type="number" id="setMax" value="${s.maxAdvanceDays}" min="1"></div>
        <div class="field"><label for="setMaxActive">Reservas futuras por usuário</label><input type="number" id="setMaxActive" value="${s.maxActivePerUser || 0}" min="0"><div class="field-help">0 = sem limite. Não se aplica à equipe.</div></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Manhã</label><div class="flex-row"><input type="time" id="setManhaStart" value="${s.turnoManha.start}"><span>às</span><input type="time" id="setManhaEnd" value="${s.turnoManha.end}"></div></div>
        <div class="field"><label>Tarde</label><div class="flex-row"><input type="time" id="setTardeStart" value="${s.turnoTarde.start}"><span>às</span><input type="time" id="setTardeEnd" value="${s.turnoTarde.end}"></div></div>
      </div>
      <label class="checkbox-field"><input type="checkbox" id="setWeekends" ${s.allowWeekends ? 'checked' : ''}><div class="cf-text"><strong>Permitir reservas aos sábados e domingos</strong></div></label>
      <div class="field mt-4"><label for="setClosed">Feriados e recessos (um por linha, AAAA-MM-DD)</label>
        <textarea id="setClosed" rows="4" placeholder="2026-11-20&#10;2026-12-24">${escapeHtml((s.closedDates || []).join('\n'))}</textarea></div>
      <div class="field"><label for="setRules">Normas de uso (exibidas no cadastro)</label><textarea id="setRules" rows="4">${escapeHtml(s.labRules || '')}</textarea></div>
      <div class="field-row">
        <div class="field"><label for="setAdminEmail">E-mail de contato do laboratório</label><input type="email" id="setAdminEmail" value="${escapeHtml(s.adminEmail || '')}"></div>
        <div class="field"><label class="checkbox-field" style="margin-top:22px;"><input type="checkbox" id="setNotify" ${s.notifyInApp ? 'checked' : ''}><div class="cf-text"><strong>Avisar usuários por mensagem interna</strong>Aprovações, recusas, cancelamentos e devoluções.</div></label></div>
      </div>
      <button class="btn dark" onclick="saveSettings()">Salvar regras</button>
    </div>`)}`;
}
function saveAutoApproveSettings() {
  window.db.settings.autoApproveCategories = [...document.querySelectorAll('.auto-approve-cat')].filter(c => c.checked).map(c => c.dataset.cat);
  saveDB(); toast('Critérios de aprovação salvos.', 'success');
}
function saveSettings() {
  const s = window.db.settings, v = id => document.getElementById(id).value;
  const m = { start: v('setManhaStart'), end: v('setManhaEnd') }, t = { start: v('setTardeStart'), end: v('setTardeEnd') };
  if (!(m.start < m.end && t.start < t.end && m.end <= t.start)) return toast('Turnos inválidos: o início deve vir antes do fim, e a manhã antes da tarde.', 'error');
  const closed = v('setClosed').split(/[\s,;]+/).map(x => x.trim()).filter(Boolean);
  const bad = closed.filter(x => !/^\d{4}-\d{2}-\d{2}$/.test(x));
  if (bad.length) return toast(`Data inválida: ${bad[0]} (use AAAA-MM-DD).`, 'error');
  Object.assign(s, {
    minAdvanceHours: Math.max(0, parseInt(v('setMin'), 10) || 0), maxAdvanceDays: Math.max(1, parseInt(v('setMax'), 10) || 30),
    maxActivePerUser: Math.max(0, parseInt(v('setMaxActive'), 10) || 0), turnoManha: m, turnoTarde: t,
    allowWeekends: document.getElementById('setWeekends').checked, closedDates: [...new Set(closed)].sort(),
    labRules: v('setRules').trim(), adminEmail: v('setAdminEmail').trim(), notifyInApp: document.getElementById('setNotify').checked
  });
  saveDB(); toast('Regras salvas.', 'success');
}

/* ---------------- Backup ---------------- */
function adminBackup() {
  const last = window.db.settings.lastBackupAt;
  const stale = !last || Date.now() - last > 30 * 864e5;
  return `
    ${panel('Cópia de segurança', 'Os dados ficam no servidor do Google (Firebase, São Paulo). A cópia mensal em arquivo protege contra exclusões por engano.', `<div class="panel-body">
      <div class="info-box ${stale ? 'warn' : 'success'}">${icon(stale ? 'alert' : 'check', 16)} Última cópia: <strong>${last ? fmtDateTime(last) : 'nunca'}</strong>${stale ? ' — recomendado exportar uma vez por mês e guardar no OneDrive do laboratório.' : ''}</div>
      <div class="flex-row wrap">
        <button class="btn dark" onclick="exportBackup();renderAdmin()">${icon('download', 16)} Exportar cópia (.json)</button>
        <label class="btn">${icon('upload', 16)} Restaurar cópia<input type="file" accept="application/json,.json" hidden onchange="restoreBackup(event)"></label>
      </div>
      <p class="small muted mt-4">A restauração repõe equipamentos, reservas, estoque e configurações. As contas de usuário não são alteradas.</p>
    </div>`)}`;
}
async function restoreBackup(e) {
  const file = e.target.files[0]; if (!file) return;
  const ans = await askConfirm({ title: 'Restaurar cópia', body: `Equipamentos, reservas, estoque e configurações serão <strong>substituídos</strong> pelo conteúdo de <strong>${escapeHtml(file.name)}</strong> para todos os usuários.`, okLabel: 'Restaurar', danger: true });
  if (!ans) return;
  importBackupFile(file, ok => { if (ok) { toast('Backup restaurado.', 'success'); refreshAuthUI(); if (!currentUser()) showView('auth'); else renderAdmin(); } });
}
async function purgeOldReturnPhotos() {
  const cutoff = Date.now() - 90 * 864e5;
  const list = window.db.reservations.filter(r => r.returnPhoto && (r.returnedAt || 0) < cutoff && CLOSED_STATUSES.includes(r.status));
  if (!list.length) return toast('Nenhuma foto antiga para remover.');
  const ans = await askConfirm({ title: 'Remover fotos antigas', body: `${list.length} foto(s) serão removidas (a reserva continua no histórico). Exporte um backup antes se quiser guardá-las.`, okLabel: 'Remover', danger: true });
  if (!ans) return;
  list.forEach(r => { r.returnPhoto = null; r.returnPhotoPurged = true; });
  saveDB(); toast('Fotos removidas.', 'success'); renderAdmin();
}
