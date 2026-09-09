-- Rode esse script no Supabase: painel do projeto → SQL Editor → New query → colar e "Run"

create table if not exists people (
  id bigint generated always as identity primary key,
  name text not null unique,
  created_at timestamptz default now()
);

create table if not exists gifts (
  id bigint generated always as identity primary key,
  person_id bigint not null references people(id) on delete cascade,
  title text not null,
  note text,
  link text,
  image text,
  claimed boolean not null default false,
  claimed_by text,
  created_at timestamptz default now()
);

create index if not exists gifts_person_id_idx on gifts(person_id);

-- Como o backend acessa o banco com a secret key (privilégio total, direto do servidor),
-- não é necessário criar políticas de RLS para esse projeto: o Postgres do Supabase
-- já nega tudo por padrão para chaves públicas, e a secret key ignora RLS mesmo que
-- você venha a habilitá-lo depois.


-- Se a tabela gifts já existia antes desta alteração, rode também:
alter table gifts add column if not exists claimed_by text;
