
-- Portal do cliente: habilita acesso público por token a contatos
alter table public.contacts
  add column if not exists portal_token text unique,
  add column if not exists portal_enabled boolean not null default false;

create index if not exists idx_contacts_portal_token on public.contacts(portal_token) where portal_token is not null;
