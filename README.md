# Amigo Secreto da Família

Site do amigo secreto da família com **Node.js + Express + Supabase**. As listas de presentes ficam no Supabase e as imagens são armazenadas no bucket `gift-images`.

## O que tem aqui

- `server.js` — backend Express conectado ao Supabase.
- `public/` — frontend HTML, CSS e JavaScript.
- `supabase-schema.sql` — cria as tabelas `people` e `gifts` e configura o bucket de imagens.
- `.env.example` — modelo das variáveis de ambiente.

## Configuração do Supabase

1. No Supabase, abra **SQL Editor → New query**.
2. Copie todo o conteúdo de `supabase-schema.sql` e clique em **Run**.
3. Confirme que existem as tabelas `people` e `gifts`.
4. Confirme que existe o bucket público `gift-images`.

## Rodando localmente

Requer Node.js 18 ou mais recente.

1. Copie `.env.example` para `.env`.
2. Preencha `SUPABASE_SECRET_KEY` com a Secret Key do projeto. **Nunca publique essa chave.**
3. Instale e inicie:

```bash
npm install
npm start
```

Depois abra `http://localhost:3000`.

## Deploy no Render

Crie um **Web Service** conectado ao repositório GitHub. Use:

- Build Command: `npm install`
- Start Command: `npm start`
- Instance Type: `Free`

No Render, em **Environment Variables**, configure:

```text
SUPABASE_URL=https://etrczkefuphiesskfqjx.supabase.co
SUPABASE_SECRET_KEY=COLE_AQUI_A_SECRET_KEY
SUPABASE_STORAGE_BUCKET=gift-images
```

Não faça upload do `.env` para o GitHub. O `.gitignore` deste projeto já bloqueia arquivos `.env`.

## Funcionalidades

- Lista de pessoas e quantidade de sugestões.
- Adição de presentes sem faixa de preço.
- Upload de imagem para sugestão de presente (JPEG, PNG, WebP ou GIF, até 3 MB).
- Link e observação para cada presente.
- Marcar/desmarcar presente como escolhido.
- Remover presente.
- Alterar o nome da pessoa sem perder sua lista.
- Persistência no Supabase PostgreSQL.
- Imagens no Supabase Storage.

> O sistema não possui autenticação. Qualquer pessoa com o link pode entrar com um nome.
