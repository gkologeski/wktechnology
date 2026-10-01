-- Fase 2: dados coletados no desfecho de contratação (modelo, área, modalidade, valores).
ALTER TABLE public.ats_applications ADD COLUMN IF NOT EXISTS hiring_details jsonb;

-- Fase 4: mudanças de status em Pessoas viram eventos de workflow (ex.: desligamento).
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
  v_ws uuid;
  v_id uuid;
  v_before jsonb;
  v_after jsonb;
  v_rec jsonb;
begin
  if tg_op = 'INSERT' then
    v_event := 'created';
    v_rec := to_jsonb(new);
    v_id := new.id;
    v_before := null;
    v_after := v_rec;
  elsif tg_op = 'UPDATE' then
    v_event := 'updated';
    v_rec := to_jsonb(new);
    v_id := new.id;
    v_before := to_jsonb(old);
    v_after := v_rec;
  else
    return null;
  end if;

  v_owner := nullif(v_rec->>'owner_id','')::uuid;
  v_ws := nullif(v_rec->>'workspace_id','')::uuid;
  if v_owner is null and v_ws is not null then
    select created_by into v_owner from public.workspaces where id = v_ws;
  end if;
  if v_owner is null then
    return null;
  end if;

  if tg_op = 'UPDATE' then
    if v_entity = 'deals' then
      if coalesce((v_after->>'stage_id'), '') is distinct from coalesce((v_before->>'stage_id'), '')
         or (v_after->>'stage') is distinct from (v_before->>'stage') then
        v_event := 'stage_changed';
      end if;
    elsif v_entity in ('leads','tickets','ats_jobs','ats_interviews',
                       'projects','contracts','financial_entries','quotes',
                       'proposals','bank_payments','subscription_invoices','customer_invoices','people') then
      if (v_after->>'status') is distinct from (v_before->>'status') then
        v_event := 'stage_changed';
      end if;
    elsif v_entity = 'ats_applications' then
      if coalesce((v_after->>'stage_value'), '') is distinct from coalesce((v_before->>'stage_value'), '')
         or (v_after->>'status') is distinct from (v_before->>'status') then
        v_event := 'stage_changed';
      end if;
    elsif v_entity = 'project_tasks' then
      if coalesce((v_after->>'status_id'),'') is distinct from coalesce((v_before->>'status_id'),'') then
        v_event := 'stage_changed';
      end if;
    elsif v_entity in ('project_milestones') then
      if (v_after->>'status') is distinct from (v_before->>'status') then
        v_event := 'stage_changed';
      end if;
    elsif v_entity in ('products','recurring_plans') then
      if (v_after->>'active') is distinct from (v_before->>'active') then
        v_event := 'stage_changed';
      end if;
    end if;
  end if;

  insert into public.workflow_events (owner_id, workspace_id, entity, entity_id, event_type, before, after)
  values (v_owner, v_ws, v_entity, v_id, v_event, v_before, v_after);

  return null;
end;
$function$;

DROP TRIGGER IF EXISTS trg_wf_events_people ON public.people;
CREATE TRIGGER trg_wf_events_people AFTER INSERT OR UPDATE ON public.people
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_workflow_event('people');