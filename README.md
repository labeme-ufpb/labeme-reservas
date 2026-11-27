# LABEME — Sistema de Reservas

Agendamento de equipamentos, espaços e estoque de materiais do Laboratório de Ensaios de Materiais e Estruturas (LABEME), Centro de Tecnologia, UFPB.

- **Site:** https://labeme-reservas.web.app
- **Perfis:** usuário (alunos e professores), equipe técnica e coordenação
- **Instalável no celular:** no navegador, menu → "Adicionar à tela inicial"

## Como funciona

| Parte | Onde |
| --- | --- |
| Páginas do sistema | `public/` → Firebase Hosting |
| Login e senhas | Firebase Authentication (e-mail e senha) |
| Dados (reservas, usuários, estoque, mensagens) | Cloud Firestore, região southamerica-east1 (São Paulo) |
| Fotos | Coleção `photos` do Firestore (referência `photo:<id>`; cache no aparelho) |
| Contatos (e-mail, telefone) | Coleção `contacts` — só o próprio usuário e a equipe leem (LGPD) |
| Regras de acesso | `firestore.rules` |

`public/js/db.js` mantém um espelho em memória (`window.db`) sincronizado em tempo real; `saveDB()` grava só os documentos que mudaram e envia fotos ao Storage.

## Publicação

- Todo envio para a branch `main` publica o site, as regras do Firestore e as regras do Storage (GitHub Actions → `.github/workflows/firebase-hosting-merge.yml`).
- A autenticação do GitHub no Google é sem chave secreta (Workload Identity Federation), configurada uma vez por `scripts/setup-github-deploy.sh` no Cloud Shell. Só este repositório pode publicar.
- Para voltar a uma versão anterior: console do Firebase → Hosting → histórico de versões → Reverter.

## Primeiro acesso

A coordenação é definida pelo campo `role: "admin"` do documento `users/{uid}` no Firestore. No primeiro acesso da coordenação, o inventário (91 equipamentos de `public/js/catalog.js`) e as configurações padrão são gravados automaticamente.

## Histórico

### v11.17 (27/11/2026) — lembrete da foto a cada entrada
- Quem está sem foto de perfil vê o lembrete "Adicione uma foto de perfil" a cada entrada no sistema (uma vez por sessão: abrir o site/app de novo ou entrar depois de "Sair"). Deixa de aparecer quando a foto é salva.

### v11.16 (27/11/2026) — Reservas futuras
- Novo botão "Reservas futuras" (próximos 60 dias, agrupado por dia, com contador por dia) na Coordenação (caixa no topo + menu lateral, a partir de amanhã) e no Painel técnico (aba, a partir de hoje). Aprovar/iniciar/concluir na própria linha.

### v11.15 (26/11/2026) — caixas da Coordenação clicáveis
- As caixas do topo da aba Coordenação abrem a lista correspondente logo abaixo, com rolagem automática e a caixa escolhida destacada: Pendentes (aprovar/recusar na própria linha), Hoje, Próximos 7 dias (nova, agrupada por dia), Devoluções e Em manutenção (agora abre a aba Manutenção).
- Novas abas laterais "Hoje" e "Próximos 7 dias" na Coordenação, com as mesmas ações rápidas do Painel técnico.

### v11.14 (24/11/2026) — solicitante em destaque, fotos ampliáveis, recorte da foto de perfil
- Ficha da reserva: bloco "Solicitante" no topo, com nome em destaque, miniatura da foto, vínculo, instituição e orientador(a).
- Toda miniatura com foto (ficha da reserva, lista de usuários, edição de usuário, mensagens, perfil) amplia ao clicar (`viewAvatar` / `openImageViewer`); o clique não abre a linha ou o cartão onde a miniatura está. A miniatura da barra superior continua sendo o atalho para o perfil.
- Foto de perfil (cadastro, Meu perfil e lembrete de foto): passa pelo mesmo ajuste de enquadramento dos equipamentos, com guia redonda; gravada em 640 × 640 (antes 320).
- "Externo à UFPB" agora informa orientador(a) (cadastro, perfil, tela de completar cadastro, Cadastrar usuário). Externos já cadastrados sem orientador são pedidos a informar no próximo acesso. Professor externo não precisa.

### v11.13 (23/11/2026) — excluir usuário apaga também a conta de acesso
- Ao excluir um usuário (Coordenação → Usuários → Excluir), o sistema apaga o perfil, o contato (e-mail/WhatsApp) e registra um pedido em `authDeletions/{uid}`.
- O workflow **Excluir contas de acesso** (`.github/workflows/excluir-contas.yml`, a cada 10 min, grátis) apaga a conta no Firebase Authentication com o Admin SDK (`scripts/excluir-contas.js`), usando a mesma conta de serviço da publicação. Só apaga se o perfil não existir mais. Depois disso o e-mail pode ser cadastrado de novo, com qualquer senha.
- Modos manuais (Actions → Excluir contas de acesso → Run workflow): `orfas-listar` / `orfas-apagar` (contas de acesso sem perfil, sem uso há 2+ dias), `autoteste`. Os registros do Actions são públicos: o script só imprime números.
- Atenção: o GitHub pausa tarefas agendadas de repositórios públicos sem atividade por 60 dias (avisa por e-mail; reativar em Actions).

### v11.12 (23/11/2026) — "e-mail já cadastrado" para quem foi cadastrado pela coordenação
- **Causa:** quando a coordenação usa "Cadastrar usuário", a conta de acesso (Firebase Authentication) já é criada. Se a pessoa depois tentava "Criar conta" com o mesmo e-mail, o Firebase recusava e o sistema só dizia "E-mail já cadastrado".
- **Criar conta com e-mail que já tem conta:** o sistema tenta entrar com a senha digitada; se der certo, entra e completa o perfil com o que foi preenchido (só campos vazios — nada que a coordenação definiu é trocado). Se a senha não confere, explica que a conta já existe e oferece "Entrar" ou "Enviar link para criar senha". Também recria o perfil completo quando a conta de acesso existe mas o perfil foi excluído.
- **Cadastrar usuário (coordenação):** por padrão a pessoa recebe um e-mail para criar a própria senha (o sistema gera uma senha aleatória provisória); continua possível definir a senha inicial. Ao final, aviso para orientar a pessoa a usar "Entrar", não "Criar conta". Mensagem clara quando o e-mail já tem conta de acesso (ex.: perfil excluído antes).
- Tela "Complete seu cadastro": pede o aceite das normas quando a conta ainda não tem (ex.: contas criadas pela coordenação).
- Aba "Criar conta": lembrete "Já tem conta, ou a coordenação já cadastrou você? Entrar".

### v11.11.1 (19/11/2026)
- Painel ao vivo: mostra o nome completo de quem reservou.

### v11.11 (19/11/2026) — horários fixos nas salas e painel ao vivo
- **Horários fixos (aulas):** em Coordenação → Recursos → Editar, recursos do tipo "Espaço" ganham a seção "Horários fixos". Marque os dias da semana, início, término, descrição (ex.: "Aula — Materiais II") e o período de validade (ex.: o semestre). Esses horários ficam bloqueados: aparecem na agenda (listrados, com cadeado), na ficha do espaço e na disponibilidade da nova reserva, e ninguém consegue reservar por cima. Ao salvar, se já houver reservas nesses horários, o sistema lista e pergunta se deve cancelá-las e avisar os usuários. Guardado em `resources.fixedBlocks` (até 40 por espaço).
- **Painel ao vivo "Hoje no LABEME"** (`…/#painel`), para TV ou monitor: relógio, o que está em uso agora, próximos usos do dia, salas livres/ocupadas, equipamentos em manutenção, avisos da coordenação e QR code do sistema. Atualiza sozinho em tempo real, mantém a tela acesa quando o navegador permite e recarrega de madrugada para pegar versões novas. Mostra o nome completo de quem reservou (v11.11.1). Botão "Painel ao vivo (TV)" no Painel técnico. Funciona com qualquer conta ativa — recomendado criar uma conta só para a TV.
- Link direto para uma tela (ex.: `#painel`) abre essa tela depois do login.
- Correção: dados novos chegando de outro aparelho não atualizavam a tela logo após o login (o campo de senha escondido continuava "em foco").

### v11.10 (17/11/2026) — cadastro com foto corrigido e dados obrigatórios
- **Correção:** no cadastro com foto de perfil, a foto era gravada antes do perfil e as regras a recusavam (só aceitam fotos de quem já tem perfil). O cadastro inteiro se perdia e, no acesso seguinte, a conta era criada vazia — sem vínculo, orientador, instituição, WhatsApp nem aceite das normas. Agora o perfil é gravado primeiro e a foto em seguida.
- WhatsApp obrigatório no cadastro e no perfil (DDD + número; aceita +55 e números estrangeiros).
- Tela obrigatória "Complete seu cadastro" ao entrar, para usuários comuns com dados faltando (nome e sobrenome, WhatsApp, vínculo, orientador para estudantes, instituição para externos). Não fecha com Esc nem clicando fora; só "Salvar e continuar" ou "Sair". Reservas ficam bloqueadas até completar. Coordenação e equipe técnica não passam por ela.
- Regras: o próprio usuário só escolhe o vínculo se a conta ainda não tiver um (nunca "Graduação com vínculo"); depois disso, só a coordenação altera.
- Coordenação → Usuários: etiqueta "Cadastro incompleto", com o que falta ao passar o mouse.

### v11.9 (12/11/2026) — vídeos explicativos e normas formatadas
- Ficha do equipamento (e página aberta pelo QR code) ganhou o espaço "Vídeo: como usar": miniatura do YouTube; ao tocar, o vídeo toca ali mesmo (youtube-nocookie) ou abre no YouTube. Sem vídeo, aparece "em preparação".
- Coordenação → Configurações → "Vídeos explicativos dos equipamentos": colar o link de cada equipamento, com miniatura na hora; também em Recursos → Editar. Guarda só o ID do vídeo (`resources.videoId`, validado nas regras). CSP liberada para i.ytimg.com e youtube-nocookie.com.
- Normas de uso no cadastro respeitam as quebras de linha; linhas com "-" viram tópicos. Prévia ao editar em Configurações.

### v11.8.1 (08/11/2026) — enquadramento também no estoque
- Fotos do Estoque de materiais passam pelo mesmo ajuste (arrastar, aproximar, girar, foto inteira), em formato quadrado 1000×1000 — o mesmo das miniaturas do estoque. Botão "Ajustar enquadramento" no cadastro. A área de ajuste limita a altura a ~55% da tela.

### v11.8 (07/11/2026) — enquadramento das fotos dos equipamentos
- Ao escolher a foto de um equipamento abre o ajuste de enquadramento (arrastar, aproximar com controle/roda/pinça, girar 90°, "foto inteira" com fundo branco). Resultado em JPG 1200×800 (3:2), o mesmo formato do cartão do catálogo, que agora tem proporção fixa 3:2. Botão "Ajustar enquadramento" para reenquadrar fotos já cadastradas. Código em `js/cropper.js`.

### v11.7 (07/11/2026) — manutenção e calibração, QR code e lista de espera
- **Manutenção e calibração**: ficha de cada equipamento com problemas relatados, manutenções e calibrações (empresa, nº do certificado, próxima data). Qualquer usuário relata problema (com foto opcional); equipe técnica e coordenação registram, resolvem (quem relatou é avisado) e colocam/retiram o equipamento de manutenção. Periodicidade e próxima calibração no cadastro do recurso; alertas de calibração vencida/a vencer (30 dias). Nova aba Coordenação → Manutenção e Painel técnico → Manutenção. Coleção `maintenance`.
- **QR code**: link direto `#equip/<id>` abre a ficha do equipamento (agenda, reservar, relatar problema); sem login, entra e depois abre a ficha. Etiquetas para impressão A4 (12 ou 4 por folha) em Recursos → Etiquetas QR, e QR individual na ficha. Biblioteca `js/vendor/qrcode.js` (qrcode-generator 1.4.4, MIT).
- **Lista de espera**: quando o período está ocupado, o usuário entra na fila pelo próprio formulário. Ao cancelamento/recusa, o 1º da fila recebe a janela "Vaga liberada" e reserva com um clique; após 2 h sem resposta, o próximo também é avisado. Aba "Lista de espera" em Minhas reservas. Coleção `waitlist` (entradas antigas limpas automaticamente).

### v11.6 (06/11/2026) — avisos gerais da coordenação
- Nova aba **Coordenação → Avisos**: título, mensagem, tipo (informativo ou importante) e data final opcional.
- Cada usuário vê o aviso em uma janela ao entrar no sistema (ou na hora, se já estiver conectado) até clicar em "Entendi"; o "visto" fica no perfil (`users.seenAnnouncements`) e vale em qualquer aparelho.
- A coordenação acompanha quantos já viram, pode encerrar ou excluir. Avisos ativos ficam listados no topo de Mensagens.
- Nova coleção `announcements` (leitura: usuários ativos; escrita: só coordenação).

### v11.5 (06/11/2026) — LGPD e plano gratuito
- E-mail e telefone saem de `users` (lido por todos os logados) e vão para `contacts/{uid}` (só o dono e a equipe). Migração automática no primeiro acesso da coordenação.
- Fotos deixam o Cloud Storage (que exige plano pago) e passam para a coleção `photos`, carregadas sob demanda e guardadas em cache no aparelho. Migração automática das fotos antigas.
- Projeto volta ao plano Spark (gratuito) em 06/11/2026; Cloud Storage não é mais usado.

### v11.4 (06/11/2026) — revisão de segurança
- Regras do Firestore validam IDs, formatos e tamanhos de todos os campos; reservas de usuários respeitam equipamento ativo, quantidade, data, vários dias e aprovação; o dono de uma reserva só pode cancelar ou enviar a devolução; avisos automáticos só pela equipe; coleções desconhecidas bloqueadas.
- Storage aceita só JPG/PNG/WebP até 5 MB em caminhos válidos.
- Navegador descarta documentos adulterados (`sanitizeDoc` em db.js), escapa horários e quantidades, protege CSV contra injeção de fórmulas.
- Cabeçalhos de segurança (CSP, anti-iframe, nosniff); script externo do EmailJS removido (não estava configurado).

### v11.3 (06/11/2026)
- **Reservas de vários dias (de… até…):** a coordenação libera por equipamento (Coordenação → Recursos → "Permitir reserva de vários dias" + máximo de dias). Reservas com `mode: "days"`, `date` (início) e `endDate` (fim); o equipamento fica ocupado o dia todo em cada dia do período.
- **Categoria "Graduação com vínculo":** só a coordenação atribui (não aparece no cadastro); entra na aprovação automática. As regras do servidor impedem que o próprio aluno escolha essa categoria ou altere a sua categoria.
- Menu do perfil com até 3 nomes.

### v11.2 (03/11/2026)
Estoque: cadastro de tambor, armário ou prateleira como **local vazio** (botão "Local vazio" ou opção no cadastro), filtro "Locais vazios" e contagem. Ao guardar material num local vazio, a marcação sai sozinha.

### v11.1 (03/11/2026)
Coordenação: exclusão de contas de teste com as reservas; tabela de usuários sem rolagem lateral; erros do "Esqueci minha senha" visíveis.

### v11 (03/11/2026)
Migração para Firebase: login real, dados compartilhados em tempo real entre todos os aparelhos, fotos no Storage, regras de acesso por perfil no servidor, recuperação de senha por e-mail, publicação automática pelo GitHub e instalação como aplicativo no celular.

### v10.1 (02/11/2026)
Login obrigatório com página de boas-vindas (+ Instagram @labeme.ufpb); numeração interna removida das telas e exportações;
logo sem fundo na proporção original; fundo azulado destacando os cartões; filtros com rótulo e legíveis no modo escuro do celular;
estoque em cartões no celular; botão "+" só em Agenda, Equipamentos e Minhas reservas; envio de foto corrigido (perfil e materiais);
perfil rolando normalmente no celular; rodapé simplificado; coluna Quantidade sem quebra de linha.

### v10.2 (02/11/2026)
Página inicial com logos UFPB e CT pequenas ao lado do LABEME (removidas do restante do sistema); Instagram centralizado no celular;
filtro de equipamento em lista própria com busca e fotos; agenda dos usuários abre em "Só as minhas reservas" (pode desligar);
estoque com ícone do local (tambor, prateleira, armário/caixa); técnicos e coordenação podem reservar em nome de outro usuário
(reserva já aprovada e a pessoa é avisada); botões de foto tocáveis em qualquer celular (cadastro, perfil, materiais, devolução);
mensagens em tela cheia no celular; seções da coordenação em grade de botões no celular.

### v10.3 (02/11/2026)
Logos UFPB (em cima) e CT (embaixo) à direita da logo do LABEME, somando a mesma altura; exportação CSV do estoque só para a coordenação.

### v10.4 (02/11/2026)
Filtro de localização no estoque (por tipo — tambores, prateleiras, armários — ou por local exato); grupo do equipamento em lista
suspensa com opção "+ Novo grupo…"; fundo próprio no Painel técnico (verde-claro) e na Coordenação (azul-petróleo claro).

### v10.5 (02/11/2026)
Tema por perfil em TODAS as abas: coordenação em azul-marinho com detalhes dourados, selo "Coordenação" no topo e fundo areia
(mantido inclusive no Painel técnico); equipe técnica em verde forte com selo "Equipe técnica" e fundo verde; usuários comuns
seguem o tema padrão. Menu superior compactado para caber em notebooks (1280px+).

### v10.6 (02/11/2026)
Página inicial sem a faixa superior (a logo já aparece no conteúdo); a faixa com logo e menu só surge após o login.
No celular, logo fixa à esquerda e botão do menu à direita.

### v10.7 (02/11/2026)
Mensagens temporárias mais curtas: avisos comuns (boas-vindas, sessão encerrada, salvo…) somem em 1,6 s; erros e alertas em 3 s.
Tocar na mensagem fecha na hora.

### v10.8 (02/11/2026)
Removido o filtro "Situação" da aba Equipamentos (permanecem Buscar, Grupo e Local; itens em manutenção continuam sinalizados no cartão).
