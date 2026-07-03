
-- 1) Amplia CHECK de workflow_events.entity para incluir tickets + ATS
alter table public.workflow_events
  drop constraint if exists workflow_events_entity_check;

alter table public.workflow_events
  add constraint workflow_events_entity_check
  check (entity in (
    'leads','contacts','companies','deals','tickets',
    'ats_jobs','ats_candidates','ats_applications','ats_interviews'
  ));

-- 2) Substitui a função de enfileiramento para detectar stage_changed nas novas entidades
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

    if v_entity = 'deals' and (coalesce(new.stage_id,'') is distinct from coalesce(old.stage_id,'')
                               or new.stage is distinct from old.stage) then
      v_event := 'stage_changed';
    elsif v_entity = 'leads' and new.status is distinct from old.status then
      v_event := 'stage_changed';
    elsif v_entity = 'tickets' and new.status is distinct from old.status then
      v_event := 'stage_changed';
    elsif v_entity = 'ats_jobs' and new.status is distinct from old.status then
      v_event := 'stage_changed';
    elsif v_entity = 'ats_applications' and (
            coalesce(new.stage_value,'') is distinct from coalesce(old.stage_value,'')
            or new.status is distinct from old.status
          ) then
      v_event := 'stage_changed';
    elsif v_entity = 'ats_interviews' and new.status is distinct from old.status then
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

-- 3) Anexa triggers idempotentes nas 4 tabelas do ATS (+ tickets, se ainda não existir)
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_wf_events_tickets') then
    create trigger trg_wf_events_tickets
      after insert or update on public.tickets
      for each row execute function public.enqueue_workflow_event('tickets');
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_wf_events_ats_jobs') then
    create trigger trg_wf_events_ats_jobs
      after insert or update on public.ats_jobs
      for each row execute function public.enqueue_workflow_event('ats_jobs');
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_wf_events_ats_candidates') then
    create trigger trg_wf_events_ats_candidates
      after insert or update on public.ats_candidates
      for each row execute function public.enqueue_workflow_event('ats_candidates');
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_wf_events_ats_applications') then
    create trigger trg_wf_events_ats_applications
      after insert or update on public.ats_applications
      for each row execute function public.enqueue_workflow_event('ats_applications');
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_wf_events_ats_interviews') then
    create trigger trg_wf_events_ats_interviews
      after insert or update on public.ats_interviews
      for each row execute function public.enqueue_workflow_event('ats_interviews');
  end if;
end $$;
