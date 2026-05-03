/* ============================================================
   seed.js — Dados de demonstração pré-cadastrados
   Roda apenas se o DB ainda não foi populado (db_seeded_v4 ausente)
   ============================================================ */

const SEED_FLAG = 'labeme_seeded_v4';

const SEED_DATA_USERS = [
  // 2 admins
  {
    id: 'u_admin', name: 'Coordenação LABEME',
    email: 'admin@labeme.ufpb.br', password: 'labeme2026',
    category: 'prof_depto', role: 'admin',
    advisor: '', institution: 'UFPB', phone: '(83) 99999-0000',
    avatar: null, profileReminderShown: true
  },
  {
    id: 'u_admin2', name: 'Prof. José Augusto Gomes Neto',
    email: 'jose.augusto@academico.ufpb.br', password: 'labeme2026',
    category: 'prof_depto', role: 'admin',
    advisor: '', institution: 'UFPB', phone: '(83) 99999-0001',
    avatar: null, profileReminderShown: true
  },
  // 2 técnicos
  {
    id: 'u_tech', name: 'João Técnico',
    email: 'tecnico@labeme.ufpb.br', password: 'tecnico2026',
    category: 'tecnico', role: 'technician',
    advisor: '', institution: 'UFPB', phone: '(83) 98888-7777',
    avatar: null, profileReminderShown: true
  },
  {
    id: 'u_tech2', name: 'Carla Andrade',
    email: 'carla.andrade@labeme.ufpb.br', password: 'tecnico2026',
    category: 'tecnico', role: 'technician',
    advisor: '', institution: 'UFPB', phone: '(83) 98888-7778',
    avatar: null, profileReminderShown: true
  },
  // 5 alunos
  {
    id: 'u_aluno1', name: 'Maria Silva',
    email: 'maria.silva@academico.ufpb.br', password: 'aluno123',
    category: 'mestrado', role: 'user',
    advisor: 'Prof. Dr. José Augusto Gomes Neto', institution: '',
    phone: '(83) 98765-4321', avatar: null, profileReminderShown: true
  },
  {
    id: 'u_aluno2', name: 'Pedro Santos',
    email: 'pedro.santos@academico.ufpb.br', password: 'aluno123',
    category: 'doutorado', role: 'user',
    advisor: 'Prof. Dr. José Augusto Gomes Neto', institution: '',
    phone: '(83) 98765-4322', avatar: null, profileReminderShown: true
  },
  {
    id: 'u_aluno3', name: 'Ana Costa',
    email: 'ana.costa@academico.ufpb.br', password: 'aluno123',
    category: 'graduacao', role: 'user',
    advisor: 'Prof. Dr. José Augusto Gomes Neto', institution: '',
    phone: '(83) 98765-4323', avatar: null, profileReminderShown: true
  },
  {
    id: 'u_aluno4', name: 'Lucas Ferreira',
    email: 'lucas.ferreira@academico.ufpb.br', password: 'aluno123',
    category: 'graduacao', role: 'user',
    advisor: 'Prof. Dr. José Augusto Gomes Neto', institution: '',
    phone: '(83) 98765-4324', avatar: null, profileReminderShown: true
  },
  {
    id: 'u_aluno5', name: 'Juliana Oliveira',
    email: 'juliana.oliveira@academico.ufpb.br', password: 'aluno123',
    category: 'mestrado', role: 'user',
    advisor: 'Prof. Dr. José Augusto Gomes Neto', institution: '',
    phone: '(83) 98765-4325', avatar: null, profileReminderShown: true
  }
];

const SEED_DATA_RESOURCES = [
  {
    id: 'r1', name: 'Prensa hidráulica EMIC PCE 100',
    type: 'equipment', mode: 'slot',
    description: 'Prensa de 100 toneladas para ensaios de compressão axial em corpos-de-prova de concreto e argamassa. Conforme NBR 5739.',
    location: 'Sala de ensaios mecânicos — bancada principal',
    totalQuantity: 1, color: 'navy', active: true,
    requiresTechnicianAssist: true, requiresTechnicianPresence: true,
    requiresReturnPhoto: false, photo: null
  },
  {
    id: 'r2', name: 'Esclerômetro de reflexão Schmidt',
    type: 'equipment', mode: 'turno',
    description: 'Ensaio não-destrutivo de dureza superficial em concreto endurecido. Marca Proceq, modelo N.',
    location: 'Armário de equipamentos portáteis — gaveta 2',
    totalQuantity: 2, color: 'green', active: true,
    requiresTechnicianAssist: false, requiresTechnicianPresence: false,
    requiresReturnPhoto: true, photo: null
  },
  {
    id: 'r3', name: 'Ultrassom para concreto Pundit Lab',
    type: 'equipment', mode: 'slot',
    description: 'Velocidade de pulso ultrassônico em estruturas e corpos-de-prova. Determinação de homogeneidade e detecção de fissuras.',
    location: 'Armário de equipamentos portáteis — gaveta 1',
    totalQuantity: 1, color: 'steel', active: true,
    requiresTechnicianAssist: true, requiresTechnicianPresence: false,
    requiresReturnPhoto: true, photo: null
  },
  {
    id: 'r4', name: 'Betoneira 400L',
    type: 'equipment', mode: 'turno',
    description: 'Mistura de concretos e argamassas — capacidade 400 litros. Inversora de rotação.',
    location: 'Pátio externo — área de produção',
    totalQuantity: 1, color: 'amber', active: true,
    requiresTechnicianAssist: false, requiresTechnicianPresence: false,
    requiresReturnPhoto: false, photo: null
  },
  {
    id: 'r5', name: 'Conjunto de peneiras granulométricas',
    type: 'consumable', mode: 'turno',
    description: 'Série de peneiras NBR conforme NBR 7211. Inclui agitador mecânico Solotest.',
    location: 'Bancada de granulometria — sala de ensaios físicos',
    totalQuantity: 3, color: 'green', active: true,
    requiresTechnicianAssist: false, requiresTechnicianPresence: false,
    requiresReturnPhoto: true, photo: null
  },
  {
    id: 'r6', name: 'Sala de cura úmida',
    type: 'space', mode: 'turno',
    description: 'Câmara úmida para cura de corpos-de-prova segundo NBR 5738. Capacidade ~200 CPs cilíndricos.',
    location: 'Anexo lateral — fundos do laboratório',
    totalQuantity: 1, color: 'steel', active: true,
    requiresTechnicianAssist: false, requiresTechnicianPresence: false,
    requiresReturnPhoto: false, photo: null
  },
  {
    id: 'r7', name: 'Moldes cilíndricos 10×20cm',
    type: 'consumable', mode: 'turno',
    description: 'Moldes metálicos para corpos-de-prova cilíndricos 10×20 cm. Conforme NBR 5738.',
    location: 'Estante de moldes — prateleira A',
    totalQuantity: 30, color: 'amber', active: true,
    requiresTechnicianAssist: false, requiresTechnicianPresence: false,
    requiresReturnPhoto: true, photo: null
  },
  {
    id: 'r8', name: 'Moldes cilíndricos 5×10cm',
    type: 'consumable', mode: 'turno',
    description: 'Moldes metálicos para corpos-de-prova cilíndricos 5×10 cm. Argamassa.',
    location: 'Estante de moldes — prateleira B',
    totalQuantity: 40, color: 'amber', active: true,
    requiresTechnicianAssist: false, requiresTechnicianPresence: false,
    requiresReturnPhoto: true, photo: null
  },
  {
    id: 'r9', name: 'Estufa de secagem 220L',
    type: 'equipment', mode: 'turno',
    description: 'Estufa elétrica para secagem até 200°C. Determinação de teor de umidade.',
    location: 'Sala de ensaios físicos — bancada B',
    totalQuantity: 1, color: 'navy', active: true,
    requiresTechnicianAssist: false, requiresTechnicianPresence: false,
    requiresReturnPhoto: false, photo: null
  },
  {
    id: 'r10', name: 'Balança analítica 0,01g',
    type: 'equipment', mode: 'turno',
    description: 'Balança eletrônica de precisão até 6 kg, resolução 0,01 g. Marca Marte.',
    location: 'Sala de ensaios físicos — bancada A',
    totalQuantity: 1, color: 'green', active: true,
    requiresTechnicianAssist: false, requiresTechnicianPresence: false,
    requiresReturnPhoto: false, photo: null
  }
];

const SEED_DATA_STOCK = [
  {
    name: 'Cimento CP II-E-32', type: 'Aglomerante',
    location: 'Tambor 01',
    professorId: 'u_admin2', professorName: 'Prof. José Augusto Gomes Neto',
    advisee: 'Maria Silva', availability: 'in_use',
    quantity: 25, unit: 'kg', notes: 'Lote A2024 — validade jul/2026'
  },
  {
    name: 'Cimento CP V-ARI', type: 'Aglomerante',
    location: 'Tambor 02',
    professorId: 'u_admin2', professorName: 'Prof. José Augusto Gomes Neto',
    advisee: '', availability: 'available',
    quantity: 50, unit: 'kg', notes: ''
  },
  {
    name: 'Areia média lavada', type: 'Agregado miúdo',
    location: 'Tambor 03',
    professorId: 'u_admin2', professorName: 'Prof. José Augusto Gomes Neto',
    advisee: 'Pedro Santos', availability: 'in_use',
    quantity: 40, unit: 'kg', notes: 'Doação CETENE — secagem realizada'
  },
  {
    name: 'Brita 19mm (graduação 1)', type: 'Agregado graúdo',
    location: 'Tambor 04',
    professorId: 'u_admin2', professorName: 'Prof. José Augusto Gomes Neto',
    advisee: '', availability: 'available',
    quantity: 80, unit: 'kg', notes: ''
  },
  {
    name: 'Brita 9,5mm', type: 'Agregado graúdo',
    location: 'Tambor 05',
    professorId: 'u_admin2', professorName: 'Prof. José Augusto Gomes Neto',
    advisee: '', availability: 'long_term',
    quantity: 60, unit: 'kg', notes: 'Reserva técnica'
  },
  {
    name: 'Sílica ativa', type: 'Adição mineral',
    location: 'Prateleira A2',
    professorId: 'u_admin2', professorName: 'Prof. José Augusto Gomes Neto',
    advisee: 'Juliana Oliveira', availability: 'in_use',
    quantity: 5, unit: 'kg', notes: 'Tese de mestrado — 2026'
  },
  {
    name: 'Cinza volante', type: 'Adição mineral',
    location: 'Prateleira A3',
    professorId: 'u_admin2', professorName: 'Prof. José Augusto Gomes Neto',
    advisee: '', availability: 'long_term',
    quantity: 15, unit: 'kg', notes: 'Doação Termopernambuco'
  },
  {
    name: 'Aditivo superplastificante MC-PowerFlow', type: 'Aditivo',
    location: 'Prateleira B1',
    professorId: 'u_admin2', professorName: 'Prof. José Augusto Gomes Neto',
    advisee: 'Maria Silva', availability: 'in_use',
    quantity: 10, unit: 'L', notes: 'Frasco aberto — validade nov/2026'
  },
  {
    name: 'Fibras de bambu beneficiadas', type: 'Fibra natural',
    location: 'Caixa C — armário de pesquisa',
    professorId: 'u_admin2', professorName: 'Prof. José Augusto Gomes Neto',
    advisee: 'Pedro Santos', availability: 'in_use',
    quantity: 8, unit: 'kg', notes: 'Pesquisa Rede Brasileira do Bambu'
  },
  {
    name: 'Resíduo de construção e demolição (RCD) moído',
    type: 'Agregado reciclado',
    location: 'Tambor 06',
    professorId: 'u_admin2', professorName: 'Prof. José Augusto Gomes Neto',
    advisee: 'Lucas Ferreira', availability: 'in_use',
    quantity: 30, unit: 'kg', notes: 'TCC — argamassas autonivelantes'
  }
];

function seedReservations() {
  const today = new Date();
  const isoOffset = (days) => {
    const d = new Date(today);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0,10);
  };
  return [
    // Aprovadas próximas
    {
      id: 'res_seed1', userId: 'u_aluno1', resourceId: 'r1',
      date: isoOffset(2), mode: 'slot', slot: { start: '14:00', end: '16:00' },
      purpose: 'Ensaio de compressão axial — corpos-de-prova de argamassas com adição de RCD.',
      quantity: 1, status: 'approved',
      createdAt: Date.now() - 86400000, returnPhotoRequired: false,
      returnPhoto: null, returnedAt: null
    },
    {
      id: 'res_seed2', userId: 'u_aluno2', resourceId: 'r4',
      date: isoOffset(1), mode: 'turno', slot: { turno: 'manha' },
      purpose: 'Produção de concreto para pesquisa de doutorado.',
      quantity: 1, status: 'approved',
      createdAt: Date.now() - 172800000, returnPhotoRequired: false,
      returnPhoto: null, returnedAt: null
    },
    {
      id: 'res_seed3', userId: 'u_aluno5', resourceId: 'r6',
      date: isoOffset(3), mode: 'turno', slot: { turno: 'tarde' },
      purpose: 'Cura de corpos-de-prova com sílica ativa.',
      quantity: 1, status: 'approved',
      createdAt: Date.now() - 86400000, returnPhotoRequired: false,
      returnPhoto: null, returnedAt: null
    },
    // Pendentes (graduação — precisa aprovação)
    {
      id: 'res_seed4', userId: 'u_aluno3', resourceId: 'r2',
      date: isoOffset(4), mode: 'turno', slot: { turno: 'manha' },
      purpose: 'TCC — caracterização não-destrutiva de concreto envelhecido.',
      quantity: 1, status: 'pending',
      createdAt: Date.now() - 7200000, returnPhotoRequired: true,
      returnPhoto: null, returnedAt: null
    },
    {
      id: 'res_seed5', userId: 'u_aluno4', resourceId: 'r7',
      date: isoOffset(5), mode: 'turno', slot: { turno: 'tarde' },
      purpose: 'TCC — produção de 8 corpos-de-prova cilíndricos para ensaio.',
      quantity: 8, status: 'pending',
      createdAt: Date.now() - 3600000, returnPhotoRequired: true,
      returnPhoto: null, returnedAt: null
    },
    {
      id: 'res_seed6', userId: 'u_aluno3', resourceId: 'r8',
      date: isoOffset(6), mode: 'turno', slot: { turno: 'manha' },
      purpose: 'Moldagem de 12 CPs de argamassa com agregado reciclado.',
      quantity: 12, status: 'pending',
      createdAt: Date.now() - 1800000, returnPhotoRequired: true,
      returnPhoto: null, returnedAt: null
    },
    // Reserva passada (devolvida)
    {
      id: 'res_seed7', userId: 'u_aluno1', resourceId: 'r3',
      date: isoOffset(-2), mode: 'slot', slot: { start: '08:00', end: '10:00' },
      purpose: 'Medição de velocidade de pulso ultrassônico.',
      quantity: 1, status: 'returned',
      createdAt: Date.now() - 432000000, returnPhotoRequired: true,
      returnPhoto: null, returnedAt: Date.now() - 172800000
    }
  ];
}

function seedMessages() {
  const now = Date.now();
  return [
    {
      id: 'msg_s1', fromUserId: 'u_aluno1', toUserId: 'u_admin',
      body: 'Olá professor, gostaria de confirmar a reserva da prensa para quarta-feira.',
      sentAt: now - 7200000, readAt: now - 5400000
    },
    {
      id: 'msg_s2', fromUserId: 'u_admin', toUserId: 'u_aluno1',
      body: 'Olá Maria, confirmado! O técnico João estará no laboratório no horário combinado.',
      sentAt: now - 5400000, readAt: now - 3600000
    },
    {
      id: 'msg_s3', fromUserId: 'u_aluno3', toUserId: 'u_tech',
      body: 'Boa tarde! Posso pegar os moldes 5x10cm com você amanhã pela manhã?',
      sentAt: now - 3600000, readAt: null
    }
  ];
}

function applySeedData() {
  if (localStorage.getItem(SEED_FLAG) === '1') return false;

  console.log('🌱 Populando dados de demonstração...');

  // Substitui usuários
  window.db.users = SEED_DATA_USERS.map(u => ({ ...u, createdAt: Date.now() }));

  // Adiciona recursos
  window.db.resources = SEED_DATA_RESOURCES.map(r => ({ ...r }));

  // Adiciona itens de estoque
  window.db.stock = SEED_DATA_STOCK.map((s, idx) => ({
    id: 'stk_seed' + (idx + 1),
    ...s,
    addedBy: 'u_tech',
    addedAt: Date.now() - (idx * 86400000)
  }));

  // Adiciona reservas
  window.db.reservations = seedReservations();

  // Adiciona mensagens
  window.db.messages = seedMessages();

  window.saveDB();
  localStorage.setItem(SEED_FLAG, '1');
  console.log('✅ Seed concluído:',
    window.db.users.length, 'usuários,',
    window.db.resources.length, 'recursos,',
    window.db.stock.length, 'materiais,',
    window.db.reservations.length, 'reservas,',
    window.db.messages.length, 'mensagens.'
  );
  return true;
}

window.applySeedData = applySeedData;
window.SEED_FLAG = SEED_FLAG;
