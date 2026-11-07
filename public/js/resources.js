/* ============================================================
   resources.js — Catálogo de equipamentos e espaços (v10)
   Busca, filtros por grupo e local, fotos reais,
   nº de inventário e patrimônio. Ficha detalhada do recurso.
   ============================================================ */

let catSearch = '';
let catFilters = { group: 'all', location: 'all' };

function normalizeTxt(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

const GROUP_ORDER = ['Ensaios mecânicos','Mistura, moldagem e preparo','Fornos, estufas e câmaras','Medição e caracterização','Peneiras','Moagem, britagem e beneficiamento','Corte e usinagem','Movimentação de cargas','Ferramentas e transporte'];
function groupRank(g) { const i = GROUP_ORDER.indexOf(g); return i < 0 ? 99 : i; }
function filteredCatalog() {
  const t = normalizeTxt(catSearch.trim());
  return window.db.resources.filter(r => {
    if (!r.active) return false;
    if (catFilters.group !== 'all' && (r.group || 'Outros') !== catFilters.group) return false;
    if (catFilters.location !== 'all' && r.location !== catFilters.location) return false;
    if (t && !normalizeTxt([r.name, r.model, r.group, r.location, r.description, r.patrimonio].join(' ')).includes(t)) return false;
    return true;
  }).sort((a, b) => groupRank(a.group) - groupRank(b.group) || (a.group || '').localeCompare(b.group || '', 'pt-BR') || a.name.localeCompare(b.name, 'pt-BR', { numeric: true }));
}

function renderResources() {
  const all = window.db.resources.filter(r => r.active);
  const groups = [...new Set(all.map(r => r.group || 'Outros'))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const locations = [...new Set(all.map(r => r.location).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const list = filteredCatalog();
  const anyFilter = catSearch || Object.values(catFilters).some(v => v !== 'all');

  document.getElementById('resourcesToolbar').innerHTML = `
    <div class="filter-bar">
      <label class="fctl grow" for="catSearch"><span>Buscar</span><div class="input-icon">${icon('search', 16)}<input type="search" id="catSearch" placeholder="Nome, modelo ou patrimônio" value="${escapeHtml(catSearch)}" oninput="onCatSearch(this.value)"></div></label>
      <label class="fctl" for="catGroup"><span>Grupo</span><select id="catGroup" onchange="setCatFilter('group',this.value)">
        <option value="all">Todos os grupos</option>${groups.map(g => `<option ${catFilters.group === g ? 'selected' : ''}>${escapeHtml(g)}</option>`).join('')}
      </select></label>
      <label class="fctl" for="catLoc"><span>Local</span><select id="catLoc" onchange="setCatFilter('location',this.value)">
        <option value="all">Todos os locais</option>${locations.map(l => `<option ${catFilters.location === l ? 'selected' : ''}>${escapeHtml(l)}</option>`).join('')}
      </select></label>
      ${anyFilter ? `<button class="btn ghost fctl-btn" onclick="clearCatFilters()">Limpar filtros</button>` : ''}
    </div>
    <div class="result-count">${list.length} de ${all.length} itens</div>`;

  const grid = document.getElementById('resourcesGrid');
  if (!list.length) {
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1;">${icon('search', 28)}<div>${all.length ? 'Nenhum item corresponde à busca.' : 'Nenhum recurso cadastrado.'}</div></div>`;
    return;
  }
  const today = todayISO();
  const showGroups = !catSearch && catFilters.group === 'all';
  const groupCount = {}; list.forEach(r => groupCount[r.group || 'Outros'] = (groupCount[r.group || 'Outros'] || 0) + 1);
  let lastGroup = null;
  grid.innerHTML = list.map(r => {
    const g = r.group || 'Outros';
    const head = showGroups && g !== lastGroup ? `<div class="group-head"><h2>${escapeHtml(g)}</h2><span>${groupCount[g]} ${groupCount[g] === 1 ? 'item' : 'itens'}</span></div>` : '';
    lastGroup = g;
    const img = safeImg(r.photo);
    const maintenance = r.status === 'maintenance';
    const upcoming = window.db.reservations.filter(x => x.resourceId === r.id && ['approved','in_use','pending'].includes(x.status) && resEnd(x) >= today).length;
    return head + `<article class="resource-card ${maintenance ? 'in-maintenance' : ''}">
      <button class="card-photo" onclick="showResourceDetail('${r.id}')" aria-label="Ver ficha de ${escapeHtml(r.name)}">
        ${img ? `<img src="${img}" alt="" loading="lazy">` : `<span class="card-photo-ph">${icon('box', 34)}</span>`}
        ${maintenance ? `<span class="maintenance-overlay">${icon('wrench', 14)} Em manutenção</span>` : ''}
      </button>
      <div class="card-body">
        <div class="card-tags">
          <span class="tag">${escapeHtml(r.group || RESOURCE_TYPES[r.type] || '')}</span>
          ${r.requiresTechnicianPresence ? `<span class="pill tech-required">Técnico obrig.</span>` : ''}
        </div>
        <h3>${escapeHtml(r.name)}</h3>
        ${r.model ? `<div class="card-model">${escapeHtml(r.model)}</div>` : ''}
        ${r.location ? `<div class="card-loc">${icon('pin', 14)} ${escapeHtml(r.location)}</div>` : ''}
        <div class="card-footer">
          <span>${r.totalQuantity > 1 ? r.totalQuantity + ' unidades' : RESOURCE_MODES[r.mode] || ''}</span>
          <span>${upcoming ? upcoming + ' reserva(s) futura(s)' : 'Livre'}</span>
        </div>
        ${maintenance
          ? `<button class="btn card-reserve-btn" disabled>${icon('wrench', 16)} Indisponível</button>`
          : `<button class="btn dark card-reserve-btn" onclick="openReserveModal({resourceId:'${r.id}'})">Reservar</button>`}
      </div>
    </article>`;
  }).join('');
}
const onCatSearch = debounce(v => {
  catSearch = v;
  const pos = document.getElementById('catSearch')?.selectionStart;
  renderResources();
  const el = document.getElementById('catSearch'); if (el) { el.focus(); try { el.setSelectionRange(pos, pos); } catch (_) {} }
}, 180);
function setCatFilter(k, v) { catFilters[k] = v; renderResources(); }
function clearCatFilters() { catSearch = ''; catFilters = { group: 'all', location: 'all' }; renderResources(); }

function showResourceDetail(id) {
  const r = getResource(id); if (!r) return;
  const img = safeImg(r.photo);
  const today = todayISO();
  const next = window.db.reservations.filter(x => x.resourceId === id && ACTIVE_STATUSES.includes(x.status) && resEnd(x) >= today)
    .sort((a, b) => (a.date + reservationRange(a).start).localeCompare(b.date + reservationRange(b).start)).slice(0, 6);
  const rules = [
    r.requiresTechnicianPresence && 'Presença de técnico obrigatória',
    !r.requiresTechnicianPresence && r.requiresTechnicianAssist && 'Acompanhamento técnico recomendado',
    r.requiresReturnPhoto && 'Devolução com foto obrigatória'
  ].filter(Boolean);
  openModal(`
    <div class="modal-head">
      <div><div class="modal-title">${escapeHtml(r.name)}</div><div class="modal-sub">${escapeHtml([r.model, r.group].filter(Boolean).join(' · '))}</div></div>
      <button class="modal-close" onclick="closeModal()" aria-label="Fechar">${icon('x')}</button>
    </div>
    <div class="modal-body">
      ${img ? `<img src="${img}" alt="${escapeHtml(r.name)}" class="detail-photo tall">` : ''}
      ${r.status === 'maintenance' ? `<div class="info-box warn">${icon('wrench', 16)} <strong>Em manutenção.</strong> ${escapeHtml(r.conditionNote || r.maintenanceNote || '')}</div>` : ''}
      <dl class="res-meta">
        <div><dt>Patrimônio</dt><dd class="mono">${escapeHtml(r.patrimonio || 'Sem patrimônio')}</dd></div>
        ${r.location ? `<div><dt>Local</dt><dd>${escapeHtml(r.location)}</dd></div>` : ''}
        <div><dt>Quantidade</dt><dd>${r.totalQuantity || 1}</dd></div>
        <div><dt>Reserva</dt><dd>${escapeHtml(RESOURCE_MODES[r.mode] || '')}</dd></div>
      </dl>
      ${r.description ? `<p>${escapeHtml(r.description)}</p>` : ''}
      ${rules.length ? `<ul class="rule-list">${rules.map(x => `<li>${icon('alert', 14)} ${x}</li>`).join('')}</ul>` : ''}
      <div class="field"><span class="label">Próximas reservas</span>
        ${next.length ? next.map(x => `<div class="occ-row"><span>${fmtDateShort(x.date)}</span><span class="mono">${slotText(x)}</span>${statusPill(x.status)}</div>`).join('') : '<div class="small muted">Nenhuma reserva futura.</div>'}
      </div>
    </div>
    <div class="modal-foot">
      ${isAdmin() ? `<button class="btn" onclick="openResourceModal('${r.id}')">${icon('edit', 16)} Editar</button>` : ''}
      <button class="btn" onclick="closeModal();setResourceFilter('${r.id}');showView('calendar')">${icon('calendar', 16)} Ver no calendário</button>
      ${r.status !== 'maintenance' ? `<button class="btn dark" onclick="closeModal();openReserveModal({resourceId:'${r.id}'})">Reservar</button>` : ''}
    </div>`, true);
}
