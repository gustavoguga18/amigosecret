# Amigo Secreto da Família Ferreira

Site com backend (Node.js + Express) e banco de dados no **Supabase** (Postgres
hospedado), pra todo mundo da família montar sua lista de ideias de presente,
com foto, de qualquer celular.

## Passo 1 — Criar as tabelas no Supabase

1. Entre no painel do seu projeto em supabase.com.
2. Vá em **SQL Editor** → **New query**.
3. Cole o conteúdo do arquivo `supabase-schema.sql` (está aqui na pasta) e clique em **Run**.

Isso cria as tabelas `people` e `gifts` que o backend usa.

## Passo 2 — Rodar localmente (opcional, pra testar antes de subir)

Requer [Node.js](https://nodejs.org) 18+.

```bash
npm install
npm start
```

O arquivo `.env` já vem preenchido com a URL e a secret key do seu projeto
Supabase, então já funciona local sem configurar nada. Abra `http://localhost:3000`.

> O `.env` está no `.gitignore` — ele **não** vai ser enviado ao GitHub quando
> você der `git push`. Isso é proposital: a secret key dá acesso total ao seu
> banco de dados, então ela não deve aparecer em nenhum arquivo versionado.

## Passo 3 — Subir pro GitHub

```bash
git init
git add .
git commit -m "Amigo secreto com Supabase"
git remote add origin <link do seu repositório>
git push -u origin main
```

Confirme que o `.env` **não** apareceu no repositório (o `.gitignore` deve
cuidar disso automaticamente).

## Passo 4 — Configurar no Render

1. No Render, crie o Web Service apontando pro seu repositório.
2. Build command: `npm install` — Start command: `npm start`.
3. Vá em **Environment** e adicione duas variáveis:
   - `SUPABASE_URL` → `https://etrczkefuphiesskfqjx.supabase.co`
   - `SUPABASE_SECRET_KEY` → sua secret key do Supabase
4. Não é preciso configurar nenhum disco persistente — os dados agora ficam
   no Supabase, não no disco do Render. Isso resolve o problema de perder
   dados a cada redeploy que tínhamos com o SQLite local.

## Sobre a secret key que você compartilhou

Como essa chave foi colada numa conversa, o ideal é gerar uma nova antes de
usar em produção (Supabase → Project Settings → API → gerar nova secret key)
e usar só a nova, tanto no `.env` local quanto no Render. É só trocar o valor
nos dois lugares — o código não precisa mudar.

## Estrutura

- `server.js` — backend Express, fala com o Supabase via `@supabase/supabase-js`
- `supabase-schema.sql` — script para criar as tabelas
- `public/` — frontend (HTML, CSS, JS)
- `.env` — suas credenciais locais (não sobe pro GitHub)
- `.env.example` — modelo sem valores reais, esse sim fica no repositório
