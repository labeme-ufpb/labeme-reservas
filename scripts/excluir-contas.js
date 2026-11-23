/* Exclui contas de acesso (Firebase Authentication) — roda no GitHub Actions (.github/workflows/excluir-contas.yml).
   Por que aqui: no plano gratuito não há Cloud Functions, e o navegador não pode apagar a conta de outra pessoa.
   A conta de serviço github-deploy (papel Firebase Admin) entra sem chave secreta (Workload Identity Federation).

   MODO (variável de ambiente):
     pedidos       (padrão) processa authDeletions/{uid} com status "pending", gravados pela coordenação ao excluir um usuário.
                   Só apaga se o perfil users/{uid} não existir mais; se existir (a pessoa voltou antes), cancela o pedido.
     orfas-listar  conta as contas de acesso sem perfil, sem uso há mais de 2 dias (só mostra o número).
     orfas-apagar  apaga essas contas sem perfil.
     autoteste     cria e apaga uma conta descartável, para conferir as permissões.
     conta         apaga UMA conta de acesso sem perfil, identificada por HASH = sha256 do e-mail em minúsculas
                   (o e-mail não aparece no registro público). Recusa se a conta ainda tiver perfil.
   O repositório é público e os registros do Actions também: nunca imprimir e-mails ou nomes. */
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
initializeApp({ credential: applicationDefault(), projectId: 'labeme-reservas' });
const db = getFirestore(), auth = getAuth();
const MODE = (process.env.MODE || 'pedidos').trim();
const DAY = 24 * 3600 * 1000;

async function eraseAccount(uid) {
  try { await auth.deleteUser(uid); }
  catch (e) { if (e.code !== 'auth/user-not-found') throw e; }
  await db.collection('contacts').doc(uid).delete();
}

async function processRequests() {
  const snap = await db.collection('authDeletions').where('status', '==', 'pending').limit(200).get();
  let done = 0, kept = 0, fail = 0;
  for (const d of snap.docs) {
    const uid = d.id;
    const req = d.data();
    if (Date.now() - (req.requestedAt || 0) < 60 * 1000) continue;   // dá tempo de o perfil ser apagado
    const prof = await db.collection('users').doc(uid).get();
    if (prof.exists) { await d.ref.update({ status: 'cancelled', doneAt: Date.now() }); kept++; continue; }
    try { await eraseAccount(uid); await d.ref.update({ status: 'done', doneAt: Date.now() }); done++; }
    catch (e) { fail++; console.log('Falha ao apagar uma conta:', e.code || e.message); }
  }
  console.log(`Pedidos pendentes: ${snap.size} · contas apagadas: ${done} · canceladas (perfil existe): ${kept} · falhas: ${fail}`);
  if (fail) process.exitCode = 1;
}

async function orphans(erase) {
  const cutoff = Date.now() - 2 * DAY;
  const found = [];
  let token, total = 0;
  do {
    const page = await auth.listUsers(1000, token);
    for (const u of page.users) {
      total++;
      const created = Date.parse(u.metadata.creationTime);
      const last = Date.parse(u.metadata.lastSignInTime || u.metadata.creationTime);
      if (created > cutoff || last > cutoff) continue;   // conta recente: pode ser um cadastro em andamento
      const prof = await db.collection('users').doc(u.uid).get();
      if (!prof.exists) found.push(u.uid);
    }
    token = page.pageToken;
  } while (token);
  console.log(`Contas de acesso: ${total} · sem perfil e sem uso há mais de 2 dias: ${found.length}`);
  if (!erase) return;
  let done = 0;
  for (const uid of found) { try { await eraseAccount(uid); done++; } catch (e) { console.log('Falha:', e.code || e.message); } }
  console.log(`Apagadas: ${done}`);
}

async function eraseByHash(h) {
  const crypto = require('crypto');
  h = String(h || '').trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(h)) { console.log('HASH inválido.'); process.exitCode = 1; return; }
  let token, match = null;
  do {
    const page = await auth.listUsers(1000, token);
    match = page.users.find(u => u.email && crypto.createHash('sha256').update(u.email.toLowerCase()).digest('hex') === h) || null;
    token = page.pageToken;
  } while (token && !match);
  if (!match) { console.log('Nenhuma conta de acesso com esse e-mail.'); return; }
  const prof = await db.collection('users').doc(match.uid).get();
  if (prof.exists) { console.log('A conta tem perfil no sistema: não foi apagada (exclua o usuário pela coordenação).'); process.exitCode = 1; return; }
  await eraseAccount(match.uid);
  console.log('Conta de acesso sem perfil apagada. O e-mail já pode ser cadastrado de novo.');
}

async function selfTest() {
  const u = await auth.createUser({ email: `autoteste-${Date.now()}@example.invalid`, password: 'T' + Math.random().toString(36).slice(2) + '9x' });
  await auth.deleteUser(u.uid);
  const q = await db.collection('authDeletions').where('status', '==', 'pending').limit(1).get();
  console.log(`Autoteste OK: criar e apagar conta de acesso; leitura de pedidos (${q.size} pendente(s)).`);
}

(async () => {
  if (MODE === 'pedidos') await processRequests();
  else if (MODE === 'orfas-listar') await orphans(false);
  else if (MODE === 'orfas-apagar') await orphans(true);
  else if (MODE === 'autoteste') await selfTest();
  else if (MODE === 'conta') await eraseByHash(process.env.HASH);
  else { console.log('MODO desconhecido:', MODE); process.exitCode = 1; }
})().catch(e => { console.log('Erro:', e.code || '', e.message); process.exitCode = 1; });
