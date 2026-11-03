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
| Fotos | Cloud Storage (`uploads/`) |
| Regras de acesso | `firestore.rules` e `storage.rules` |

`public/js/db.js` mantém um espelho em memória (`window.db`) sincronizado em tempo real; `saveDB()` grava só os documentos que mudaram e envia fotos ao Storage.

## Publicação

- Todo envio para a branch `main` publica o site, as regras do Firestore e as regras do Storage (GitHub Actions → `.github/workflows/firebase-hosting-merge.yml`).
- A autenticação do GitHub no Google é sem chave secreta (Workload Identity Federation), configurada uma vez por `scripts/setup-github-deploy.sh` no Cloud Shell. Só este repositório pode publicar.
- Para voltar a uma versão anterior: console do Firebase → Hosting → histórico de versões → Reverter.

## Primeiro acesso

A coordenação é definida pelo campo `role: "admin"` do documento `users/{uid}` no Firestore. No primeiro acesso da coordenação, o inventário (91 equipamentos de `public/js/catalog.js`) e as configurações padrão são gravados automaticamente.

## Histórico

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
