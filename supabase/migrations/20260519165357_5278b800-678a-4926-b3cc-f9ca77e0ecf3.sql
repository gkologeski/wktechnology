
-- Item 10 — Scoring executor

-- Garante coluna score em companies (leads/contacts já têm).
alter table public.companies add column if not exists score integer not null default 0;

-- Log de aplicações de pontos (idempotência: 1 evento por regra+entidade).
create table if not exists public.score_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  rule_id uuid not null references public.scoring_rules(id) on delete cascade,
  entity text not null check (entity in ('leads','contacts','companies')),
  entity_id uuid not null,
  points integer not null,
  reason text,
  created_at timestamptz not null default now(),
  unique (rule_id, entity, entity_id)
);
create index if not exists idx_score_events_owner_created on public.score_events (owner_id, created_at desc);
create index if not exists idx_score_events_entity on public.score_events (entity, entity_id);

alter table public.score_events enable row level security;
create policy score_events_owner on public.score_events for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Cursor por owner para o tick de scoring (independente do workflow tick).
create table if not exists public.scoring_cursors (
  owner_id uuid primary key,
  last_event_at timestamptz not null default 'epoch',
  updated_at timestamptz not null default now()
);
alter table public.scoring_cursors enable row level security;
create policy scoring_cursors_owner on public.scoring_cursors for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Garante que workflow_events está disparado também para contacts/companies (caso ainda não esteja).
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_wf_events_contacts') then
    create trigger trg_wf_events_contacts
      after insert or update on public.contacts
      for each row execute function public.enqueue_workflow_event('contacts');
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_wf_events_companies') then
    create trigger trg_wf_events_companies
      after insert or update on public.companies
      for each row execute function public.enqueue_workflow_event('companies');
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_wf_events_leads') then
    create trigger trg_wf_events_leads
      after insert or update on public.leads
      for each row execute function public.enqueue_workflow_event('leads');
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_wf_events_deals') then
    create trigger trg_wf_events_deals
      after insert or update on public.deals
      for each row execute function public.enqueue_workflow_event('deals');
  end if;
end $$;
