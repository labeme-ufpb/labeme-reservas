/* ============================================================
   admin.js — Painel administrativo (v3)
   - Sem turno noite
   - Coordenação pode cadastrar novos usuários (incluindo técnicos)
   ============================================================ */

let adminTab = 'pending';

function setAdminTab(tab) {
  adminTab = tab;
  document.querySelectorAll('.admin-side a').forEach(a =>
    a.classList.toggle('active', a.dataset.admintab === tab)
  );
  renderAdmin();
}

function renderAdmin() {
  const pendingCount = window.db.reservations.filter(r => r.status === 'pending').length;
  const awaitingReturnCount = window.db.reservations.filter(r => r.status === 'awaiting_return').length;
  const todayCount = window.db.reservations.filter(r =>
    r.status !== 'denied' && r.date === todayISO()
  ).length;
  const upcomingCount = window.db.reservations.filter(r =>
    ['approved','in_use'].includes(r.status) && r.date >= todayISO()
  ).length;

  const badge = document.getElementById('badgePending');
  badge.textContent = pendingCount;
  badge.style.display = pendingCount > 0 ? 'inline-block' : 'none';
  const badgeReturn = document.getElementById('badgeReturn');
  badgeReturn.textContent = awaitingReturnCount;
  badgeReturn.style.display = awaitingReturnCount > 0 ? 'inline-block' : 'none';

  document.getElementById('statsRow').innerHTML = `
    <div class="stat-card accent-amber">
      <div class="stat-label">Pendentes</div>
      <div class="stat-value">${pendingCount}</div>
      <div class="stat-foot">aguardando aprovação</div>
    </div>
    <div class="stat-card accent-green">
      <div class="stat-label">Hoje</div>
      <div class="stat-value">${todayCount}</div>
      <div class="stat-foot">${fmtDate(todayISO())}</div>
    </div>
    <div class="stat-card accent-steel">
      <div class="stat-label">Próximas</div>
      <div class="stat-value">${upcomingCount}</div>
      <div class="stat-foot">a partir de hoje</div>
    </div>
    <div class="stat-card accent-navy">
      <div class="stat-label">Recursos</div>
      <div class="stat-value">${window.db.resources.filter(r=>r.active).length}</div>
      <div class="stat-foot">${window.db.users.length} usuários cadastrados</div>
    </div>
  `;

  const content = document.getElementById('adminContent');
  if (adminTab === 'pending') content.innerHTML = adminPending();
  else if (adminTab === 'returns') content.innerHTML = adminReturns();
  else if (adminTab === 'resources') content.innerHTML = adminResources();
  else if (adminTab === 'users') content.innerHTML = adminUsers();
  else if (adminTab === 'all-res') content.innerHTML = adminAllReservations();
  else if (adminTab === 'settings') content.innerHTML = adminSettings();
}

function adminPending() {
  const list = window.db.reservations
    .filter(r => r.status === 'pending')
    .sort((a,b) => a.date.localeCompare(b.date));
  if (list.length === 0) {
    return `<div class="panel">
      <div class="panel-head"><div><div class="panel-title">Reservas pendentes</div><div class="panel-sub">Aguardando aprovação da coordenação ou técnicos.</div></div></div>
      <div class="empty"><div class="empty-icon">✓</div>Nenhuma reserva pendente — você está em dia!</div>
    </div>`;
  }
  return `<div class="panel">
    <div class="panel-head"><div><div class="panel-title">Reservas pendentes</div><div class="panel-sub">${list.length} aguardando aprovação.</div></div></div>
    <div class="panel-body">
      <table>
        <thead><tr><th>Data</th><th>Recurso</th><th>Solicitante</th><th>Categoria</th><th>Finalidade</th><th>Ações</th></tr></thead>
        <tbody>${list.map(r => {
          const res = getResource(r.resourceId);
          const u = getUser(r.userId);
          const sText = slotText(r, window.db.settings);
          const qty = r.quantity > 1 ? ` <span class="muted">×${r.quantity}</span>` : '';
          return `<tr>
            <td><div style="font-weight:500;">${fmtDate(r.date)}</div><div style="font-size:12px;color:var(--ink-500);">${sText}</div></td>
            <td>${escapeHtml(res?.name||'?')}${qty}</td>
            <td>${escapeHtml(u?.name||'?')}<div style="font-size:12px;color:var(--ink-500);">${escapeHtml(u?.email||'')}</div></td>
            <td><span class="pill auto">${CATEGORY_LABELS[u?.category]||'?'}</span></td>
            <td style="max-width:240px;font-size:13px;color:var(--ink-700);">${escapeHtml(r.purpose||'')}</td>
            <td><div class="row-actions">
              <button class="icon-btn success" onclick="setReservationStatus('${r.id}','approved')" title="Aprovar">✓</button>
              <button class="icon-btn danger" onclick="setReservationStatus('${r.id}','denied')" title="Recusar">✕</button>
              <button class="icon-btn" onclick="showResDetail('${r.id}')" title="Ver detalhes">👁</button>
            </div></td>
          </tr>`;
        }).join('')}</tbody>
      </table>
    </div></div>`;
}

function adminReturns() {
  const list = window.db.reservations
    .filter(r => r.status === 'awaiting_return')
    .sort((a,b) => (a.returnedAt||0) - (b.returnedAt||0));
  if (list.length === 0) {
    return `<div class="panel">
      <div class="panel-head"><div><div class="panel-title">Devoluções pendentes</div><div class="panel-sub">Reservas com foto de devolução aguardando confirmação.</div></div></div>
      <div class="empty"><div class="empty-icon">✓</div>Nenhuma devolução pendente.</div>
    </div>`;
  }
  return `<div class="panel">
    <div class="panel-head"><div><div class="panel-title">Devoluções aguardando confirmação</div><div class="panel-sub">${list.length} item(ns) com foto enviada.</div></div></div>
    <div class="panel-body">
      <table>
        <thead><tr><th>Foto</th><th>Recurso</th><th>Solicitante</th><th>Reserva</th><th>Devolvido em</th><th>Ações</th></tr></thead>
        <tbody>${list.map(r => {
          const res = getResource(r.resourceId);
          const u = getUser(r.userId);
          const returnedDate = r.returnedAt ? new Date(r.returnedAt).toLocaleString('pt-BR') : '—';
          return `<tr>
            <td>${r.returnPhoto ? `<img src="${r.returnPhoto}" style="width:60px;height:60px;object-fit:cover;border-radius:4px;cursor:pointer;" onclick="showResDetail('${r.id}')">` : '—'}</td>
            <td>${escapeHtml(res?.name||'?')}${r.quantity>1?` ×${r.quantity}`:''}</td>
            <td>${escapeHtml(u?.name||'?')}</td>
            <td>${fmtDate(r.date)}</td>
            <td style="font-size:12px;">${returnedDate}</td>
            <td><div class="row-actions">
              <button class="icon-btn success" onclick="confirmReturn('${r.id}')" title="Confirmar devolução">✓</button>
              <button class="icon-btn" onclick="showResDetail('${r.id}')" title="Ver">👁</button>
            </div></td>
          </tr>`;
        }).join('')}</tbody>
      </table>
    </div></div>`;
}

function adminResources() {
  if (window.db.resources.length === 0) {
    return `<div class="panel">
      <div class="panel-head">
        <div><div class="panel-title">Recursos cadastrados</div><div class="panel-sub">Equipamentos e espaços disponíveis para reserva.</div></div>
        <button class="btn dark" onclick="openResourceModal()">+ Adicionar recurso</button>
      </div>
      <div class="empty">
        <div class="empty-icon">⚙</div>
        Nenhum recurso cadastrado.<br>
        <button class="btn dark mt-4" onclick="openResourceModal()">Cadastrar primeiro recurso</button>
      </div>
    </div>`;
  }
  return `<div class="panel">
    <div class="panel-head">
      <div><div class="panel-title">Recursos cadastrados</div><div class="panel-sub">${window.db.resources.length} item(ns) — ${window.db.resources.filter(r=>r.active).length} ativo(s).</div></div>
      <button class="btn dark" onclick="openResourceModal()">+ Adicionar recurso</button>
    </div>
    <div class="panel-body">
      <table>
        <thead><tr><th></th><th>Nome</th><th>Tipo</th><th>Modo</th><th>Qtd</th><th>Técnico</th><th>Status</th><th>Ações</th></tr></thead>
        <tbody>${window.db.resources.map(r => `<tr>
          <td>${r.photo ? `<img src="${r.photo}" class="resource-thumb">` : `<div class="resource-thumb-empty">○</div>`}</td>
          <td>
            <div style="font-weight:500;">${escapeHtml(r.name)}</div>
            <div style="font-size:12px;color:var(--ink-500);max-width:280px;">${r.location ? '📍 ' + escapeHtml(r.location) : ''}</div>
          </td>
          <td><span class="pill ${r.type==='equipment'?'equip':r.type==='consumable'?'consumable':'space'}">${r.type==='equipment'?'Equipamento':r.type==='consumable'?'Consumível':'Espaço'}</span></td>
          <td style="font-size:12px;">${r.mode==='slot'?'Por horário':r.mode==='turno'?'Por turno':'Ambos'}</td>
          <td>${r.totalQuantity || 1}</td>
          <td>${r.requiresTechnicianPresence ? '<span class="pill tech-required">Obrigatória</span>' : (r.requiresTechnicianAssist ? 'Recomendado' : '—')}</td>
          <td>${r.active?'<span class="pill approved">Ativo</span>':'<span class="pill denied">Inativo</span>'}</td>
          <td><div class="row-actions">
            <button class="icon-btn" onclick="openResourceModal('${r.id}')" title="Editar">✎</button>
            <button class="icon-btn danger" onclick="deleteResource('${r.id}')" title="Excluir">🗑</button>
          </div></td>
        </tr>`).join('')}</tbody>
      </table>
    </div></div>`;
}

function openResourceModal(id) {
  const r = id ? getResource(id) : {
    name: '', type: 'equipment', mode: 'turno',
    requiresTechnicianAssist: false,
    requiresTechnicianPresence: false,
    requiresReturnPhoto: false,
    description: '', color: 'green', active: true,
    photo: null, location: '', totalQuantity: 1
  };
  const html = `
    <div class="modal-head">
      <div><div class="modal-title">${id?'Editar':'Adicionar'} recurso</div></div>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="field">
        <label>Foto do recurso</label>
        <label class="file-upload ${r.photo?'has-file':''}" id="rPhotoLabel">
          <input type="file" id="rPhotoInput" accept="image/*" onchange="onResourcePhotoChange(event)">
          <div id="rPhotoText">${r.photo ? '✓ Foto carregada — clique para trocar' : '📷 Clique para adicionar uma foto'}</div>
        </label>
        <img id="rPhotoPreview" class="file-preview" src="${r.photo||''}" style="${r.photo?'':'display:none;'}">
      </div>
      <div class="field">
        <label>Nome <span class="req">*</span></label>
        <input type="text" id="rName" value="${escapeHtml(r.name)}" placeholder="Ex.: Prensa hidráulica EMIC PCE 100">
      </div>
      <div class="field">
        <label>Localização no laboratório</label>
        <input type="text" id="rLocation" value="${escapeHtml(r.location||'')}" placeholder="Ex.: Sala 02, bancada A — fundo">
        <div class="field-help">Onde encontrar o recurso fisicamente.</div>
      </div>
      <div class="field">
        <label>Descrição</label>
        <textarea id="rDesc" rows="2" placeholder="Para que serve, normas aplicáveis, capacidade...">${escapeHtml(r.description||'')}</textarea>
      </div>
      <div class="field-row">
        <div class="field">
          <label>Tipo</label>
          <select id="rType">
            <option value="equipment" ${r.type==='equipment'?'selected':''}>Equipamento</option>
            <option value="space" ${r.type==='space'?'selected':''}>Espaço físico</option>
            <option value="consumable" ${r.type==='consumable'?'selected':''}>Item múltiplo (moldes, peneiras…)</option>
          </select>
        </div>
        <div class="field">
          <label>Modo de reserva</label>
          <select id="rMode">
            <option value="turno" ${r.mode==='turno'?'selected':''}>Por turno</option>
            <option value="slot" ${r.mode==='slot'?'selected':''}>Por horário (hora a hora)</option>
            <option value="both" ${r.mode==='both'?'selected':''}>Ambos (usuário escolhe)</option>
          </select>
        </div>
      </div>
      <div class="field-row">
        <div class="field">
          <label>Quantidade total disponível</label>
          <input type="number" id="rQty" value="${r.totalQuantity||1}" min="1">
          <div class="field-help">Quantas unidades existem? (ex.: 20 moldes 5×10cm)</div>
        </div>
        <div class="field">
          <label>Cor de identificação</label>
          <select id="rColor">
            <option value="green" ${r.color==='green'?'selected':''}>Verde-LABEME</option>
            <option value="navy" ${r.color==='navy'?'selected':''}>Azul-marinho</option>
            <option value="steel" ${r.color==='steel'?'selected':''}>Azul-aço</option>
            <option value="amber" ${r.color==='amber'?'selected':''}>Âmbar</option>
          </select>
        </div>
      </div>

      <div style="margin:16px 0 8px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;color:var(--ink-700);">
        Regras de uso
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        <label class="checkbox-field">
          <input type="checkbox" id="rTechAssist" ${r.requiresTechnicianAssist?'checked':''}>
          <div class="cf-text">
            <strong>Acompanhamento técnico recomendado</strong>
            Aviso informativo ao usuário; não bloqueia a reserva.
          </div>
        </label>
        <label class="checkbox-field">
          <input type="checkbox" id="rTechPresence" ${r.requiresTechnicianPresence?'checked':''}>
          <div class="cf-text">
            <strong>Presença de técnico OBRIGATÓRIA</strong>
            Reserva só pode ocorrer com técnico presente. Aparece com destaque ao usuário e no dashboard do técnico.
          </div>
        </label>
        <label class="checkbox-field">
          <input type="checkbox" id="rReturnPhoto" ${r.requiresReturnPhoto?'checked':''}>
          <div class="cf-text">
            <strong>Devolução com foto obrigatória</strong>
            Usuário deve enviar foto comprovando devolução em bom estado. Útil para moldes, ferramentas, peças avulsas.
          </div>
        </label>
      </div>

      <div class="field" style="margin-top:14px;">
        <label>Status</label>
        <select id="rActive">
          <option value="true" ${r.active?'selected':''}>Ativo (visível para reserva)</option>
          <option value="false" ${!r.active?'selected':''}>Inativo (oculto)</option>
        </select>
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn" onclick="closeModal()">Cancelar</button>
      <button class="btn dark" onclick="saveResource('${id||''}')">Salvar</button>
    </div>
  `;
  openModal(html, true);
  window._resourcePhotoData = r.photo || null;
}

function onResourcePhotoChange(e) {
  const file = e.target.files[0];
  if (!file) return;
  fileToDataURL(file).then(dataUrl => {
    window._resourcePhotoData = dataUrl;
    document.getElementById('rPhotoPreview').src = dataUrl;
    document.getElementById('rPhotoPreview').style.display = 'block';
    document.getElementById('rPhotoText').textContent = '✓ Foto carregada — clique para trocar';
    document.getElementById('rPhotoLabel').classList.add('has-file');
  });
}

function saveResource(id) {
  const data = {
    name: document.getElementById('rName').value.trim(),
    description: document.getElementById('rDesc').value.trim(),
    location: document.getElementById('rLocation').value.trim(),
    type: document.getElementById('rType').value,
    mode: document.getElementById('rMode').value,
    color: document.getElementById('rColor').value,
    totalQuantity: parseInt(document.getElementById('rQty').value) || 1,
    active: document.getElementById('rActive').value === 'true',
    requiresTechnicianAssist: document.getElementById('rTechAssist').checked,
    requiresTechnicianPresence: document.getElementById('rTechPresence').checked,
    requiresReturnPhoto: document.getElementById('rReturnPhoto').checked,
    photo: window._resourcePhotoData || null
  };
  if (!data.name) return toast('Nome obrigatório.', 'error');
  if (id) {
    Object.assign(getResource(id), data);
  } else {
    window.db.resources.push({ id: uid('r'), ...data });
  }
  saveDB();
  window._resourcePhotoData = null;
  closeModal();
  toast(id ? 'Recurso atualizado.' : 'Recurso adicionado.', 'success');
  renderAdmin();
  renderCalendar();
}

function deleteResource(id) {
  if (!confirm('Excluir este recurso? Reservas existentes não serão removidas.')) return;
  window.db.resources = window.db.resources.filter(r => r.id !== id);
  saveDB();
  toast('Recurso removido.', 'warn');
  renderAdmin();
  renderCalendar();
}

// ========== USERS — coordenação cadastra novos usuários ==========
function adminUsers() {
  const cur = currentUser();
  return `<div class="panel">
    <div class="panel-head">
      <div><div class="panel-title">Usuários cadastrados</div><div class="panel-sub">${window.db.users.length} pessoas com acesso.</div></div>
      ${cur?.role === 'admin' ? `<button class="btn dark" onclick="openCreateUserModal()">+ Cadastrar usuário</button>` : ''}
    </div>
    <div class="panel-body">
      <table>
        <thead><tr><th></th><th>Nome</th><th>E-mail</th><th>Categoria</th><th>Papel</th><th>Orientador / Inst.</th><th>Reservas</th><th></th></tr></thead>
        <tbody>${window.db.users.map(u => {
          const count = window.db.reservations.filter(r => r.userId === u.id).length;
          return `<tr>
            <td>${renderAvatar(u, 'small')}</td>
            <td><div style="font-weight:500;">${escapeHtml(u.name)}</div></td>
            <td>${escapeHtml(u.email)}</td>
            <td><span class="pill auto">${CATEGORY_LABELS[u.category]||'?'}</span></td>
            <td>${u.role==='admin'?'<span class="pill approved">Coordenação</span>':u.role==='technician'?'<span class="pill completed">Técnico</span>':'Usuário'}</td>
            <td>${escapeHtml(u.advisor || u.institution || '—')}</td>
            <td>${count}</td>
            <td><button class="icon-btn" onclick="openUserModal('${u.id}')" title="Editar">✎</button></td>
          </tr>`;
        }).join('')}</tbody>
      </table>
    </div></div>`;
}

function openCreateUserModal() {
  if (!isAdmin()) return toast('Sem permissão.', 'error');
  const html = `
    <div class="modal-head">
      <div><div class="modal-title">Cadastrar novo usuário</div><div class="modal-sub">Crie contas para alunos, professores, técnicos ou coordenação</div></div>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="info-box">A senha definida aqui poderá ser alterada pelo próprio usuário no primeiro login.</div>
      <div class="field"><label>Nome completo <span class="req">*</span></label>
        <input type="text" id="cuName" placeholder="Nome do novo usuário">
      </div>
      <div class="field-row">
        <div class="field"><label>E-mail <span class="req">*</span></label>
          <input type="email" id="cuEmail" placeholder="email@ufpb.br">
        </div>
        <div class="field"><label>WhatsApp</label>
          <input type="tel" id="cuPhone" placeholder="(83) 9XXXX-XXXX">
        </div>
      </div>
      <div class="field-row">
        <div class="field">
          <label>Categoria <span class="req">*</span></label>
          <select id="cuCategory" onchange="onCreateUserCategoryChange()">
            <option value="">Selecione...</option>
            ${Object.entries(CATEGORY_LABELS).map(([k,v]) => `<option value="${k}">${v}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>Papel no sistema <span class="req">*</span></label>
          <select id="cuRole">
            <option value="user">Usuário</option>
            <option value="technician">Técnico</option>
            <option value="admin">Coordenação (admin)</option>
          </select>
          <div class="field-help">Técnicos e coordenação aprovam reservas.</div>
        </div>
      </div>
      <div class="field" id="cuAdvisorField" style="display:none;">
        <label>Orientador <span class="req">*</span></label>
        <input type="text" id="cuAdvisor">
      </div>
      <div class="field" id="cuInstitutionField" style="display:none;">
        <label>Instituição <span class="req">*</span></label>
        <input type="text" id="cuInstitution">
      </div>
      <div class="field-row">
        <div class="field"><label>Senha <span class="req">*</span></label>
          <input type="password" id="cuPwd" placeholder="Mínimo 6 caracteres">
        </div>
        <div class="field"><label>Confirmar senha <span class="req">*</span></label>
          <input type="password" id="cuPwdConfirm">
        </div>
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn" onclick="closeModal()">Cancelar</button>
      <button class="btn dark" onclick="submitCreateUser()">Criar usuário</button>
    </div>
  `;
  openModal(html);
}

function onCreateUserCategoryChange() {
  const cat = document.getElementById('cuCategory').value;
  document.getElementById('cuAdvisorField').style.display =
    ['graduacao','mestrado','doutorado'].includes(cat) ? 'block' : 'none';
  document.getElementById('cuInstitutionField').style.display =
    ['prof_externo','externo'].includes(cat) ? 'block' : 'none';

  // Auto-sugere papel "técnico" se categoria = tecnico
  if (cat === 'tecnico') {
    document.getElementById('cuRole').value = 'technician';
  }
}

async function submitCreateUser() {
  if (!isAdmin()) return toast('Sem permissão.', 'error');

  const name = document.getElementById('cuName').value.trim();
  const email = document.getElementById('cuEmail').value.trim().toLowerCase();
  const phone = document.getElementById('cuPhone').value.trim();
  const category = document.getElementById('cuCategory').value;
  const role = document.getElementById('cuRole').value;
  const advisor = document.getElementById('cuAdvisor').value.trim();
  const institution = document.getElementById('cuInstitution').value.trim();
  const pwd = document.getElementById('cuPwd').value;
  const pwdConfirm = document.getElementById('cuPwdConfirm').value;

  if (!name || !email || !category || !pwd) return toast('Preencha todos os campos obrigatórios.', 'error');
  if (pwd.length < 6) return toast('Senha deve ter pelo menos 6 caracteres.', 'error');
  if (pwd !== pwdConfirm) return toast('As senhas não coincidem.', 'error');
  if (window.db.users.find(u => u.email.toLowerCase() === email.toLowerCase())) return toast('E-mail já cadastrado.', 'error');
  if (['graduacao','mestrado','doutorado'].includes(category) && !advisor) return toast('Informe o orientador.', 'error');
  if (['prof_externo','externo'].includes(category) && !institution) return toast('Informe a instituição.', 'error');

  try {
    const authUid = await createAuthAccount(email, pwd);
    const u = {
      id: authUid,
      name, email,
      category, advisor, institution, phone,
      role,
      avatar: null,
      profileReminderShown: false,
      createdAt: Date.now()
    };
    window.db.users.push(u);
    await saveDB();
    closeModal();
    toast(`Usuário ${name} criado com sucesso no Authentication e no Firestore.`, 'success');
    renderAdmin();
  } catch (err) {
    console.error(err);
    const msg = err.code === 'auth/email-already-in-use'
      ? 'E-mail já existe no Firebase Authentication.'
      : 'Erro ao criar usuário: ' + (err.message || err.code);
    toast(msg, 'error');
  }
}

function openUserModal(id) {
  const u = getUser(id);
  if (!u) return;
  const cur = currentUser();
  const isSelf = cur.id === u.id;
  const html = `
    <div class="modal-head">
      <div>
        <div class="modal-title">Editar usuário</div>
        <div class="modal-sub">${escapeHtml(u.email)}</div>
      </div>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div style="text-align:center;margin-bottom:18px;">
        ${renderAvatar(u, 'large')}
      </div>
      <div class="field"><label>Nome</label>
        <input type="text" id="uName" value="${escapeHtml(u.name)}">
      </div>
      <div class="field-row">
        <div class="field"><label>Categoria</label>
          <select id="uCategory">
            ${Object.entries(CATEGORY_LABELS).map(([k,v]) => `<option value="${k}" ${u.category===k?'selected':''}>${v}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>Papel no sistema</label>
          <select id="uRole" ${isSelf?'disabled':''}>
            <option value="user" ${u.role==='user'?'selected':''}>Usuário</option>
            <option value="technician" ${u.role==='technician'?'selected':''}>Técnico</option>
            <option value="admin" ${u.role==='admin'?'selected':''}>Coordenação</option>
          </select>
          ${isSelf?'<div class="field-help">Você não pode alterar seu próprio papel.</div>':''}
        </div>
      </div>
      <div class="field"><label>Orientador / Instituição</label>
        <input type="text" id="uAdvisor" value="${escapeHtml(u.advisor||u.institution||'')}">
      </div>
      <div class="field"><label>Redefinição de senha</label>
        <div class="field-help">Por segurança, a senha não é salva no sistema. Use o botão abaixo para enviar um link de redefinição ao e-mail cadastrado.</div>
        <button type="button" class="btn" onclick="sendUserPasswordReset('${u.id}')">Enviar link de redefinição de senha</button>
      </div>
    </div>
    <div class="modal-foot">
      ${!isSelf ? `<button class="btn danger" onclick="deleteUser('${u.id}')">Excluir</button>` : ''}
      <button class="btn" onclick="closeModal()">Cancelar</button>
      <button class="btn dark" onclick="saveUser('${u.id}')">Salvar</button>
    </div>
  `;
  openModal(html);
}

async function saveUser(id) {
  const u = getUser(id);
  u.name = document.getElementById('uName').value.trim();
  u.category = document.getElementById('uCategory').value;
  if (!document.getElementById('uRole').disabled) {
    u.role = document.getElementById('uRole').value;
  }
  const advInst = document.getElementById('uAdvisor').value.trim();
  if (['graduacao','mestrado','doutorado'].includes(u.category)) {
    u.advisor = advInst;
    u.institution = '';
  } else {
    u.institution = advInst;
    u.advisor = '';
  }

  await saveDB();
  closeModal();
  toast('Usuário atualizado.', 'success');
  renderAdmin();
}

async function sendUserPasswordReset(id) {
  const u = getUser(id);
  if (!u?.email) return toast('Usuário sem e-mail cadastrado.', 'error');
  try {
    await sendPasswordReset(u.email);
    toast('Link de redefinição enviado para ' + u.email, 'success');
  } catch (err) {
    console.error(err);
    toast('Erro ao enviar redefinição: ' + (err.message || err.code), 'error');
  }
}

async function deleteUser(id) {
  if (!confirm('Remover este usuário do Firestore? As reservas dele serão mantidas no histórico. A conta do Firebase Authentication deve ser desativada/removida pelo console do Firebase, se necessário.')) return;
  window.db.users = window.db.users.filter(u => u.id !== id);
  await saveDB();
  closeModal();
  toast('Usuário removido do Firestore.', 'warn');
  renderAdmin();
}

function adminAllReservations() {
  const list = window.db.reservations.slice().sort((a,b) => b.date.localeCompare(a.date));
  if (list.length === 0) {
    return `<div class="panel">
      <div class="panel-head"><div><div class="panel-title">Histórico completo</div></div></div>
      <div class="empty"><div class="empty-icon">○</div>Nenhuma reserva ainda.</div>
    </div>`;
  }
  return `<div class="panel">
    <div class="panel-head"><div><div class="panel-title">Histórico completo</div><div class="panel-sub">Todas as reservas, em ordem cronológica reversa.</div></div></div>
    <div class="panel-body">
      <table>
        <thead><tr><th>Data</th><th>Recurso</th><th>Solicitante</th><th>Qtd</th><th>Status</th><th></th></tr></thead>
        <tbody>${list.map(r => {
          const res = getResource(r.resourceId);
          const u = getUser(r.userId);
          const sText = slotText(r, window.db.settings);
          return `<tr>
            <td>${fmtDate(r.date)}<div style="font-size:12px;color:var(--ink-500);">${sText}</div></td>
            <td>${escapeHtml(res?.name||'?')}</td>
            <td>${escapeHtml(u?.name||'?')}</td>
            <td>${r.quantity || 1}</td>
            <td><span class="pill ${r.status}">${RES_STATUS[r.status]}</span></td>
            <td><button class="icon-btn" onclick="showResDetail('${r.id}')">👁</button></td>
          </tr>`;
        }).join('')}</tbody>
      </table>
    </div></div>`;
}

function adminSettings() {
  const s = window.db.settings;
  // Sem turno noite
  return `<div class="panel">
    <div class="panel-head"><div><div class="panel-title">Configurações gerais</div><div class="panel-sub">Parâmetros globais do sistema.</div></div></div>
    <div class="panel-body" style="padding:20px 24px;">
      <div class="field-row">
        <div class="field"><label>Antecedência mínima (horas)</label>
          <input type="number" id="setMin" value="${s.minAdvanceHours}" min="0">
          <div class="field-help">Tempo mínimo entre solicitação e data da reserva.</div>
        </div>
        <div class="field"><label>Antecedência máxima (dias)</label>
          <input type="number" id="setMax" value="${s.maxAdvanceDays}" min="1">
          <div class="field-help">Quão à frente os usuários podem reservar.</div>
        </div>
      </div>

      <div style="margin:18px 0 8px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;color:var(--ink-700);">Turnos institucionais</div>
      <div class="field-row">
        <div class="field"><label>Manhã — início</label><input type="time" id="setManhaStart" value="${s.turnoManha.start}"></div>
        <div class="field"><label>Manhã — fim</label><input type="time" id="setManhaEnd" value="${s.turnoManha.end}"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Tarde — início</label><input type="time" id="setTardeStart" value="${s.turnoTarde.start}"></div>
        <div class="field"><label>Tarde — fim</label><input type="time" id="setTardeEnd" value="${s.turnoTarde.end}"></div>
      </div>

      <div class="field" style="margin-top:14px;"><label>E-mail da coordenação</label>
        <input type="email" id="setAdminEmail" value="${escapeHtml(s.adminEmail)}">
        <div class="field-help">Recebe notificações de novas solicitações.</div>
      </div>
      <label class="checkbox-field" style="margin-bottom:14px;">
        <input type="checkbox" id="setNotify" ${s.notifyEmail?'checked':''}>
        <div class="cf-text"><strong>Enviar notificações por e-mail</strong>Avisa solicitante e admin sobre aprovações, recusas e devoluções.</div>
      </label>
      <button class="btn dark" onclick="saveSettings()">Salvar configurações</button>

      <details style="margin-top:30px;border-top:1px solid var(--line-200);padding-top:20px;">
        <summary style="color:var(--danger);">Zona de perigo</summary>
        <p style="font-size:13px;color:var(--ink-500);margin:8px 0 12px;">Apaga todos os dados de demonstração e reinicializa o sistema.</p>
        <button class="btn danger" onclick="resetAll()">Resetar todos os dados</button>
      </details>
    </div></div>`;
}

function saveSettings() {
  const s = window.db.settings;
  s.minAdvanceHours = parseInt(document.getElementById('setMin').value) || 0;
  s.maxAdvanceDays = parseInt(document.getElementById('setMax').value) || 30;
  s.adminEmail = document.getElementById('setAdminEmail').value;
  s.notifyEmail = document.getElementById('setNotify').checked;
  s.turnoManha = {
    start: document.getElementById('setManhaStart').value,
    end: document.getElementById('setManhaEnd').value
  };
  s.turnoTarde = {
    start: document.getElementById('setTardeStart').value,
    end: document.getElementById('setTardeEnd').value
  };
  saveDB();
  toast('Configurações salvas.', 'success');
}

async function resetAll() {
  if (!isAdmin()) return toast('Sem permissão.', 'error');
  await wipeFirestoreData();
  renderAdmin();
  renderCalendar();
}

window.adminTab = adminTab;
window.setAdminTab = setAdminTab;
window.renderAdmin = renderAdmin;
window.openResourceModal = openResourceModal;
window.onResourcePhotoChange = onResourcePhotoChange;
window.saveResource = saveResource;
window.deleteResource = deleteResource;
window.openCreateUserModal = openCreateUserModal;
window.onCreateUserCategoryChange = onCreateUserCategoryChange;
window.submitCreateUser = submitCreateUser;
window.openUserModal = openUserModal;
window.saveUser = saveUser;
window.sendUserPasswordReset = sendUserPasswordReset;
window.deleteUser = deleteUser;
window.saveSettings = saveSettings;
window.resetAll = resetAll;
