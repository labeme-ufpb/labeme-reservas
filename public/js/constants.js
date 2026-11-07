/* ============================================================
   constants.js — Constantes, ícones e helpers globais (v10)
   ============================================================ */

/* Versão do sistema: tem de ser igual a window.APP_BUILD no index.html.
   Se o navegador abriu uma página antiga guardada em cache (com scripts novos),
   recarrega uma vez buscando a página atualizada. */
const APP_BUILD = '11.6.1';
(function checkBuild() {
  try {
    if (window.APP_BUILD === APP_BUILD) {
      if (/[?&]v=/.test(location.search)) history.replaceState(null, '', location.pathname + location.hash);
      return;
    }
    if (sessionStorage.getItem('labeme_build_reload') === APP_BUILD) return;   // evita repetir
    sessionStorage.setItem('labeme_build_reload', APP_BUILD);
  } catch (_) {}
  location.replace(location.pathname + '?v=' + APP_BUILD + location.hash);
})();

const CATEGORY_LABELS = {
  graduacao: 'Graduação',
  graduacao_vinculo: 'Graduação com vínculo',
  mestrado: 'Mestrado',
  doutorado: 'Doutorado',
  prof_depto: 'Professor (Depto)',
  prof_externo: 'Professor externo',
  tecnico: 'Técnico-Adm.',
  externo: 'Externo à UFPB'
};
const CATEGORY_ORDER = ['graduacao','graduacao_vinculo','mestrado','doutorado','prof_depto','prof_externo','tecnico','externo'];
// "Graduação com vínculo": aluno de graduação com autonomia no laboratório. Só a coordenação atribui
// (não aparece no cadastro) e, por padrão, tem aprovação automática das reservas.
const STAFF_ONLY_CATEGORIES = ['graduacao_vinculo'];
const STUDENT_CATEGORIES = ['graduacao','graduacao_vinculo','mestrado','doutorado'];
const EXTERNAL_CATEGORIES = ['prof_externo','externo'];

const TURNO_LABELS = { manha: 'Manhã', tarde: 'Tarde' };

const ROLE_LABELS = {
  user: 'Usuário',
  technician: 'Técnico de laboratório',
  admin: 'Coordenação'
};

const AUTO_APPROVE_CATEGORIES = ['graduacao_vinculo','mestrado','doutorado','prof_depto','prof_externo','tecnico'];

function isAutoApprovedCategory(category) {
  const list = window.db?.settings?.autoApproveCategories;
  return (Array.isArray(list) ? list : AUTO_APPROVE_CATEGORIES).includes(category);
}

const RES_STATUS = {
  pending: 'Pendente',
  approved: 'Aprovada',
  denied: 'Recusada',
  cancelled: 'Cancelada',
  in_use: 'Em uso',
  awaiting_return: 'Aguardando conferência',
  returned: 'Devolvida',
  completed: 'Concluída'
};
// Status que ocupam o recurso (contam para conflito de agenda)
const ACTIVE_STATUSES = ['pending','approved','in_use','awaiting_return'];
// Status encerrados
const CLOSED_STATUSES = ['denied','cancelled','returned','completed'];

const PURPOSE_TYPES = {
  pesquisa_ic: 'Pesquisa — Iniciação científica',
  pesquisa_tcc: 'Pesquisa — TCC',
  pesquisa_pos: 'Pesquisa — Mestrado/Doutorado',
  pesquisa_docente: 'Pesquisa — Projeto docente',
  ensino: 'Ensino — Aula prática',
  extensao: 'Extensão',
  servico: 'Prestação de serviço / externo',
  manutencao: 'Manutenção / calibração',
  outro: 'Outro'
};

const RESOURCE_TYPES = { equipment: 'Equipamento', consumable: 'Item múltiplo', space: 'Espaço' };
const RESOURCE_MODES = { turno: 'Por turno', slot: 'Por horário', both: 'Turno ou horário' };

const STOCK_AVAILABILITY = {
  available: 'Disponível para uso',
  in_use: 'Em uso',
  long_term: 'Estoque de longo prazo',
  empty: 'Local vazio'
};
const STOCK_AVAIL_CLASS = { available: 'available', in_use: 'in_use_stock', long_term: 'long_term', empty: 'stock_empty' };
const STOCK_UNITS = ['kg','g','L','mL','sacos','unidades','caixas','galões','m³','m','m²'];

/* ============ ÍCONES (SVG inline, traço 1.75) ============ */
const ICON_PATHS = {
  megaphone: '<path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>',
  calendar: '<rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
  grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
  box: '<path d="M21 8 12 3 3 8v8l9 5 9-5V8Z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
  chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12Z"/>',
  gauge: '<path d="M12 14l4-4"/><path d="M3.5 18a10 10 0 1 1 17 0"/>',
  shield: '<path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5V6L12 3Z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M21.5 20a6.5 6.5 0 0 0-4-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  edit: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  pin: '<path d="M12 21s7-6.2 7-11.5a7 7 0 0 0-14 0C5 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4V8Z"/><circle cx="12" cy="13" r="3.5"/>',
  wrench: '<path d="M14.5 6.5a4 4 0 0 0 5 5L12 19a2.1 2.1 0 0 1-3-3l7.5-7.5"/><path d="M14.5 6.5 17 4l3 3-2.5 2.5"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3M15 8l2 2"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M4 20h16"/>',
  upload: '<path d="M12 20V9M7 14l5-5 5 5M4 4h16"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  logout: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11"/>',
  alert: '<path d="M12 3 2 20h20L12 3Z"/><path d="M12 10v4.5M12 17.5v.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.5v.01"/>',
  play: '<path d="M7 4.5v15l12-7.5-12-7.5Z"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  arrowLeft: '<path d="M15 5l-7 7 7 7"/>',
  arrowRight: '<path d="M9 5l7 7-7 7"/>',
  database: '<ellipse cx="12" cy="5.5" rx="8" ry="3"/><path d="M4 5.5v13c0 1.7 3.6 3 8 3s8-1.3 8-3v-13M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  ban: '<circle cx="12" cy="12" r="9"/><path d="m5.7 5.7 12.6 12.6"/>',
  drum: '<ellipse cx="12" cy="5" rx="7" ry="2.5"/><path d="M5 5v14c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V5"/><path d="M5 10c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5M5 15c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5"/>',
  shelf: '<path d="M4 3v18M20 3v18M4 9h16M4 15h16M4 21h16"/><rect x="6.5" y="5" width="4" height="4" rx=".5"/><rect x="13" y="11" width="5" height="4" rx=".5"/><rect x="7" y="17" width="3" height="4" rx=".5"/>',
  cabinet: '<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M12 3v18M10 11v2M14 11v2"/>'
};
/* Ícone do local de armazenamento a partir do texto cadastrado */
function storageKind(location) {
  const t = String(location || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (/tambor|barril|bombona|tonel/.test(t)) return { icon: 'drum', label: 'Tambor' };
  if (/prateleira|estante|bancada/.test(t)) return { icon: 'shelf', label: 'Prateleira' };
  if (/armario|gaveta|caixa|bau/.test(t)) return { icon: 'cabinet', label: 'Armário / caixa' };
  return { icon: 'pin', label: 'Local' };
}
function storageChip(location) {
  if (!location) return '';
  const k = storageKind(location);
  return `<span class="storage-chip storage-${k.icon}" title="${k.label}">${icon(k.icon, 15)}${escapeHtml(location)}</span>`;
}
function icon(name, size = 18, extraClass = '') {
  const p = ICON_PATHS[name] || ICON_PATHS.info;
  return `<svg class="ico ${extraClass}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${p}</svg>`;
}

/* ============ DATAS (sempre em horário LOCAL) ============ */
// Bug da v9: toISOString() usa UTC — depois das 21h em João Pessoa (UTC-3)
// o "hoje" virava o dia seguinte. Todas as datas agora são calculadas no fuso local.
function localISO(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function todayISO() { return localISO(new Date()); }
function parseISO(iso) { return new Date(iso + 'T12:00:00'); }
function addDaysISO(iso, n) { const d = parseISO(iso); d.setDate(d.getDate() + n); return localISO(d); }
function isWeekendISO(iso) { const g = parseISO(iso).getDay(); return g === 0 || g === 6; }
function nowHHMM() { const d = new Date(); return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0'); }
function hhmmToMin(t) { const [h, m] = String(t).split(':').map(Number); return h * 60 + (m || 0); }
function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

function fmtDate(iso) {
  if (!iso) return '—';
  return parseISO(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtDateShort(iso) {
  if (!iso) return '—';
  return parseISO(iso).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
}
function fmtDateLong(iso) {
  return capitalize(parseISO(iso).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }));
}
function fmtDateTime(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function fmtTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const y = new Date(today); y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'ontem';
  if ((today - d) / 864e5 < 7) return d.toLocaleDateString('pt-BR', { weekday: 'short' });
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function turnoRange(turno, settings = window.db.settings) {
  return settings[`turno${capitalize(turno)}`] || null;
}
function turnoText(turno, settings = window.db.settings) {
  const t = turnoRange(turno, settings);
  return t ? `${TURNO_LABELS[turno]} (${t.start}–${t.end})` : (TURNO_LABELS[turno] || turno);
}
/* Reservas de vários dias (mode 'days'): de r.date até r.endDate, dias inteiros */
function isMultiDay(r) { return r && r.mode === 'days'; }
function resEnd(r) { return r.endDate && r.endDate > r.date ? r.endDate : r.date; }
function resCovers(r, iso) { return r.date <= iso && iso <= resEnd(r); }
function resOverlapsDates(r, from, to) { return r.date <= to && resEnd(r) >= from; }
function daySpan(from, to) { const out = []; let d = from; while (d <= to && out.length < 370) { out.push(d); d = addDaysISO(d, 1); } return out; }
function resDayCount(r) { return daySpan(r.date, resEnd(r)).length; }

// Converte qualquer reserva para intervalo {start,end} em HH:MM
function reservationRange(r, settings = window.db.settings) {
  if (isMultiDay(r)) return { start: '00:00', end: '23:59' };
  if (r.mode === 'slot') return { start: r.slot.start, end: r.slot.end };
  const t = turnoRange(r.slot.turno, settings);
  return t ? { start: t.start, end: t.end } : { start: '00:00', end: '23:59' };
}
function reservationHours(r, settings = window.db.settings) {
  if (isMultiDay(r)) {   // horas de expediente por dia × número de dias
    const day = ['manha', 'tarde'].reduce((s, t) => { const tr = turnoRange(t, settings); return s + (tr ? (hhmmToMin(tr.end) - hhmmToMin(tr.start)) / 60 : 0); }, 0);
    return day * resDayCount(r);
  }
  const { start, end } = reservationRange(r);
  return Math.max(0, (hhmmToMin(end) - hhmmToMin(start)) / 60);
}
function slotText(r, settings = window.db.settings) {
  if (isMultiDay(r)) { const n = resDayCount(r); return n > 1 ? `${n} dias · até ${fmtDateShort(resEnd(r))}` : 'Dia inteiro'; }
  return escapeHtml(r.mode === 'slot' ? `${r.slot.start}–${r.slot.end}` : turnoText(r.slot.turno, settings));
}

/* ============ SEGURANÇA DE SAÍDA ============ */
function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/[&<>"'`]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','`':'&#96;' }[c]));
}
// Só aceita imagens embutidas (data:image/…), arquivos da pasta assets/, fotos da coleção photos ou links antigos do Storage
function safeImg(src) {
  if (!src || typeof src !== 'string') return '';
  if (/^data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=]+$/.test(src)) return src;
  if (/^assets\/[\w\-./]+\.(jpe?g|png|webp|gif)$/i.test(src)) return src;
  // Foto guardada na coleção photos (carregada sob demanda e mantida em cache no aparelho)
  if (/^photo:[A-Za-z0-9_-]{1,64}$/.test(src)) return typeof photoSrc === 'function' ? photoSrc(src.slice(6)) : '';
  // Fotos enviadas ao Cloud Storage do projeto (link com token de acesso)
  if (/^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/[\w.\-]+\/o\/[^"'<>\s]+$/.test(src)) return src;
  return '';
}
// IDs vindos de backup importado são validados antes de entrar no sistema
function isSafeId(id) { return typeof id === 'string' && /^[A-Za-z0-9_\-]{1,64}$/.test(id); }

/* ============ UI HELPERS ============ */
function toast(msg, type = '') {
  const stack = document.getElementById('toasts');
  if (!stack) return;
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  el.textContent = msg;
  stack.appendChild(el);
  while (stack.children.length > 3) stack.firstElementChild.remove();
  // Avisos rápidos somem logo; erros e alertas ficam um pouco mais para dar tempo de ler. Toque para fechar.
  const ms = (type === 'error' || type === 'warn') ? 3000 : 1600;
  const close = () => { el.classList.add('leaving'); setTimeout(() => el.remove(), 300); };
  el.addEventListener('click', close);
  setTimeout(close, ms);
}

// Compressão SEMPRE aplicada (v9 só comprimia acima de 2 MB e estourava o localStorage).
// Aceita arquivos sem tipo informado (alguns celulares Android enviam type vazio) e
// lê pela URL do objeto, que usa menos memória com fotos de 12 MP.
function fileToDataURL(file, maxDim = 1024, quality = 0.8) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    if (file.type && !/^image\//.test(file.type)) return reject(new Error('O arquivo escolhido não é uma imagem.'));
    const url = URL.createObjectURL(file);
    {
      const img = new Image();
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Não foi possível ler esta foto. Se for do iPhone (HEIC), escolha "Mais compatível" em Ajustes → Câmera → Formatos, ou envie um JPG.')); };
      img.onload = () => {
        URL.revokeObjectURL(url);
        let { width, height } = img;
        const scale = Math.min(1, maxDim / Math.max(width, height));
        width = Math.round(width * scale); height = Math.round(height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = url;
    }
  });
}

/* Nomes curtos: títulos (Prof., Dra.) contam como palavra; "de", "da", "dos"… não contam */
const NAME_TITLES = /^(prof|profa|prof\.ª|dr|dra|me|ma|eng)\.?$/i;
const NAME_LINKS = /^(de|da|do|das|dos|e|d')$/i;
function shortName(name, n = 3) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  const out = []; let count = 0;
  for (const w of words) {
    if (count >= n) break;
    out.push(w);
    if (!NAME_LINKS.test(w)) count++;
  }
  while (out.length && NAME_LINKS.test(out[out.length - 1])) out.pop();
  return out.join(' ');
}
function firstName(name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  return words.find(w => !NAME_TITLES.test(w)) || words[0] || '';
}

function avatarInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(p => !/^(prof|profa|dr|dra)\.?$/i.test(p));
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
function renderAvatar(user, size = '') {
  const cls = size ? `user-avatar ${size}` : 'user-avatar';
  const src = safeImg(user?.avatar);
  if (src) return `<div class="${cls}"><img src="${src}" alt=""></div>`;
  return `<div class="${cls}" aria-hidden="true">${escapeHtml(avatarInitials(user?.name))}</div>`;
}
function statusPill(status) {
  return `<span class="pill ${escapeHtml(status)}">${escapeHtml(RES_STATUS[status] || status)}</span>`;
}
function userName(id) { const u = getUser(id); return u ? u.name : 'Usuário removido'; }
function resourceName(id) { const r = getResource(id); return r ? r.name : 'Recurso removido'; }

function downloadFile(filename, content, mime = 'text/plain') {
  const blob = new Blob([content], { type: mime + ';charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function toCSV(rows) {
  // Separador ';' e BOM — abre direto no Excel em português
  const esc = v => {
    let s = v === null || v === undefined ? '' : String(v);
    // Impede que um texto começando com = + - @ vire fórmula ao abrir no Excel (injeção de fórmula)
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return '﻿' + rows.map(r => r.map(esc).join(';')).join('\r\n');
}
function debounce(fn, ms = 200) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
function isMobile() { return window.matchMedia('(max-width: 720px)').matches; }
