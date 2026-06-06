-- Habilita workflows e rotação para tickets

-- 1) Constraint workflows.entity
ALTER TABLE public.workflows DROP CONSTRAINT IF EXISTS workflows_entity_check;
ALTER TABLE public.workflows ADD CONSTRAINT workflows_entity_check
  CHECK (entity = ANY (ARRAY['leads','contacts','companies','deals','tickets']));

-- 2) Constraint workflow_events.entity
ALTER TABLE public.workflow_events DROP CONSTRAINT IF EXISTS workflow_events_entity_check;
ALTER TABLE public.workflow_events ADD CONSTRAINT workflow_events_entity_check
  CHECK (entity = ANY (ARRAY['leads','contacts','companies','deals','tickets']));

-- 3) Constraint rotation_rules.entity
ALTER TABLE public.rotation_rules DROP CONSTRAINT IF EXISTS rotation_rules_entity_check;
ALTER TABLE public.rotation_rules ADD CONSTRAINT rotation_rules_entity_check
  CHECK (entity = ANY (ARRAY['leads','deals','tickets']));

-- 4) Atualiza enqueue_workflow_event para tickets (status muda = stage_changed)
CREATE OR REPLACE FUNCTION public.enqueue_workflow_event()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
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
    if v_entity = 'deals' then
      if (coalesce(v_after->>'stage_id','') is distinct from coalesce(v_before->>'stage_id',''))
         or (v_after->>'stage' is distinct from v_before->>'stage') then
        v_event := 'stage_changed';
      else
        v_event := 'updated';
      end if;
    elsif v_entity = 'leads' then
      if v_after->>'status' is distinct from v_before->>'status' then
        v_event := 'stage_changed';
      else
        v_event := 'updated';
      end if;
    elsif v_entity = 'tickets' then
      if (v_after->>'status' is distinct from v_before->>'status')
         or (coalesce(v_after->>'pipeline_id','') is distinct from coalesce(v_before->>'pipeline_id','')) then
        v_event := 'stage_changed';
      else
        v_event := 'updated';
      end if;
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
$function$;

-- 5) Trigger em tickets
DROP TRIGGER IF EXISTS trg_wf_events_tickets ON public.tickets;
CREATE TRIGGER trg_wf_events_tickets
AFTER INSERT OR UPDATE ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.enqueue_workflow_event('tickets');
