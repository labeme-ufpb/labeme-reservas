/* ============================================================
   stock.js — Estoque de materiais (v11.2)
   Formato planilha: linhas/colunas, busca, filtros, ordenação por coluna
   Locais vazios: tambor, armário ou prateleira cadastrado sem material
   (empty: true, availability: 'empty')
   ============================================================ */

function isEmptySpot(item) { return !!item && (item.empty === true || item.availability === 'empty'); }
function stockLabel(item) { return isEmptySpot(item) ? 'Local vazio' : (item.name || '—'); }

let stockSearch = '';
let stockFilters = {
  availability: 'all',   // all | available | in_use | long_term
  type: 'all',           // all | <tipo específico>
  professor: 'all',      // all | <nome do professor>
  location: 'all'        // all | kind:drum|shelf|cabinet|pin | loc:<texto exato>
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
    <div class="filter-bar boxed">
      <label class="fctl grow" for="stockSearchInput"><span>Buscar</span><div class="input-icon">${icon('search',16)}<input type="search" id="stockSearchInput" placeholder="Material, local, professor…"
        value="${escapeHtml(stockSearch)}" oninput="onStockSearch(event)"></div></label>

      <label class="fctl" for="stAvailF"><span>Disponibilidade</span><select id="stAvailF" onchange="setStockAvailability(this.value)">
        <option value="all" ${stockFilters.availability==='all'?'selected':''}>Toda disponibilidade</option>
        <option value="available" ${stockFilters.availability==='available'?'selected':''}>Disponíveis</option>
        <option value="in_use" ${stockFilters.availability==='in_use'?'selected':''}>Em uso</option>
        <option value="long_term" ${stockFilters.availability==='long_term'?'selected':''}>Estoque longo prazo</option>
        <option value="empty" ${stockFilters.availability==='empty'?'selected':''}>Locais vazios (${(window.db.stock || []).filter(isEmptySpot).length})</option>
      </select></label>

      <label class="fctl" for="stTypeF"><span>Tipo</span><select id="stTypeF" onchange="setStockType(this.value)">
        <option value="all" ${stockFilters.type==='all'?'selected':''}>Todos os tipos</option>
        ${allTypes.map(t => `<option value="${escapeHtml(t)}" ${stockFilters.type===t?'selected':''}>${escapeHtml(t)}</option>`).join('')}
      </select></label>

      <label class="fctl" for="stLocF"><span>Localização</span><select id="stLocF" onchange="setStockLocation(this.value)">
        ${stockLocationOptions()}
      </select></label>

      <label class="fctl" for="stProfF"><span>Professor</span><select id="stProfF" onchange="setStockProfessor(this.value)">
        <option value="all" ${stockFilters.professor==='all'?'selected':''}>Todos os professores</option>
        ${allProfessors.map(p => `<option value="${escapeHtml(p)}" ${stockFilters.professor===p?'selected':''}>${escapeHtml(p)}</option>`).join('')}
      </select></label>

      ${(stockSearch || stockFilters.availability !== 'all' || stockFilters.type !== 'all' || stockFilters.professor !== 'all' || stockFilters.location !== 'all')
        ? `<button class="btn ghost fctl-btn" onclick="clearStockFilters()">Limpar filtros</button>` : ''}

      <div class="fctl-actions">
        ${isAdmin() ? `<button class="btn fctl-btn" onclick="exportStockCSV()">${icon('download',16)} CSV</button>` : ''}
        ${canManage ? `<button class="btn fctl-btn" onclick="openStockModal(null, true)">${icon('cabinet',16)} Local vazio</button>
        <button class="btn dark fctl-btn" onclick="openStockModal()">${icon('plus',16)} Cadastrar material</button>` : ''}
      </div>
    </div>

    <div style="margin-bottom:10px;font-size:13px;color:var(--ink-500);">
      Mostrando <strong>${filtered.length}</strong> de ${(window.db.stock||[]).length} registros
      ${(window.db.stock || []).some(isEmptySpot) ? ` · <strong>${(window.db.stock || []).filter(isEmptySpot).length}</strong> local(is) vazio(s)` : ''}
    </div>

    ${filtered.length === 0 ? `
      <div class="panel"><div class="empty">
        ${icon('box',28)}
        ${(window.db.stock||[]).length === 0
          ? `Nenhum material cadastrado ainda.${canManage ? '<br><button class="btn dark mt-4" onclick="openStockModal()">Cadastrar primeiro material</button>' : ''}`
          : 'Nenhum material corresponde aos filtros aplicados.'}
      </div></div>
    ` : `
      <div class="panel stock-table-panel">
        <div class="panel-body table-wrap">
          <table class="data-table stock-table">
            <thead>
              <tr>
                <th style="width:60px;">Foto</th>
                ${sortableHeader('name', 'Nome')}
                ${sortableHeader('type', 'Tipo')}
                ${sortableHeader('location', 'Localização')}
                ${sortableHeader('quantity', 'Quantidade')}
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
      <div class="stock-cards">${filtered.map(renderStockCard).join('')}</div>
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

/* Celular: cada material vira um cartão clicável (a tabela fica para o computador) */
function renderStockCard(item) {
  const img = safeImg(item.photo);
  const qty = item.quantity ? `${item.quantity}${item.unit ? ' ' + item.unit : ''}` : '';
  const empty = isEmptySpot(item);
  return `<button class="stock-card-m ${empty ? 'is-empty' : ''}" onclick="showStockDetail('${item.id}')">
    ${img ? `<img src="${img}" alt="" loading="lazy">` : `<span class="stock-card-ph">${icon(empty ? storageKind(item.location).icon : 'box', 22)}</span>`}
    <span class="stock-card-main">
      <strong>${escapeHtml(stockLabel(item))}</strong>
      ${item.type ? `<span class="small muted">${escapeHtml(item.type)}</span>` : ''}
      ${storageChip(item.location)}
      ${item.professorName || item.advisee ? `<span class="small muted">${escapeHtml([item.professorName, item.advisee].filter(Boolean).join(' → '))}</span>` : ''}
      <span class="stock-card-foot">${qty ? `<span class="stock-qty">${escapeHtml(qty)}</span>` : ''}<span class="pill ${STOCK_AVAIL_CLASS[item.availability] || 'auto'}">${escapeHtml(STOCK_AVAILABILITY[item.availability] || '')}</span></span>
    </span>
    ${icon('arrowRight', 18, 'stock-card-chev')}
  </button>`;
}

function renderStockRow(item, canManage) {
  const photoHtml = safeImg(item.photo)
    ? `<img src="${safeImg(item.photo)}" alt="" style="width:42px;height:42px;object-fit:cover;border-radius:4px;border:1px solid var(--line-200);">`
    : `<div style="width:42px;height:42px;background:var(--paper-warm);border:1px solid var(--line-200);border-radius:4px;display:grid;place-items:center;color:var(--line-300);font-size:16px;">⊟</div>`;
  const availClass = STOCK_AVAIL_CLASS[item.availability] || 'auto';
  const availLabel = STOCK_AVAILABILITY[item.availability] || item.availability;
  const qtyText = item.quantity ? `${item.quantity}${item.unit?' '+item.unit:''}` : '—';
  const dateText = item.addedAt ? new Date(item.addedAt).toLocaleDateString('pt-BR', {day:'2-digit',month:'2-digit',year:'2-digit'}) : '—';

  return `<tr class="${isEmptySpot(item) ? 'stock-row-empty' : ''}" style="cursor:pointer;" onclick="showStockDetail('${item.id}')">
    <td data-label="">${photoHtml}</td>
    <td data-label="Nome"><strong style="color:var(--ink-900);">${escapeHtml(stockLabel(item))}</strong></td>
    <td data-label="Tipo">${escapeHtml(item.type || '—')}</td>
    <td data-label="Localização">${item.location ? storageChip(item.location) : '—'}</td>
    <td data-label="Quantidade" class="nowrap" style="font-variant-numeric: tabular-nums;">${qtyText}</td>
    <td data-label="Professor">${escapeHtml(item.professorName || '—')}</td>
    <td data-label="Orientando">${escapeHtml(item.advisee || '—')}</td>
    <td data-label="Disponibilidade"><span class="pill ${availClass}">${availLabel}</span></td>
    <td data-label="Cadastrado em" style="color:var(--ink-500);font-size:13px;font-variant-numeric: tabular-nums;">${dateText}</td>
    <td data-label="" onclick="event.stopPropagation()">
      <div class="row-actions">
        <button class="icon-btn" onclick="showStockDetail('${item.id}')" title="Ver" aria-label="Ver">${icon('eye',16)}</button>
        ${canManage ? `<button class="icon-btn" onclick="openStockModal('${item.id}')" title="Editar" aria-label="Editar">${icon('edit',16)}</button>
        <button class="icon-btn danger" onclick="deleteStock('${item.id}')" title="Excluir" aria-label="Excluir">${icon('trash',16)}</button>` : ''}
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
    if (stockFilters.location !== 'all') {
      const f = stockFilters.location;
      if (f.startsWith('kind:') && storageKind(item.location).icon !== f.slice(5)) return false;
      if (f.startsWith('loc:') && (item.location || '') !== f.slice(4)) return false;
    }
    if (term) {
      const haystack = [
        item.name, item.type, item.location,
        item.professorName, item.advisee, item.notes, isEmptySpot(item) ? 'local vazio' : ''
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
function setStockLocation(v) { stockFilters.location = v; renderStock(); }
/* Filtro de localização: primeiro por tipo (tambores, prateleiras, armários), depois cada local cadastrado */
function stockLocationOptions() {
  const f = stockFilters.location;
  const locs = [...new Set((window.db.stock || []).map(s => s.location).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
  const kinds = [['drum', 'Todos os tambores'], ['shelf', 'Todas as prateleiras'], ['cabinet', 'Armários e caixas'], ['pin', 'Outros locais']]
    .filter(([k]) => locs.some(l => storageKind(l).icon === k));
  const o = (v, label) => `<option value="${escapeHtml(v)}" ${f === v ? 'selected' : ''}>${escapeHtml(label)}</option>`;
  return o('all', 'Todos os locais') + kinds.map(([k, l]) => o('kind:' + k, l)).join('')
    + `<option disabled>──────────</option>` + locs.map(l => o('loc:' + l, l)).join('');
}
function clearStockFilters() {
  stockSearch = '';
  stockFilters = { availability: 'all', type: 'all', professor: 'all', location: 'all' };
  renderStock();
}

const onStockSearch = debounce(e => {
  stockSearch = e.target.value;
  const cursorPos = e.target.selectionStart;
  renderStock();
  const input = document.getElementById('stockSearchInput');
  if (input) { input.focus(); try { input.setSelectionRange(cursorPos, cursorPos); } catch (_) {} }
}, 180);

function exportStockCSV() {
  if (!isAdmin()) return;
  const rows = [['Material','Tipo','Localização','Quantidade','Unidade','Professor responsável','Orientando','Disponibilidade','Observações','Cadastrado em']];
  filteredStock().forEach(i => rows.push([stockLabel(i), i.type, i.location, i.quantity, i.unit, i.professorName, i.advisee, STOCK_AVAILABILITY[i.availability], i.notes, i.addedAt ? fmtDateTime(i.addedAt) : '']));
  downloadFile(`labeme-estoque-${todayISO()}.csv`, toCSV(rows), 'text/csv');
}

function showStockDetail(id) {
  const item = getStockItem(id);
  if (!item) return;
  const addedBy = getUser(item.addedBy);
  const addedDate = item.addedAt ? fmtDateTime(item.addedAt) : '—';

  const html = `
    <div class="modal-head">
      <div>
        <div class="modal-title">${escapeHtml(isEmptySpot(item) ? `${item.location} — vazio` : item.name)}</div>
        <div class="modal-sub">Cadastrado por ${escapeHtml(addedBy?.name || 'usuário removido')} em ${addedDate}</div>
      </div>
      <button class="modal-close" onclick="closeModal()" aria-label="Fechar">${icon('x')}</button>
    </div>
    <div class="modal-body">
      ${safeImg(item.photo) ? `<img src="${safeImg(item.photo)}" alt="" style="width:100%;max-height:300px;object-fit:contain;border-radius:6px;background:var(--paper-warm);margin-bottom:16px;">` : ''}
      <dl class="res-meta">
        <div><dt>Tipo</dt><dd>${escapeHtml(item.type || '—')}</dd></div>
        <div><dt>Localização</dt><dd>${item.location ? storageChip(item.location) : '—'}</dd></div>
        <div><dt>Disponibilidade</dt><dd><span class="pill ${STOCK_AVAIL_CLASS[item.availability]||'auto'}">${STOCK_AVAILABILITY[item.availability]||item.availability}</span></dd></div>
        <div><dt>Quantidade</dt><dd>${item.quantity ? item.quantity + ' ' + (item.unit||'') : '—'}</dd></div>
        <div><dt>Professor responsável</dt><dd>${escapeHtml(item.professorName || '—')}</dd></div>
        <div><dt>Orientando usando</dt><dd>${escapeHtml(item.advisee || '—')}</dd></div>
      </dl>
      ${item.notes ? `<div class="field"><label>Observações</label><div style="padding:10px;background:var(--paper-warm);border-radius:6px;font-size:14px;">${escapeHtml(item.notes)}</div></div>` : ''}
    </div>
    <div class="modal-foot">
      ${canManageStock() ? `<button class="btn" onclick="closeModal();openStockModal('${item.id}')">${isEmptySpot(item) ? 'Guardar material aqui' : 'Editar'}</button>` : ''}
      <button class="btn" onclick="closeModal()">Fechar</button>
    </div>
  `;
  openModal(html);
}

function openStockModal(id, asEmpty = false) {
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
      <div><div class="modal-title">${id ? 'Editar registro do estoque' : 'Cadastrar no estoque'}</div></div>
      <button class="modal-close" onclick="closeModal()" aria-label="Fechar">${icon('x')}</button>
    </div>
    <div class="modal-body">
      <div class="seg stock-kind-seg" role="group" aria-label="O que está sendo cadastrado">
        <button type="button" id="stKindMaterial" onclick="setStockKind(false)">${icon('box', 16)} Material</button>
        <button type="button" id="stKindEmpty" onclick="setStockKind(true)">${icon('cabinet', 16)} Local vazio</button>
      </div>
      <div class="info-box" id="stEmptyInfo" hidden>Registre um tambor, armário ou prateleira que está <strong>vazio</strong> e disponível para guardar material. Quando algo for guardado nele, abra este registro e troque para <strong>Material</strong>.</div>
      <div class="field">
        <label id="stPhotoLabelText">Foto do material</label>
        <label class="file-upload ${item.photo?'has-file':''}" id="stockPhotoLabel">
          <input type="file" id="stockPhotoInput" accept="image/*" onchange="onStockPhotoChange(event)">
          <div id="stockPhotoText">${item.photo ? '✓ Foto carregada — clique para trocar' : '📷 Clique para adicionar uma foto'}</div>
        </label>
        <img id="stockPhotoPreview" class="file-preview" src="${safeImg(item.photo)}" style="${item.photo?'':'display:none;'}" alt="Prévia">
      </div>
      <div class="field">
        <label for="stLocation">Localização <span class="req">*</span></label>
        <input type="text" id="stLocation" list="stLocList" value="${escapeHtml(item.location||'')}" placeholder="Ex.: Tambor 03 / Prateleira A2 / Armário 1">
        <datalist id="stLocList">${[...new Set((window.db.stock || []).map(s => s.location).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true })).map(l => `<option value="${escapeHtml(l)}">`).join('')}</datalist>
      </div>
      <div class="st-material-only">
      <div class="field">
        <label>Nome do material <span class="req">*</span></label>
        <input type="text" id="stName" value="${escapeHtml(isEmptySpot(item) ? '' : item.name)}" placeholder="Ex.: Cimento CP II-E-32">
      </div>
      <div class="field">
        <label>Tipo de material</label>
        <input type="text" id="stType" value="${escapeHtml(item.type||'')}" placeholder="Ex.: Aglomerante, agregado, aditivo...">
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
  setStockKind(id ? isEmptySpot(item) : asEmpty);

  if (item.advisee && !students.find(s => s.name === item.advisee)) {
    document.getElementById('stAdvisee').value = '__custom__';
  }
}

function setStockKind(empty) {
  window._stockEmpty = !!empty;
  document.getElementById('stKindMaterial')?.classList.toggle('active', !empty);
  document.getElementById('stKindEmpty')?.classList.toggle('active', !!empty);
  document.querySelectorAll('.st-material-only').forEach(el => { el.hidden = !!empty; });
  const info = document.getElementById('stEmptyInfo'); if (info) info.hidden = !empty;
  const lbl = document.getElementById('stPhotoLabelText'); if (lbl) lbl.textContent = empty ? 'Foto do local (opcional)' : 'Foto do material';
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
  fileToDataURL(file, 900, 0.78).then(dataUrl => {
    window._stockPhotoData = dataUrl;
    document.getElementById('stockPhotoPreview').src = dataUrl;
    document.getElementById('stockPhotoPreview').style.display = 'block';
    document.getElementById('stockPhotoText').textContent = '✓ Foto carregada — clique para trocar';
    document.getElementById('stockPhotoLabel').classList.add('has-file');
  }).catch(err => toast(err.message, 'error'));
}

async function saveStock(id) {
  const u = currentUser();
  if (!u || !canManageStock()) return toast('Sem permissão.', 'error');

  const empty = !!window._stockEmpty;
  const name = document.getElementById('stName').value.trim();
  const location = document.getElementById('stLocation').value.trim();
  if (!location) return toast('Informe a localização.', 'error');
  if (!empty && !name) return toast('Informe o nome do material.', 'error');
  const sameLoc = s => s.id !== id && (s.location || '').trim().toLowerCase() === location.toLowerCase();

  if (empty) {
    const busy = (window.db.stock || []).filter(s => sameLoc(s) && !isEmptySpot(s));
    if (busy.length && !(await askConfirm({ title: 'Local com material', body: `Ainda há ${busy.length} material(is) registrado(s) em <strong>${escapeHtml(location)}</strong>: ${busy.map(b => escapeHtml(b.name)).join(', ')}. Marcar mesmo assim como vazio? (Os registros desses materiais continuam; edite-os se foram retirados.)`, okLabel: 'Marcar como vazio' }))) return;
    if ((window.db.stock || []).some(s => sameLoc(s) && isEmptySpot(s))) return toast(`${location} já está registrado como vazio.`, 'warn');
    const data = { empty: true, name: '', type: '', location, professorId: '', professorName: '', advisee: '', availability: 'empty',
      quantity: null, unit: '', notes: document.getElementById('stNotes').value.trim(), photo: window._stockPhotoData || null };
    if (id) Object.assign(getStockItem(id), data);
    else window.db.stock.push({ id: uid('stk'), ...data, addedBy: u.id, addedAt: Date.now() });
    saveDB();
    window._stockPhotoData = null;
    closeModal();
    toast(`${location} registrado como vazio.`, 'success');
    return renderStock();
  }

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
    empty: false,
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

  // Guardou material num local que estava marcado como vazio: a marcação sai sozinha
  const freed = (window.db.stock || []).filter(s => sameLoc(s) && isEmptySpot(s));
  if (freed.length) window.db.stock = window.db.stock.filter(s => !freed.includes(s));

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
  toast((id ? 'Material atualizado.' : 'Material cadastrado.') + (freed.length ? ` ${location} deixou de constar como vazio.` : ''), 'success');
  renderStock();
}

async function deleteStock(id) {
  if (!canManageStock()) return;
  const item = getStockItem(id);
  const ans = await askConfirm({ title: isEmptySpot(item) ? 'Excluir local vazio' : 'Excluir material', body: `Excluir <strong>${escapeHtml(isEmptySpot(item) ? item.location + ' (vazio)' : item?.name || '')}</strong> do estoque?`, okLabel: 'Excluir', danger: true });
  if (!ans) return;
  window.db.stock = window.db.stock.filter(s => s.id !== id);
  saveDB();
  toast('Material removido.', 'warn');
  renderStock();
}

