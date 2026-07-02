
create extension if not exists pg_trgm;

-- Trigram indexes for global search (short titles/emails)
create index if not exists idx_search_contacts_first_name on public.contacts using gin (first_name gin_trgm_ops);
create index if not exists idx_search_contacts_last_name  on public.contacts using gin (last_name gin_trgm_ops);
create index if not exists idx_search_contacts_email      on public.contacts using gin (email gin_trgm_ops);
create index if not exists idx_search_companies_name      on public.companies using gin (name gin_trgm_ops);
create index if not exists idx_search_deals_name          on public.deals using gin (name gin_trgm_ops);
create index if not exists idx_search_tickets_subject     on public.tickets using gin (subject gin_trgm_ops);
create index if not exists idx_search_activities_subject  on public.activities using gin (subject gin_trgm_ops);
create index if not exists idx_search_ats_candidates_name on public.ats_candidates using gin (full_name gin_trgm_ops);
create index if not exists idx_search_ats_candidates_email on public.ats_candidates using gin (email gin_trgm_ops);
create index if not exists idx_search_ats_jobs_title      on public.ats_jobs using gin (title gin_trgm_ops);

-- Recentes por usuário
create table if not exists public.search_recent (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  entity_type text not null,
  entity_id text not null,
  title text not null,
  url text not null,
  opened_at timestamptz not null default now(),
  unique (user_id, entity_type, entity_id)
);
create index if not exists idx_search_recent_user_opened on public.search_recent(user_id, opened_at desc);
grant select, insert, update, delete on public.search_recent to authenticated;
grant all on public.search_recent to service_role;
alter table public.search_recent enable row level security;
create policy "own search_recent" on public.search_recent for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Fixados por usuário
create table if not exists public.search_pinned (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  entity_type text not null,
  entity_id text not null,
  title text not null,
  url text not null,
  pinned_at timestamptz not null default now(),
  unique (user_id, entity_type, entity_id)
);
create index if not exists idx_search_pinned_user on public.search_pinned(user_id, pinned_at desc);
grant select, insert, update, delete on public.search_pinned to authenticated;
grant all on public.search_pinned to service_role;
alter table public.search_pinned enable row level security;
create policy "own search_pinned" on public.search_pinned for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
