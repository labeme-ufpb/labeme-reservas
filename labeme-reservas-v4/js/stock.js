/* ============================================================
   stock.js — Estoque de materiais (v4)
   Formato planilha: linhas/colunas, busca, filtros, ordenação por coluna
   ============================================================ */

let stockSearch = '';
let stockFilters = {
  availability: 'all',   // all | available | in_use | long_term
  type: 'all',           // all | <tipo específico>
  professor: 'all'       // all | <id professor>
};
let stockSort = { col: 'addedAt', dir: 'desc' };

function canManageStock() {
  const u = currentUser();
  return u && (u.role === 'admin' || u.role === 'technician');
}

function renderStock() {
  const u = currentUser();
  if (!u) { showView('auth'); return; }

  // Coleta valores únicos para os filtros
  const allTypes = [...new Set((window.db.stock || []).map(s => s.type).filter(Boolean))].sort();
  const allProfessors = [...new Set(
    (window.db.stock || []).map(s => s.professorName).filter(Boolean)
  )].sort();

  const filtered = filteredStock();
  const canManage = canManageStock();

  const mount = document.getElementById('stockContent');
  mount.innerHTML = `
    <div style="background:white;border:1px solid var(--line-200);border-radius:var(--radius-md);padding:14px 18px;margin-bottom:14px;display:flex;gap:12px;flex-wrap:wrap;align-items:center;">
      <input type="text" id="stockSearchInput" placeholder="🔍 Buscar por nome, tipo, localização, professor..."
        value="${escapeHtml(stockSearch)}"
        oninput="onStockSearch(event)"
        style="flex:1;min-width:240px;padding:9px 12px;border:1px solid var(--line-200);border-radius:6px;font-family:inherit;font-size:14px;outline:none;">

      <select onchange="setStockAvailability(this.value)" style="padding:9px 12px;border:1px solid var(--line-200);border-radius:6px;font-family:inherit;font-size:13px;background:white;">
        <option value="all" ${stockFilters.availability==='all'?'selected':''}>Toda disponibilidade</option>
        <option value="available" ${stockFilters.availability==='available'?'selected':''}>Disponíveis</option>
        <option value="in_use" ${stockFilters.availability==='in_use'?'selected':''}>Em uso</option>
        <option value="long_term" ${stockFilters.availability==='long_term'?'selected':''}>Estoque longo prazo</option>
      </select>

      <select onchange="setStockType(this.value)" style="padding:9px 12px;border:1px solid var(--line-200);border-radius:6px;font-family:inherit;font-size:13px;background:white;">
        <option value="all" ${stockFilters.type==='all'?'selected':''}>Todos os tipos</option>
        ${allTypes.map(t => `<option value="${escapeHtml(t)}" ${stockFilters.type===t?'selected':''}>${escapeHtml(t)}</option>`).join('')}
      </select>

      <select onchange="setStockProfessor(this.value)" style="padding:9px 12px;border:1px solid var(--line-200);border-radius:6px;font-family:inherit;font-size:13px;background:white;">
        <option value="all" ${stockFilters.professor==='all'?'selected':''}>Todos os professores</option>
        ${allProfessors.map(p => `<option value="${escapeHtml(p)}" ${stockFilters.professor===p?'selected':''}>${escapeHtml(p)}</option>`).join('')}
      </select>

      ${(stockSearch || stockFilters.availability !== 'all' || stockFilters.type !== 'all' || stockFilters.professor !== 'all')
        ? `<button class="btn" onclick="clearStockFilters()" style="font-size:13px;padding:7px 12px;">Limpar filtros</button>` : ''}

      ${canManage ? `<button class="btn dark" onclick="openStockModal()" style="margin-left:auto;">+ Cadastrar material</button>` : ''}
    </div>

    <div style="margin-bottom:10px;font-size:13px;color:var(--ink-500);">
      Mostrando <strong>${filtered.length}</strong> de ${(window.db.stock||[]).length} materiais
    </div>

    ${filtered.length === 0 ? `
      <div class="panel"><div class="empty">
        <div class="empty-icon">⊟</div>
        ${(window.db.stock||[]).length === 0
          ? `Nenhum material cadastrado ainda.${canManage ? '<br><button class="btn dark mt-4" onclick="openStockModal()">Cadastrar primeiro material</button>' : ''}`
          : 'Nenhum material corresponde aos filtros aplicados.'}
      </div></div>
    ` : `
      <div class="panel">
        <div class="panel-body">
          <table class="stock-table">
            <thead>
              <tr>
                <th style="width:60px;">Foto</th>
                ${sortableHeader('name', 'Nome')}
                ${sortableHeader('type', 'Tipo')}
                ${sortableHeader('location', 'Localização')}
                ${sortableHeader('quantity', 'Qtd')}
                ${sortableHeader('professorName', 'Professor')}
                ${sortableHeader('advisee', 'Orientando')}
                ${sortableHeader('availability', 'Disponibilidade')}
                ${sortableHeader('addedAt', 'Cadastrado em')}
                <th style="width:120px;">Ações</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.map(item => renderStockRow(item, canManage)).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `}
  `;
}

function sortableHeader(col, label) {
  const isActive = stockSort.col === col;
  const arrow = isActive ? (stockSort.dir === 'asc' ? '↑' : '↓') : '';
  const color = isActive ? 'var(--labeme-navy)' : 'var(--ink-500)';
  return `<th onclick="setStockSort('${col}')" style="cursor:pointer;user-select:none;color:${color};">
    ${label} <span style="font-weight:700;">${arrow}</span>
  </th>`;
}

function renderStockRow(item, canManage) {
  const photoHtml = item.photo
    ? `<img src="${item.photo}" style="width:42px;height:42px;object-fit:cover;border-radius:4px;border:1px solid var(--line-200);">`
    : `<div style="width:42px;height:42px;background:var(--paper-warm);border:1px solid var(--line-200);border-radius:4px;display:grid;place-items:center;color:var(--line-300);font-size:16px;">⊟</div>`;
  const availClass = STOCK_AVAIL_CLASS[item.availability] || 'auto';
  const availLabel = STOCK_AVAILABILITY[item.availability] || item.availability;
  const qtyText = item.quantity ? `${item.quantity}${item.unit?' '+item.unit:''}` : '—';
  const dateText = item.addedAt ? new Date(item.addedAt).toLocaleDateString('pt-BR', {day:'2-digit',month:'2-digit',year:'2-digit'}) : '—';

  return `<tr style="cursor:pointer;" onclick="showStockDetail('${item.id}')">
    <td data-label="">${photoHtml}</td>
    <td data-label="Nome"><strong style="color:var(--ink-900);">${escapeHtml(item.name)}</strong></td>
    <td data-label="Tipo">${escapeHtml(item.type || '—')}</td>
    <td data-label="Localização">📍 ${escapeHtml(item.location || '—')}</td>
    <td data-label="Quantidade" style="font-variant-numeric: tabular-nums;">${qtyText}</td>
    <td data-label="Professor">${escapeHtml(item.professorName || '—')}</td>
    <td data-label="Orientando">${escapeHtml(item.advisee || '—')}</td>
    <td data-label="Disponibilidade"><span class="pill ${availClass}">${availLabel}</span></td>
    <td data-label="Cadastrado em" style="color:var(--ink-500);font-size:13px;font-variant-numeric: tabular-nums;">${dateText}</td>
    <td data-label="" onclick="event.stopPropagation()">
      <div class="row-actions">
        <button class="icon-btn" onclick="showStockDetail('${item.id}')" title="Ver">👁</button>
        ${canManage ? `<button class="icon-btn" onclick="openStockModal('${item.id}')" title="Editar">✎</button>
        <button class="icon-btn danger" onclick="deleteStock('${item.id}')" title="Excluir">🗑</button>` : ''}
      </div>
    </td>
  </tr>`;
}

function filteredStock() {
  const term = stockSearch.toLowerCase().trim();
  let result = (window.db.stock || []).filter(item => {
    if (stockFilters.availability !== 'all' && item.availability !== stockFilters.availability) return false;
    if (stockFilters.type !== 'all' && item.type !== stockFilters.type) return false;
    if (stockFilters.professor !== 'all' && item.professorName !== stockFilters.professor) return false;
    if (term) {
      const haystack = [
        item.name, item.type, item.location,
        item.professorName, item.advisee, item.notes
      ].filter(Boolean).join(' ').toLowerCase();
      if (!haystack.includes(term)) return false;
    }
    return true;
  });

  // Ordenação
  result.sort((a, b) => {
    let av = a[stockSort.col], bv = b[stockSort.col];
    // Tratar null/undefined como vazio
    av = av == null ? '' : av;
    bv = bv == null ? '' : bv;
    let cmp;
    if (typeof av === 'number' && typeof bv === 'number') {
      cmp = av - bv;
    } else {
      cmp = String(av).localeCompare(String(bv), 'pt-BR', { numeric: true, sensitivity: 'base' });
    }
    return stockSort.dir === 'asc' ? cmp : -cmp;
  });

  return result;
}

function setStockSort(col) {
  if (stockSort.col === col) {
    stockSort.dir = stockSort.dir === 'asc' ? 'desc' : 'asc';
  } else {
    stockSort.col = col;
    stockSort.dir = 'asc';
  }
  renderStock();
}

function setStockAvailability(v) { stockFilters.availability = v; renderStock(); }
function setStockType(v) { stockFilters.type = v; renderStock(); }
function setStockProfessor(v) { stockFilters.professor = v; renderStock(); }
function clearStockFilters() {
  stockSearch = '';
  stockFilters = { availability: 'all', type: 'all', professor: 'all' };
  renderStock();
}

function onStockSearch(e) {
  stockSearch = e.target.value;
  // Re-render mantendo foco no campo
  const cursorPos = e.target.selectionStart;
  renderStock();
  setTimeout(() => {
    const input = document.getElementById('stockSearchInput');
    if (input) {
      input.focus();
      input.setSelectionRange(cursorPos, cursorPos);
    }
  }, 0);
}

function showStockDetail(id) {
  const item = getStockItem(id);
  if (!item) return;
  const addedBy = getUser(item.addedBy);
  const addedDate = item.addedAt ? fmtDateTime(item.addedAt) : '—';

  const html = `
    <div class="modal-head">
      <div>
        <div class="modal-title">${escapeHtml(item.name)}</div>
        <div class="modal-sub">Cadastrado por ${escapeHtml(addedBy?.name || 'usuário removido')} em ${addedDate}</div>
      </div>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      ${item.photo ? `<img src="${item.photo}" style="width:100%;max-height:300px;object-fit:contain;border-radius:6px;background:var(--paper-warm);margin-bottom:16px;">` : ''}
      <dl class="res-meta">
        <div><dt>Tipo</dt><dd>${escapeHtml(item.type || '—')}</dd></div>
        <div><dt>Localização</dt><dd>📍 ${escapeHtml(item.location || '—')}</dd></div>
        <div><dt>Disponibilidade</dt><dd><span class="pill ${STOCK_AVAIL_CLASS[item.availability]||'auto'}">${STOCK_AVAILABILITY[item.availability]||item.availability}</span></dd></div>
        <div><dt>Quantidade</dt><dd>${item.quantity ? item.quantity + ' ' + (item.unit||'') : '—'}</dd></div>
        <div><dt>Professor responsável</dt><dd>${escapeHtml(item.professorName || '—')}</dd></div>
        <div><dt>Orientando usando</dt><dd>${escapeHtml(item.advisee || '—')}</dd></div>
      </dl>
      ${item.notes ? `<div class="field"><label>Observações</label><div style="padding:10px;background:var(--paper-warm);border-radius:6px;font-size:14px;">${escapeHtml(item.notes)}</div></div>` : ''}
    </div>
    <div class="modal-foot">
      ${canManageStock() ? `<button class="btn" onclick="closeModal();openStockModal('${item.id}')">Editar</button>` : ''}
      <button class="btn" onclick="closeModal()">Fechar</button>
    </div>
  `;
  openModal(html);
}

function openStockModal(id) {
  if (!canManageStock()) {
    return toast('Apenas técnicos e coordenação podem cadastrar materiais.', 'warn');
  }
  const item = id ? getStockItem(id) : {
    name: '', type: '', location: '',
    professorId: '', professorName: '',
    advisee: '',
    availability: 'available',
    quantity: '', unit: '',
    photo: null, notes: ''
  };

  const professors = window.db.users.filter(u =>
    ['prof_depto', 'prof_externo'].includes(u.category)
  );
  const professorOptions = professors.map(p =>
    `<option value="${p.id}|${escapeHtml(p.name)}" ${item.professorId === p.id ? 'selected' : ''}>${escapeHtml(p.name)}</option>`
  ).join('');

  const students = window.db.users.filter(u =>
    ['graduacao', 'mestrado', 'doutorado'].includes(u.category)
  );
  const studentOptions = students.map(s =>
    `<option value="${escapeHtml(s.name)}" ${item.advisee === s.name ? 'selected' : ''}>${escapeHtml(s.name)}</option>`
  ).join('');

  const unitOptions = STOCK_UNITS.map(u =>
    `<option value="${u}" ${item.unit === u ? 'selected' : ''}>${u}</option>`
  ).join('');

  const html = `
    <div class="modal-head">
      <div><div class="modal-title">${id ? 'Editar' : 'Cadastrar'} material</div></div>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="field">
        <label>Foto do material</label>
        <label class="file-upload ${item.photo?'has-file':''}" id="stockPhotoLabel">
          <input type="file" id="stockPhotoInput" accept="image/*" onchange="onStockPhotoChange(event)">
          <div id="stockPhotoText">${item.photo ? '✓ Foto carregada — clique para trocar' : '📷 Clique para adicionar uma foto'}</div>
        </label>
        <img id="stockPhotoPreview" class="file-preview" src="${item.photo||''}" style="${item.photo?'':'display:none;'}">
      </div>
      <div class="field">
        <label>Nome do material <span class="req">*</span></label>
        <input type="text" id="stName" value="${escapeHtml(item.name)}" placeholder="Ex.: Cimento CP II-E-32">
      </div>
      <div class="field-row">
        <div class="field">
          <label>Tipo de material</label>
          <input type="text" id="stType" value="${escapeHtml(item.type||'')}" placeholder="Ex.: Aglomerante, agregado, aditivo...">
        </div>
        <div class="field">
          <label>Localização <span class="req">*</span></label>
          <input type="text" id="stLocation" value="${escapeHtml(item.location||'')}" placeholder="Ex.: Tambor 03 / Prateleira A2">
        </div>
      </div>
      <div class="field-row">
        <div class="field">
          <label>Quantidade</label>
          <input type="number" id="stQty" value="${item.quantity||''}" step="any" min="0" placeholder="Ex.: 25">
        </div>
        <div class="field">
          <label>Unidade</label>
          <select id="stUnit">
            <option value="">—</option>
            ${unitOptions}
          </select>
        </div>
      </div>
      <div class="field">
        <label>Professor responsável</label>
        <select id="stProfessor" onchange="onStockProfessorChange()">
          <option value="">— Nenhum —</option>
          ${professorOptions}
          <option value="__custom__" ${item.professorId === 'custom' ? 'selected' : ''}>+ Outro (digitar manualmente)</option>
        </select>
        <input type="text" id="stProfessorCustom" placeholder="Nome do professor"
          value="${escapeHtml(item.professorId === 'custom' ? (item.professorName||'') : '')}"
          style="margin-top:8px;display:${item.professorId === 'custom' ? 'block' : 'none'};">
      </div>
      <div class="field">
        <label>Orientando que está usando</label>
        <select id="stAdvisee" onchange="onStockAdviseeChange()">
          <option value="">— Nenhum —</option>
          ${studentOptions}
          <option value="__custom__">+ Outro (digitar manualmente)</option>
        </select>
        <input type="text" id="stAdviseeCustom" placeholder="Nome do orientando"
          value="${escapeHtml(item.advisee && !students.find(s => s.name === item.advisee) ? item.advisee : '')}"
          style="margin-top:8px;display:${item.advisee && !students.find(s => s.name === item.advisee) ? 'block' : 'none'};">
      </div>
      <div class="field">
        <label>Disponibilidade <span class="req">*</span></label>
        <select id="stAvailability">
          <option value="available" ${item.availability==='available'?'selected':''}>Disponível para uso</option>
          <option value="in_use" ${item.availability==='in_use'?'selected':''}>Em uso</option>
          <option value="long_term" ${item.availability==='long_term'?'selected':''}>Estoque de longo prazo</option>
        </select>
      </div>
      <div class="field">
        <label>Observações</label>
        <textarea id="stNotes" rows="2" placeholder="Notas adicionais (validade, fornecedor, lote...)">${escapeHtml(item.notes||'')}</textarea>
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn" onclick="closeModal()">Cancelar</button>
      <button class="btn dark" onclick="saveStock('${id||''}')">Salvar</button>
    </div>
  `;
  openModal(html, true);
  window._stockPhotoData = item.photo || null;

  if (item.advisee && !students.find(s => s.name === item.advisee)) {
    document.getElementById('stAdvisee').value = '__custom__';
  }
}

function onStockProfessorChange() {
  const sel = document.getElementById('stProfessor').value;
  const custom = document.getElementById('stProfessorCustom');
  custom.style.display = sel === '__custom__' ? 'block' : 'none';
  if (sel !== '__custom__') custom.value = '';
}

function onStockAdviseeChange() {
  const sel = document.getElementById('stAdvisee').value;
  const custom = document.getElementById('stAdviseeCustom');
  custom.style.display = sel === '__custom__' ? 'block' : 'none';
  if (sel !== '__custom__') custom.value = '';
}

function onStockPhotoChange(e) {
  const file = e.target.files[0];
  if (!file) return;
  fileToDataURL(file).then(dataUrl => {
    window._stockPhotoData = dataUrl;
    document.getElementById('stockPhotoPreview').src = dataUrl;
    document.getElementById('stockPhotoPreview').style.display = 'block';
    document.getElementById('stockPhotoText').textContent = '✓ Foto carregada — clique para trocar';
    document.getElementById('stockPhotoLabel').classList.add('has-file');
  });
}

function saveStock(id) {
  const u = currentUser();
  if (!u || !canManageStock()) return toast('Sem permissão.', 'error');

  const name = document.getElementById('stName').value.trim();
  const location = document.getElementById('stLocation').value.trim();
  if (!name || !location) return toast('Nome e localização são obrigatórios.', 'error');

  const profSel = document.getElementById('stProfessor').value;
  let professorId = '', professorName = '';
  if (profSel === '__custom__') {
    professorId = 'custom';
    professorName = document.getElementById('stProfessorCustom').value.trim();
  } else if (profSel) {
    const [pid, pname] = profSel.split('|');
    professorId = pid;
    professorName = pname;
  }

  const advSel = document.getElementById('stAdvisee').value;
  let advisee = '';
  if (advSel === '__custom__') {
    advisee = document.getElementById('stAdviseeCustom').value.trim();
  } else if (advSel) {
    advisee = advSel;
  }

  const data = {
    name,
    type: document.getElementById('stType').value.trim(),
    location,
    professorId,
    professorName,
    advisee,
    availability: document.getElementById('stAvailability').value,
    quantity: document.getElementById('stQty').value ? parseFloat(document.getElementById('stQty').value) : null,
    unit: document.getElementById('stUnit').value,
    notes: document.getElementById('stNotes').value.trim(),
    photo: window._stockPhotoData || null
  };

  if (id) {
    Object.assign(getStockItem(id), data);
  } else {
    if (!window.db.stock) window.db.stock = [];
    window.db.stock.push({
      id: uid('stk'),
      ...data,
      addedBy: u.id,
      addedAt: Date.now()
    });
  }
  saveDB();
  window._stockPhotoData = null;
  closeModal();
  toast(id ? 'Material atualizado.' : 'Material cadastrado.', 'success');
  renderStock();
}

function deleteStock(id) {
  if (!canManageStock()) return;
  if (!confirm('Excluir este material do estoque?')) return;
  window.db.stock = window.db.stock.filter(s => s.id !== id);
  saveDB();
  toast('Material removido.', 'warn');
  renderStock();
}

window.canManageStock = canManageStock;
window.renderStock = renderStock;
window.setStockAvailability = setStockAvailability;
window.setStockType = setStockType;
window.setStockProfessor = setStockProfessor;
window.clearStockFilters = clearStockFilters;
window.setStockSort = setStockSort;
window.onStockSearch = onStockSearch;
window.showStockDetail = showStockDetail;
window.openStockModal = openStockModal;
window.onStockProfessorChange = onStockProfessorChange;
window.onStockAdviseeChange = onStockAdviseeChange;
window.onStockPhotoChange = onStockPhotoChange;
window.saveStock = saveStock;
window.deleteStock = deleteStock;
