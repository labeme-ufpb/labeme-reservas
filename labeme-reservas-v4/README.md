# LABEME — Sistema de Reservas (v4)

Plataforma de agendamento de equipamentos, espaços e gestão de estoque do **Laboratório de Ensaios de Materiais e Estruturas** — Centro de Tecnologia · UFPB.

## O que mudou na v4

- **Logos com fundo branco sólido** (JPG, sem transparência) — fim do "fundo preto"
- **Pré-preenchimento automático** do recurso ao clicar "Reservar" no card do equipamento
- **Aba ENTRAR** sempre carrega primeiro ao clicar em "Entrar"; botão **"+ Novo cadastro"** abaixo
- **Bug das mensagens corrigido** (textarea era zerado pelo polling a cada 5s — agora respeita usuário digitando)
- **Dashboard do técnico com aba "Pendentes"** mostrando solicitações com botões ✓/✕ e 💬 diretos
- **Estoque em formato planilha** com:
  - Busca por nome, tipo, localização, professor ou observações
  - Filtros por disponibilidade, tipo de material e professor responsável
  - Ordenação clicando no cabeçalho de qualquer coluna (asc/desc)
- **Dados de demonstração pré-cadastrados**: 2 admins, 2 técnicos, 5 alunos, 10 equipamentos, 10 materiais, 7 reservas (3 pendentes)

## Credenciais de demonstração

| Perfil          | E-mail                                | Senha          |
|-----------------|---------------------------------------|----------------|
| **Coordenação 1** (Maria Coordenadora) | admin@labeme.ufpb.br                 | labeme2026   |
| **Coordenação 2** (Prof. José Augusto)  | jose.augusto@academico.ufpb.br        | labeme2026   |
| **Técnico 1** (João)        | tecnico@labeme.ufpb.br                | tecnico2026  |
| **Técnico 2** (Carla)       | carla.andrade@labeme.ufpb.br          | tecnico2026  |
| **Aluna mestrado** (Maria Silva)   | maria.silva@academico.ufpb.br         | aluno123     |
| **Aluno doutorado** (Pedro Santos) | pedro.santos@academico.ufpb.br        | aluno123     |
| **Aluna graduação** (Ana Costa)    | ana.costa@academico.ufpb.br           | aluno123     |
| **Aluno graduação** (Lucas Ferreira) | lucas.ferreira@academico.ufpb.br    | aluno123     |
| **Aluna mestrado** (Juliana Oliveira) | juliana.oliveira@academico.ufpb.br | aluno123     |

## Como testar localmente

Abra `index.html` no navegador. Os dados pré-cadastrados aparecem automaticamente no primeiro acesso.

## Estrutura do projeto

```
labeme-reservas-v4/
├── index.html              ← página principal
├── styles.css              ← identidade visual
├── README.md
├── assets/
│   ├── labeme-logo.jpg     ← logo do laboratório (fundo branco)
│   ├── ufpb-brasao.jpg     ← brasão UFPB (fundo branco)
│   └── ct-ufpb.jpg         ← logo CT (fundo branco)
└── js/
    ├── db.js               ← persistência (localStorage)
    ├── constants.js        ← constantes e helpers
    ├── auth.js             ← login, cadastro, lembrete foto
    ├── calendar.js         ← calendário mensal e semanal
    ├── reservations.js     ← reservas, devoluções
    ├── profile.js          ← tela de perfil
    ├── messages.js         ← mensagens internas
    ├── stock.js            ← estoque (planilha + busca/filtros/ordenação)
    ├── admin.js            ← painel administrativo
    ├── tech.js             ← dashboard do técnico (com aba Pendentes)
    ├── seed.js             ← dados de demonstração
    └── app.js              ← roteamento
```

## Roteiro sugerido de teste

### Como técnico (tecnico@labeme.ufpb.br)
1. Login → cai automaticamente no Dashboard com aba **Pendentes** mostrando 3 solicitações de alunos
2. Aprove uma reserva (botão ✓), recuse outra (botão ✕)
3. Vá em "Estoque" — veja a planilha com os 10 materiais
4. Clique em "Localização" no cabeçalho para ordenar por tambor
5. Filtre por "Em uso" no select de disponibilidade
6. Use a busca digitando "RCD" → filtra material reciclado

### Como aluno (maria.silva@academico.ufpb.br)
1. Login → vai para Calendário
2. Clique em "Equipamentos" → veja os cards
3. Clique em "Reservar" num equipamento → o modal já vem com o equipamento selecionado
4. Vá em "Mensagens" → você verá conversa anterior com a coordenação; digite uma mensagem longa para testar

### Como coordenação (admin@labeme.ufpb.br)
1. Vá em "Admin → Usuários" → cadastre um novo usuário
2. Vá em "Admin → Recursos" → adicione foto a um equipamento existente
3. "Admin → Pendentes" — veja as mesmas pendências que o técnico vê

## Hospedagem no GitHub Pages

1. Crie um repositório novo no GitHub
2. Faça upload da pasta inteira
3. Em **Settings → Pages**, ative GitHub Pages na branch `main` / pasta root
4. Acesse em `https://SEU_USUARIO.github.io/labeme-reservas/`

## Próximo passo: Firebase (produção)

A camada de persistência (`js/db.js`) está isolada para permitir migração para Firebase Firestore sem reescrever o resto do código.

## Autoria

Desenvolvido para o LABEME — UFPB, sob coordenação do Prof. Dr. José Augusto Gomes Neto, 2026.
