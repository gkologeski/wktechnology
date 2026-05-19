
create table public.macros (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  name text not null,
  shortcut text,
  category text,
  body text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index macros_owner_idx on public.macros(owner_id);
alter table public.macros enable row level security;
create policy macros_owner on public.macros for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
