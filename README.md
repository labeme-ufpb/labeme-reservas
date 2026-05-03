# LABEME — Sistema de Reservas com Firebase (v5)

Plataforma de agendamento de equipamentos, espaços e gestão de estoque do **Laboratório de Ensaios de Materiais e Estruturas — LABEME**, Centro de Tecnologia, UFPB.

## Versão v5 — implantação real

Esta versão usa:

- **Firebase Authentication** para login real por e-mail e senha;
- **Cloud Firestore** para dados compartilhados;
- **Firebase Storage** para imagens;
- **GitHub Pages** para hospedagem estática.

## Estrutura

```text
labeme-reservas-firebase/
├── index.html
├── styles.css
├── README.md
├── FIREBASE_SETUP.md
├── firestore.rules
├── storage.rules
├── assets/
│   ├── labeme-logo.jpg
│   ├── ufpb-brasao.jpg
│   └── ct-ufpb.jpg
└── js/
    ├── firebase-config.js
    ├── db.js
    ├── constants.js
    ├── auth.js
    ├── calendar.js
    ├── reservations.js
    ├── profile.js
    ├── messages.js
    ├── stock.js
    ├── admin.js
    ├── tech.js
    └── app.js
```

## Instalação

Consulte o arquivo `FIREBASE_SETUP.md` antes de publicar.

## Primeira conta administrativa

A primeira conta administrativa deve ser criada manualmente no Firebase Authentication e no Firestore, usando o mesmo UID.

Depois disso, novos usuários podem ser cadastrados pelo próprio sistema.

## Atenção

Esta versão não usa mais dados de demonstração. Se o Firestore estiver vazio, o sistema abrirá sem usuários, reservas, estoque ou equipamentos cadastrados.
