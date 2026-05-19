
-- 1) workflow_events queue
create table public.workflow_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  entity text not null check (entity in ('leads','contacts','companies','deals')),
  entity_id uuid not null,
  event_type text not null check (event_type in ('created','updated','stage_changed')),
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);
create index workflow_events_pending_idx on public.workflow_events (created_at) where processed_at is null;
create index workflow_events_owner_idx on public.workflow_events (owner_id, created_at desc);
alter table public.workflow_events enable row level security;
create policy "workflow_events_owner" on public.workflow_events
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- 2) workflow_runs
create table public.workflow_runs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  event_id uuid not null references public.workflow_events(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','running','success','error','skipped')),
  error text,
  log jsonb not null default '[]'::jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workflow_id, event_id)
);
create index workflow_runs_workflow_idx on public.workflow_runs (workflow_id, created_at desc);
create index workflow_runs_owner_idx on public.workflow_runs (owner_id, created_at desc);
alter table public.workflow_runs enable row level security;
create policy "workflow_runs_owner" on public.workflow_runs
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- 3) Enqueue function (generic)
create or replace function public.enqueue_workflow_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_entity text := tg_argv[0];
  v_event text;
  v_owner uuid;
  v_id uuid;
  v_before jsonb;
  v_after jsonb;
begin
  if tg_op = 'INSERT' then
    v_event := 'created';
    v_owner := new.owner_id;
    v_id := new.id;
    v_before := null;
    v_after := to_jsonb(new);
  elsif tg_op = 'UPDATE' then
    v_owner := new.owner_id;
    v_id := new.id;
    v_before := to_jsonb(old);
    v_after := to_jsonb(new);
    -- stage change: deals (stage_id text) or leads (status enum) ou deals.stage enum
    if v_entity = 'deals' and (coalesce(new.stage_id,'') is distinct from coalesce(old.stage_id,'')
                               or new.stage is distinct from old.stage) then
      v_event := 'stage_changed';
    elsif v_entity = 'leads' and new.status is distinct from old.status then
      v_event := 'stage_changed';
    else
      v_event := 'updated';
    end if;
  else
    return null;
  end if;

  insert into public.workflow_events (owner_id, entity, entity_id, event_type, before, after)
  values (v_owner, v_entity, v_id, v_event, v_before, v_after);

  return null;
end;
$fn$;

-- 4) Attach triggers
create trigger leads_wf_event after insert or update on public.leads
  for each row execute function public.enqueue_workflow_event('leads');
create trigger contacts_wf_event after insert or update on public.contacts
  for each row execute function public.enqueue_workflow_event('contacts');
create trigger companies_wf_event after insert or update on public.companies
  for each row execute function public.enqueue_workflow_event('companies');
create trigger deals_wf_event after insert or update on public.deals
  for each row execute function public.enqueue_workflow_event('deals');

-- 5) pg_cron tick
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'workflows-tick',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://wktechnology.lovable.app/api/public/hooks/workflows-tick',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6cm1odHphZW9uemptYmdiYWJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4MTM4ODcsImV4cCI6MjA5NDM4OTg4N30.NZt1xBOm8e8Bcl6LKDRsfBBCY2sg_JXtMBjx8hb7sBg"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
