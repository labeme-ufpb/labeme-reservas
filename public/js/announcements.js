/* ============================================================
   announcements.js — Avisos gerais da coordenação (v11.6)
   - A coordenação publica um aviso (título, mensagem, prazo opcional)
   - Cada usuário vê o aviso em uma janela ao entrar no sistema
     (ou na hora, se já estiver com o sistema aberto) até clicar "Entendi"
   - O "visto" fica no perfil (users.seenAnnouncements), vale em todos os aparelhos
   - Avisos ativos também ficam listados no topo da aba Mensagens
   ============================================================ */

function activeAnnouncements() {
  const today = todayISO();
  return (window.db.announcements || [])
    .filter(a => a.active !== false && (!a.expiresAt || a.expiresAt >= today))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}
function unseenAnnouncements(u = currentUser()) {
  if (!u) return [];
  const seen = new Set(Array.isArray(u.seenAnnouncements) ? u.seenAnnouncements : []);
  return activeAnnouncements().filter(a => !seen.has(a.id)).reverse();   // mais antigo primeiro
}
const _annShown = new Set();   // já exibidos nesta sessão (fechou sem "Entendi" → volta no próximo login)
function modalIsOpen() { return document.getElementById('modalOverlay')?.classList.contains('show'); }

/* Mostra os avisos ainda não vistos (chamado ao entrar e quando chegam dados novos) */
function checkAnnouncements() {
  if (!currentUser() || modalIsOpen() || currentView === 'auth') return;
  const list = unseenAnnouncements().filter(a => !_annShown.has(a.id));
  if (list.length) showAnnouncementPopup(list.map(a => a.id), 0);
}

function announcementBody(a) {
  return `<div class="ann-body">${escapeHtml(a.body).replace(/\n/g, '<br>')}</div>
    <div class="ann-meta">${icon('user', 14)} ${escapeHtml(userName(a.createdBy))} · ${fmtDateTime(a.createdAt)}${a.expiresAt ? ` · válido até ${fmtDate(a.expiresAt)}` : ''}</div>`;
}

function showAnnouncementPopup(ids, i) {
  const a = (window.db.announcements || []).find(x => x.id === ids[i]);
  if (!a) return markAnnouncementsSeen(ids);
  const last = i >= ids.length - 1;
  ids.forEach(id => _annShown.add(id));
  openModal(`
    <div class="modal-head ann-head ${a.level === 'important' ? 'important' : ''}">
      <div class="ann-icon">${icon('megaphone', 22)}</div>
      <div><div class="modal-title">${escapeHtml(a.title)}</div>
      <div class="modal-sub">Aviso da coordenação${ids.length > 1 ? ` · ${i + 1} de ${ids.length}` : ''}${a.level === 'important' ? ' · <strong>Importante</strong>' : ''}</div></div>
    </div>
    <div class="modal-body">${announcementBody(a)}</div>
    <div class="modal-foot">
      ${last ? `<button class="btn dark" onclick="markAnnouncementsSeen(${escapeHtml(JSON.stringify(ids))})">${icon('check', 16)} Entendi</button>`
             : `<button class="btn dark" onclick="showAnnouncementPopup(${escapeHtml(JSON.stringify(ids))}, ${i + 1})">Próximo aviso</button>`}
    </div>`);
}

function markAnnouncementsSeen(ids) {
  const u = currentUser();
  closeModal();
  if (!u) return;
  const existing = new Set((window.db.announcements || []).map(a => a.id));
  // guarda só avisos que ainda existem (lista não cresce sem limite)
  const seen = new Set((Array.isArray(u.seenAnnouncements) ? u.seenAnnouncements : []).filter(id => existing.has(id)));
  ids.forEach(id => seen.add(id));
  u.seenAnnouncements = [...seen].slice(-300);
  saveDB();
  setTimeout(() => {
    checkAnnouncements();   // se chegou outro aviso enquanto lia
    if (!modalIsOpen() && !u.avatar && !u.profileReminderShown) showProfilePhotoReminder();
  }, 300);
}

/* Lista no topo da aba Mensagens (para reler) */
function renderAnnouncementsStrip() {
  const list = activeAnnouncements();
  if (!list.length) return '';
  return `<details class="ann-strip" ${list.some(a => a.level === 'important') ? 'open' : ''}>
    <summary>${icon('megaphone', 16)} Avisos da coordenação <span class="count">${list.length}</span></summary>
    ${list.map(a => `<div class="ann-item ${a.level === 'important' ? 'important' : ''}"><strong>${escapeHtml(a.title)}</strong>${announcementBody(a)}</div>`).join('')}
  </details>`;
}

/* ---------------- Coordenação → Avisos ---------------- */
function adminAnnouncements() {
  const all = (window.db.announcements || []).slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const activeIds = new Set(activeAnnouncements().map(a => a.id));
  const people = window.db.users.filter(u => u.active !== false);
  const seenBy = id => people.filter(u => Array.isArray(u.seenAnnouncements) && u.seenAnnouncements.includes(id)).length;
  return panel('Novo aviso geral', 'Aparece em uma janela para todos os usuários ao entrarem no sistema, até clicarem em "Entendi".', `
    <div class="panel-body">
      <div class="field"><label for="annTitle">Título <span class="req">*</span></label>
        <input type="text" id="annTitle" maxlength="120" placeholder="Ex.: Laboratório fechado na sexta-feira (15/11)"></div>
      <div class="field"><label for="annBody">Mensagem <span class="req">*</span></label>
        <textarea id="annBody" rows="5" maxlength="3000" placeholder="Escreva o aviso para alunos, professores e equipe técnica…"></textarea></div>
      <div class="field-row">
        <div class="field"><label for="annLevel">Tipo</label><select id="annLevel">
          <option value="info">Informativo</option><option value="important">Importante (destaque em vermelho)</option></select></div>
        <div class="field"><label for="annUntil">Exibir até (opcional)</label><input type="date" id="annUntil" min="${todayISO()}">
          <div class="field-help">Depois desta data o aviso deixa de aparecer.</div></div>
      </div>
      <div class="flex-row"><button class="btn dark" onclick="submitAnnouncement()">${icon('megaphone', 16)} Publicar aviso</button></div>
    </div>`)
  + panel('Avisos publicados', `${activeIds.size} ativo(s) · ${people.length} usuário(s) ativo(s)`, all.length ? `<div class="panel-body">
      ${all.map(a => {
        const on = activeIds.has(a.id);
        return `<div class="ann-admin-row ${on ? '' : 'ended'}">
          <div class="ann-admin-main">
            <div><strong>${escapeHtml(a.title)}</strong> ${a.level === 'important' ? '<span class="pill denied">Importante</span>' : ''} <span class="pill ${on ? 'approved' : 'cancelled'}">${on ? 'Ativo' : 'Encerrado'}</span></div>
            <div class="small muted clamp2">${escapeHtml(a.body)}</div>
            <div class="small muted">${fmtDateTime(a.createdAt)}${a.expiresAt ? ` · até ${fmtDate(a.expiresAt)}` : ''} · visto por <strong>${seenBy(a.id)}</strong> de ${people.length}</div>
          </div>
          <div class="row-actions">
            ${on ? `<button class="btn" onclick="endAnnouncement('${a.id}')">Encerrar</button>` : ''}
            <button class="icon-btn danger" title="Excluir" aria-label="Excluir aviso" onclick="deleteAnnouncement('${a.id}')">${icon('trash', 16)}</button>
          </div>
        </div>`; }).join('')}</div>` : emptyBox('Nenhum aviso publicado ainda.', 'megaphone'));
}

async function submitAnnouncement() {
  if (!isAdmin()) return;
  const title = document.getElementById('annTitle').value.trim();
  const body = document.getElementById('annBody').value.trim();
  const level = document.getElementById('annLevel').value === 'important' ? 'important' : 'info';
  const until = document.getElementById('annUntil').value;
  if (!title) return toast('Informe o título do aviso.', 'error');
  if (body.length < 5) return toast('Escreva a mensagem do aviso.', 'error');
  if (until && until < todayISO()) return toast('A data final já passou.', 'error');
  const ok = await askConfirm({ title: 'Publicar aviso', body: `Todos os usuários verão <strong>${escapeHtml(title)}</strong> ao entrar no sistema.`, okLabel: 'Publicar' });
  if (!ok) return;
  const me = currentUser();
  const a = { id: uid('ann'), title, body, level, active: true, createdAt: Date.now(), createdBy: me.id, ...(until ? { expiresAt: until } : {}) };
  if (!window.db.announcements) window.db.announcements = [];
  window.db.announcements.push(a);
  me.seenAnnouncements = [...new Set([...(me.seenAnnouncements || []), a.id])].slice(-300);   // quem publica não recebe a janela
  saveDB();
  toast('Aviso publicado para todos os usuários.', 'success');
  renderAdmin();
}
async function endAnnouncement(id) {
  const a = (window.db.announcements || []).find(x => x.id === id); if (!a || !isAdmin()) return;
  const ok = await askConfirm({ title: 'Encerrar aviso', body: `<strong>${escapeHtml(a.title)}</strong> deixa de aparecer para quem ainda não viu.`, okLabel: 'Encerrar' });
  if (!ok) return;
  a.active = false; a.endedAt = Date.now();
  saveDB(); toast('Aviso encerrado.', 'warn'); renderAdmin();
}
async function deleteAnnouncement(id) {
  const a = (window.db.announcements || []).find(x => x.id === id); if (!a || !isAdmin()) return;
  const ok = await askConfirm({ title: 'Excluir aviso', body: `Excluir <strong>${escapeHtml(a.title)}</strong> definitivamente?`, okLabel: 'Excluir', danger: true });
  if (!ok) return;
  window.db.announcements = window.db.announcements.filter(x => x.id !== id);
  saveDB(); toast('Aviso excluído.', 'warn'); renderAdmin();
}
