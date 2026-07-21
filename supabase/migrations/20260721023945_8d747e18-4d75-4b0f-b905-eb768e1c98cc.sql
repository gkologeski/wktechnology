
-- Fase 3: expandir enqueue_workflow_event para 13 novas entidades ERP

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

  -- Owner: try new.owner_id via jsonb, fallback to workspaces.created_by
  v_owner := nullif(v_rec->>'owner_id','')::uuid;
  v_ws := nullif(v_rec->>'workspace_id','')::uuid;
  if v_owner is null and v_ws is not null then
    select created_by into v_owner from public.workspaces where id = v_ws;
  end if;
  if v_owner is null then
    return null;
  end if;

  -- stage_changed detection
  if tg_op = 'UPDATE' then
    if v_entity = 'deals' then
      if coalesce((v_after->>'stage_id'), '') is distinct from coalesce((v_before->>'stage_id'), '')
         or (v_after->>'stage') is distinct from (v_before->>'stage') then
        v_event := 'stage_changed';
      end if;
    elsif v_entity in ('leads','tickets','ats_jobs','ats_interviews',
                       'projects','contracts','financial_entries','quotes',
                       'proposals','bank_payments','subscription_invoices','customer_invoices') then
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

-- Attach triggers to the 13 new tables
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'projects','project_tasks','project_milestones',
    'contracts','financial_entries','bank_payments',
    'quotes','proposals','products','services',
    'recurring_plans','subscription_invoices','customer_invoices'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_wf_events_%1$s ON public.%1$s', t);
    EXECUTE format(
      'CREATE TRIGGER trg_wf_events_%1$s AFTER INSERT OR UPDATE ON public.%1$s '
      'FOR EACH ROW EXECUTE FUNCTION public.enqueue_workflow_event(%2$L)',
      t, t
    );
  END LOOP;
END $$;
