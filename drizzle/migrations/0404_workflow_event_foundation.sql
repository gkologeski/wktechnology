-- Package 0: one canonical generic event producer per CRM row mutation and
-- task-stage classification using the current physical status columns.
-- No historical queue/run/data rewrite, no policy/grant/default changes.
DO $foundation$
DECLARE
  entity text;
  relation regclass;
  producer oid := to_regprocedure('public.enqueue_workflow_event()');
  canonical text;
  legacy text;
  registered integer;
BEGIN
  IF producer IS NULL
     OR to_regprocedure('public.crm_is_derivation_backfill(jsonb,jsonb)') IS NULL
     OR to_regprocedure('public.project_is_link_backfill(jsonb,jsonb,text[])') IS NULL THEN
    RAISE EXCEPTION 'Workflow foundation dependencies differ; inspect before applying.';
  END IF;
  IF (SELECT count(*) FROM pg_attribute
       WHERE attrelid='public.project_tasks'::regclass AND NOT attisdropped
         AND attname IN('status','custom_status_id')) <> 2 THEN
    RAISE EXCEPTION 'Project task status columns differ; inspect before applying.';
  END IF;
  FOREACH entity IN ARRAY ARRAY['leads','contacts','companies','deals'] LOOP
    relation := to_regclass('public.' || entity);
    canonical := 'trg_wf_events_' || entity;
    legacy := entity || '_wf_event';
    IF relation IS NULL THEN
      RAISE EXCEPTION 'Workflow source relation % is missing.', entity;
    END IF;
    SELECT count(*) INTO registered FROM pg_trigger
      WHERE tgrelid=relation AND tgfoid=producer AND NOT tgisinternal;
    IF registered NOT BETWEEN 1 AND 2 OR EXISTS(
      SELECT 1 FROM pg_trigger WHERE tgrelid=relation AND tgfoid=producer AND NOT tgisinternal
      AND (tgname NOT IN(canonical,legacy) OR tgtype::integer<>21 OR tgenabled<>'O'
        OR tgnargs<>1 OR tgargs<>convert_to(entity,'UTF8')||decode('00','hex')
        OR tgqual IS NOT NULL OR tgconstraint<>0)
    ) THEN
      RAISE EXCEPTION 'Unexpected generic Workflow trigger configuration on %; inspect before applying.', entity;
    END IF;
    -- Keep the current canonical trigger. A single legacy-only installation is
    -- renamed rather than adding a second emitter. Unknown emitters are refused.
    IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid=relation AND tgfoid=producer AND tgname=canonical AND NOT tgisinternal) THEN
      EXECUTE format('ALTER TRIGGER %I ON public.%I RENAME TO %I',legacy,entity,canonical);
    ELSE
      EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I',legacy,entity);
    END IF;
    IF (SELECT count(*) FROM pg_trigger WHERE tgrelid=relation AND tgfoid=producer AND NOT tgisinternal AND tgenabled<>'D')<>1 THEN
      RAISE EXCEPTION 'Workflow source % still has an unexpected number of active emitters.',entity;
    END IF;
  END LOOP;
END $foundation$;

-- CREATE OR REPLACE keeps the existing function OID, owner and ACL, preserving
-- all other bound sources, derivation backfills and project-link backfills.
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
BEGIN
 IF TG_OP = 'UPDATE' AND public.crm_is_derivation_backfill(to_jsonb(OLD),to_jsonb(NEW)) THEN RETURN NEW; END IF;
 IF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'projects' AND public.project_is_link_backfill(to_jsonb(OLD),to_jsonb(NEW),ARRAY['company_id']) THEN RETURN NULL; END IF;
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
      if (v_after->>'status') is distinct from (v_before->>'status')
         or (v_after->>'custom_status_id') is distinct from (v_before->>'custom_status_id') then
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

NOTIFY pgrst, 'reload schema';
