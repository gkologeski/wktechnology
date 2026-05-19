
create table if not exists public.rotation_rules (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  name text not null,
  entity text not null check (entity in ('leads','deals')),
  enabled boolean not null default true,
  strategy text not null default 'round_robin' check (strategy in ('round_robin','weighted')),
  filters jsonb not null default '[]'::jsonb,
  assignees jsonb not null default '[]'::jsonb,
  last_index integer not null default -1,
  last_assigned_user_id uuid,
  last_assigned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.rotation_rules enable row level security;

create policy rotation_rules_owner on public.rotation_rules
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create trigger rotation_rules_set_updated_at
  before update on public.rotation_rules
  for each row execute function public.set_updated_at();

create index if not exists rotation_rules_owner_entity_idx
  on public.rotation_rules (owner_id, entity) where enabled = true;
