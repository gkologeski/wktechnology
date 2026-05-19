
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_owner_id uuid not null,
  actor_user_id uuid,
  entity text not null,
  entity_id uuid,
  action text not null,
  before jsonb,
  after jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_workspace_created_idx
  on public.audit_logs (workspace_owner_id, created_at desc);
create index if not exists audit_logs_entity_idx
  on public.audit_logs (workspace_owner_id, entity, entity_id, created_at desc);

alter table public.audit_logs enable row level security;

drop policy if exists audit_logs_select on public.audit_logs;
create policy audit_logs_select on public.audit_logs
  for select to authenticated
  using (
    workspace_owner_id = auth.uid()
    or public.is_workspace_admin(workspace_owner_id, auth.uid())
  );

-- Função de trigger genérica
create or replace function public.log_audit_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entity text := tg_argv[0];
  v_owner uuid;
  v_id uuid;
  v_action text;
  v_before jsonb;
  v_after jsonb;
begin
  if tg_op = 'INSERT' then
    v_action := 'created';
    v_owner := new.owner_id;
    v_id := new.id;
    v_before := null;
    v_after := to_jsonb(new);
  elsif tg_op = 'UPDATE' then
    v_action := 'updated';
    v_owner := new.owner_id;
    v_id := new.id;
    v_before := to_jsonb(old);
    v_after := to_jsonb(new);
    if v_before is not distinct from v_after then
      return null;
    end if;
  elsif tg_op = 'DELETE' then
    v_action := 'deleted';
    v_owner := old.owner_id;
    v_id := old.id;
    v_before := to_jsonb(old);
    v_after := null;
  else
    return null;
  end if;

  insert into public.audit_logs (workspace_owner_id, actor_user_id, entity, entity_id, action, before, after)
  values (v_owner, auth.uid(), v_entity, v_id, v_action, v_before, v_after);

  return null;
end;
$$;

-- Triggers em leads
drop trigger if exists trg_audit_leads on public.leads;
create trigger trg_audit_leads
  after insert or update or delete on public.leads
  for each row execute function public.log_audit_event('leads');

drop trigger if exists trg_audit_contacts on public.contacts;
create trigger trg_audit_contacts
  after insert or update or delete on public.contacts
  for each row execute function public.log_audit_event('contacts');

drop trigger if exists trg_audit_companies on public.companies;
create trigger trg_audit_companies
  after insert or update or delete on public.companies
  for each row execute function public.log_audit_event('companies');

drop trigger if exists trg_audit_deals on public.deals;
create trigger trg_audit_deals
  after insert or update or delete on public.deals
  for each row execute function public.log_audit_event('deals');
