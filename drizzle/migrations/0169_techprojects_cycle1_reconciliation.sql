-- Ciclo 1 TechProjects: conciliação de importações, vínculos canônicos e fila de inconsistências.
-- Aditiva: nenhuma coluna/tabela removida; nenhum dado de origem alterado.

CREATE OR REPLACE FUNCTION public.iso8601_duration_seconds(p text)
RETURNS numeric LANGUAGE plpgsql IMMUTABLE SET search_path = pg_catalog AS $$
DECLARE m text[];
BEGIN
  IF p IS NULL THEN RETURN NULL; END IF;
  m := regexp_match(p, '^(-)?P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$');
  IF m IS NULL THEN RETURN NULL; END IF;
  RETURN (CASE WHEN m[1] = '-' THEN -1 ELSE 1 END) * (
    coalesce(m[2]::numeric, 0) * 86400 + coalesce(m[3]::numeric, 0) * 3600
    + coalesce(m[4]::numeric, 0) * 60 + coalesce(m[5]::numeric, 0));
END $$;

CREATE OR REPLACE FUNCTION public.try_iso_date(p text)
RETURNS date LANGUAGE plpgsql IMMUTABLE SET search_path = pg_catalog AS $$
BEGIN
  IF p IS NULL OR p !~ '^\d{4}-\d{2}-\d{2}' THEN RETURN NULL; END IF;
  RETURN left(p, 10)::date;
EXCEPTION WHEN others THEN RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.project_entry_seconds(
  p_started timestamptz, p_stopped timestamptz, p_minutes integer, p_hours numeric)
RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path = pg_catalog AS $$
  SELECT CASE
    WHEN p_started IS NOT NULL AND p_stopped IS NOT NULL AND p_stopped >= p_started
      THEN extract(epoch FROM (p_stopped - p_started))
    WHEN p_minutes IS NOT NULL THEN p_minutes::numeric * 60
    ELSE coalesce(p_hours, 0) * 3600 END $$;

CREATE OR REPLACE FUNCTION public.project_is_link_backfill(old_row jsonb, new_row jsonb, p_fields text[])
RETURNS boolean LANGUAGE sql STABLE SET search_path = pg_catalog AS $$
  SELECT current_user NOT IN ('authenticated', 'anon')
     AND coalesce(current_setting('app.project_link_backfill', true), '') = 'on'
     AND old_row->>'workspace_id' = new_row->>'workspace_id'
     AND (old_row - (p_fields || ARRAY['updated_at'])) = (new_row - (p_fields || ARRAY['updated_at'])) $$;

ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS company_id uuid
  REFERENCES public.companies(id) ON DELETE SET NULL;
COMMENT ON COLUMN public.projects.company_id IS
  'Empresa canônica do cliente; só vínculo exato (FK da origem) ou sugestão confirmada, rastreado em project_link_changes.';
CREATE INDEX IF NOT EXISTS projects_company_idx ON public.projects (workspace_id, company_id)
  WHERE company_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.projects_company_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.company_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.company_id IS DISTINCT FROM OLD.company_id)
     AND NOT EXISTS (SELECT 1 FROM public.companies c
                      WHERE c.id = NEW.company_id AND c.workspace_id = NEW.workspace_id) THEN
    RAISE EXCEPTION 'A empresa do projeto precisa ser do mesmo workspace.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS projects_company_guard ON public.projects;
CREATE TRIGGER projects_company_guard BEFORE INSERT OR UPDATE OF company_id ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.projects_company_guard();

CREATE OR REPLACE FUNCTION public.projects_link_backfill_keep_updated()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF public.project_is_link_backfill(to_jsonb(OLD), to_jsonb(NEW), ARRAY['company_id']) THEN
    NEW.updated_at := OLD.updated_at;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS projects_zz_link_backfill ON public.projects;
CREATE TRIGGER projects_zz_link_backfill BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.projects_link_backfill_keep_updated();

CREATE OR REPLACE FUNCTION public.project_time_entries_validate()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_overlap record;
  v_forced boolean := NEW.source = 'import' AND current_setting('app.clockify_force_import', true) = 'on';
BEGIN
  -- Vínculo auditado (person_id/allocation_id): não recalcula duração nem mexe em updated_at.
  IF TG_OP = 'UPDATE' AND public.project_is_link_backfill(to_jsonb(OLD), to_jsonb(NEW), ARRAY['person_id','allocation_id']) THEN
    NEW.updated_at := OLD.updated_at;
    RETURN NEW;
  END IF;

  IF NEW.project_id IS NULL THEN RAISE EXCEPTION 'Apontamento exige um projeto.'; END IF;
  IF NEW.user_id IS NULL THEN RAISE EXCEPTION 'Apontamento exige um profissional.'; END IF;

  IF NEW.start_time IS NOT NULL AND NEW.end_time IS NOT NULL THEN
    IF NEW.end_time < NEW.start_time OR (NEW.end_time = NEW.start_time AND NOT v_forced) THEN
      RAISE EXCEPTION 'O horário final deve ser maior que o horário inicial.';
    END IF;
    NEW.duration_minutes := ROUND(EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 60)::int;
  ELSIF NEW.duration_minutes IS NULL AND NEW.hours IS NOT NULL THEN
    NEW.duration_minutes := GREATEST(0, ROUND(NEW.hours * 60))::int;
  END IF;

  IF NEW.duration_minutes IS NOT NULL THEN
    IF NEW.duration_minutes < 0 THEN RAISE EXCEPTION 'A duração do apontamento não pode ser negativa.'; END IF;
    NEW.hours := ROUND((NEW.duration_minutes::numeric / 60), 2);
  END IF;

  IF NEW.start_time IS NOT NULL AND NEW.end_time IS NOT NULL AND NOT v_forced THEN
    SELECT t.start_time, t.end_time INTO v_overlap
      FROM public.project_time_entries t
     WHERE t.user_id = NEW.user_id AND t.entry_date = NEW.entry_date
       AND t.id IS DISTINCT FROM NEW.id
       AND t.start_time IS NOT NULL AND t.end_time IS NOT NULL
       AND t.start_time < NEW.end_time AND t.end_time > NEW.start_time
     LIMIT 1;
    IF v_overlap IS NOT NULL THEN
      RAISE EXCEPTION 'Já existe um apontamento entre % e % neste dia.',
        to_char(v_overlap.start_time, 'HH24:MI'), to_char(v_overlap.end_time, 'HH24:MI');
    END IF;
  END IF;

  IF NEW.created_by IS NULL THEN NEW.created_by := COALESCE(auth.uid(), NEW.user_id); END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.project_time_entries_audit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ws uuid := COALESCE(NEW.workspace_id, OLD.workspace_id);
BEGIN
  -- Vínculo auditado já é registrado, com antes/depois, em project_link_changes.
  IF TG_OP = 'UPDATE' AND public.project_is_link_backfill(to_jsonb(OLD), to_jsonb(NEW), ARRAY['person_id','allocation_id']) THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.audit_logs (workspace_owner_id, actor_user_id, entity, entity_id,
                                 action, before, after, module_id)
  VALUES (
    v_ws,
    auth.uid(),
    'project_time_entries',
    COALESCE(NEW.id, OLD.id),
    lower(TG_OP),
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
    'projects'
  );
  RETURN COALESCE(NEW, OLD);
END;
$function$;

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

CREATE TABLE public.project_link_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('apply_exact','confirm_suggestion','reject_suggestion','revert')),
  actor uuid,
  counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.project_link_batches TO authenticated;
GRANT ALL ON public.project_link_batches TO service_role;
ALTER TABLE public.project_link_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY project_link_batches_admin_read ON public.project_link_batches FOR SELECT TO authenticated
  USING (public.is_active_workspace_admin(workspace_id, auth.uid()));
CREATE INDEX project_link_batches_ws_idx ON public.project_link_batches (workspace_id, created_at DESC);

CREATE TABLE public.project_link_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  batch_id uuid NOT NULL REFERENCES public.project_link_batches(id) ON DELETE CASCADE,
  target_table text NOT NULL CHECK (target_table IN ('projects','project_time_entries')),
  target_id uuid NOT NULL,
  field text NOT NULL CHECK (field IN ('company_id','person_id','allocation_id')),
  subject_id uuid,
  old_value uuid,
  new_value uuid,
  criterion text NOT NULL,
  provider text,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  reverted_at timestamptz,
  reverted_by uuid,
  revert_batch_id uuid
);
GRANT SELECT ON public.project_link_changes TO authenticated;
GRANT ALL ON public.project_link_changes TO service_role;
ALTER TABLE public.project_link_changes ENABLE ROW LEVEL SECURITY;
CREATE POLICY project_link_changes_admin_read ON public.project_link_changes FOR SELECT TO authenticated
  USING (public.is_active_workspace_admin(workspace_id, auth.uid()));
CREATE INDEX project_link_changes_batch_idx ON public.project_link_changes (workspace_id, batch_id);
CREATE INDEX project_link_changes_target_idx ON public.project_link_changes (workspace_id, target_table, target_id, field);
CREATE INDEX project_link_changes_subject_idx ON public.project_link_changes (workspace_id, field, subject_id) WHERE reverted_at IS NULL;

CREATE TABLE public.project_link_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('company','person')),
  provider text NOT NULL,
  subject_id uuid NOT NULL,
  candidate_id uuid NOT NULL,
  criterion text NOT NULL CHECK (criterion IN ('name_exact','email_ambiguous','source_conflict')),
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested','confirmed','rejected')),
  note text,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, kind, subject_id, candidate_id)
);
GRANT SELECT ON public.project_link_suggestions TO authenticated;
GRANT ALL ON public.project_link_suggestions TO service_role;
ALTER TABLE public.project_link_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY project_link_suggestions_admin_read ON public.project_link_suggestions FOR SELECT TO authenticated
  USING (public.is_active_workspace_admin(workspace_id, auth.uid()));

CREATE TABLE public.project_reconciliation_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  dedupe_key text NOT NULL,
  issue_type text NOT NULL CHECK (issue_type IN ('date_before_2020','non_positive_duration','overlap',
    'possible_duplicate','unknown_event','long_interval','open_interval','no_project',
    'cross_source_duplicate','hour_entry_unmatched','staging_review')),
  provider text NOT NULL CHECK (provider IN ('clockify','jibble','erp')),
  time_entry_id uuid REFERENCES public.project_time_entries(id) ON DELETE SET NULL,
  staging_table text CHECK (staging_table IN ('clockify_staging_records','time_import_staging')),
  staging_id uuid,
  source_external_id text,
  user_id uuid,
  project_id uuid,
  entry_date date,
  seconds_impact numeric NOT NULL DEFAULT 0,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','deferred','confirmed','dismissed')),
  resolution_note text,
  resolved_by uuid,
  resolved_at timestamptz,
  present boolean NOT NULL DEFAULT true,
  first_detected_at timestamptz NOT NULL DEFAULT now(),
  last_detected_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, dedupe_key)
);
GRANT SELECT ON public.project_reconciliation_issues TO authenticated;
GRANT ALL ON public.project_reconciliation_issues TO service_role;
ALTER TABLE public.project_reconciliation_issues ENABLE ROW LEVEL SECURITY;
CREATE POLICY project_recon_issues_read ON public.project_reconciliation_issues FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces())
         AND (public.is_active_workspace_admin(workspace_id, auth.uid())
              OR public.user_has_permission(auth.uid(), workspace_id, 'techprojects.time_entries.view.workspace')));
CREATE INDEX project_recon_issues_status_idx ON public.project_reconciliation_issues (workspace_id, present, status, issue_type);
CREATE INDEX project_recon_issues_date_idx ON public.project_reconciliation_issues (workspace_id, entry_date);
CREATE INDEX project_recon_issues_entry_idx ON public.project_reconciliation_issues (time_entry_id) WHERE time_entry_id IS NOT NULL;

CREATE TABLE public.project_reconciliation_issue_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  issue_id uuid NOT NULL REFERENCES public.project_reconciliation_issues(id) ON DELETE CASCADE,
  action text NOT NULL,
  from_status text,
  to_status text,
  note text,
  actor uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.project_reconciliation_issue_events TO authenticated;
GRANT ALL ON public.project_reconciliation_issue_events TO service_role;
ALTER TABLE public.project_reconciliation_issue_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY project_recon_events_admin_read ON public.project_reconciliation_issue_events FOR SELECT TO authenticated
  USING (public.is_active_workspace_admin(workspace_id, auth.uid()));
CREATE INDEX project_recon_events_issue_idx ON public.project_reconciliation_issue_events (issue_id, created_at);

CREATE TABLE public.project_reconciliation_refreshes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  actor uuid,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  counts jsonb NOT NULL DEFAULT '{}'::jsonb
);
GRANT SELECT ON public.project_reconciliation_refreshes TO authenticated;
GRANT ALL ON public.project_reconciliation_refreshes TO service_role;
ALTER TABLE public.project_reconciliation_refreshes ENABLE ROW LEVEL SECURITY;
CREATE POLICY project_recon_refreshes_read ON public.project_reconciliation_refreshes FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces())
         AND (public.is_active_workspace_admin(workspace_id, auth.uid())
              OR public.user_has_permission(auth.uid(), workspace_id, 'techprojects.time_entries.view.workspace')));
CREATE INDEX project_recon_refreshes_ws_idx ON public.project_reconciliation_refreshes (workspace_id, finished_at DESC);

CREATE OR REPLACE FUNCTION public.project_recon_assert_admin(p_ws uuid, p_write boolean)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_ws IS NULL THEN RAISE EXCEPTION 'Workspace obrigatório.' USING ERRCODE = '22023'; END IF;
  IF auth.uid() IS NULL THEN
    IF coalesce(auth.role(), '') = 'service_role' OR session_user IN ('postgres', 'supabase_admin') THEN RETURN; END IF;
    RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_active_workspace_admin(p_ws, auth.uid())
     OR NOT EXISTS (SELECT 1 FROM public.current_user_workspaces() AS w(id) WHERE w.id = p_ws) THEN
    RAISE EXCEPTION 'Apenas administradores ativos do workspace ativo.' USING ERRCODE = '42501';
  END IF;
  IF p_write AND public.is_read_only_view() THEN
    RAISE EXCEPTION 'O modo Ver como é somente leitura.' USING ERRCODE = '42501';
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.project_recon_assert_admin(uuid, boolean) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.project_reconciliation_refresh(p_ws uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public SET statement_timeout = '180s' AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_ref uuid;
  v_counts jsonb;
  v_cleared int;
  v_covered int;
BEGIN
  PERFORM public.project_recon_assert_admin(p_ws, true);
  PERFORM pg_advisory_xact_lock(hashtext('project_recon:' || p_ws::text));
  INSERT INTO public.project_reconciliation_refreshes (workspace_id, actor, started_at)
    VALUES (p_ws, auth.uid(), v_now) RETURNING id INTO v_ref;

  DROP TABLE IF EXISTS pg_temp._recon_prov;
  DROP TABLE IF EXISTS pg_temp._recon_det;
  CREATE TEMP TABLE _recon_prov ON COMMIT DROP AS
    SELECT e.id, e.user_id, e.project_id, e.entry_date, e.started_at, e.stopped_at,
           e.duration_minutes, e.hours, e.status, e.source, e.external_id,
           CASE WHEN cl.target_id IS NOT NULL THEN 'clockify' WHEN tl.target_id IS NOT NULL THEN 'jibble' ELSE 'erp' END AS provider,
           cl.external_id AS ck_ext, cl.meta AS ck_meta, tl.external_id AS jb_ext,
           public.project_entry_seconds(e.started_at, e.stopped_at, e.duration_minutes, e.hours) AS secs
      FROM public.project_time_entries e
      LEFT JOIN (SELECT DISTINCT ON (target_id) target_id, external_id, meta FROM public.clockify_import_links
                  WHERE workspace_id = p_ws AND target_table = 'project_time_entries' ORDER BY target_id, segment) cl
        ON cl.target_id = e.id
      LEFT JOIN (SELECT DISTINCT ON (target_id) target_id, external_id FROM public.time_import_links
                  WHERE workspace_id = p_ws AND target_table = 'project_time_entries' ORDER BY target_id, segment) tl
        ON tl.target_id = e.id
     WHERE e.workspace_id = p_ws;

  CREATE TEMP TABLE _recon_det (
    dedupe_key text PRIMARY KEY, issue_type text, provider text, time_entry_id uuid, staging_table text,
    staging_id uuid, source_external_id text, user_id uuid, project_id uuid, entry_date date,
    seconds_impact numeric, detail jsonb) ON COMMIT DROP;

  INSERT INTO _recon_det
  SELECT 'date_before_2020:' || p.id, 'date_before_2020', p.provider, p.id, NULL, NULL,
         coalesce(p.ck_ext, p.jb_ext, p.external_id), p.user_id, p.project_id, p.entry_date, p.secs,
         jsonb_build_object(
           'entry_date', p.entry_date, 'started_at', p.started_at, 'stopped_at', p.stopped_at,
           'source_start', s.payload->'timeInterval'->>'start', 'source_end', s.payload->'timeInterval'->>'end',
           'source_timezone', s.payload->'timeInterval'->>'timeZone',
           'diagnosis', CASE
             WHEN s.id IS NULL THEN 'no_raw'
             WHEN public.try_iso_date(s.payload->'timeInterval'->>'start') < date '2020-01-01' THEN 'origin_payload'
             ELSE 'transformation_mismatch' END)
    FROM _recon_prov p
    LEFT JOIN public.clockify_staging_records s
      ON s.workspace_id = p_ws AND s.entity_type = 'time_entry' AND s.external_id = p.ck_ext
   WHERE p.entry_date < date '2020-01-01';

  INSERT INTO _recon_det
  SELECT 'non_positive_duration:' || p.id, 'non_positive_duration', p.provider, p.id, NULL, NULL,
         coalesce(p.ck_ext, p.jb_ext, p.external_id), p.user_id, p.project_id, p.entry_date, p.secs,
         jsonb_build_object('hours', p.hours, 'duration_minutes', p.duration_minutes, 'seconds', p.secs,
           'started_at', p.started_at, 'stopped_at', p.stopped_at, 'forced_reason', p.ck_meta->>'forced_reason')
    FROM _recon_prov p
   WHERE coalesce(p.hours, 0) <= 0 OR p.secs <= 0;

  INSERT INTO _recon_det
  SELECT 'overlap:' || x.id, 'overlap', x.provider, x.id, NULL, NULL,
         coalesce(x.ck_ext, x.jb_ext, x.external_id), x.user_id, x.project_id, x.entry_date,
         extract(epoch FROM (least(x.stopped_at, x.prev_max) - x.started_at)),
         jsonb_build_object('started_at', x.started_at, 'stopped_at', x.stopped_at,
           'overlap_seconds', extract(epoch FROM (least(x.stopped_at, x.prev_max) - x.started_at)),
           'forced_reason', x.ck_meta->>'forced_reason')
    FROM (SELECT p.*, max(p.stopped_at) OVER (PARTITION BY p.user_id ORDER BY p.started_at, p.id
                 ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS prev_max
            FROM _recon_prov p
           WHERE p.started_at IS NOT NULL AND p.stopped_at > p.started_at) x
   WHERE x.prev_max > x.started_at;

  INSERT INTO _recon_det
  SELECT 'possible_duplicate:' || y.id, 'possible_duplicate', y.provider, y.id, NULL, NULL,
         coalesce(y.ck_ext, y.jb_ext, y.external_id), y.user_id, y.project_id, y.entry_date, y.secs,
         jsonb_build_object('group_size', y.n, 'first_entry_id', y.first_id, 'providers', y.provs,
           'started_at', y.started_at, 'stopped_at', y.stopped_at)
    FROM (SELECT p.*,
                 row_number() OVER w AS rn,
                 count(*) OVER (PARTITION BY p.user_id, p.started_at, p.stopped_at) AS n,
                 first_value(p.id) OVER w AS first_id,
                 to_jsonb(array_agg(p.provider) OVER (PARTITION BY p.user_id, p.started_at, p.stopped_at)) AS provs
            FROM _recon_prov p
           WHERE p.started_at IS NOT NULL AND p.stopped_at IS NOT NULL
          WINDOW w AS (PARTITION BY p.user_id, p.started_at, p.stopped_at ORDER BY p.id)) y
   WHERE y.n > 1 AND y.rn > 1;

  INSERT INTO _recon_det
  SELECT s.reason_code || ':jibble:' || s.id, s.reason_code, 'jibble', NULL, 'time_import_staging', s.id,
         s.external_id, m.target_id, NULL,
         coalesce(public.try_iso_date(s.payload->'segments'->0->>'localDate'),
                  public.try_iso_date(s.payload->>'localTime'), s.period),
         coalesce(CASE WHEN (s.payload->>'seconds') ~ '^-?\d+(\.\d+)?$' THEN (s.payload->>'seconds')::numeric END, 0),
         jsonb_build_object('entity', s.entity_type, 'status', s.status, 'reason_detail', s.reason_detail,
           'start_utc', s.payload->>'startUtc', 'end_utc', s.payload->>'endUtc',
           'event_type', s.payload->>'type', 'event_time', s.payload->>'time',
           'offset', coalesce(s.payload->>'endOffset', s.payload->>'offset'),
           'person_external_id', s.person_external_id,
           'duplicate', (SELECT jsonb_build_object('kind', d.kind, 'decision', d.decision,
                            'existing_source', d.existing_source, 'overlap_seconds', d.overlap_seconds,
                            'existing_entry_id', d.existing_entry_id)
                           FROM public.time_import_duplicates d
                          WHERE d.workspace_id = p_ws AND d.provider = s.provider AND d.external_id = s.external_id
                          ORDER BY d.segment LIMIT 1))
    FROM public.time_import_staging s
    LEFT JOIN public.time_import_mappings m
      ON m.workspace_id = p_ws AND m.provider = s.provider AND m.source_org_id = s.source_org_id
     AND m.entity_type = 'person' AND m.external_id = s.person_external_id AND m.decision IN ('auto','confirmed')
   WHERE s.workspace_id = p_ws
     AND s.reason_code IN ('unknown_event','long_interval','open_interval','no_project','cross_source_duplicate')
     AND s.status <> 'imported';

  INSERT INTO _recon_det
  SELECT 'staging_review:clockify:' || s.id, 'staging_review', 'clockify', NULL, 'clockify_staging_records', s.id,
         s.external_id, NULL, NULL, public.try_iso_date(s.payload->'timeInterval'->>'start'), 0,
         jsonb_build_object('entity', s.entity_type, 'status', s.status, 'reason_code', s.reason_code,
           'reason_detail', s.reason_detail)
    FROM public.clockify_staging_records s
   WHERE s.workspace_id = p_ws AND s.entity_type = 'time_entry' AND s.status NOT IN ('imported','staged')
  ON CONFLICT (dedupe_key) DO NOTHING;

  WITH he AS (
    SELECT s.id, s.external_id, s.payload->>'personId' AS pid, public.try_iso_date(s.payload->>'date') AS d,
           public.iso8601_duration_seconds(s.payload->>'duration') AS secs, s.payload->>'status' AS st, s.person_external_id
      FROM public.time_import_staging s
     WHERE s.workspace_id = p_ws AND s.provider = 'jibble' AND s.entity_type = 'hour_entry'
       AND coalesce(s.payload->>'status', 'Active') NOT IN ('Archived','Deleted','Removed')),
  hs AS (SELECT pid, d, sum(secs) AS secs FROM he GROUP BY 1, 2),
  iv AS (
    SELECT s.payload->>'personId' AS pid, public.try_iso_date(seg->>'localDate') AS d,
           sum(CASE WHEN (seg->>'seconds') ~ '^\d+(\.\d+)?$' THEN (seg->>'seconds')::numeric ELSE 0 END) AS secs
      FROM public.time_import_staging s
     CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(s.payload->'segments') = 'array' THEN s.payload->'segments' ELSE '[]'::jsonb END) seg
     WHERE s.workspace_id = p_ws AND s.provider = 'jibble' AND s.entity_type = 'interval'
     GROUP BY 1, 2),
  ins AS (
    INSERT INTO _recon_det
    SELECT 'hour_entry_unmatched:' || he.id, 'hour_entry_unmatched', 'jibble', NULL, 'time_import_staging', he.id,
           he.external_id, m.target_id, NULL, he.d, greatest(hs.secs - coalesce(iv.secs, 0), 0),
           jsonb_build_object('entry_seconds', he.secs, 'hour_entries_day_seconds', hs.secs,
             'intervals_day_seconds', coalesce(iv.secs, 0), 'status', he.st,
             'semantics', 'Duração sem horário de início/fim; materializar depende da definição do ciclo 3.')
      FROM he JOIN hs ON hs.pid IS NOT DISTINCT FROM he.pid AND hs.d IS NOT DISTINCT FROM he.d
      LEFT JOIN iv ON iv.pid = he.pid AND iv.d = he.d
      LEFT JOIN public.time_import_mappings m
        ON m.workspace_id = p_ws AND m.provider = 'jibble' AND m.entity_type = 'person'
       AND m.external_id = he.pid AND m.decision IN ('auto','confirmed')
     WHERE coalesce(he.secs, 0) > 0 AND coalesce(iv.secs, 0) < hs.secs
    RETURNING 1)
  SELECT (SELECT count(*) FROM he WHERE coalesce(secs, 0) > 0) - (SELECT count(*) FROM ins) INTO v_covered;

  UPDATE public.project_reconciliation_issues i
     SET present = false, updated_at = now()
   WHERE i.workspace_id = p_ws AND i.present
     AND NOT EXISTS (SELECT 1 FROM _recon_det d WHERE d.dedupe_key = i.dedupe_key);
  GET DIAGNOSTICS v_cleared = ROW_COUNT;

  INSERT INTO public.project_reconciliation_issues AS i
    (workspace_id, dedupe_key, issue_type, provider, time_entry_id, staging_table, staging_id,
     source_external_id, user_id, project_id, entry_date, seconds_impact, detail,
     present, first_detected_at, last_detected_at)
  SELECT p_ws, d.dedupe_key, d.issue_type, d.provider, d.time_entry_id, d.staging_table, d.staging_id,
         d.source_external_id, d.user_id, d.project_id, d.entry_date, coalesce(d.seconds_impact, 0), d.detail,
         true, v_now, v_now
    FROM _recon_det d
  ON CONFLICT (workspace_id, dedupe_key) DO UPDATE
     SET present = true, last_detected_at = v_now, seconds_impact = EXCLUDED.seconds_impact,
         detail = EXCLUDED.detail, user_id = EXCLUDED.user_id, project_id = EXCLUDED.project_id,
         entry_date = EXCLUDED.entry_date, time_entry_id = EXCLUDED.time_entry_id, updated_at = now();

  SELECT jsonb_build_object(
           'by_type', coalesce((SELECT jsonb_object_agg(issue_type, n) FROM
              (SELECT issue_type, count(*) AS n FROM _recon_det GROUP BY 1) x), '{}'::jsonb),
           'detected', (SELECT count(*) FROM _recon_det),
           'distinct_entries', (SELECT count(DISTINCT time_entry_id) FROM _recon_det WHERE time_entry_id IS NOT NULL),
           'cleared', v_cleared,
           'hour_entries_covered_by_intervals', v_covered,
           'entries_scanned', (SELECT count(*) FROM _recon_prov))
    INTO v_counts;
  UPDATE public.project_reconciliation_refreshes SET finished_at = clock_timestamp(), counts = v_counts WHERE id = v_ref;
  RETURN v_counts || jsonb_build_object('refresh_id', v_ref);
END $$;
REVOKE ALL ON FUNCTION public.project_reconciliation_refresh(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_reconciliation_refresh(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.project_reconciliation_decide(p_ws uuid, p_ids uuid[], p_action text, p_note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_to text; v_n int;
BEGIN
  PERFORM public.project_recon_assert_admin(p_ws, true);
  v_to := CASE p_action WHEN 'confirm' THEN 'confirmed' WHEN 'dismiss' THEN 'dismissed'
                        WHEN 'defer' THEN 'deferred' WHEN 'reopen' THEN 'open' END;
  IF v_to IS NULL THEN RAISE EXCEPTION 'Ação inválida.' USING ERRCODE = '22023'; END IF;
  IF p_ids IS NULL OR cardinality(p_ids) = 0 OR cardinality(p_ids) > 5000 THEN
    RAISE EXCEPTION 'Selecione entre 1 e 5000 alertas.' USING ERRCODE = '22023';
  END IF;
  IF p_action IN ('confirm','dismiss') AND length(btrim(coalesce(p_note, ''))) < 5 THEN
    RAISE EXCEPTION 'Informe a justificativa (mínimo 5 caracteres).' USING ERRCODE = '22023';
  END IF;
  WITH t AS (
    SELECT id, status FROM public.project_reconciliation_issues
     WHERE workspace_id = p_ws AND id = ANY (p_ids) AND status <> v_to FOR UPDATE),
  u AS (
    UPDATE public.project_reconciliation_issues i
       SET status = v_to,
           resolution_note = CASE WHEN v_to = 'open' THEN NULL ELSE nullif(btrim(p_note), '') END,
           resolved_by = CASE WHEN v_to = 'open' THEN NULL ELSE auth.uid() END,
           resolved_at = CASE WHEN v_to = 'open' THEN NULL ELSE now() END,
           updated_at = now()
      FROM t WHERE i.id = t.id
    RETURNING i.id, t.status AS from_status)
  INSERT INTO public.project_reconciliation_issue_events (workspace_id, issue_id, action, from_status, to_status, note, actor)
  SELECT p_ws, u.id, p_action, u.from_status, v_to, nullif(btrim(p_note), ''), auth.uid() FROM u;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN jsonb_build_object('updated', v_n);
END $$;
REVOKE ALL ON FUNCTION public.project_reconciliation_decide(uuid, uuid[], text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_reconciliation_decide(uuid, uuid[], text, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.project_links_apply_exact(p_ws uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public SET statement_timeout = '180s' AS $$
DECLARE
  v_batch uuid;
  v_company int := 0; v_person int := 0; v_alloc int := 0; v_sugg int := 0; v_conflict int := 0;
  v_counts jsonb;
BEGIN
  PERFORM public.project_recon_assert_admin(p_ws, true);
  PERFORM pg_advisory_xact_lock(hashtext('project_links:' || p_ws::text));
  PERFORM set_config('app.project_link_backfill', 'on', true);
  INSERT INTO public.project_link_batches (workspace_id, kind, actor) VALUES (p_ws, 'apply_exact', auth.uid())
    RETURNING id INTO v_batch;

  DROP TABLE IF EXISTS pg_temp._lk_company;
  CREATE TEMP TABLE _lk_company ON COMMIT DROP AS
  SELECT p.id AS project_id, src.provider, src.company_id, src.client_id,
         (c.id IS NOT NULL) AS company_ok,
         EXISTS (SELECT 1 FROM public.clockify_mappings m
                  WHERE src.provider = 'clockify' AND m.workspace_id = p_ws AND m.entity_type = 'client'
                    AND m.external_id = src.client_id AND m.target_id IS NOT NULL
                    AND m.target_id::text <> src.company_id)
      OR EXISTS (SELECT 1 FROM public.time_import_mappings m
                  WHERE src.provider = 'jibble' AND m.workspace_id = p_ws AND m.entity_type = 'client'
                    AND m.external_id = src.client_id AND m.target_id IS NOT NULL
                    AND m.target_id::text <> src.company_id) AS mapping_conflict,
         (p.metadata ? 'clockify' AND p.metadata ? 'jibble'
          AND p.metadata->'clockify'->>'company_id' IS DISTINCT FROM p.metadata->'jibble'->>'company_id') AS provider_conflict
    FROM public.projects p
   CROSS JOIN LATERAL (VALUES
           ('clockify', p.metadata->'clockify'->>'company_id', p.metadata->'clockify'->>'client_id'),
           ('jibble', p.metadata->'jibble'->>'company_id', p.metadata->'jibble'->>'client_id')) AS src(provider, company_id, client_id)
    LEFT JOIN public.companies c ON c.id::text = src.company_id AND c.workspace_id = p_ws AND c.deleted_at IS NULL
   WHERE p.workspace_id = p_ws AND p.company_id IS NULL AND src.company_id IS NOT NULL;

  WITH ok AS (
    SELECT DISTINCT ON (project_id) project_id, provider, company_id::uuid AS company_id, client_id
      FROM _lk_company WHERE company_ok AND NOT mapping_conflict AND NOT provider_conflict
     ORDER BY project_id, provider),
  upd AS (
    UPDATE public.projects p SET company_id = ok.company_id
      FROM ok WHERE p.id = ok.project_id AND p.workspace_id = p_ws AND p.company_id IS NULL
    RETURNING p.id, ok.company_id, ok.provider, ok.client_id)
  INSERT INTO public.project_link_changes (workspace_id, batch_id, target_table, target_id, field, subject_id,
    old_value, new_value, criterion, provider, evidence, actor)
  SELECT p_ws, v_batch, 'projects', upd.id, 'company_id', upd.id, NULL, upd.company_id, 'source_fk_metadata',
         upd.provider, jsonb_build_object('source_client_id', upd.client_id), auth.uid() FROM upd;
  GET DIAGNOSTICS v_company = ROW_COUNT;

  INSERT INTO public.project_link_suggestions (workspace_id, kind, provider, subject_id, candidate_id, criterion, detail)
  SELECT p_ws, 'company', l.provider, l.project_id, l.company_id::uuid, 'source_conflict',
         jsonb_build_object('mapping_conflict', l.mapping_conflict, 'provider_conflict', l.provider_conflict,
                            'source_client_id', l.client_id)
    FROM _lk_company l
   WHERE l.company_ok AND (l.mapping_conflict OR l.provider_conflict)
  ON CONFLICT (workspace_id, kind, subject_id, candidate_id) DO NOTHING;
  GET DIAGNOSTICS v_conflict = ROW_COUNT;

  DROP TABLE IF EXISTS pg_temp._lk_person;
  CREATE TEMP TABLE _lk_person ON COMMIT DROP AS
  WITH u AS (
    SELECT DISTINCT e.user_id FROM public.project_time_entries e
     WHERE e.workspace_id = p_ws AND e.person_id IS NULL),
  ue AS (
    SELECT u.user_id, lower(btrim(au.email)) AS em FROM u
      JOIN auth.users au ON au.id = u.user_id
      JOIN public.workspace_members wm ON wm.workspace_id = p_ws AND wm.user_id = u.user_id
     WHERE au.email IS NOT NULL AND btrim(au.email) <> ''),
  wm_em AS (
    SELECT lower(btrim(au.email)) AS em, count(*) AS n FROM public.workspace_members wm
      JOIN auth.users au ON au.id = wm.user_id WHERE wm.workspace_id = p_ws GROUP BY 1),
  pe AS (
    SELECT p.id, lower(btrim(p.email)) AS em, p.profile_id FROM public.people p
     WHERE p.workspace_id = p_ws AND p.email IS NOT NULL AND btrim(p.email) <> '' AND NOT coalesce(p.archived, false)),
  pe_em AS (SELECT em, count(*) AS n FROM pe GROUP BY 1)
  SELECT ue.user_id, pe.id AS person_id, ue.em,
         (wm_em.n = 1 AND pe_em.n = 1 AND (pe.profile_id IS NULL OR pe.profile_id = ue.user_id)
          AND NOT EXISTS (SELECT 1 FROM public.project_time_entries x
                           WHERE x.workspace_id = p_ws AND x.person_id = pe.id AND x.user_id <> ue.user_id)
          AND NOT EXISTS (SELECT 1 FROM public.project_time_entries x
                           WHERE x.workspace_id = p_ws AND x.user_id = ue.user_id
                             AND x.person_id IS NOT NULL AND x.person_id <> pe.id)) AS exact
    FROM ue JOIN pe ON pe.em = ue.em
    JOIN wm_em ON wm_em.em = ue.em JOIN pe_em ON pe_em.em = ue.em;

  WITH upd AS (
    UPDATE public.project_time_entries e SET person_id = m.person_id
      FROM _lk_person m
     WHERE m.exact AND e.workspace_id = p_ws AND e.user_id = m.user_id AND e.person_id IS NULL
    RETURNING e.id, e.user_id, m.person_id)
  INSERT INTO public.project_link_changes (workspace_id, batch_id, target_table, target_id, field, subject_id,
    old_value, new_value, criterion, provider, evidence, actor)
  SELECT p_ws, v_batch, 'project_time_entries', upd.id, 'person_id', upd.user_id, NULL, upd.person_id,
         'email_exact_unique', NULL, '{}'::jsonb, auth.uid() FROM upd;
  GET DIAGNOSTICS v_person = ROW_COUNT;

  INSERT INTO public.project_link_suggestions (workspace_id, kind, provider, subject_id, candidate_id, criterion, detail)
  SELECT p_ws, 'person', 'erp', m.user_id, m.person_id, 'email_ambiguous', '{}'::jsonb
    FROM _lk_person m WHERE NOT m.exact
  ON CONFLICT (workspace_id, kind, subject_id, candidate_id) DO NOTHING;
  GET DIAGNOSTICS v_sugg = ROW_COUNT;

  WITH u AS (
    SELECT DISTINCT e.user_id FROM public.project_time_entries e
     WHERE e.workspace_id = p_ws AND e.person_id IS NULL),
  ins AS (
    INSERT INTO public.project_link_suggestions (workspace_id, kind, provider, subject_id, candidate_id, criterion, detail)
    SELECT p_ws, 'person', 'erp', u.user_id, pe.id, 'name_exact', '{}'::jsonb
      FROM u JOIN public.profiles pr ON pr.id = u.user_id
      JOIN public.people pe ON pe.workspace_id = p_ws AND NOT coalesce(pe.archived, false)
       AND lower(regexp_replace(btrim(pe.full_name), '\s+', ' ', 'g')) = lower(regexp_replace(btrim(pr.full_name), '\s+', ' ', 'g'))
     WHERE pr.full_name IS NOT NULL AND btrim(pr.full_name) <> ''
       AND NOT EXISTS (SELECT 1 FROM _lk_person m WHERE m.user_id = u.user_id)
    ON CONFLICT (workspace_id, kind, subject_id, candidate_id) DO NOTHING
    RETURNING 1)
  SELECT v_sugg + count(*) INTO v_sugg FROM ins;

  WITH a AS (
    SELECT e.id, min(al.id::text)::uuid AS allocation_id, count(*) AS n
      FROM public.project_time_entries e
      JOIN public.people_allocations al
        ON al.workspace_id = e.workspace_id AND al.person_id = e.person_id AND al.project_id = e.project_id
       AND al.starts_at IS NOT NULL AND e.entry_date >= al.starts_at
       AND (al.ends_at IS NULL OR e.entry_date <= al.ends_at)
     WHERE e.workspace_id = p_ws AND e.person_id IS NOT NULL AND e.allocation_id IS NULL
     GROUP BY e.id HAVING count(*) = 1),
  upd AS (
    UPDATE public.project_time_entries e SET allocation_id = a.allocation_id
      FROM a WHERE e.id = a.id AND e.allocation_id IS NULL
    RETURNING e.id, e.user_id, a.allocation_id)
  INSERT INTO public.project_link_changes (workspace_id, batch_id, target_table, target_id, field, subject_id,
    old_value, new_value, criterion, provider, evidence, actor)
  SELECT p_ws, v_batch, 'project_time_entries', upd.id, 'allocation_id', upd.user_id, NULL, upd.allocation_id,
         'allocation_unique_period', NULL, '{}'::jsonb, auth.uid() FROM upd;
  GET DIAGNOSTICS v_alloc = ROW_COUNT;

  v_counts := jsonb_build_object('company_links', v_company, 'person_links', v_person,
    'allocation_links', v_alloc, 'suggestions_new', v_sugg, 'company_conflicts_new', v_conflict,
    'person_exact_subjects', (SELECT count(*) FROM _lk_person WHERE exact),
    'person_ambiguous_subjects', (SELECT count(DISTINCT user_id) FROM _lk_person WHERE NOT exact));
  UPDATE public.project_link_batches SET counts = v_counts WHERE id = v_batch;
  RETURN v_counts || jsonb_build_object('batch_id', v_batch);
END $$;
REVOKE ALL ON FUNCTION public.project_links_apply_exact(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_links_apply_exact(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.project_link_suggestions_decide(p_ws uuid, p_ids uuid[], p_action text, p_note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_batch uuid; v_applied int := 0; v_n int := 0; v_dup int;
BEGIN
  PERFORM public.project_recon_assert_admin(p_ws, true);
  IF p_action NOT IN ('confirm','reject') THEN RAISE EXCEPTION 'Ação inválida.' USING ERRCODE = '22023'; END IF;
  IF p_ids IS NULL OR cardinality(p_ids) = 0 OR cardinality(p_ids) > 1000 THEN
    RAISE EXCEPTION 'Selecione entre 1 e 1000 sugestões.' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('project_links:' || p_ws::text));
  PERFORM set_config('app.project_link_backfill', 'on', true);
  INSERT INTO public.project_link_batches (workspace_id, kind, actor)
    VALUES (p_ws, CASE WHEN p_action = 'confirm' THEN 'confirm_suggestion' ELSE 'reject_suggestion' END, auth.uid())
    RETURNING id INTO v_batch;

  IF p_action = 'reject' THEN
    UPDATE public.project_link_suggestions SET status = 'rejected', note = nullif(btrim(p_note), ''),
           decided_by = auth.uid(), decided_at = now(), updated_at = now()
     WHERE workspace_id = p_ws AND id = ANY (p_ids) AND status = 'suggested';
    GET DIAGNOSTICS v_n = ROW_COUNT;
    UPDATE public.project_link_batches SET counts = jsonb_build_object('rejected', v_n) WHERE id = v_batch;
    RETURN jsonb_build_object('rejected', v_n, 'batch_id', v_batch);
  END IF;

  SELECT count(*) - count(DISTINCT (kind, subject_id)) INTO v_dup
    FROM public.project_link_suggestions WHERE workspace_id = p_ws AND id = ANY (p_ids) AND status = 'suggested';
  IF v_dup > 0 THEN
    RAISE EXCEPTION 'Escolha só um candidato por registro.' USING ERRCODE = '22023';
  END IF;

  WITH s AS (
    SELECT s.* FROM public.project_link_suggestions s
      JOIN public.companies c ON c.id = s.candidate_id AND c.workspace_id = p_ws AND c.deleted_at IS NULL
     WHERE s.workspace_id = p_ws AND s.id = ANY (p_ids) AND s.status = 'suggested' AND s.kind = 'company'),
  upd AS (
    UPDATE public.projects p SET company_id = s.candidate_id FROM s
     WHERE p.id = s.subject_id AND p.workspace_id = p_ws AND p.company_id IS NULL
    RETURNING p.id, s.candidate_id, s.provider, s.id AS sid)
  INSERT INTO public.project_link_changes (workspace_id, batch_id, target_table, target_id, field, subject_id,
    old_value, new_value, criterion, provider, evidence, actor)
  SELECT p_ws, v_batch, 'projects', upd.id, 'company_id', upd.id, NULL, upd.candidate_id, 'confirmed_suggestion',
         upd.provider, jsonb_build_object('suggestion_id', upd.sid, 'note', nullif(btrim(p_note), '')), auth.uid() FROM upd;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_applied := v_applied + v_n;

  WITH s AS (
    SELECT s.* FROM public.project_link_suggestions s
      JOIN public.people pe ON pe.id = s.candidate_id AND pe.workspace_id = p_ws
     WHERE s.workspace_id = p_ws AND s.id = ANY (p_ids) AND s.status = 'suggested' AND s.kind = 'person'
       AND NOT EXISTS (SELECT 1 FROM public.project_time_entries x
                        WHERE x.workspace_id = p_ws AND x.person_id = s.candidate_id AND x.user_id <> s.subject_id)),
  upd AS (
    UPDATE public.project_time_entries e SET person_id = s.candidate_id FROM s
     WHERE e.workspace_id = p_ws AND e.user_id = s.subject_id AND e.person_id IS NULL
    RETURNING e.id, e.user_id, s.candidate_id, s.id AS sid)
  INSERT INTO public.project_link_changes (workspace_id, batch_id, target_table, target_id, field, subject_id,
    old_value, new_value, criterion, provider, evidence, actor)
  SELECT p_ws, v_batch, 'project_time_entries', upd.id, 'person_id', upd.user_id, NULL, upd.candidate_id,
         'confirmed_suggestion', NULL, jsonb_build_object('suggestion_id', upd.sid, 'note', nullif(btrim(p_note), '')),
         auth.uid() FROM upd;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_applied := v_applied + v_n;

  UPDATE public.project_link_suggestions SET status = 'confirmed', note = nullif(btrim(p_note), ''),
         decided_by = auth.uid(), decided_at = now(), updated_at = now()
   WHERE workspace_id = p_ws AND id = ANY (p_ids) AND status = 'suggested';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  UPDATE public.project_link_batches SET counts = jsonb_build_object('confirmed', v_n, 'rows_linked', v_applied)
   WHERE id = v_batch;
  RETURN jsonb_build_object('confirmed', v_n, 'rows_linked', v_applied, 'batch_id', v_batch);
END $$;
REVOKE ALL ON FUNCTION public.project_link_suggestions_decide(uuid, uuid[], text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_link_suggestions_decide(uuid, uuid[], text, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.project_links_revert(p_ws uuid, p_kind text, p_subject_ids uuid[], p_batch uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_batch uuid; v_rev int := 0; v_n int; v_skipped int;
BEGIN
  PERFORM public.project_recon_assert_admin(p_ws, true);
  IF p_kind NOT IN ('company','person','batch') THEN RAISE EXCEPTION 'Tipo inválido.' USING ERRCODE = '22023'; END IF;
  IF p_kind <> 'batch' AND (p_subject_ids IS NULL OR cardinality(p_subject_ids) = 0 OR cardinality(p_subject_ids) > 1000) THEN
    RAISE EXCEPTION 'Selecione entre 1 e 1000 registros.' USING ERRCODE = '22023';
  END IF;
  IF p_kind = 'batch' AND p_batch IS NULL THEN RAISE EXCEPTION 'Lote obrigatório.' USING ERRCODE = '22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('project_links:' || p_ws::text));
  PERFORM set_config('app.project_link_backfill', 'on', true);
  INSERT INTO public.project_link_batches (workspace_id, kind, actor) VALUES (p_ws, 'revert', auth.uid())
    RETURNING id INTO v_batch;

  DROP TABLE IF EXISTS pg_temp._lk_rev;
  CREATE TEMP TABLE _lk_rev ON COMMIT DROP AS
  SELECT c.* FROM public.project_link_changes c
   WHERE c.workspace_id = p_ws AND c.reverted_at IS NULL
     AND ((p_kind = 'company' AND c.field = 'company_id' AND c.subject_id = ANY (p_subject_ids))
       OR (p_kind = 'person' AND c.field IN ('person_id','allocation_id') AND c.subject_id = ANY (p_subject_ids))
       OR (p_kind = 'batch' AND c.batch_id = p_batch));

  WITH upd AS (
    UPDATE public.projects p SET company_id = r.old_value FROM _lk_rev r
     WHERE r.target_table = 'projects' AND r.field = 'company_id' AND p.id = r.target_id
       AND p.workspace_id = p_ws AND p.company_id IS NOT DISTINCT FROM r.new_value
    RETURNING r.id)
  UPDATE public.project_link_changes c SET reverted_at = now(), reverted_by = auth.uid(), revert_batch_id = v_batch
    FROM upd WHERE c.id = upd.id;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_rev := v_rev + v_n;

  WITH upd AS (
    UPDATE public.project_time_entries e SET allocation_id = r.old_value FROM _lk_rev r
     WHERE r.target_table = 'project_time_entries' AND r.field = 'allocation_id' AND e.id = r.target_id
       AND e.workspace_id = p_ws AND e.allocation_id IS NOT DISTINCT FROM r.new_value
    RETURNING r.id)
  UPDATE public.project_link_changes c SET reverted_at = now(), reverted_by = auth.uid(), revert_batch_id = v_batch
    FROM upd WHERE c.id = upd.id;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_rev := v_rev + v_n;

  WITH upd AS (
    UPDATE public.project_time_entries e SET person_id = r.old_value FROM _lk_rev r
     WHERE r.target_table = 'project_time_entries' AND r.field = 'person_id' AND e.id = r.target_id
       AND e.workspace_id = p_ws AND e.person_id IS NOT DISTINCT FROM r.new_value
       AND (e.allocation_id IS NULL OR r.old_value IS NOT NULL)
    RETURNING r.id)
  UPDATE public.project_link_changes c SET reverted_at = now(), reverted_by = auth.uid(), revert_batch_id = v_batch
    FROM upd WHERE c.id = upd.id;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_rev := v_rev + v_n;

  SELECT count(*) - v_rev INTO v_skipped FROM _lk_rev;
  UPDATE public.project_link_batches SET counts = jsonb_build_object('reverted', v_rev, 'skipped_changed_since', v_skipped)
   WHERE id = v_batch;
  RETURN jsonb_build_object('reverted', v_rev, 'skipped_changed_since', v_skipped, 'batch_id', v_batch);
END $$;
REVOKE ALL ON FUNCTION public.project_links_revert(uuid, text, uuid[], uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_links_revert(uuid, text, uuid[], uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.project_reconciliation_overview(p_ws uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
WITH ck_erp AS (
  SELECT count(*) AS n, sum(public.project_entry_seconds(e.started_at, e.stopped_at, e.duration_minutes, e.hours)) AS s,
         sum(l.source_seconds) AS src
    FROM public.clockify_import_links l JOIN public.project_time_entries e ON e.id = l.target_id
   WHERE l.workspace_id = p_ws AND l.target_table = 'project_time_entries'),
jb_erp AS (
  SELECT count(*) AS n, sum(public.project_entry_seconds(e.started_at, e.stopped_at, e.duration_minutes, e.hours)) AS s,
         sum(l.source_seconds) AS src
    FROM public.time_import_links l JOIN public.project_time_entries e ON e.id = l.target_id
   WHERE l.workspace_id = p_ws AND l.provider = 'jibble' AND l.target_table = 'project_time_entries')
SELECT jsonb_build_object(
  'clockify', jsonb_build_object(
    'staging', coalesce((SELECT jsonb_object_agg(k, n) FROM (SELECT entity_type || ':' || status AS k, count(*) AS n
        FROM public.clockify_staging_records WHERE workspace_id = p_ws GROUP BY 1) x), '{}'::jsonb),
    'links', coalesce((SELECT jsonb_object_agg(k, n) FROM (SELECT entity_type || ':' || target_table AS k, count(*) AS n
        FROM public.clockify_import_links WHERE workspace_id = p_ws GROUP BY 1) x), '{}'::jsonb),
    'linked_entries', (SELECT n FROM ck_erp), 'erp_seconds', (SELECT s FROM ck_erp),
    'source_seconds', (SELECT src FROM ck_erp),
    'capabilities', (SELECT r.report->'capabilities' FROM public.clockify_import_runs r
        WHERE r.workspace_id = p_ws AND r.report ? 'capabilities' ORDER BY r.finished_at DESC NULLS LAST LIMIT 1),
    'not_collected', (SELECT r.report->'not_collected' FROM public.clockify_import_runs r
        WHERE r.workspace_id = p_ws AND r.report ? 'not_collected' ORDER BY r.finished_at DESC NULLS LAST LIMIT 1),
    'origin_report', (SELECT jsonb_build_object('run_id', r.id, 'finished_at', r.finished_at,
          'status', r.report->'reconciliation'->>'status',
          'diffs', coalesce(r.report->'reconciliation'->'diffs', '[]'::jsonb))
        FROM public.clockify_import_runs r
        WHERE r.workspace_id = p_ws AND r.report ? 'reconciliation' ORDER BY r.finished_at DESC NULLS LAST LIMIT 1),
    'runs', coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'kind', kind, 'status', status, 'phase', phase,
          'started_at', started_at, 'finished_at', finished_at, 'has_error', error IS NOT NULL) ORDER BY created_at DESC)
        FROM (SELECT * FROM public.clockify_import_runs WHERE workspace_id = p_ws ORDER BY created_at DESC LIMIT 10) r), '[]'::jsonb)),
  'jibble', jsonb_build_object(
    'staging', coalesce((SELECT jsonb_object_agg(k, n) FROM (SELECT entity_type || ':' || status AS k, count(*) AS n
        FROM public.time_import_staging WHERE workspace_id = p_ws AND provider = 'jibble' GROUP BY 1) x), '{}'::jsonb),
    'links', coalesce((SELECT jsonb_object_agg(k, n) FROM (SELECT entity_type || ':' || target_table AS k, count(*) AS n
        FROM public.time_import_links WHERE workspace_id = p_ws AND provider = 'jibble' GROUP BY 1) x), '{}'::jsonb),
    'linked_entries', (SELECT n FROM jb_erp), 'erp_seconds', (SELECT s FROM jb_erp),
    'source_seconds', (SELECT src FROM jb_erp),
    'not_imported', (SELECT r.report->'notImported' FROM public.time_import_runs r
        WHERE r.workspace_id = p_ws AND r.provider = 'jibble' AND r.report ? 'notImported'
        ORDER BY r.finished_at DESC NULLS LAST LIMIT 1),
    'runs', coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'kind', kind, 'status', status, 'phase', phase,
          'started_at', started_at, 'finished_at', finished_at, 'has_error', error IS NOT NULL) ORDER BY created_at DESC)
        FROM (SELECT * FROM public.time_import_runs WHERE workspace_id = p_ws AND provider = 'jibble'
              ORDER BY created_at DESC LIMIT 10) r), '[]'::jsonb)),
  'erp', jsonb_build_object(
    'entries', (SELECT count(*) FROM public.project_time_entries WHERE workspace_id = p_ws),
    'entries_with_person', (SELECT count(*) FROM public.project_time_entries WHERE workspace_id = p_ws AND person_id IS NOT NULL),
    'entries_with_allocation', (SELECT count(*) FROM public.project_time_entries WHERE workspace_id = p_ws AND allocation_id IS NOT NULL),
    'projects', (SELECT count(*) FROM public.projects WHERE workspace_id = p_ws),
    'projects_with_company', (SELECT count(*) FROM public.projects WHERE workspace_id = p_ws AND company_id IS NOT NULL)),
  'issues', coalesce((SELECT jsonb_object_agg(k, jsonb_build_object('n', n, 'seconds', s)) FROM
      (SELECT issue_type || ':' || status AS k, count(*) AS n, sum(seconds_impact) AS s
         FROM public.project_reconciliation_issues WHERE workspace_id = p_ws AND present GROUP BY 1) x), '{}'::jsonb),
  'issue_entries_open', (SELECT count(DISTINCT time_entry_id) FROM public.project_reconciliation_issues
      WHERE workspace_id = p_ws AND present AND status IN ('open','deferred') AND time_entry_id IS NOT NULL),
  'last_refresh', (SELECT jsonb_build_object('finished_at', finished_at, 'counts', counts)
      FROM public.project_reconciliation_refreshes WHERE workspace_id = p_ws AND finished_at IS NOT NULL
      ORDER BY finished_at DESC LIMIT 1),
  'generated_at', now())
$$;
REVOKE ALL ON FUNCTION public.project_reconciliation_overview(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_reconciliation_overview(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.project_reconciliation_breakdown(
  p_ws uuid, p_provider text, p_from date, p_to date, p_group text,
  p_user uuid DEFAULT NULL, p_project uuid DEFAULT NULL, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
RETURNS TABLE (group_key text, label text, erp_rows bigint, erp_seconds numeric, linked_rows bigint,
               linked_erp_seconds numeric, source_seconds numeric, diff_seconds numeric,
               rows_with_open_issues bigint, total_groups bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
WITH base AS (
  SELECT e.id, e.user_id, e.project_id, e.entry_date,
         public.project_entry_seconds(e.started_at, e.stopped_at, e.duration_minutes, e.hours) AS secs,
         coalesce(cl.source_seconds, tl.source_seconds) AS src,
         CASE WHEN cl.target_id IS NOT NULL THEN 'clockify' WHEN tl.target_id IS NOT NULL THEN 'jibble' ELSE 'erp' END AS prov
    FROM public.project_time_entries e
    LEFT JOIN (SELECT target_id, sum(source_seconds) AS source_seconds FROM public.clockify_import_links
                WHERE workspace_id = p_ws AND target_table = 'project_time_entries' GROUP BY 1) cl ON cl.target_id = e.id
    LEFT JOIN (SELECT target_id, sum(source_seconds) AS source_seconds FROM public.time_import_links
                WHERE workspace_id = p_ws AND target_table = 'project_time_entries' GROUP BY 1) tl ON tl.target_id = e.id
   WHERE e.workspace_id = p_ws AND e.entry_date BETWEEN p_from AND p_to
     AND (p_user IS NULL OR e.user_id = p_user) AND (p_project IS NULL OR e.project_id = p_project)),
f AS (SELECT * FROM base WHERE coalesce(p_provider, 'all') = 'all' OR prov = p_provider),
iss AS (SELECT DISTINCT time_entry_id FROM public.project_reconciliation_issues
         WHERE workspace_id = p_ws AND present AND status IN ('open','deferred') AND time_entry_id IS NOT NULL),
g AS (
  SELECT CASE p_group WHEN 'month' THEN to_char(f.entry_date, 'YYYY-MM') WHEN 'person' THEN f.user_id::text
              ELSE f.project_id::text END AS k,
         count(*) AS n, sum(f.secs) AS s, count(f.src) AS ln,
         sum(f.secs) FILTER (WHERE f.src IS NOT NULL) AS ls, sum(f.src) AS ss,
         count(*) FILTER (WHERE iss.time_entry_id IS NOT NULL) AS ni
    FROM f LEFT JOIN iss ON iss.time_entry_id = f.id GROUP BY 1)
SELECT g.k,
       CASE p_group WHEN 'month' THEN g.k
            WHEN 'person' THEN (SELECT pr.full_name FROM public.profiles pr WHERE pr.id::text = g.k)
            ELSE (SELECT p.name FROM public.projects p WHERE p.id::text = g.k) END,
       g.n, g.s, g.ln, g.ls, g.ss, CASE WHEN g.ln > 0 THEN g.ls - g.ss END, g.ni, count(*) OVER ()
  FROM g
 ORDER BY CASE WHEN p_group = 'month' THEN g.k END DESC NULLS LAST, g.s DESC NULLS LAST, g.k
 LIMIT least(greatest(coalesce(p_limit, 50), 1), 500) OFFSET greatest(coalesce(p_offset, 0), 0)
$$;
REVOKE ALL ON FUNCTION public.project_reconciliation_breakdown(uuid, text, date, date, text, uuid, uuid, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_reconciliation_breakdown(uuid, text, date, date, text, uuid, uuid, integer, integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.project_link_people_overview(p_ws uuid)
RETURNS TABLE (user_id uuid, user_name text, member_status text, entries bigint, entries_with_person bigint,
               person_ids uuid[], suggestions bigint, linked_by_trace bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT e.user_id, pr.full_name, wm.status, count(*), count(e.person_id),
         array_remove(array_agg(DISTINCT e.person_id), NULL),
         (SELECT count(*) FROM public.project_link_suggestions s
           WHERE s.workspace_id = p_ws AND s.kind = 'person' AND s.subject_id = e.user_id AND s.status = 'suggested'),
         (SELECT count(*) FROM public.project_link_changes c
           WHERE c.workspace_id = p_ws AND c.field = 'person_id' AND c.subject_id = e.user_id AND c.reverted_at IS NULL)
    FROM public.project_time_entries e
    LEFT JOIN public.profiles pr ON pr.id = e.user_id
    LEFT JOIN public.workspace_members wm ON wm.workspace_id = p_ws AND wm.user_id = e.user_id
   WHERE e.workspace_id = p_ws
   GROUP BY e.user_id, pr.full_name, wm.status
   ORDER BY count(*) DESC
$$;
REVOKE ALL ON FUNCTION public.project_link_people_overview(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_link_people_overview(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.project_dashboard_summary(p_from date, p_to date, p_tz text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
DECLARE v_today date; v jsonb;
BEGIN
  IF p_from IS NULL OR p_to IS NULL OR p_from > p_to THEN
    RAISE EXCEPTION 'Período inválido: a data inicial deve ser anterior ou igual à final.' USING ERRCODE = '22023';
  END IF;
  IF p_to - p_from > 3700 THEN RAISE EXCEPTION 'Período máximo de 10 anos.' USING ERRCODE = '22023'; END IF;
  IF p_tz IS NULL OR p_tz !~ '^[A-Za-z_]+(/[A-Za-z0-9_+\-]+){0,2}$' THEN
    RAISE EXCEPTION 'Fuso horário inválido.' USING ERRCODE = '22023';
  END IF;
  BEGIN
    v_today := (now() AT TIME ZONE p_tz)::date;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'Fuso horário inválido.' USING ERRCODE = '22023';
  END;

  WITH pr AS (SELECT id, name, status::text AS st, due_at, updated_at, planned_hours FROM public.projects),
  tk AS (SELECT project_id, status::text AS st, due_at FROM public.project_tasks),
  tk_by_project AS (SELECT project_id, count(*) AS total, count(*) FILTER (WHERE st = 'done') AS done FROM tk GROUP BY 1),
  te AS (
    SELECT e.id, e.project_id,
           CASE WHEN e.status = 'locked' AND e.source = 'import' THEN 'locked_import' ELSE e.status END AS k,
           public.project_entry_seconds(e.started_at, e.stopped_at, e.duration_minutes, e.hours) AS secs
      FROM public.project_time_entries e WHERE e.entry_date BETWEEN p_from AND p_to),
  iss AS (SELECT DISTINCT time_entry_id FROM public.project_reconciliation_issues
           WHERE present AND status IN ('open','deferred') AND time_entry_id IS NOT NULL),
  te_flag AS (SELECT te.*, (iss.time_entry_id IS NOT NULL) AS in_review FROM te LEFT JOIN iss ON iss.time_entry_id = te.id),
  active AS (
    SELECT pr.id, pr.name, pr.st, pr.due_at, pr.updated_at, pr.planned_hours,
           coalesce(t.total, 0) AS tasks_total, coalesce(t.done, 0) AS tasks_done
      FROM pr LEFT JOIN tk_by_project t ON t.project_id = pr.id WHERE pr.st = 'active'),
  attention AS (
    SELECT pr.* FROM pr WHERE pr.st = 'on_hold'
        OR (pr.st IN ('active','planning') AND pr.due_at IS NOT NULL AND pr.due_at < v_today))
  SELECT jsonb_build_object(
    'today', v_today, 'from', p_from, 'to', p_to, 'tz', p_tz, 'generated_at', now(),
    'projects', jsonb_build_object(
      'total', (SELECT count(*) FROM pr),
      'by_status', coalesce((SELECT jsonb_object_agg(st, n) FROM (SELECT st, count(*) AS n FROM pr GROUP BY 1) x), '{}'::jsonb)),
    'in_progress_total', (SELECT count(*) FROM active),
    'in_progress', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id', a.id, 'name', a.name, 'status', a.st, 'dueAt', a.due_at,
        'tasksTotal', a.tasks_total, 'tasksDone', a.tasks_done, 'plannedHours', a.planned_hours,
        'periodSeconds', (SELECT coalesce(sum(secs), 0) FROM te WHERE te.project_id = a.id)) ORDER BY a.updated_at DESC)
      FROM (SELECT * FROM active ORDER BY updated_at DESC LIMIT 8) a), '[]'::jsonb),
    'active_with_task_base', (SELECT count(*) FROM active WHERE tasks_total > 0),
    'active_task_completion', (SELECT CASE WHEN sum(tasks_total) > 0 THEN sum(tasks_done)::numeric / sum(tasks_total) END
                                 FROM active WHERE tasks_total > 0),
    'attention_total', (SELECT count(*) FROM attention),
    'attention', coalesce((SELECT jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name, 'status', a.st, 'dueAt', a.due_at)
                            ORDER BY a.due_at NULLS LAST)
                           FROM (SELECT * FROM attention ORDER BY due_at NULLS LAST LIMIT 8) a), '[]'::jsonb),
    'tasks', jsonb_build_object(
      'open', (SELECT count(*) FROM tk WHERE st <> 'done'),
      'overdue', (SELECT count(*) FROM tk WHERE st <> 'done' AND due_at IS NOT NULL AND due_at < v_today)),
    'period', jsonb_build_object(
      'rows', (SELECT count(*) FROM te_flag),
      'seconds', (SELECT coalesce(sum(secs), 0) FROM te_flag),
      'rows_in_review', (SELECT count(*) FROM te_flag WHERE in_review),
      'seconds_in_review', (SELECT coalesce(sum(secs), 0) FROM te_flag WHERE in_review),
      'by_status', coalesce((SELECT jsonb_agg(jsonb_build_object('status', k, 'rows', n, 'seconds', s) ORDER BY s DESC)
                             FROM (SELECT k, count(*) AS n, coalesce(sum(secs), 0) AS s FROM te_flag GROUP BY k) x), '[]'::jsonb)),
    'coverage', jsonb_build_object(
      'issues_visible', EXISTS (SELECT 1 FROM public.current_user_workspaces() AS w(id)
          WHERE public.is_active_workspace_admin(w.id, auth.uid())
             OR public.user_has_permission(auth.uid(), w.id, 'techprojects.time_entries.view.workspace')),
      'can_open_center', EXISTS (SELECT 1 FROM public.current_user_workspaces() AS w(id)
          WHERE public.is_active_workspace_admin(w.id, auth.uid())),
      'open_issues', (SELECT count(*) FROM public.project_reconciliation_issues WHERE present AND status IN ('open','deferred')),
      'last_refresh_at', (SELECT max(finished_at) FROM public.project_reconciliation_refreshes)))
  INTO v;
  RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.project_dashboard_summary(date, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_dashboard_summary(date, date, text) TO authenticated, service_role;
