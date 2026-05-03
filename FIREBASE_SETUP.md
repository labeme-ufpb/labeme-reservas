# Implantação real — LABEME Reservas com Firebase

Esta versão substitui o `localStorage` por:

- Firebase Authentication: login real por e-mail e senha;
- Cloud Firestore: usuários, equipamentos, reservas, estoque, mensagens e configurações;
- Firebase Storage: imagens de perfil, equipamentos, materiais e devoluções.

## 1. Criar o primeiro administrador

Antes de publicar o sistema atualizado, crie manualmente o primeiro administrador no Firebase.

### 1.1. Authentication

No Firebase Console:

1. Acesse **Authentication**;
2. Entre em **Users / Usuários**;
3. Clique em **Add user / Adicionar usuário**;
4. Crie o usuário principal, por exemplo:
   - e-mail: `jose.augusto@academico.ufpb.br`
   - senha provisória: defina uma senha com no mínimo 6 caracteres;
5. Copie o **UID** gerado para esse usuário.

### 1.2. Firestore

No Firestore, crie a coleção:

```text
users
```

Dentro dela, crie um documento cujo **ID do documento** seja exatamente o UID copiado no Authentication.

Campos sugeridos:

| Campo | Tipo | Valor |
|---|---|---|
| `id` | string | mesmo UID do Authentication |
| `name` | string | `Prof. José Augusto Gomes Neto` |
| `email` | string | `jose.augusto@academico.ufpb.br` |
| `category` | string | `prof_depto` |
| `role` | string | `admin` |
| `advisor` | string | vazio |
| `institution` | string | `UFPB` |
| `phone` | string | telefone institucional ou vazio |
| `avatar` | null | null |
| `profileReminderShown` | boolean | true |
| `createdAt` | number | data/hora atual em milissegundos, ou qualquer número inicial |

Depois desse cadastro inicial, a coordenação poderá criar os demais usuários pelo próprio painel administrativo do sistema.

## 2. Regras do Firestore

No Firebase Console:

1. Acesse **Firestore**;
2. Vá em **Rules / Regras**;
3. Substitua o conteúdo pelas regras do arquivo `firestore.rules`;
4. Clique em **Publish / Publicar**.

## 3. Regras do Storage

No Firebase Console:

1. Acesse **Storage**;
2. Vá em **Rules / Regras**;
3. Substitua o conteúdo pelas regras do arquivo `storage.rules`;
4. Clique em **Publish / Publicar**.

## 4. Domínio autorizado

Em **Authentication → Settings → Authorized domains**, confirme se existe:

```text
labeme-ufpb.github.io
```

Se não existir, adicione esse domínio.

## 5. Publicação no GitHub Pages

Suba para o repositório o conteúdo desta pasta, mantendo `index.html` na raiz:

```text
index.html
styles.css
README.md
FIREBASE_SETUP.md
firestore.rules
storage.rules
assets/
js/
```

Depois atualize o endereço publicado:

```text
https://labeme-ufpb.github.io/labeme-reservas/
```

## 6. O que foi removido da versão de demonstração

- Banner com credenciais públicas;
- `seed.js` com usuários e senhas fictícias;
- autenticação local baseada em senha gravada no código;
- persistência em `localStorage`.

## 7. Observações importantes

- O cadastro público cria sempre usuário comum (`role: user`).
- Apenas administradores podem promover alguém para técnico ou coordenação.
- A senha dos usuários não é salva no Firestore.
- Redefinição de senha deve ser feita por link enviado pelo Firebase Authentication.
- A função “Resetar todos os dados” apaga dados operacionais, mas preserva usuários no Authentication.
