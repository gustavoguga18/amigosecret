# Amigo Secreto da Família

Site com backend (Node.js + Express) e banco de dados (SQLite) para todo mundo
da família montar sua lista de ideias de presente. Os dados ficam guardados no
servidor, então qualquer pessoa que abrir o link — de qualquer celular — vê e
edita as mesmas listas.

## O que tem aqui

- `server.js` — backend em Express, com um banco SQLite (`data/amigo-secreto.db`,
  criado automaticamente na primeira execução)
- `public/` — frontend (HTML, CSS e JS puro, sem framework)

## Rodando no seu computador

Requer [Node.js](https://nodejs.org) instalado (versão 18 ou mais recente).

```bash
npm install
npm start
```

Depois é só abrir `http://localhost:3000` no navegador.

## Colocando no ar (para a família acessar de qualquer lugar)

Esse projeto é um servidor Node comum, então funciona em qualquer serviço de
hospedagem que rode Node.js. Sugestões com plano gratuito, do mais simples ao
mais flexível:

### Render.com (recomendado, mais simples)
1. Crie uma conta em render.com e um repositório no GitHub com esses arquivos.
2. Em Render, clique em "New +" → "Web Service" e aponte para o repositório.
3. Build command: `npm install` — Start command: `npm start`.
4. Em "Disks", adicione um disco persistente (ex: 1 GB) montado em `/opt/render/project/src/data`,
   para o banco de dados não ser apagado a cada deploy.
5. Ao terminar o deploy, você recebe um link tipo `https://seu-app.onrender.com` —
   é esse link que você manda para a família.

### Railway.app
1. Crie um projeto novo e conecte o repositório do GitHub.
2. Railway detecta o Node automaticamente (`npm install` + `npm start`).
3. Adicione um "Volume" persistente apontando para a pasta `data/`.
4. Railway gera um domínio público (`.up.railway.app`) — dá pra apontar um domínio próprio depois.

### Um VPS próprio (ex: DigitalOcean, Hetzner)
Se você já tem um servidor, instale o Node, copie os arquivos, rode
`npm install && npm start` (idealmente atrás de um gerenciador de processo
como o `pm2`, e com Nginx na frente para HTTPS e domínio próprio).

> Só um cuidado: como não há login, quem tiver o link pode entrar com qualquer
> nome. Para uso familiar isso normalmente não é problema, mas evite divulgar
> o link publicamente.

## Personalizando

- Título do site: troque "Amigo Secreto da Família" em `public/index.html`.
- Cores: no início de `public/styles.css`, nas variáveis dentro de `:root`.
# amigosecret
