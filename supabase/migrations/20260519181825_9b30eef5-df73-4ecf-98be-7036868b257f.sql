
alter table public.leads      add column if not exists custom_fields jsonb not null default '{}'::jsonb;
alter table public.contacts   add column if not exists custom_fields jsonb not null default '{}'::jsonb;
alter table public.companies  add column if not exists custom_fields jsonb not null default '{}'::jsonb;
alter table public.deals      add column if not exists custom_fields jsonb not null default '{}'::jsonb;

create table if not exists public.custom_properties (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  entity text not null check (entity in ('leads','contacts','companies','deals')),
  key text not null,
  label text not null,
  type text not null default 'text' check (type in ('text','number','date','boolean','select','multiselect','url','email','tel','textarea')),
  options jsonb not null default '[]'::jsonb,
  position integer not null default 0,
  required boolean not null default false,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, entity, key)
);

create index if not exists custom_properties_owner_entity_idx
  on public.custom_properties (owner_id, entity, position);

alter table public.custom_properties enable row level security;

drop policy if exists custom_properties_owner on public.custom_properties;
create policy custom_properties_owner on public.custom_properties
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop trigger if exists trg_custom_properties_updated on public.custom_properties;
create trigger trg_custom_properties_updated
  before update on public.custom_properties
  for each row execute function public.set_updated_at();
