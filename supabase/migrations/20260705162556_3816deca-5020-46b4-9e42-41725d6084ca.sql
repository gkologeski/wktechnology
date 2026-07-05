CREATE OR REPLACE FUNCTION public.enqueue_workflow_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
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
    v_event := 'updated';

    if v_entity = 'deals' then
      if coalesce((v_after->>'stage_id'), '') is distinct from coalesce((v_before->>'stage_id'), '')
         or (v_after->>'stage') is distinct from (v_before->>'stage') then
        v_event := 'stage_changed';
      end if;
    elsif v_entity = 'leads' then
      if (v_after->>'status') is distinct from (v_before->>'status') then
        v_event := 'stage_changed';
      end if;
    elsif v_entity = 'tickets' then
      if (v_after->>'status') is distinct from (v_before->>'status') then
        v_event := 'stage_changed';
      end if;
    elsif v_entity = 'ats_jobs' then
      if (v_after->>'status') is distinct from (v_before->>'status') then
        v_event := 'stage_changed';
      end if;
    elsif v_entity = 'ats_applications' then
      if coalesce((v_after->>'stage_value'), '') is distinct from coalesce((v_before->>'stage_value'), '')
         or (v_after->>'status') is distinct from (v_before->>'status') then
        v_event := 'stage_changed';
      end if;
    elsif v_entity = 'ats_interviews' then
      if (v_after->>'status') is distinct from (v_before->>'status') then
        v_event := 'stage_changed';
      end if;
    end if;
  else
    return null;
  end if;

  insert into public.workflow_events (owner_id, entity, entity_id, event_type, before, after)
  values (v_owner, v_entity, v_id, v_event, v_before, v_after);

  return null;
end;
$function$;