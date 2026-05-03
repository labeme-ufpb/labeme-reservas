/* ============================================================
   constants.js — Constantes e helpers globais (v3)
   ============================================================ */

const CATEGORY_LABELS = {
  graduacao: 'Graduação',
  mestrado: 'Mestrado',
  doutorado: 'Doutorado',
  prof_depto: 'Professor (Depto)',
  prof_externo: 'Professor externo',
  tecnico: 'Técnico-Adm.',
  externo: 'Externo à UFPB'
};

// Apenas manhã e tarde — turno noite removido
const TURNO_LABELS = {
  manha: 'Manhã',
  tarde: 'Tarde'
};

const ROLE_LABELS = {
  user: 'Usuário',
  technician: 'Técnico de laboratório',
  admin: 'Coordenação'
};

// Categorias com aprovação automática
const AUTO_APPROVE_CATEGORIES = [
  'mestrado', 'doutorado', 'prof_depto', 'prof_externo', 'tecnico'
];

const RES_STATUS = {
  pending: 'Pendente',
  approved: 'Aprovada',
  denied: 'Recusada',
  in_use: 'Em uso',
  awaiting_return: 'Aguardando devolução',
  returned: 'Devolvida',
  completed: 'Concluída'
};

// Disponibilidade do estoque
const STOCK_AVAILABILITY = {
  available: 'Disponível para uso',
  in_use: 'Em uso',
  long_term: 'Estoque de longo prazo'
};

const STOCK_AVAIL_CLASS = {
  available: 'available',
  in_use: 'in_use_stock',
  long_term: 'long_term'
};

// Unidades de quantidade do estoque
const STOCK_UNITS = [
  'kg', 'g', 'L', 'mL', 'sacos', 'unidades', 'caixas', 'galões', 'm³', 'm', 'm²'
];

// ========== HELPERS ==========
function fmtDate(iso) {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

function fmtDateLong(iso) {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  });
}

function fmtDateTime(timestamp) {
  if (!timestamp) return '—';
  const d = new Date(timestamp);
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function fmtTime(timestamp) {
  if (!timestamp) return '—';
  const d = new Date(timestamp);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'ontem';
  const diff = (today - d) / (1000 * 60 * 60 * 24);
  if (diff < 7) {
    return d.toLocaleDateString('pt-BR', { weekday: 'short' });
  }
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function todayISO() {
  return new Date().toISOString().slice(0,10);
}

function turnoText(turno, settings) {
  const t = settings[`turno${turno.charAt(0).toUpperCase()+turno.slice(1)}`];
  if (!t) return TURNO_LABELS[turno] || turno;
  return `${TURNO_LABELS[turno]} (${t.start}–${t.end})`;
}

function slotText(reservation, settings) {
  if (reservation.mode === 'slot') {
    return `${reservation.slot.start}–${reservation.slot.end}`;
  }
  return turnoText(reservation.slot.turno, settings);
}

function toast(msg, type='') {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  document.getElementById('toasts').appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateX(20px)';
    el.style.transition = 'all 0.25s';
  }, 3500);
  setTimeout(() => el.remove(), 4000);
}

async function fileToDataURL(file) {
  if (!file) return null;

  // Em produção, quando o usuário está autenticado, a imagem é enviada ao Firebase Storage
  // e o sistema salva apenas a URL pública assinada de download.
  try {
    if (typeof uploadFileToStorage === 'function' && window.firebaseAuth?.currentUser) {
      const url = await uploadFileToStorage(file, 'uploads');
      if (url) return url;
    }
  } catch (err) {
    console.warn('Falha no upload para Storage. Usando base64 como fallback:', err);
  }

  // Fallback para pré-cadastro antes do login ou para execução local sem Firebase.
  return new Promise((resolve, reject) => {
    if (file.size > 2 * 1024 * 1024) {
      return resizeImage(file, 1200).then(resolve).catch(reject);
    }
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function resizeImage(file, maxDim) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round(height * maxDim / width);
            width = maxDim;
          } else {
            width = Math.round(width * maxDim / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Avatar = primeiras letras do nome
function avatarInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length-1][0]).toUpperCase();
}

function renderAvatar(user, size='') {
  const cls = size ? `user-avatar ${size}` : 'user-avatar';
  if (user?.avatar) {
    return `<div class="${cls}"><img src="${user.avatar}" alt="${user.name}"></div>`;
  }
  return `<div class="${cls}">${avatarInitials(user?.name)}</div>`;
}

function escapeHtml(s) {
  if (!s) return '';
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

window.CATEGORY_LABELS = CATEGORY_LABELS;
window.TURNO_LABELS = TURNO_LABELS;
window.ROLE_LABELS = ROLE_LABELS;
window.AUTO_APPROVE_CATEGORIES = AUTO_APPROVE_CATEGORIES;
window.RES_STATUS = RES_STATUS;
window.STOCK_AVAILABILITY = STOCK_AVAILABILITY;
window.STOCK_AVAIL_CLASS = STOCK_AVAIL_CLASS;
window.STOCK_UNITS = STOCK_UNITS;
window.fmtDate = fmtDate;
window.fmtDateLong = fmtDateLong;
window.fmtDateTime = fmtDateTime;
window.fmtTime = fmtTime;
window.todayISO = todayISO;
window.turnoText = turnoText;
window.slotText = slotText;
window.toast = toast;
window.fileToDataURL = fileToDataURL;
window.avatarInitials = avatarInitials;
window.renderAvatar = renderAvatar;
window.escapeHtml = escapeHtml;
