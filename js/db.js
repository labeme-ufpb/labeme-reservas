/* ============================================================
   db.js — Camada de persistência (v3)
   ============================================================ */

const DB_KEY = 'labeme_db_v3';
const SESSION_KEY = 'labeme_session_v3';

const DEFAULT_SETTINGS = {
  minAdvanceHours: 24,
  maxAdvanceDays: 30,
  notifyEmail: true,
  labName: 'LABEME — UFPB',
  adminEmail: 'admin@labeme.ufpb.br',
  // Apenas manhã e tarde — turno noite removido
  turnoManha: { start: '08:00', end: '12:00' },
  turnoTarde: { start: '14:00', end: '17:00' }
};

const SEED_USERS = [
  {
    id: 'u_admin',
    name: 'Coordenação LABEME',
    email: 'admin@labeme.ufpb.br',
    password: 'labeme2026',
    category: 'prof_depto',
    role: 'admin',
    advisor: '',
    institution: 'UFPB',
    phone: '(83) 99999-0000',
    avatar: null,
    profileReminderShown: true,
    createdAt: Date.now()
  },
  {
    id: 'u_tech',
    name: 'João Técnico (demo)',
    email: 'tecnico@labeme.ufpb.br',
    password: 'tecnico2026',
    category: 'tecnico',
    role: 'technician',
    advisor: '',
    institution: 'UFPB',
    phone: '(83) 98888-7777',
    avatar: null,
    profileReminderShown: true,
    createdAt: Date.now()
  }
];

function loadDB() {
  const raw = localStorage.getItem(DB_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      // Garante que estruturas novas existam mesmo em DBs antigos
      if (!parsed.messages) parsed.messages = [];
      if (!parsed.stock) parsed.stock = [];
      return parsed;
    } catch(e) { console.warn('DB corrupted, resetting'); }
  }
  const fresh = {
    users: SEED_USERS.slice(),
    resources: [],
    reservations: [],
    messages: [],   // {id, fromUserId, toUserId, body, sentAt, readAt}
    stock: [],      // {id, name, type, location, professorId, professorName, advisee, availability, quantity, unit, photo, addedBy, addedAt}
    settings: { ...DEFAULT_SETTINGS }
  };
  localStorage.setItem(DB_KEY, JSON.stringify(fresh));
  return fresh;
}

function saveDB() {
  localStorage.setItem(DB_KEY, JSON.stringify(window.db));
}

function uid(prefix='id') {
  return prefix + '_' + Math.random().toString(36).slice(2, 10);
}

function getResource(id) { return window.db.resources.find(r => r.id === id); }
function getUser(id) { return window.db.users.find(u => u.id === id); }
function getReservation(id) { return window.db.reservations.find(r => r.id === id); }
function getStockItem(id) { return window.db.stock.find(s => s.id === id); }

window.loadDB = loadDB;
window.saveDB = saveDB;
window.uid = uid;
window.getResource = getResource;
window.getUser = getUser;
window.getReservation = getReservation;
window.getStockItem = getStockItem;
window.DB_KEY = DB_KEY;
window.SESSION_KEY = SESSION_KEY;
