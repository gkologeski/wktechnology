
do $$ begin
  create type public.ticket_status as enum ('new','open','waiting','resolved','closed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ticket_priority as enum ('low','medium','high','urgent');
exception when duplicate_object then null; end $$;

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  subject text not null,
  description text,
  status public.ticket_status not null default 'new',
  priority public.ticket_priority not null default 'medium',
  source text,
  assignee_id uuid,
  contact_id uuid references public.contacts(id) on delete set null,
  company_id uuid references public.companies(id) on delete set null,
  deal_id uuid references public.deals(id) on delete set null,
  pipeline_id uuid,
  due_at timestamptz,
  resolved_at timestamptz,
  custom_fields jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tickets_owner_idx on public.tickets(owner_id);
create index if not exists tickets_status_idx on public.tickets(status);
create index if not exists tickets_assignee_idx on public.tickets(assignee_id);
create index if not exists tickets_contact_idx on public.tickets(contact_id);
create index if not exists tickets_company_idx on public.tickets(company_id);
create index if not exists tickets_deal_idx on public.tickets(deal_id);

alter table public.tickets enable row level security;

drop policy if exists "tickets_select" on public.tickets;
create policy "tickets_select" on public.tickets
  for select to authenticated
  using (owner_id = auth.uid() or public.is_workspace_admin(owner_id, auth.uid()));

drop policy if exists "tickets_insert" on public.tickets;
create policy "tickets_insert" on public.tickets
  for insert to authenticated
  with check (owner_id = auth.uid() or public.is_workspace_admin(owner_id, auth.uid()));

drop policy if exists "tickets_update" on public.tickets;
create policy "tickets_update" on public.tickets
  for update to authenticated
  using (owner_id = auth.uid() or public.is_workspace_admin(owner_id, auth.uid()))
  with check (owner_id = auth.uid() or public.is_workspace_admin(owner_id, auth.uid()));

drop policy if exists "tickets_delete" on public.tickets;
create policy "tickets_delete" on public.tickets
  for delete to authenticated
  using (owner_id = auth.uid() or public.is_workspace_admin(owner_id, auth.uid()));

drop trigger if exists tickets_set_updated_at on public.tickets;
create trigger tickets_set_updated_at
  before update on public.tickets
  for each row execute function public.set_updated_at();

drop trigger if exists tickets_audit on public.tickets;
create trigger tickets_audit
  after insert or update or delete on public.tickets
  for each row execute function public.log_audit_event('tickets');
