# Amigo Secreto da Família Ferreira

Site com backend (Node.js + Express) e banco de dados no **Supabase** (Postgres
hospedado), pra todo mundo da família montar sua lista de ideias de presente,
com foto, de qualquer celular.

## Estrutura

- `server.js` — backend Express, fala com o Supabase via `@supabase/supabase-js`
- `supabase-schema.sql` — script para criar as tabelas
- `public/` — frontend (HTML, CSS, JS)
- `.env` — suas credenciais locais (não sobe pro GitHub)
- `.env.example` — modelo sem valores reais, esse sim fica no repositório
