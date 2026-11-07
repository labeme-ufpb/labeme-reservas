/* ============================================================
   qr.js — QR code dos equipamentos (v11.7)
   - Cada equipamento tem um link direto: …/#equip/<id>
   - Ao escanear, abre a ficha do equipamento (agenda, reservar,
     relatar problema). Sem login, entra primeiro e depois abre a ficha.
   - Etiquetas para impressão (A4) geradas no navegador
     (biblioteca qrcode-generator, MIT, em js/vendor/qrcode.js)
   ============================================================ */

function equipUrl(id) { return location.origin + location.pathname + '#equip/' + id; }
function qrSvg(text) {
  const q = qrcode(0, 'M'); q.addData(text); q.make();
  return q.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
}
/* Rota do link: "#equip/<id>" → id do equipamento (ou null) */
function equipFromHash(hash = location.hash) {
  const m = /^#equip\/([A-Za-z0-9_-]{1,64})$/.exec(hash || '');
  return m ? m[1] : null;
}
function openEquipFromLink(id) {
  if (!getResource(id)) { toast('Equipamento não encontrado (link antigo ou removido).', 'warn'); showView('resources'); return; }
  showView('resources');
  showResourceDetail(id);
}

/* ---------- Etiquetas ---------- */
let _qrSel = new Set(), _qrSearch = '';
function openQrLabelsModal(preselect = []) {
  if (!isTechnician()) return;
  _qrSel = new Set(preselect); _qrSearch = '';
  openModal(`
    <div class="modal-head"><div><div class="modal-title">Etiquetas com QR code</div>
      <div class="modal-sub">Cole a etiqueta no equipamento: ao escanear com o celular, abre a ficha para reservar ou relatar problema.</div></div>
      <button class="modal-close" onclick="closeModal()" aria-label="Fechar">${icon('x')}</button></div>
    <div class="modal-body">
      <div class="flex-row wrap" style="margin-bottom:10px;">
        <div class="input-icon grow">${icon('search', 16)}<input type="search" id="qrSearch" placeholder="Filtrar por nome, grupo ou local" oninput="_qrSearch=this.value;renderQrPick()"></div>
        <button class="btn small" onclick="qrSelectVisible(true)">Marcar visíveis</button>
        <button class="btn small" onclick="qrSelectVisible(false)">Desmarcar</button>
      </div>
      <div id="qrPick" class="qr-pick"></div>
      <div class="field" style="margin-top:12px;"><span class="label">Tamanho</span>
        <div class="seg">
          <label><input type="radio" name="qrSize" value="small" checked><span>Pequena (12 por folha)</span></label>
          <label><input type="radio" name="qrSize" value="large"><span>Grande (4 por folha)</span></label>
        </div></div>
    </div>
    <div class="modal-foot"><span class="small muted grow" id="qrCount"></span>
      <button class="btn" onclick="closeModal()">Cancelar</button>
      <button class="btn dark" onclick="printQrLabels()">${icon('download', 16)} Imprimir / salvar PDF</button></div>`, true);
  renderQrPick();
}
function qrVisibleResources() {
  const t = normalizeTxt(_qrSearch);
  return window.db.resources.filter(r => r.active && (!t || normalizeTxt([r.name, r.group, r.location, r.patrimonio].join(' ')).includes(t)))
    .sort((a, b) => (a.group || '').localeCompare(b.group || '', 'pt-BR') || a.name.localeCompare(b.name, 'pt-BR', { numeric: true }));
}
function renderQrPick() {
  const list = qrVisibleResources();
  document.getElementById('qrPick').innerHTML = list.length ? list.map(r => `<label class="qr-pick-row">
      <input type="checkbox" ${_qrSel.has(r.id) ? 'checked' : ''} onchange="this.checked?_qrSel.add('${r.id}'):_qrSel.delete('${r.id}');qrCount()">
      <span><strong>${escapeHtml(r.name)}</strong><span class="small muted">${escapeHtml([r.group, r.location, r.patrimonio && 'Pat. ' + r.patrimonio].filter(Boolean).join(' · '))}</span></span></label>`).join('')
    : '<div class="small muted">Nenhum equipamento encontrado.</div>';
  qrCount();
}
function qrSelectVisible(on) { qrVisibleResources().forEach(r => on ? _qrSel.add(r.id) : _qrSel.delete(r.id)); renderQrPick(); }
function qrCount() { const el = document.getElementById('qrCount'); if (el) el.textContent = `${_qrSel.size} selecionada(s)`; }

function printQrLabels(ids = [..._qrSel], size = document.querySelector('input[name=qrSize]:checked')?.value || 'small') {
  const list = ids.map(getResource).filter(Boolean);
  if (!list.length) return toast('Selecione pelo menos um equipamento.', 'warn');
  let area = document.getElementById('printArea');
  if (!area) { area = document.createElement('div'); area.id = 'printArea'; document.body.appendChild(area); }
  area.className = 'qr-sheet ' + size;
  area.innerHTML = list.map(r => `<div class="qr-label">
      <div class="qr-code">${qrSvg(equipUrl(r.id))}</div>
      <div class="qr-info">
        <img src="assets/labeme-logo.png" alt="LABEME" class="qr-logo">
        <div class="qr-name">${escapeHtml(r.name)}</div>
        ${r.patrimonio ? `<div class="qr-meta">Patrimônio ${escapeHtml(r.patrimonio)}</div>` : ''}
        ${r.location ? `<div class="qr-meta">${escapeHtml(r.location)}</div>` : ''}
        <div class="qr-hint">Escaneie: reservar · agenda · relatar problema</div>
      </div></div>`).join('');
  closeModal();
  document.body.classList.add('printing-labels');
  const done = () => { document.body.classList.remove('printing-labels'); area.innerHTML = ''; window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  // espera o logo carregar antes de abrir a impressão
  const logo = area.querySelector('img');
  const go = () => setTimeout(() => window.print(), 60);
  if (logo && !logo.complete) { logo.onload = logo.onerror = go; } else go();
}

/* QR de um equipamento só, na ficha (para mostrar na tela ou imprimir) */
function showEquipQr(id) {
  const r = getResource(id); if (!r) return;
  openModal(`
    <div class="modal-head"><div><div class="modal-title">QR code</div><div class="modal-sub">${escapeHtml(r.name)}</div></div>
      <button class="modal-close" onclick="closeModal()" aria-label="Fechar">${icon('x')}</button></div>
    <div class="modal-body center">
      <div class="qr-big">${qrSvg(equipUrl(r.id))}</div>
      <div class="small muted mono qr-url">${escapeHtml(equipUrl(r.id))}</div>
    </div>
    <div class="modal-foot">
      <button class="btn" onclick="showResourceDetail('${r.id}')">Voltar</button>
      <button class="btn" onclick="copyEquipLink('${r.id}')">${icon('copy', 16)} Copiar link</button>
      <button class="btn dark" onclick="printQrLabels(['${r.id}'], 'large')">${icon('download', 16)} Imprimir etiqueta</button>
    </div>`);
}
function copyEquipLink(id) {
  const url = equipUrl(id);
  (navigator.clipboard?.writeText(url) || Promise.reject()).then(() => toast('Link copiado.', 'success'), () => toast(url, 'info'));
}
