-- TechProjects Ciclo 3 — parte 2: envio versionado, aprovação/devolução, aceite manual do
-- cliente, fechamento/reabertura de competência, guardas do apontamento, cronômetro com pausas e
-- prévia de horas sem horário do Jibble (materialização só por ação explícita do admin).

-- =========================================================== envio e aprovação
CREATE TABLE public.project_timesheet_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  period_from date NOT NULL,
  period_to date NOT NULL,
  version integer NOT NULL,
  status text NOT NULL CHECK (status IN ('submitted','approved','rejected','partial','withdrawn')),
  entries_hash text NOT NULL,
  entry_count integer NOT NULL,
  total_seconds bigint NOT NULL,
  policy_version integer NOT NULL DEFAULT 0,
  timezone text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  submitted_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (period_to >= period_from),
  UNIQUE (workspace_id, user_id, period_from, period_to, version)
);
CREATE TABLE public.project_timesheet_submission_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  submission_id uuid NOT NULL REFERENCES public.project_timesheet_submissions(id) ON DELETE CASCADE,
  time_entry_id uuid REFERENCES public.project_time_entries(id) ON DELETE SET NULL,
  entry_revision integer NOT NULL,
  user_id uuid NOT NULL,
  project_id uuid NOT NULL,
  entry_date date NOT NULL,
  duration_seconds bigint NOT NULL,
  decision text NOT NULL DEFAULT 'pending' CHECK (decision IN ('pending','approved','rejected','invalidated','withdrawn')),
  decided_by uuid,
  decided_at timestamptz,
  reason text
);
CREATE INDEX project_timesheet_items_submission_idx ON public.project_timesheet_submission_items (submission_id);
CREATE INDEX project_timesheet_items_entry_idx ON public.project_timesheet_submission_items (time_entry_id);
CREATE INDEX project_timesheet_items_pending_idx ON public.project_timesheet_submission_items (workspace_id, project_id) WHERE decision = 'pending';
CREATE UNIQUE INDEX project_timesheet_items_one_pending ON public.project_timesheet_submission_items (time_entry_id) WHERE decision = 'pending';

CREATE TABLE public.project_client_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  period_from date NOT NULL,
  period_to date NOT NULL,
  status text NOT NULL CHECK (status IN ('accepted','contested','voided')),
  method text NOT NULL DEFAULT 'manual_evidence' CHECK (method = 'manual_evidence'),
  client_name text NOT NULL CHECK (length(btrim(client_name)) >= 2),
  client_email text,
  client_contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  evidence text NOT NULL CHECK (length(btrim(evidence)) >= 10),
  evidence_reference text,
  entries_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  entry_count integer NOT NULL DEFAULT 0,
  total_seconds bigint NOT NULL DEFAULT 0,
  recorded_by uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  voided_by uuid,
  voided_at timestamptz,
  void_reason text,
  CHECK (period_to >= period_from)
);
CREATE TABLE public.project_period_closings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  scope text NOT NULL CHECK (scope IN ('project','person')),
  project_id uuid REFERENCES public.projects(id) ON DELETE RESTRICT,
  user_id uuid,
  period_from date NOT NULL,
  period_to date NOT NULL,
  timezone text NOT NULL,
  policy_version integer NOT NULL DEFAULT 0,
  status text NOT NULL CHECK (status IN ('closed','reopened')),
  entries_snapshot jsonb NOT NULL,
  entry_count integer NOT NULL,
  total_seconds bigint NOT NULL,
  excluded_import_count integer NOT NULL DEFAULT 0,
  excluded_import_seconds bigint NOT NULL DEFAULT 0,
  closed_by uuid NOT NULL,
  closed_at timestamptz NOT NULL DEFAULT now(),
  reopened_by uuid,
  reopened_at timestamptz,
  reopen_reason text,
  CHECK (period_to >= period_from),
  CHECK ((scope = 'project' AND project_id IS NOT NULL) OR (scope = 'person' AND user_id IS NOT NULL))
);
CREATE INDEX project_period_closings_scope_idx ON public.project_period_closings (workspace_id, scope, project_id, user_id) WHERE status = 'closed';

GRANT SELECT ON public.project_timesheet_submissions, public.project_timesheet_submission_items,
  public.project_client_acceptances, public.project_period_closings TO authenticated;
GRANT ALL ON public.project_timesheet_submissions, public.project_timesheet_submission_items,
  public.project_client_acceptances, public.project_period_closings TO service_role;
ALTER TABLE public.project_timesheet_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_timesheet_submission_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_client_acceptances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_period_closings ENABLE ROW LEVEL SECURITY;
CREATE POLICY ptsub_select ON public.project_timesheet_submissions FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()) AND workspace_id IN (SELECT public.current_user_workspaces())
         AND (user_id = auth.uid() OR public.is_workspace_admin_v2(workspace_id, auth.uid())
              OR EXISTS (SELECT 1 FROM public.project_timesheet_submission_items i
                          WHERE i.submission_id = project_timesheet_submissions.id
                            AND public.project_time_can_approve(auth.uid(), i.project_id, i.user_id))));
CREATE POLICY ptsubi_select ON public.project_timesheet_submission_items FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()) AND workspace_id IN (SELECT public.current_user_workspaces())
         AND (user_id = auth.uid() OR public.is_workspace_admin_v2(workspace_id, auth.uid())
              OR public.project_time_can_approve(auth.uid(), project_id, user_id)));
CREATE POLICY pca_select ON public.project_client_acceptances FOR SELECT TO authenticated
  USING (public.project_visible_to_current_user(project_id));
CREATE POLICY ppc_select ON public.project_period_closings FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()) AND workspace_id IN (SELECT public.current_user_workspaces())
         AND (user_id = auth.uid() OR public.is_workspace_admin_v2(workspace_id, auth.uid())
              OR (project_id IS NOT NULL AND public.project_visible_to_current_user(project_id))));

ALTER TABLE public.project_time_entries
  ADD CONSTRAINT project_time_entries_submission_fk FOREIGN KEY (submission_id) REFERENCES public.project_timesheet_submissions(id) ON DELETE RESTRICT,
  ADD CONSTRAINT project_time_entries_closing_fk FOREIGN KEY (period_closing_id) REFERENCES public.project_period_closings(id) ON DELETE RESTRICT,
  ADD CONSTRAINT project_time_entries_acceptance_fk FOREIGN KEY (client_acceptance_id) REFERENCES public.project_client_acceptances(id) ON DELETE RESTRICT;

-- Edição depois do envio: o item pendente deixa de valer (o aprovador não decide dado antigo).
CREATE OR REPLACE FUNCTION public.project_time_entries_invalidate_items()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.revision IS DISTINCT FROM OLD.revision THEN
    UPDATE public.project_timesheet_submission_items SET decision = 'invalidated', reason = 'Editado após o envio', decided_at = now()
     WHERE time_entry_id = NEW.id AND decision = 'pending';
  END IF;
  RETURN NULL;
END $$;

-- =========================================================== guardas do apontamento
CREATE OR REPLACE FUNCTION public.project_time_entries_validate()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE
  v_overlap record;
  v_forced boolean := NEW.source = 'import' AND current_setting('app.clockify_force_import', true) = 'on';
  v_import boolean := coalesce(current_setting('app.clockify_import', true), '') = 'on';
  v_flow boolean := coalesce(current_setting('app.project_time_workflow', true), '') = 'on';
  v_free boolean;
  v_content boolean := false;
  v_workflow boolean := false;
  v_times boolean := false;
  v_policy jsonb;
  v_secs bigint;
  v_day bigint;
  v_flags text[] := '{}';
BEGIN
  -- Vínculo auditado (person_id/allocation_id): não recalcula duração nem mexe em updated_at.
  IF TG_OP = 'UPDATE' AND public.project_is_link_backfill(to_jsonb(OLD), to_jsonb(NEW), ARRAY['person_id','allocation_id']) THEN
    NEW.updated_at := OLD.updated_at;
    RETURN NEW;
  END IF;

  IF NEW.project_id IS NULL THEN RAISE EXCEPTION 'Apontamento exige um projeto.'; END IF;
  IF NEW.user_id IS NULL THEN RAISE EXCEPTION 'Apontamento exige um profissional.'; END IF;

  -- Caminhos privilegiados: importadores (flag de importação), RPCs do fluxo (flag de fluxo) e
  -- processos de servidor sem usuário. Sessões de usuário comum passam por todas as guardas.
  v_free := v_import OR v_flow OR auth.uid() IS NULL;

  IF TG_OP = 'UPDATE' THEN
    v_content := (NEW.project_id, NEW.task_id, NEW.user_id, NEW.entry_date, NEW.start_time, NEW.end_time,
                  NEW.duration_minutes, NEW.duration_seconds, NEW.hours, NEW.started_at, NEW.stopped_at,
                  NEW.billable, NEW.description, NEW.entry_kind, NEW.timezone, NEW.hourly_rate,
                  NEW.workspace_id, NEW.source, NEW.external_id, NEW.person_id, NEW.allocation_id)
      IS DISTINCT FROM (OLD.project_id, OLD.task_id, OLD.user_id, OLD.entry_date, OLD.start_time, OLD.end_time,
                  OLD.duration_minutes, OLD.duration_seconds, OLD.hours, OLD.started_at, OLD.stopped_at,
                  OLD.billable, OLD.description, OLD.entry_kind, OLD.timezone, OLD.hourly_rate,
                  OLD.workspace_id, OLD.source, OLD.external_id, OLD.person_id, OLD.allocation_id);
    v_workflow := (NEW.status, NEW.submitted_at, NEW.approved_at, NEW.approved_by, NEW.rejected_at, NEW.rejected_by,
                   NEW.reject_reason, NEW.locked_at, NEW.submission_id, NEW.period_closing_id, NEW.client_acceptance_id,
                   NEW.revision, NEW.timer_session_id, NEW.review_flags)
      IS DISTINCT FROM (OLD.status, OLD.submitted_at, OLD.approved_at, OLD.approved_by, OLD.rejected_at, OLD.rejected_by,
                   OLD.reject_reason, OLD.locked_at, OLD.submission_id, OLD.period_closing_id, OLD.client_acceptance_id,
                   OLD.revision, OLD.timer_session_id, OLD.review_flags);
    v_times := (NEW.entry_date, NEW.start_time, NEW.end_time, NEW.user_id) IS DISTINCT FROM (OLD.entry_date, OLD.start_time, OLD.end_time, OLD.user_id);
    IF NOT v_free THEN
      IF OLD.period_closing_id IS NOT NULL AND (v_content OR v_workflow) THEN
        RAISE EXCEPTION 'Apontamento em competência fechada; reabra a competência antes de alterar.' USING ERRCODE = '42501';
      END IF;
      IF v_workflow THEN
        RAISE EXCEPTION 'A situação de aprovação só muda pelo fluxo de envio e aprovação.' USING ERRCODE = '42501';
      END IF;
      IF v_content AND OLD.status IN ('approved','locked') THEN
        RAISE EXCEPTION 'Apontamento aprovado ou travado; reabra a aprovação antes de editar.' USING ERRCODE = '42501';
      END IF;
      IF v_content AND OLD.status IN ('submitted','rejected') THEN
        -- Editar depois do envio invalida o item enviado: volta a rascunho e precisa ser reenviado.
        NEW.status := 'draft'; NEW.submitted_at := NULL; NEW.submission_id := NULL;
      END IF;
    END IF;
    IF v_content THEN NEW.revision := OLD.revision + 1; END IF;
  ELSE
    v_times := true;
    IF NOT v_free THEN
      IF NEW.status IS DISTINCT FROM 'draft' OR NEW.approved_at IS NOT NULL OR NEW.submitted_at IS NOT NULL
         OR NEW.locked_at IS NOT NULL OR NEW.submission_id IS NOT NULL OR NEW.period_closing_id IS NOT NULL
         OR NEW.client_acceptance_id IS NOT NULL OR NEW.timer_session_id IS NOT NULL OR NEW.review_flags IS NOT NULL THEN
        RAISE EXCEPTION 'Novo apontamento começa como rascunho.' USING ERRCODE = '42501';
      END IF;
      NEW.revision := 0;
    END IF;
  END IF;

  IF NOT v_free AND (TG_OP = 'INSERT' OR NEW.project_id IS DISTINCT FROM OLD.project_id
                     OR NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.entry_date IS DISTINCT FROM OLD.entry_date) THEN
    v_policy := public.project_time_policy_get(NEW.workspace_id);
    IF coalesce((v_policy->>'track_requires_link')::boolean, true)
       AND NOT public.project_time_can_track(NEW.user_id, NEW.project_id, NEW.entry_date) THEN
      RAISE EXCEPTION 'Profissional sem vínculo para apontar neste projeto (membro liberado ou alocação vigente).' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NOT public.project_time_tz_valid(NEW.timezone) THEN RAISE EXCEPTION 'Fuso horário inválido.'; END IF;

  -- Tipo e duração canônica em segundos (registros novos/editados; importados não são reescritos).
  IF NOT v_import AND (TG_OP = 'INSERT' OR v_content) THEN
    IF NEW.entry_kind IS NULL THEN
      NEW.entry_kind := CASE WHEN NEW.start_time IS NOT NULL AND NEW.end_time IS NOT NULL THEN 'interval'
                             WHEN NEW.source = 'timer' THEN 'timer' ELSE 'duration' END;
    END IF;
    IF NEW.entry_kind = 'duration' THEN
      IF NEW.start_time IS NOT NULL OR NEW.end_time IS NOT NULL THEN
        RAISE EXCEPTION 'Lançamento por duração não tem horário de início/fim.';
      END IF;
      IF TG_OP = 'UPDATE' AND NEW.duration_seconds IS NOT DISTINCT FROM OLD.duration_seconds THEN
        IF NEW.duration_minutes IS DISTINCT FROM OLD.duration_minutes AND NEW.duration_minutes IS NOT NULL THEN
          NEW.duration_seconds := NEW.duration_minutes * 60;
        ELSIF NEW.hours IS DISTINCT FROM OLD.hours AND NEW.hours IS NOT NULL THEN
          NEW.duration_seconds := round(NEW.hours * 3600);
        END IF;
      ELSIF NEW.duration_seconds IS NULL THEN
        NEW.duration_seconds := CASE WHEN NEW.duration_minutes IS NOT NULL THEN NEW.duration_minutes * 60
                                     WHEN NEW.hours IS NOT NULL THEN round(NEW.hours * 3600) END;
      END IF;
      IF coalesce(NEW.duration_seconds, 0) <= 0 AND NOT v_free THEN RAISE EXCEPTION 'Informe a duração.'; END IF;
      NEW.duration_minutes := round(NEW.duration_seconds / 60.0)::int;
      NEW.hours := NULL;
      v_flags := v_flags || 'unpositioned'::text;
    ELSIF NEW.entry_kind = 'interval' THEN
      IF NEW.start_time IS NULL OR NEW.end_time IS NULL THEN RAISE EXCEPTION 'Informe início e fim.'; END IF;
      NEW.duration_seconds := EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time))::int;
    ELSIF NEW.entry_kind = 'timer' AND NEW.started_at IS NOT NULL AND NEW.stopped_at IS NOT NULL THEN
      NEW.duration_seconds := floor(EXTRACT(EPOCH FROM (NEW.stopped_at - NEW.started_at)))::int;
    END IF;
  END IF;

  IF NEW.start_time IS NOT NULL AND NEW.end_time IS NOT NULL THEN
    IF NEW.end_time < NEW.start_time OR (NEW.end_time = NEW.start_time AND NOT v_forced) THEN
      RAISE EXCEPTION 'O horário final deve ser maior que o horário inicial.';
    END IF;
    IF NEW.entry_kind = 'timer' AND NEW.duration_seconds IS NOT NULL THEN
      -- Cronômetro: vale o intervalo UTC real (troca de horário de verão muda o relógio local).
      NEW.duration_minutes := round(NEW.duration_seconds / 60.0)::int;
    ELSE
      NEW.duration_minutes := ROUND(EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 60)::int;
    END IF;
  ELSIF NEW.duration_minutes IS NULL AND NEW.duration_seconds IS NOT NULL THEN
    NEW.duration_minutes := round(NEW.duration_seconds / 60.0)::int;
  ELSIF NEW.duration_minutes IS NULL AND NEW.hours IS NOT NULL THEN
    NEW.duration_minutes := GREATEST(0, ROUND(NEW.hours * 60))::int;
  END IF;

  IF NEW.duration_minutes IS NOT NULL THEN
    IF NEW.duration_minutes < 0 THEN RAISE EXCEPTION 'A duração do apontamento não pode ser negativa.'; END IF;
    NEW.hours := ROUND((coalesce(NEW.duration_seconds::numeric / 60, NEW.duration_minutes::numeric) / 60), 2);
    IF NEW.duration_seconds IS NULL THEN NEW.hours := ROUND((NEW.duration_minutes::numeric / 60), 2); END IF;
  END IF;

  IF v_times AND NEW.start_time IS NOT NULL AND NEW.end_time IS NOT NULL AND NOT v_forced THEN
    SELECT t.start_time, t.end_time INTO v_overlap
      FROM public.project_time_entries t
     WHERE t.user_id = NEW.user_id AND t.entry_date = NEW.entry_date
       AND t.id IS DISTINCT FROM NEW.id
       AND t.start_time IS NOT NULL AND t.end_time IS NOT NULL
       AND t.start_time < NEW.end_time AND t.end_time > NEW.start_time
     LIMIT 1;
    IF v_overlap IS NOT NULL THEN
      IF NEW.entry_kind = 'timer' THEN
        -- Cronômetro é evidência de tempo real: grava e marca para revisão em vez de descartar.
        v_flags := v_flags || 'overlap'::text;
      ELSE
        RAISE EXCEPTION 'Já existe um apontamento entre % e % neste dia.',
          to_char(v_overlap.start_time, 'HH24:MI'), to_char(v_overlap.end_time, 'HH24:MI');
      END IF;
    END IF;
  END IF;

  IF NOT v_import AND (TG_OP = 'INSERT' OR v_content) THEN
    v_policy := coalesce(v_policy, public.project_time_policy_get(NEW.workspace_id));
    v_secs := coalesce(NEW.duration_seconds, NEW.duration_minutes * 60, 0);
    SELECT coalesce(sum(coalesce(t.duration_seconds, t.duration_minutes * 60, 0)), 0) INTO v_day
      FROM public.project_time_entries t
     WHERE t.user_id = NEW.user_id AND t.entry_date = NEW.entry_date AND t.id IS DISTINCT FROM NEW.id;
    IF v_day + v_secs > coalesce((v_policy->>'max_daily_seconds')::bigint, 57600) THEN
      v_flags := v_flags || 'daily_excess'::text;
    END IF;
    IF NEW.review_flags IS NOT NULL AND 'dst_ambiguous' = ANY (NEW.review_flags) THEN v_flags := v_flags || 'dst_ambiguous'::text; END IF;
    NEW.review_flags := CASE WHEN cardinality(v_flags) = 0 THEN NULL ELSE (SELECT array_agg(DISTINCT f ORDER BY f) FROM unnest(v_flags) f) END;
  END IF;

  IF NEW.created_by IS NULL THEN NEW.created_by := COALESCE(auth.uid(), NEW.user_id); END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.project_time_entries_delete_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF coalesce(current_setting('app.clockify_import', true), '') = 'on'
     OR coalesce(current_setting('app.project_time_workflow', true), '') = 'on' OR auth.uid() IS NULL THEN
    RETURN OLD;
  END IF;
  IF OLD.period_closing_id IS NOT NULL THEN
    RAISE EXCEPTION 'Apontamento em competência fechada não pode ser excluído.' USING ERRCODE = '42501';
  END IF;
  IF OLD.status IN ('submitted','approved','locked') THEN
    RAISE EXCEPTION 'Apontamento enviado, aprovado ou travado não pode ser excluído.' USING ERRCODE = '42501';
  END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER project_time_entries_delete_guard BEFORE DELETE ON public.project_time_entries
  FOR EACH ROW EXECUTE FUNCTION public.project_time_entries_delete_guard();
CREATE TRIGGER project_time_entries_invalidate_items AFTER UPDATE ON public.project_time_entries
  FOR EACH ROW WHEN (NEW.revision IS DISTINCT FROM OLD.revision) EXECUTE FUNCTION public.project_time_entries_invalidate_items();

-- =========================================================== projetos para apontar
CREATE OR REPLACE FUNCTION public.project_time_trackable_projects(p_ws uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_pol jsonb;
BEGIN
  PERFORM public.project_time_assert_actor(p_ws, false);
  v_pol := public.project_time_policy_get(p_ws);
  RETURN jsonb_build_object(
    'policy', v_pol,
    'projects', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'status', p.status,
               'favorite', EXISTS (SELECT 1 FROM public.project_time_favorites f WHERE f.user_id = v_uid AND f.project_id = p.id),
               'last_used', (SELECT max(e.entry_date) FROM public.project_time_entries e WHERE e.user_id = v_uid AND e.project_id = p.id),
               'billable_default', NOT EXISTS (SELECT 1 FROM public.project_members m WHERE m.project_id = p.id AND m.user_id = v_uid AND m.bill_rate_hour = 0))
             ORDER BY p.name)
        FROM public.projects p
       WHERE p.workspace_id = p_ws AND p.status IN ('planning','active')
         AND (public.project_time_can_track(v_uid, p.id, current_date)
              OR NOT coalesce((v_pol->>'track_requires_link')::boolean, true))), '[]'::jsonb),
    'person_linked', EXISTS (SELECT 1 FROM public.people pe WHERE pe.profile_id = v_uid AND (pe.workspace_id = p_ws OR pe.owner_id = p_ws)));
END $$;
REVOKE ALL ON FUNCTION public.project_time_trackable_projects(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_time_trackable_projects(uuid) TO authenticated;

-- =========================================================== cronômetro
CREATE OR REPLACE FUNCTION public.project_timer_json(p_session uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN s.id IS NULL THEN NULL ELSE jsonb_build_object(
    'id', s.id, 'state', s.state, 'version', s.version, 'project_id', s.project_id, 'task_id', s.task_id,
    'project_name', (SELECT name FROM public.projects WHERE id = s.project_id),
    'task_title', (SELECT title FROM public.project_tasks WHERE id = s.task_id),
    'description', s.description, 'billable', s.billable, 'timezone', s.timezone,
    'started_at', s.started_at, 'stopped_at', s.stopped_at, 'server_now', now(),
    'work_seconds', (SELECT coalesce(sum(floor(EXTRACT(EPOCH FROM (coalesce(g.ended_at, now()) - g.started_at)))), 0)::bigint
                       FROM public.project_timer_segments g WHERE g.session_id = s.id AND g.kind = 'work'),
    'paid_break_seconds', (SELECT coalesce(sum(floor(EXTRACT(EPOCH FROM (coalesce(g.ended_at, now()) - g.started_at)))), 0)::bigint
                       FROM public.project_timer_segments g WHERE g.session_id = s.id AND g.kind = 'break_paid'),
    'unpaid_break_seconds', (SELECT coalesce(sum(floor(EXTRACT(EPOCH FROM (coalesce(g.ended_at, now()) - g.started_at)))), 0)::bigint
                       FROM public.project_timer_segments g WHERE g.session_id = s.id AND g.kind = 'break_unpaid'),
    'segments', coalesce((SELECT jsonb_agg(jsonb_build_object('kind', g.kind, 'task_id', g.task_id, 'started_at', g.started_at, 'ended_at', g.ended_at) ORDER BY g.started_at)
                       FROM public.project_timer_segments g WHERE g.session_id = s.id), '[]'::jsonb),
    'entries', coalesce((SELECT jsonb_agg(jsonb_build_object('id', e.id, 'entry_date', e.entry_date, 'duration_seconds', e.duration_seconds, 'review_flags', e.review_flags) ORDER BY e.started_at)
                       FROM public.project_time_entries e WHERE e.timer_session_id = s.id), '[]'::jsonb)) END
    FROM (SELECT 1) x LEFT JOIN public.project_timer_sessions s ON s.id = p_session $$;
REVOKE ALL ON FUNCTION public.project_timer_json(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.project_timer_get(p_ws uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  PERFORM public.project_time_assert_actor(p_ws, false);
  SELECT id INTO v_id FROM public.project_timer_sessions
   WHERE workspace_id = p_ws AND user_id = auth.uid() AND state IN ('running','paused');
  RETURN public.project_timer_json(v_id);
END $$;
REVOKE ALL ON FUNCTION public.project_timer_get(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_timer_get(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.project_timer_start(p_ws uuid, p_project uuid, p_task uuid, p_description text,
  p_billable boolean, p_tz text, p_request_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_id uuid; v_pol jsonb;
BEGIN
  PERFORM public.project_time_assert_actor(p_ws, true);
  IF p_request_id IS NOT NULL THEN
    SELECT id INTO v_id FROM public.project_timer_sessions WHERE workspace_id = p_ws AND user_id = v_uid AND client_request_id = p_request_id;
    IF v_id IS NOT NULL THEN RETURN public.project_timer_json(v_id) || jsonb_build_object('idempotent', true); END IF;
  END IF;
  SELECT id INTO v_id FROM public.project_timer_sessions WHERE workspace_id = p_ws AND user_id = v_uid AND state IN ('running','paused');
  IF v_id IS NOT NULL THEN RETURN public.project_timer_json(v_id) || jsonb_build_object('conflict', true); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.projects WHERE id = p_project AND workspace_id = p_ws) THEN RAISE EXCEPTION 'Projeto fora do workspace.'; END IF;
  IF p_task IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.project_tasks WHERE id = p_task AND project_id = p_project) THEN
    RAISE EXCEPTION 'Atividade não pertence ao projeto.';
  END IF;
  IF NOT public.project_time_tz_valid(p_tz) OR p_tz IS NULL THEN RAISE EXCEPTION 'Fuso horário inválido.'; END IF;
  v_pol := public.project_time_policy_get(p_ws);
  IF coalesce((v_pol->>'track_requires_link')::boolean, true)
     AND NOT public.project_time_can_track(v_uid, p_project, (now() AT TIME ZONE p_tz)::date) THEN
    RAISE EXCEPTION 'Profissional sem vínculo para apontar neste projeto (membro liberado ou alocação vigente).' USING ERRCODE = '42501';
  END IF;
  BEGIN
    INSERT INTO public.project_timer_sessions (workspace_id, user_id, project_id, task_id, description, billable, timezone,
           state, client_request_id, policy_version)
    VALUES (p_ws, v_uid, p_project, p_task, p_description, coalesce(p_billable, true), p_tz, 'running', p_request_id,
            (v_pol->>'version')::int)
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO v_id FROM public.project_timer_sessions WHERE workspace_id = p_ws AND user_id = v_uid
       AND (state IN ('running','paused') OR client_request_id = p_request_id) ORDER BY created_at DESC LIMIT 1;
    RETURN public.project_timer_json(v_id) || jsonb_build_object('conflict', true);
  END;
  INSERT INTO public.project_timer_segments (workspace_id, session_id, kind, task_id, started_at)
  VALUES (p_ws, v_id, 'work', p_task, now());
  RETURN public.project_timer_json(v_id);
END $$;
REVOKE ALL ON FUNCTION public.project_timer_start(uuid, uuid, uuid, text, boolean, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_timer_start(uuid, uuid, uuid, text, boolean, text, text) TO authenticated;

-- Carrega e trava a sessão do usuário; devolve NULL quando a versão difere (o chamador decide).
CREATE OR REPLACE FUNCTION public.project_timer_lock(p_session uuid)
RETURNS public.project_timer_sessions LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.project_timer_sessions;
BEGIN
  SELECT * INTO s FROM public.project_timer_sessions WHERE id = p_session FOR UPDATE;
  IF s.id IS NULL OR s.user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Cronômetro não encontrado.' USING ERRCODE = '42501'; END IF;
  PERFORM public.project_time_assert_actor(s.workspace_id, true);
  RETURN s;
END $$;
REVOKE ALL ON FUNCTION public.project_timer_lock(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.project_timer_pause(p_session uuid, p_paid boolean, p_version integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.project_timer_sessions; v_now timestamptz := now();
BEGIN
  s := public.project_timer_lock(p_session);
  IF s.state = 'paused' THEN RETURN public.project_timer_json(s.id) || jsonb_build_object('idempotent', true); END IF;
  IF s.state <> 'running' THEN RAISE EXCEPTION 'Cronômetro já finalizado.'; END IF;
  IF p_version IS NOT NULL AND p_version <> s.version THEN RAISE EXCEPTION 'TIMER_STALE: o cronômetro mudou em outra aba; atualize.'; END IF;
  UPDATE public.project_timer_segments SET ended_at = v_now WHERE session_id = s.id AND ended_at IS NULL;
  INSERT INTO public.project_timer_segments (workspace_id, session_id, kind, task_id, started_at)
  VALUES (s.workspace_id, s.id, CASE WHEN coalesce(p_paid, false) THEN 'break_paid' ELSE 'break_unpaid' END, s.task_id, v_now);
  UPDATE public.project_timer_sessions SET state = 'paused', version = version + 1, updated_at = v_now WHERE id = s.id;
  RETURN public.project_timer_json(s.id);
END $$;
REVOKE ALL ON FUNCTION public.project_timer_pause(uuid, boolean, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_timer_pause(uuid, boolean, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.project_timer_resume(p_session uuid, p_version integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.project_timer_sessions; v_now timestamptz := now();
BEGIN
  s := public.project_timer_lock(p_session);
  IF s.state = 'running' THEN RETURN public.project_timer_json(s.id) || jsonb_build_object('idempotent', true); END IF;
  IF s.state <> 'paused' THEN RAISE EXCEPTION 'Cronômetro já finalizado.'; END IF;
  IF p_version IS NOT NULL AND p_version <> s.version THEN RAISE EXCEPTION 'TIMER_STALE: o cronômetro mudou em outra aba; atualize.'; END IF;
  UPDATE public.project_timer_segments SET ended_at = v_now WHERE session_id = s.id AND ended_at IS NULL;
  INSERT INTO public.project_timer_segments (workspace_id, session_id, kind, task_id, started_at)
  VALUES (s.workspace_id, s.id, 'work', s.task_id, v_now);
  UPDATE public.project_timer_sessions SET state = 'running', version = version + 1, updated_at = v_now WHERE id = s.id;
  RETURN public.project_timer_json(s.id);
END $$;
REVOKE ALL ON FUNCTION public.project_timer_resume(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_timer_resume(uuid, integer) TO authenticated;

-- Troca de atividade sem parar o cronômetro: fecha o trecho atual e abre outro com a nova tarefa.
CREATE OR REPLACE FUNCTION public.project_timer_switch(p_session uuid, p_task uuid, p_version integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.project_timer_sessions; v_now timestamptz := now();
BEGIN
  s := public.project_timer_lock(p_session);
  IF s.state NOT IN ('running','paused') THEN RAISE EXCEPTION 'Cronômetro já finalizado.'; END IF;
  IF s.task_id IS NOT DISTINCT FROM p_task THEN RETURN public.project_timer_json(s.id) || jsonb_build_object('idempotent', true); END IF;
  IF p_version IS NOT NULL AND p_version <> s.version THEN RAISE EXCEPTION 'TIMER_STALE: o cronômetro mudou em outra aba; atualize.'; END IF;
  IF p_task IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.project_tasks WHERE id = p_task AND project_id = s.project_id) THEN
    RAISE EXCEPTION 'Atividade não pertence ao projeto.';
  END IF;
  IF s.state = 'running' THEN
    UPDATE public.project_timer_segments SET ended_at = v_now WHERE session_id = s.id AND ended_at IS NULL;
    INSERT INTO public.project_timer_segments (workspace_id, session_id, kind, task_id, started_at)
    VALUES (s.workspace_id, s.id, 'work', p_task, v_now);
  END IF;
  UPDATE public.project_timer_sessions SET task_id = p_task, version = version + 1, updated_at = v_now WHERE id = s.id;
  RETURN public.project_timer_json(s.id);
END $$;
REVOKE ALL ON FUNCTION public.project_timer_switch(uuid, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_timer_switch(uuid, uuid, integer) TO authenticated;

-- Finaliza: cada trecho de trabalho vira apontamento(s) em UTC exato, dividido na meia-noite local
-- do fuso da sessão. Pausas pagas ficam como presença, nunca como hora produtiva.
CREATE OR REPLACE FUNCTION public.project_timer_stop(p_session uuid, p_version integer, p_discard boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.project_timer_sessions; g record; v_now timestamptz := now(); v_s timestamptz; v_e timestamptz;
  v_day date; v_day_end timestamptz; v_part timestamptz; v_secs int; v_ls time; v_le time; v_flags text[];
BEGIN
  s := public.project_timer_lock(p_session);
  IF s.state IN ('stopped','discarded') THEN RETURN public.project_timer_json(s.id) || jsonb_build_object('idempotent', true); END IF;
  IF p_version IS NOT NULL AND p_version <> s.version THEN RAISE EXCEPTION 'TIMER_STALE: o cronômetro mudou em outra aba; atualize.'; END IF;
  UPDATE public.project_timer_segments SET ended_at = v_now WHERE session_id = s.id AND ended_at IS NULL;
  IF coalesce(p_discard, false) THEN
    UPDATE public.project_timer_sessions SET state = 'discarded', stopped_at = v_now, version = version + 1, updated_at = v_now WHERE id = s.id;
    PERFORM public.project_time_log(s.workspace_id, 'timer', s.id, 'discarded', s.user_id, s.project_id, NULL, '{}'::jsonb);
    RETURN public.project_timer_json(s.id);
  END IF;
  PERFORM set_config('app.project_time_workflow', 'on', true);
  FOR g IN SELECT * FROM public.project_timer_segments WHERE session_id = s.id AND kind = 'work' ORDER BY started_at LOOP
    v_s := g.started_at; v_e := g.ended_at;
    WHILE v_s < v_e LOOP
      v_day := (v_s AT TIME ZONE s.timezone)::date;
      v_day_end := ((v_day + 1)::timestamp AT TIME ZONE s.timezone);
      v_part := least(v_e, v_day_end);
      v_secs := floor(EXTRACT(EPOCH FROM (v_part - v_s)))::int;
      IF v_secs >= 1 THEN
        v_ls := (v_s AT TIME ZONE s.timezone)::time;
        v_le := CASE WHEN v_part = v_day_end THEN '24:00:00'::time ELSE (v_part AT TIME ZONE s.timezone)::time END;
        v_flags := NULL;
        IF v_le <= v_ls THEN v_ls := NULL; v_le := NULL; v_flags := ARRAY['dst_ambiguous']; END IF;
        INSERT INTO public.project_time_entries (workspace_id, project_id, task_id, user_id, entry_date, start_time, end_time,
               duration_seconds, description, billable, source, status, started_at, stopped_at, entry_kind, timezone,
               timer_session_id, created_by, review_flags)
        VALUES (s.workspace_id, s.project_id, g.task_id, s.user_id, v_day, v_ls, v_le, v_secs, s.description, s.billable,
                'timer', 'draft', v_s, v_part, 'timer', s.timezone, s.id, s.user_id, v_flags);
      END IF;
      v_s := v_part;
    END LOOP;
  END LOOP;
  PERFORM set_config('app.project_time_workflow', 'off', true);
  UPDATE public.project_timer_sessions SET state = 'stopped', stopped_at = v_now, version = version + 1, updated_at = v_now WHERE id = s.id;
  RETURN public.project_timer_json(s.id);
END $$;
REVOKE ALL ON FUNCTION public.project_timer_stop(uuid, integer, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_timer_stop(uuid, integer, boolean) TO authenticated;

-- =========================================================== envio do período
CREATE OR REPLACE FUNCTION public.project_timesheet_scan(p_ws uuid, p_user uuid, p_from date, p_to date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pol jsonb := public.project_time_policy_get(p_ws); v jsonb;
BEGIN
  WITH e AS (
    SELECT t.id, t.revision, t.project_id, t.entry_date, t.review_flags, t.start_time, t.end_time, t.entry_kind,
           coalesce(t.duration_seconds, t.duration_minutes * 60, 0)::bigint AS secs, pr.name AS project_name, tk.title AS task_title
      FROM public.project_time_entries t JOIN public.projects pr ON pr.id = t.project_id
      LEFT JOIN public.project_tasks tk ON tk.id = t.task_id
     WHERE t.workspace_id = p_ws AND t.user_id = p_user AND t.entry_date BETWEEN p_from AND p_to
       AND t.status IN ('draft','rejected') AND t.period_closing_id IS NULL),
  blockers AS (
    SELECT 'running_timer' AS code, 'Há um cronômetro em andamento; finalize antes de enviar.' AS message, NULL::uuid AS project_id, 1::bigint AS n
      FROM public.project_timer_sessions s WHERE s.workspace_id = p_ws AND s.user_id = p_user AND s.state IN ('running','paused')
       AND (s.started_at AT TIME ZONE s.timezone)::date <= p_to
    UNION ALL
    SELECT 'overlap', 'Apontamentos com sobreposição de horário precisam ser corrigidos.', NULL, count(*)
      FROM e WHERE coalesce((v_pol->>'submit_blocks_on_overlap')::boolean, true) AND 'overlap' = ANY (coalesce(e.review_flags, '{}')) HAVING count(*) > 0
    UNION ALL
    SELECT 'no_approver', 'Projeto "' || e.project_name || '" sem líder aprovador configurado.', e.project_id, count(*)
      FROM e WHERE coalesce((v_pol->>'submit_requires_approver')::boolean, true) AND NOT public.project_time_has_approver(e.project_id, p_user)
     GROUP BY e.project_id, e.project_name),
  warnings AS (
    SELECT 'daily_excess' AS code, 'Dias acima do limite diário da política; o aprovador verá o alerta.' AS message, count(*) AS n
      FROM e WHERE 'daily_excess' = ANY (coalesce(e.review_flags, '{}')) HAVING count(*) > 0
    UNION ALL
    SELECT 'unpositioned', 'Lançamentos só por duração: sobreposição não é verificável.', count(*)
      FROM e WHERE e.entry_kind = 'duration' HAVING count(*) > 0
    UNION ALL
    SELECT 'dst_ambiguous', 'Trechos na troca de horário de verão sem horário local exibível (UTC preservado).', count(*)
      FROM e WHERE 'dst_ambiguous' = ANY (coalesce(e.review_flags, '{}')) HAVING count(*) > 0)
  SELECT jsonb_build_object(
    'entries', coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'revision', revision, 'project_id', project_id, 'project_name', project_name,
                 'task_title', task_title, 'entry_date', entry_date, 'seconds', secs, 'review_flags', review_flags) ORDER BY entry_date, start_time NULLS LAST) FROM e), '[]'::jsonb),
    'hash', coalesce((SELECT md5(string_agg(id::text || ':' || revision, ',' ORDER BY id)) FROM e), md5('')),
    'entry_count', (SELECT count(*) FROM e),
    'total_seconds', coalesce((SELECT sum(secs) FROM e), 0),
    'blockers', coalesce((SELECT jsonb_agg(to_jsonb(b)) FROM blockers b), '[]'::jsonb),
    'warnings', coalesce((SELECT jsonb_agg(to_jsonb(w)) FROM warnings w), '[]'::jsonb),
    'policy_version', (v_pol->>'version')::int) INTO v;
  RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.project_timesheet_scan(uuid, uuid, date, date) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.project_timesheet_preview(p_ws uuid, p_from date, p_to date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.project_time_assert_actor(p_ws, false);
  IF p_from IS NULL OR p_to IS NULL OR p_to < p_from OR p_to - p_from > 62 THEN RAISE EXCEPTION 'Período inválido (até 63 dias).'; END IF;
  RETURN public.project_timesheet_scan(p_ws, auth.uid(), p_from, p_to);
END $$;
REVOKE ALL ON FUNCTION public.project_timesheet_preview(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_timesheet_preview(uuid, date, date) TO authenticated;

CREATE OR REPLACE FUNCTION public.project_timesheet_submit(p_ws uuid, p_from date, p_to date, p_expected_hash text, p_tz text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_scan jsonb; v_sub uuid; v_ver int; v_n int;
BEGIN
  PERFORM public.project_time_assert_actor(p_ws, true);
  IF p_from IS NULL OR p_to IS NULL OR p_to < p_from OR p_to - p_from > 62 THEN RAISE EXCEPTION 'Período inválido (até 63 dias).'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('project_timesheet_submit:' || p_ws::text || ':' || v_uid::text));
  PERFORM 1 FROM public.project_time_entries t
   WHERE t.workspace_id = p_ws AND t.user_id = v_uid AND t.entry_date BETWEEN p_from AND p_to
     AND t.status IN ('draft','rejected') FOR UPDATE;
  v_scan := public.project_timesheet_scan(p_ws, v_uid, p_from, p_to);
  IF p_expected_hash IS NOT NULL AND p_expected_hash <> v_scan->>'hash' THEN
    RAISE EXCEPTION 'SUBMIT_STALE: os apontamentos mudaram desde a prévia; revise e envie de novo.';
  END IF;
  IF jsonb_array_length(v_scan->'blockers') > 0 THEN
    RAISE EXCEPTION 'SUBMIT_BLOCKED: %', (SELECT string_agg(b->>'message', ' ') FROM jsonb_array_elements(v_scan->'blockers') b);
  END IF;
  IF (v_scan->>'entry_count')::int = 0 THEN RAISE EXCEPTION 'Nenhum apontamento em rascunho ou devolvido no período.'; END IF;
  SELECT coalesce(max(version), 0) + 1 INTO v_ver FROM public.project_timesheet_submissions
   WHERE workspace_id = p_ws AND user_id = v_uid AND period_from = p_from AND period_to = p_to;
  INSERT INTO public.project_timesheet_submissions (workspace_id, user_id, period_from, period_to, version, status,
         entries_hash, entry_count, total_seconds, policy_version, timezone, submitted_by)
  VALUES (p_ws, v_uid, p_from, p_to, v_ver, 'submitted', v_scan->>'hash', (v_scan->>'entry_count')::int,
          (v_scan->>'total_seconds')::bigint, coalesce((v_scan->>'policy_version')::int, 0),
          CASE WHEN public.project_time_tz_valid(p_tz) THEN p_tz END, v_uid)
  RETURNING id INTO v_sub;
  INSERT INTO public.project_timesheet_submission_items (workspace_id, submission_id, time_entry_id, entry_revision, user_id,
         project_id, entry_date, duration_seconds)
  SELECT p_ws, v_sub, (x->>'id')::uuid, (x->>'revision')::int, v_uid, (x->>'project_id')::uuid, (x->>'entry_date')::date, (x->>'seconds')::bigint
    FROM jsonb_array_elements(v_scan->'entries') x;
  PERFORM set_config('app.project_time_workflow', 'on', true);
  UPDATE public.project_time_entries t SET status = 'submitted', submitted_at = now(), submission_id = v_sub,
         rejected_at = NULL, rejected_by = NULL
   WHERE t.id IN (SELECT (x->>'id')::uuid FROM jsonb_array_elements(v_scan->'entries') x);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  PERFORM set_config('app.project_time_workflow', 'off', true);
  PERFORM public.project_time_log(p_ws, 'timesheet_submission', v_sub, 'submitted', v_uid, NULL, NULL,
    jsonb_build_object('version', v_ver, 'from', p_from, 'to', p_to, 'entries', v_n, 'seconds', v_scan->'total_seconds', 'hash', v_scan->>'hash'));
  RETURN jsonb_build_object('submission_id', v_sub, 'version', v_ver, 'entries', v_n, 'total_seconds', v_scan->'total_seconds');
END $$;
REVOKE ALL ON FUNCTION public.project_timesheet_submit(uuid, date, date, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_timesheet_submit(uuid, date, date, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.project_timesheet_refresh_submission(p_sub uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.project_timesheet_submissions s SET updated_at = now(), status = CASE
      WHEN NOT EXISTS (SELECT 1 FROM public.project_timesheet_submission_items i WHERE i.submission_id = s.id AND i.decision <> 'withdrawn') THEN 'withdrawn'
      WHEN EXISTS (SELECT 1 FROM public.project_timesheet_submission_items i WHERE i.submission_id = s.id AND i.decision = 'pending')
           THEN CASE WHEN EXISTS (SELECT 1 FROM public.project_timesheet_submission_items i WHERE i.submission_id = s.id AND i.decision <> 'pending') THEN 'partial' ELSE 'submitted' END
      WHEN NOT EXISTS (SELECT 1 FROM public.project_timesheet_submission_items i WHERE i.submission_id = s.id AND i.decision NOT IN ('approved','withdrawn')) THEN 'approved'
      WHEN NOT EXISTS (SELECT 1 FROM public.project_timesheet_submission_items i WHERE i.submission_id = s.id AND i.decision = 'approved') THEN 'rejected'
      ELSE 'partial' END
   WHERE s.id = p_sub $$;
REVOKE ALL ON FUNCTION public.project_timesheet_refresh_submission(uuid) FROM PUBLIC, anon, authenticated;

-- Profissional recolhe itens ainda pendentes (antes de qualquer decisão).
CREATE OR REPLACE FUNCTION public.project_timesheet_withdraw(p_submission uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s record; v_n int;
BEGIN
  SELECT * INTO s FROM public.project_timesheet_submissions WHERE id = p_submission FOR UPDATE;
  IF s.id IS NULL OR s.user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Envio não encontrado.' USING ERRCODE = '42501'; END IF;
  PERFORM public.project_time_assert_actor(s.workspace_id, true);
  PERFORM set_config('app.project_time_workflow', 'on', true);
  UPDATE public.project_time_entries t SET status = 'draft', submitted_at = NULL, submission_id = NULL
   WHERE t.submission_id = s.id AND t.status = 'submitted'
     AND EXISTS (SELECT 1 FROM public.project_timesheet_submission_items i WHERE i.time_entry_id = t.id AND i.submission_id = s.id AND i.decision = 'pending');
  GET DIAGNOSTICS v_n = ROW_COUNT;
  PERFORM set_config('app.project_time_workflow', 'off', true);
  UPDATE public.project_timesheet_submission_items SET decision = 'withdrawn', decided_at = now(), decided_by = auth.uid()
   WHERE submission_id = s.id AND decision = 'pending';
  PERFORM public.project_timesheet_refresh_submission(s.id);
  PERFORM public.project_time_log(s.workspace_id, 'timesheet_submission', s.id, 'withdrawn', s.user_id, NULL, NULL, jsonb_build_object('entries', v_n));
  RETURN jsonb_build_object('withdrawn', v_n);
END $$;
REVOKE ALL ON FUNCTION public.project_timesheet_withdraw(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_timesheet_withdraw(uuid) TO authenticated;

-- Decisão do aprovador: tudo ou nada; cada item confere revisão (conflito de versão = erro).
CREATE OR REPLACE FUNCTION public.project_timesheet_decide(p_ws uuid, p_items jsonb, p_action text, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE x jsonb; i record; t record; v_n int := 0; v_subs uuid[] := '{}';
BEGIN
  PERFORM public.project_time_assert_actor(p_ws, true);
  IF p_action NOT IN ('approve','reject') THEN RAISE EXCEPTION 'Ação inválida.'; END IF;
  IF p_action = 'reject' AND length(btrim(coalesce(p_reason, ''))) < 3 THEN RAISE EXCEPTION 'Informe o motivo da devolução.'; END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 OR jsonb_array_length(p_items) > 500 THEN
    RAISE EXCEPTION 'Selecione de 1 a 500 itens.';
  END IF;
  PERFORM set_config('app.project_time_workflow', 'on', true);
  FOR x IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT * INTO i FROM public.project_timesheet_submission_items WHERE id = (x->>'item_id')::uuid AND workspace_id = p_ws FOR UPDATE;
    IF i.id IS NULL THEN RAISE EXCEPTION 'Item não encontrado.'; END IF;
    IF i.decision <> 'pending' THEN RAISE EXCEPTION 'DECIDE_STALE: item já decidido, recolhido ou invalidado por edição.'; END IF;
    SELECT * INTO t FROM public.project_time_entries WHERE id = i.time_entry_id FOR UPDATE;
    IF t.id IS NULL OR t.status <> 'submitted' OR t.submission_id IS DISTINCT FROM i.submission_id
       OR t.revision <> i.entry_revision OR (x ? 'revision' AND (x->>'revision')::int <> t.revision) THEN
      RAISE EXCEPTION 'DECIDE_STALE: o apontamento mudou depois do envio ou da sua leitura; atualize a lista.';
    END IF;
    IF NOT public.project_time_can_approve(auth.uid(), t.project_id, t.user_id) THEN
      RAISE EXCEPTION 'Sem autorização para decidir horas deste profissional neste projeto.' USING ERRCODE = '42501';
    END IF;
    IF p_action = 'approve' THEN
      UPDATE public.project_time_entries SET status = 'approved', approved_at = now(), approved_by = auth.uid(), locked_at = now(),
             rejected_at = NULL, rejected_by = NULL, reject_reason = NULL WHERE id = t.id;
    ELSE
      UPDATE public.project_time_entries SET status = 'rejected', rejected_at = now(), rejected_by = auth.uid(),
             reject_reason = btrim(p_reason), submission_id = NULL, submitted_at = NULL WHERE id = t.id;
    END IF;
    UPDATE public.project_timesheet_submission_items SET decision = CASE WHEN p_action = 'approve' THEN 'approved' ELSE 'rejected' END,
           decided_by = auth.uid(), decided_at = now(), reason = nullif(btrim(coalesce(p_reason, '')), '') WHERE id = i.id;
    PERFORM public.project_time_log(p_ws, 'time_entry', t.id, CASE WHEN p_action = 'approve' THEN 'approved' ELSE 'rejected' END,
      t.user_id, t.project_id, p_reason, jsonb_build_object('item_id', i.id, 'submission_id', i.submission_id, 'revision', t.revision));
    v_subs := v_subs || i.submission_id; v_n := v_n + 1;
  END LOOP;
  PERFORM set_config('app.project_time_workflow', 'off', true);
  PERFORM public.project_timesheet_refresh_submission(u) FROM (SELECT DISTINCT unnest(v_subs) u) z;
  RETURN jsonb_build_object('decided', v_n, 'action', p_action);
END $$;
REVOKE ALL ON FUNCTION public.project_timesheet_decide(uuid, jsonb, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_timesheet_decide(uuid, jsonb, text, text) TO authenticated;

-- Reabrir aprovação (antes do fechamento): volta a rascunho, com motivo e trilha.
CREATE OR REPLACE FUNCTION public.project_time_reopen_approval(p_ws uuid, p_ids uuid[], p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t record; v_n int := 0;
BEGIN
  PERFORM public.project_time_assert_actor(p_ws, true);
  IF length(btrim(coalesce(p_reason, ''))) < 5 THEN RAISE EXCEPTION 'Informe o motivo da reabertura.'; END IF;
  PERFORM set_config('app.project_time_workflow', 'on', true);
  FOR t IN SELECT * FROM public.project_time_entries WHERE id = ANY (coalesce(p_ids, '{}')) AND workspace_id = p_ws ORDER BY id FOR UPDATE LOOP
    IF t.period_closing_id IS NOT NULL THEN RAISE EXCEPTION 'Apontamento em competência fechada; reabra a competência primeiro.'; END IF;
    IF t.status <> 'approved' THEN RAISE EXCEPTION 'Só apontamentos aprovados podem ser reabertos (importados travados não).'; END IF;
    IF t.client_acceptance_id IS NOT NULL THEN RAISE EXCEPTION 'Apontamento com aceite do cliente registrado; anule o aceite antes.'; END IF;
    IF NOT public.project_time_can_approve(auth.uid(), t.project_id, t.user_id) THEN
      RAISE EXCEPTION 'Sem autorização para reabrir horas deste profissional.' USING ERRCODE = '42501';
    END IF;
    UPDATE public.project_time_entries SET status = 'draft', approved_at = NULL, approved_by = NULL, locked_at = NULL,
           submitted_at = NULL, submission_id = NULL WHERE id = t.id;
    UPDATE public.project_timesheet_submission_items SET decision = 'invalidated', reason = 'Aprovação reaberta: ' || btrim(p_reason)
     WHERE time_entry_id = t.id AND decision = 'approved';
    PERFORM public.project_time_log(p_ws, 'time_entry', t.id, 'approval_reopened', t.user_id, t.project_id, p_reason, '{}'::jsonb);
    v_n := v_n + 1;
  END LOOP;
  PERFORM set_config('app.project_time_workflow', 'off', true);
  IF v_n = 0 THEN RAISE EXCEPTION 'Nenhum apontamento reaberto.'; END IF;
  RETURN jsonb_build_object('reopened', v_n);
END $$;
REVOKE ALL ON FUNCTION public.project_time_reopen_approval(uuid, uuid[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_time_reopen_approval(uuid, uuid[], text) TO authenticated;

-- Fila do aprovador (somente o que ele pode decidir); sem custos/tarifas.
CREATE OR REPLACE FUNCTION public.project_time_pending_for_me(p_ws uuid, p_project uuid, p_user uuid, p_limit int, p_offset int)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v jsonb;
BEGIN
  PERFORM public.project_time_assert_actor(p_ws, false);
  WITH q AS (
    SELECT i.id AS item_id, i.submission_id, t.id AS entry_id, t.revision, t.user_id, t.project_id, t.entry_date, t.start_time, t.end_time,
           t.started_at, t.stopped_at, t.timezone, t.entry_kind, coalesce(t.duration_seconds, t.duration_minutes * 60, 0) AS seconds,
           t.description, t.billable, t.review_flags, pr.name AS project_name, tk.title AS task_title,
           coalesce(pf.full_name, 'Sem nome') AS user_name, s.submitted_at, s.version AS submission_version
      FROM public.project_timesheet_submission_items i
      JOIN public.project_time_entries t ON t.id = i.time_entry_id
      JOIN public.project_timesheet_submissions s ON s.id = i.submission_id
      JOIN public.projects pr ON pr.id = t.project_id
      LEFT JOIN public.project_tasks tk ON tk.id = t.task_id
      LEFT JOIN public.profiles pf ON pf.id = t.user_id
     WHERE i.workspace_id = p_ws AND i.decision = 'pending'
       AND (p_project IS NULL OR t.project_id = p_project) AND (p_user IS NULL OR t.user_id = p_user)
       AND public.project_time_can_approve(auth.uid(), t.project_id, t.user_id))
  SELECT jsonb_build_object('total', (SELECT count(*) FROM q), 'total_seconds', coalesce((SELECT sum(seconds) FROM q), 0),
    'items', coalesce((SELECT jsonb_agg(to_jsonb(z)) FROM (SELECT * FROM q ORDER BY entry_date, user_name, start_time NULLS LAST
      LIMIT least(greatest(coalesce(p_limit, 100), 1), 500) OFFSET greatest(coalesce(p_offset, 0), 0)) z), '[]'::jsonb)) INTO v;
  RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.project_time_pending_for_me(uuid, uuid, uuid, int, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_time_pending_for_me(uuid, uuid, uuid, int, int) TO authenticated;

-- Timesheet agregado no banco, como o usuário (RLS): sem limite de linhas.
CREATE OR REPLACE FUNCTION public.project_timesheet_overview(p_from date, p_to date, p_user uuid, p_project uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH e AS (
    SELECT t.user_id, t.project_id, t.entry_date, t.status, t.source, t.period_closing_id,
           coalesce(t.duration_seconds, public.project_entry_seconds(t.started_at, t.stopped_at, t.duration_minutes, t.hours), 0)::bigint AS secs
      FROM public.project_time_entries t
     WHERE t.entry_date BETWEEN p_from AND p_to AND (p_user IS NULL OR t.user_id = p_user) AND (p_project IS NULL OR t.project_id = p_project)
       AND t.workspace_id IN (SELECT public.current_user_workspaces())),
  k AS (SELECT *, CASE WHEN status = 'locked' AND source = 'import' THEN 'locked_import' ELSE status END AS st FROM e)
  SELECT jsonb_build_object(
    'totals', jsonb_build_object(
       'registered', coalesce(sum(secs), 0),
       'draft', coalesce(sum(secs) FILTER (WHERE st = 'draft'), 0),
       'submitted', coalesce(sum(secs) FILTER (WHERE st = 'submitted'), 0),
       'approved', coalesce(sum(secs) FILTER (WHERE st = 'approved'), 0),
       'rejected', coalesce(sum(secs) FILTER (WHERE st = 'rejected'), 0),
       'locked_import', coalesce(sum(secs) FILTER (WHERE st = 'locked_import'), 0),
       'closed', coalesce(sum(secs) FILTER (WHERE period_closing_id IS NOT NULL), 0),
       'entries', count(*)),
    'by_user', coalesce((SELECT jsonb_agg(u ORDER BY (u->>'registered')::bigint DESC) FROM (
       SELECT jsonb_build_object('user_id', user_id, 'name', coalesce((SELECT full_name FROM public.profiles WHERE id = user_id), 'Sem nome'),
         'registered', sum(secs), 'draft', coalesce(sum(secs) FILTER (WHERE st = 'draft'), 0),
         'submitted', coalesce(sum(secs) FILTER (WHERE st = 'submitted'), 0), 'approved', coalesce(sum(secs) FILTER (WHERE st = 'approved'), 0),
         'rejected', coalesce(sum(secs) FILTER (WHERE st = 'rejected'), 0), 'locked_import', coalesce(sum(secs) FILTER (WHERE st = 'locked_import'), 0),
         'schedule_configured', EXISTS (SELECT 1 FROM public.people pe WHERE pe.profile_id = k.user_id AND pe.work_schedule IS NOT NULL)) AS u
         FROM k GROUP BY user_id) x), '[]'::jsonb),
    'by_day', coalesce((SELECT jsonb_agg(jsonb_build_object('date', d, 'registered', s, 'approved', a) ORDER BY d) FROM (
       SELECT entry_date AS d, sum(secs) AS s, coalesce(sum(secs) FILTER (WHERE st = 'approved'), 0) AS a FROM k GROUP BY entry_date) y), '[]'::jsonb),
    'by_project', coalesce((SELECT jsonb_agg(jsonb_build_object('project_id', project_id, 'name', (SELECT name FROM public.projects WHERE id = project_id), 'registered', s) ORDER BY s DESC) FROM (
       SELECT project_id, sum(secs) AS s FROM k GROUP BY project_id) z), '[]'::jsonb))
  FROM k $$;
REVOKE ALL ON FUNCTION public.project_timesheet_overview(date, date, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_timesheet_overview(date, date, uuid, uuid) TO authenticated;

-- =========================================================== aceite manual do cliente
CREATE OR REPLACE FUNCTION public.project_client_acceptance_record(p_project uuid, p_from date, p_to date, p_status text,
  p_client_name text, p_client_email text, p_contact uuid, p_evidence text, p_reference text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p record; v_id uuid; v_snap jsonb; v_n int; v_secs bigint;
BEGIN
  SELECT id, workspace_id, client_acceptance_required, company_id INTO p FROM public.projects WHERE id = p_project FOR UPDATE;
  IF p.id IS NULL THEN RAISE EXCEPTION 'Projeto não encontrado.'; END IF;
  PERFORM public.project_time_assert_actor(p.workspace_id, true);
  IF NOT p.client_acceptance_required THEN RAISE EXCEPTION 'Aceite do cliente não está habilitado neste projeto.'; END IF;
  IF p_status NOT IN ('accepted','contested') THEN RAISE EXCEPTION 'Situação inválida.'; END IF;
  IF NOT public.project_time_can_approve(auth.uid(), p_project, NULL) THEN
    RAISE EXCEPTION 'Apenas aprovadores do projeto registram o aceite.' USING ERRCODE = '42501';
  END IF;
  IF p_contact IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.contacts c WHERE c.id = p_contact AND c.workspace_id = p.workspace_id) THEN
    RAISE EXCEPTION 'Contato fora do workspace.';
  END IF;
  IF length(btrim(coalesce(p_evidence, ''))) < 10 THEN RAISE EXCEPTION 'Descreva a evidência do aceite (mín. 10 caracteres).'; END IF;
  PERFORM 1 FROM public.project_time_entries WHERE project_id = p_project AND entry_date BETWEEN p_from AND p_to FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.project_time_entries WHERE project_id = p_project AND entry_date BETWEEN p_from AND p_to
              AND status IN ('draft','submitted','rejected')) THEN
    RAISE EXCEPTION 'Há horas ainda não aprovadas no período; o aceite cobre apenas horas aprovadas.';
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'revision', revision, 'seconds', coalesce(duration_seconds, duration_minutes * 60, 0)) ORDER BY id), '[]'::jsonb),
         count(*), coalesce(sum(coalesce(duration_seconds, duration_minutes * 60, 0)), 0)
    INTO v_snap, v_n, v_secs
    FROM public.project_time_entries WHERE project_id = p_project AND entry_date BETWEEN p_from AND p_to
     AND status = 'approved' AND client_acceptance_id IS NULL AND period_closing_id IS NULL;
  IF v_n = 0 THEN RAISE EXCEPTION 'Nenhuma hora aprovada pendente de aceite no período.'; END IF;
  INSERT INTO public.project_client_acceptances (workspace_id, project_id, period_from, period_to, status, client_name, client_email,
         client_contact_id, evidence, evidence_reference, entries_snapshot, entry_count, total_seconds, recorded_by)
  VALUES (p.workspace_id, p_project, p_from, p_to, p_status, btrim(p_client_name), nullif(btrim(coalesce(p_client_email, '')), ''),
          p_contact, btrim(p_evidence), nullif(btrim(coalesce(p_reference, '')), ''), v_snap, v_n, v_secs, auth.uid())
  RETURNING id INTO v_id;
  IF p_status = 'accepted' THEN
    PERFORM set_config('app.project_time_workflow', 'on', true);
    UPDATE public.project_time_entries SET client_acceptance_id = v_id WHERE id IN (SELECT (x->>'id')::uuid FROM jsonb_array_elements(v_snap) x);
    PERFORM set_config('app.project_time_workflow', 'off', true);
  END IF;
  PERFORM public.project_time_log(p.workspace_id, 'client_acceptance', v_id, p_status, NULL, p_project, NULL,
    jsonb_build_object('entries', v_n, 'seconds', v_secs, 'method', 'manual_evidence', 'client_name', p_client_name));
  RETURN jsonb_build_object('acceptance_id', v_id, 'entries', v_n, 'total_seconds', v_secs, 'status', p_status);
END $$;
REVOKE ALL ON FUNCTION public.project_client_acceptance_record(uuid, date, date, text, text, text, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_client_acceptance_record(uuid, date, date, text, text, text, uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.project_client_acceptance_void(p_id uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a record;
BEGIN
  SELECT * INTO a FROM public.project_client_acceptances WHERE id = p_id FOR UPDATE;
  IF a.id IS NULL THEN RAISE EXCEPTION 'Aceite não encontrado.'; END IF;
  PERFORM public.project_time_assert_actor(a.workspace_id, true);
  IF NOT public.project_time_can_approve(auth.uid(), a.project_id, NULL) THEN RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501'; END IF;
  IF a.status = 'voided' THEN RETURN; END IF;
  IF length(btrim(coalesce(p_reason, ''))) < 5 THEN RAISE EXCEPTION 'Informe o motivo.'; END IF;
  IF EXISTS (SELECT 1 FROM public.project_time_entries WHERE client_acceptance_id = p_id AND period_closing_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Aceite usado em competência fechada; reabra a competência antes.';
  END IF;
  PERFORM set_config('app.project_time_workflow', 'on', true);
  UPDATE public.project_time_entries SET client_acceptance_id = NULL WHERE client_acceptance_id = p_id;
  PERFORM set_config('app.project_time_workflow', 'off', true);
  UPDATE public.project_client_acceptances SET status = 'voided', voided_by = auth.uid(), voided_at = now(), void_reason = btrim(p_reason) WHERE id = p_id;
  PERFORM public.project_time_log(a.workspace_id, 'client_acceptance', p_id, 'voided', NULL, a.project_id, p_reason, '{}'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.project_client_acceptance_void(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_client_acceptance_void(uuid, text) TO authenticated;

-- =========================================================== fechamento de competência
INSERT INTO public.permissions (key, module, resource, action, scope, label_pt, description, is_system)
VALUES ('techprojects.timesheet_closing.manage.workspace', 'techprojects', 'timesheet_closing', 'manage', 'workspace',
        'Fechar competência de horas', 'Fecha a competência de horas aprovadas por projeto ou pessoa (não gera fatura nem pagamento).', true),
       ('techprojects.timesheet_reopen.manage.workspace', 'techprojects', 'timesheet_reopen', 'manage', 'workspace',
        'Reabrir competência de horas', 'Reabre competência fechada, com motivo e trilha de auditoria.', true)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.project_period_scope_entries(p_ws uuid, p_scope text, p_project uuid, p_user uuid, p_from date, p_to date)
RETURNS SETOF public.project_time_entries LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.project_time_entries t
   WHERE t.workspace_id = p_ws AND t.entry_date BETWEEN p_from AND p_to
     AND ((p_scope = 'project' AND t.project_id = p_project) OR (p_scope = 'person' AND t.user_id = p_user)) $$;
REVOKE ALL ON FUNCTION public.project_period_scope_entries(uuid, text, uuid, uuid, date, date) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.project_period_close_check(p_ws uuid, p_scope text, p_project uuid, p_user uuid, p_from date, p_to date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pol jsonb := public.project_time_policy_get(p_ws); v jsonb;
BEGIN
  WITH e AS (SELECT * FROM public.project_period_scope_entries(p_ws, p_scope, p_project, p_user, p_from, p_to)),
  acc AS (SELECT (p_scope = 'project' AND coalesce((SELECT client_acceptance_required FROM public.projects WHERE id = p_project), false)
                   AND coalesce((v_pol->>'closing_requires_client_acceptance')::boolean, true)) AS req)
  SELECT jsonb_build_object(
    'pending', (SELECT count(*) FROM e WHERE status IN ('draft','submitted','rejected')),
    'pending_seconds', coalesce((SELECT sum(coalesce(duration_seconds, duration_minutes * 60, 0)) FROM e WHERE status IN ('draft','submitted','rejected')), 0),
    'eligible', (SELECT count(*) FROM e WHERE status = 'approved' AND period_closing_id IS NULL),
    'eligible_seconds', coalesce((SELECT sum(coalesce(duration_seconds, duration_minutes * 60, 0)) FROM e WHERE status = 'approved' AND period_closing_id IS NULL), 0),
    'already_closed', (SELECT count(*) FROM e WHERE period_closing_id IS NOT NULL),
    'missing_acceptance', CASE WHEN (SELECT req FROM acc) THEN (SELECT count(*) FROM e WHERE status = 'approved' AND client_acceptance_id IS NULL AND period_closing_id IS NULL) ELSE 0 END,
    'imported_locked', (SELECT count(*) FROM e WHERE status = 'locked' AND source = 'import'),
    'imported_locked_seconds', coalesce((SELECT sum(public.project_entry_seconds(started_at, stopped_at, duration_minutes, hours)) FROM e WHERE status = 'locked' AND source = 'import'), 0),
    'running_timers', (SELECT count(*) FROM public.project_timer_sessions s WHERE s.workspace_id = p_ws AND s.state IN ('running','paused')
                        AND ((p_scope = 'project' AND s.project_id = p_project) OR (p_scope = 'person' AND s.user_id = p_user))),
    'overlapping_closing', EXISTS (SELECT 1 FROM public.project_period_closings c WHERE c.workspace_id = p_ws AND c.status = 'closed' AND c.scope = p_scope
                        AND c.project_id IS NOT DISTINCT FROM p_project AND c.user_id IS NOT DISTINCT FROM p_user
                        AND c.period_from <= p_to AND c.period_to >= p_from),
    'acceptance_required', (SELECT req FROM acc),
    'policy_version', (v_pol->>'version')::int) INTO v;
  RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.project_period_close_check(uuid, text, uuid, uuid, date, date) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.project_period_close_assert(p_ws uuid, p_scope text, p_project uuid, p_user uuid)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_scope NOT IN ('project','person') THEN RAISE EXCEPTION 'Escopo inválido.'; END IF;
  IF p_scope = 'project' AND NOT EXISTS (SELECT 1 FROM public.projects WHERE id = p_project AND workspace_id = p_ws) THEN RAISE EXCEPTION 'Projeto fora do workspace.'; END IF;
  IF p_scope = 'person' AND NOT EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = p_ws AND user_id = p_user) THEN RAISE EXCEPTION 'Pessoa fora do workspace.'; END IF;
  IF NOT public.user_has_permission(auth.uid(), p_ws, 'techprojects.timesheet_closing.manage.workspace') THEN
    RAISE EXCEPTION 'Sem permissão para fechar competência.' USING ERRCODE = '42501';
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.project_period_close_assert(uuid, text, uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.project_period_close_preview(p_ws uuid, p_scope text, p_project uuid, p_user uuid, p_from date, p_to date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.project_time_assert_actor(p_ws, false);
  PERFORM public.project_period_close_assert(p_ws, p_scope, p_project, p_user);
  IF p_from IS NULL OR p_to IS NULL OR p_to < p_from OR p_to - p_from > 92 THEN RAISE EXCEPTION 'Período inválido (até 93 dias).'; END IF;
  RETURN public.project_period_close_check(p_ws, p_scope, p_project, p_user, p_from, p_to);
END $$;
REVOKE ALL ON FUNCTION public.project_period_close_preview(uuid, text, uuid, uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_period_close_preview(uuid, text, uuid, uuid, date, date) TO authenticated;

CREATE OR REPLACE FUNCTION public.project_period_close(p_ws uuid, p_scope text, p_project uuid, p_user uuid, p_from date, p_to date, p_tz text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v jsonb; v_id uuid; v_snap jsonb; v_n int; v_secs bigint;
BEGIN
  PERFORM public.project_time_assert_actor(p_ws, true);
  PERFORM public.project_period_close_assert(p_ws, p_scope, p_project, p_user);
  IF p_from IS NULL OR p_to IS NULL OR p_to < p_from OR p_to - p_from > 92 THEN RAISE EXCEPTION 'Período inválido (até 93 dias).'; END IF;
  IF p_tz IS NULL OR NOT public.project_time_tz_valid(p_tz) THEN RAISE EXCEPTION 'Fuso horário inválido.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('project_period_close:' || p_ws::text));
  PERFORM 1 FROM public.project_time_entries t WHERE t.workspace_id = p_ws AND t.entry_date BETWEEN p_from AND p_to
     AND ((p_scope = 'project' AND t.project_id = p_project) OR (p_scope = 'person' AND t.user_id = p_user)) FOR UPDATE;
  v := public.project_period_close_check(p_ws, p_scope, p_project, p_user, p_from, p_to);
  IF (v->>'overlapping_closing')::boolean THEN RAISE EXCEPTION 'CLOSE_BLOCKED: já existe competência fechada que cobre parte do período.'; END IF;
  IF (v->>'pending')::int > 0 THEN RAISE EXCEPTION 'CLOSE_BLOCKED: % apontamento(s) ainda em rascunho, enviados ou devolvidos.', v->>'pending'; END IF;
  IF (v->>'running_timers')::int > 0 THEN RAISE EXCEPTION 'CLOSE_BLOCKED: há cronômetro em andamento no escopo.'; END IF;
  IF (v->>'missing_acceptance')::int > 0 THEN RAISE EXCEPTION 'CLOSE_BLOCKED: % apontamento(s) aprovados sem aceite do cliente registrado.', v->>'missing_acceptance'; END IF;
  IF (v->>'eligible')::int = 0 THEN RAISE EXCEPTION 'CLOSE_BLOCKED: nenhuma hora aprovada no período.'; END IF;
  SELECT jsonb_agg(jsonb_build_object('id', id, 'revision', revision, 'user_id', user_id, 'project_id', project_id, 'entry_date', entry_date,
           'seconds', coalesce(duration_seconds, duration_minutes * 60, 0), 'billable', billable, 'approved_at', approved_at) ORDER BY id),
         count(*), coalesce(sum(coalesce(duration_seconds, duration_minutes * 60, 0)), 0)
    INTO v_snap, v_n, v_secs
    FROM public.project_period_scope_entries(p_ws, p_scope, p_project, p_user, p_from, p_to) e
   WHERE e.status = 'approved' AND e.period_closing_id IS NULL;
  INSERT INTO public.project_period_closings (workspace_id, scope, project_id, user_id, period_from, period_to, timezone, policy_version,
         status, entries_snapshot, entry_count, total_seconds, excluded_import_count, excluded_import_seconds, closed_by)
  VALUES (p_ws, p_scope, CASE WHEN p_scope = 'project' THEN p_project END, CASE WHEN p_scope = 'person' THEN p_user END,
          p_from, p_to, p_tz, coalesce((v->>'policy_version')::int, 0), 'closed', v_snap, v_n, v_secs,
          (v->>'imported_locked')::int, (v->>'imported_locked_seconds')::numeric::bigint, auth.uid())
  RETURNING id INTO v_id;
  PERFORM set_config('app.project_time_workflow', 'on', true);
  UPDATE public.project_time_entries SET period_closing_id = v_id WHERE id IN (SELECT (x->>'id')::uuid FROM jsonb_array_elements(v_snap) x);
  PERFORM set_config('app.project_time_workflow', 'off', true);
  PERFORM public.project_time_log(p_ws, 'period_closing', v_id, 'closed', p_user, p_project, NULL,
    jsonb_build_object('scope', p_scope, 'from', p_from, 'to', p_to, 'entries', v_n, 'seconds', v_secs,
      'excluded_import', v->'imported_locked', 'tz', p_tz));
  RETURN jsonb_build_object('closing_id', v_id, 'entries', v_n, 'total_seconds', v_secs, 'excluded_import', v->'imported_locked');
END $$;
REVOKE ALL ON FUNCTION public.project_period_close(uuid, text, uuid, uuid, date, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_period_close(uuid, text, uuid, uuid, date, date, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.project_period_reopen(p_closing uuid, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c record; v_n int;
BEGIN
  SELECT * INTO c FROM public.project_period_closings WHERE id = p_closing FOR UPDATE;
  IF c.id IS NULL THEN RAISE EXCEPTION 'Competência não encontrada.'; END IF;
  PERFORM public.project_time_assert_actor(c.workspace_id, true);
  IF NOT public.user_has_permission(auth.uid(), c.workspace_id, 'techprojects.timesheet_reopen.manage.workspace') THEN
    RAISE EXCEPTION 'Sem permissão explícita para reabrir competência.' USING ERRCODE = '42501';
  END IF;
  IF c.status <> 'closed' THEN RAISE EXCEPTION 'Competência já reaberta.'; END IF;
  IF length(btrim(coalesce(p_reason, ''))) < 10 THEN RAISE EXCEPTION 'Informe o motivo da reabertura (mín. 10 caracteres).'; END IF;
  PERFORM set_config('app.project_time_workflow', 'on', true);
  UPDATE public.project_time_entries SET period_closing_id = NULL WHERE period_closing_id = c.id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  PERFORM set_config('app.project_time_workflow', 'off', true);
  UPDATE public.project_period_closings SET status = 'reopened', reopened_by = auth.uid(), reopened_at = now(), reopen_reason = btrim(p_reason) WHERE id = c.id;
  PERFORM public.project_time_log(c.workspace_id, 'period_closing', c.id, 'reopened', c.user_id, c.project_id, p_reason, jsonb_build_object('entries', v_n));
  RETURN jsonb_build_object('reopened_entries', v_n);
END $$;
REVOKE ALL ON FUNCTION public.project_period_reopen(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_period_reopen(uuid, text) TO authenticated;

-- =========================================================== Jibble: horas sem horário
-- Classifica cada lançamento por duração do Jibble. Só `candidate` pode virar apontamento, e só por
-- ação explícita do admin: dia sem intervalo do Jibble, sem apontamento de outra fonte no mesmo dia,
-- pessoa e projeto mapeados por decisão confirmada. O resto fica em revisão (sem chute).
CREATE OR REPLACE FUNCTION public.project_jibble_hour_classify(p_ws uuid)
RETURNS TABLE (staging_id uuid, external_id text, person_external_id text, user_id uuid, project_external_id text, project_id uuid,
  entry_date date, seconds numeric, day_hour_seconds numeric, day_interval_seconds numeric, day_erp_seconds numeric,
  note text, classification text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH he AS (
    SELECT s.id, s.external_id, s.payload->>'personId' AS pid, s.payload->>'projectId' AS prj, public.try_iso_date(s.payload->>'date') AS d,
           public.iso8601_duration_seconds(s.payload->>'duration') AS secs, s.payload->>'note' AS note, coalesce(s.payload->>'status', 'Active') AS st
      FROM public.time_import_staging s
     WHERE s.workspace_id = p_ws AND s.provider = 'jibble' AND s.entity_type = 'hour_entry'),
  hs AS (SELECT pid, d, sum(secs) AS secs FROM he WHERE st NOT IN ('Archived','Deleted','Removed') GROUP BY 1, 2),
  iv AS (
    SELECT s.payload->>'personId' AS pid, public.try_iso_date(seg->>'localDate') AS d,
           sum(CASE WHEN (seg->>'seconds') ~ '^\d+(\.\d+)?$' THEN (seg->>'seconds')::numeric ELSE 0 END) AS secs
      FROM public.time_import_staging s
     CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(s.payload->'segments') = 'array' THEN s.payload->'segments' ELSE '[]'::jsonb END) seg
     WHERE s.workspace_id = p_ws AND s.provider = 'jibble' AND s.entity_type = 'interval'
     GROUP BY 1, 2),
  pm AS (SELECT external_id, (array_agg(DISTINCT target_id))[1] AS target_id FROM public.time_import_mappings
          WHERE workspace_id = p_ws AND provider = 'jibble' AND entity_type = 'person' AND decision IN ('auto','confirmed') AND target_id IS NOT NULL
          GROUP BY external_id HAVING count(DISTINCT target_id) = 1),
  jm AS (SELECT external_id, (array_agg(DISTINCT target_id))[1] AS target_id FROM (
           SELECT external_id, target_id FROM public.time_import_mappings
            WHERE workspace_id = p_ws AND provider = 'jibble' AND entity_type = 'project' AND decision IN ('auto','confirmed') AND target_id IS NOT NULL
           UNION ALL
           SELECT external_id, target_id FROM public.time_import_links
            WHERE workspace_id = p_ws AND provider = 'jibble' AND entity_type = 'project' AND target_table = 'projects') x
          GROUP BY external_id HAVING count(DISTINCT target_id) = 1)
  SELECT he.id, he.external_id, he.pid, pm.target_id, he.prj, jm.target_id, he.d, he.secs, hs.secs, coalesce(iv.secs, 0),
         coalesce((SELECT sum(coalesce(t.duration_seconds, public.project_entry_seconds(t.started_at, t.stopped_at, t.duration_minutes, t.hours)))
                     FROM public.project_time_entries t WHERE t.workspace_id = p_ws AND t.user_id = pm.target_id AND t.entry_date = he.d
                      AND NOT (t.source = 'import' AND t.external_id = 'jibble:hour_entry:' || he.external_id)), 0),
         he.note,
         CASE
           WHEN EXISTS (SELECT 1 FROM public.project_time_entries t WHERE t.workspace_id = p_ws AND t.source = 'import'
                          AND t.external_id = 'jibble:hour_entry:' || he.external_id) THEN 'materialized'
           WHEN he.st IN ('Archived','Deleted','Removed') THEN 'archived'
           WHEN coalesce(he.secs, 0) <= 0 OR he.d IS NULL THEN 'invalid'
           WHEN coalesce(iv.secs, 0) >= hs.secs THEN 'covered'
           WHEN pm.target_id IS NULL THEN 'no_person'
           WHEN he.prj IS NULL THEN 'no_project'
           WHEN jm.target_id IS NULL THEN 'project_unmapped'
           WHEN coalesce(iv.secs, 0) > 0 THEN 'partial_coverage'
           WHEN EXISTS (SELECT 1 FROM public.project_time_entries t WHERE t.workspace_id = p_ws AND t.user_id = pm.target_id AND t.entry_date = he.d) THEN 'other_entries_same_day'
           ELSE 'candidate' END
    FROM he LEFT JOIN hs ON hs.pid IS NOT DISTINCT FROM he.pid AND hs.d IS NOT DISTINCT FROM he.d
    LEFT JOIN iv ON iv.pid = he.pid AND iv.d = he.d
    LEFT JOIN pm ON pm.external_id = he.pid
    LEFT JOIN jm ON jm.external_id = he.prj $$;
REVOKE ALL ON FUNCTION public.project_jibble_hour_classify(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.project_jibble_hour_preview(p_ws uuid, p_classification text, p_limit int, p_offset int)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v jsonb;
BEGIN
  PERFORM public.project_recon_assert_admin(p_ws, false);
  WITH c AS (SELECT * FROM public.project_jibble_hour_classify(p_ws))
  SELECT jsonb_build_object(
    'summary', coalesce((SELECT jsonb_object_agg(classification, jsonb_build_object('count', n, 'seconds', s)) FROM (
                 SELECT classification, count(*) AS n, coalesce(sum(seconds), 0) AS s FROM c GROUP BY 1) z), '{}'::jsonb),
    'total', (SELECT count(*) FROM c WHERE p_classification IS NULL OR classification = p_classification),
    'rows', coalesce((SELECT jsonb_agg(to_jsonb(r)) FROM (
               SELECT c.*, (SELECT full_name FROM public.profiles WHERE id = c.user_id) AS user_name,
                      (SELECT name FROM public.projects WHERE id = c.project_id) AS project_name
                 FROM c WHERE p_classification IS NULL OR classification = p_classification
                ORDER BY entry_date DESC NULLS LAST, person_external_id
                LIMIT least(greatest(coalesce(p_limit, 50), 1), 500) OFFSET greatest(coalesce(p_offset, 0), 0)) r), '[]'::jsonb)) INTO v;
  RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.project_jibble_hour_preview(uuid, text, int, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_jibble_hour_preview(uuid, text, int, int) TO authenticated;

CREATE OR REPLACE FUNCTION public.project_jibble_hour_materialize(p_ws uuid, p_staging_ids uuid[], p_note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; v_n int := 0; v_skipped int := 0; v_id uuid; v_org text;
BEGIN
  PERFORM public.project_recon_assert_admin(p_ws, true);
  IF length(btrim(coalesce(p_note, ''))) < 5 THEN RAISE EXCEPTION 'Informe a justificativa da materialização.'; END IF;
  IF cardinality(coalesce(p_staging_ids, '{}')) = 0 OR cardinality(p_staging_ids) > 500 THEN RAISE EXCEPTION 'Selecione de 1 a 500 lançamentos.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('project_jibble_hour_materialize:' || p_ws::text));
  PERFORM set_config('app.clockify_import', 'on', true);
  FOR r IN SELECT c.*, s.source_org_id, s.payload_hash FROM public.project_jibble_hour_classify(p_ws) c
             JOIN public.time_import_staging s ON s.id = c.staging_id
            WHERE c.staging_id = ANY (p_staging_ids) LOOP
    IF r.classification <> 'candidate' THEN v_skipped := v_skipped + 1; CONTINUE; END IF;
    INSERT INTO public.project_time_entries (workspace_id, project_id, user_id, entry_date, duration_seconds, duration_minutes,
           description, billable, source, external_id, status, locked_at, entry_kind, created_by, review_flags)
    VALUES (p_ws, r.project_id, r.user_id, r.entry_date, r.seconds::int, round(r.seconds / 60.0)::int, r.note, true, 'import',
            'jibble:hour_entry:' || r.external_id, 'locked', now(), 'duration', auth.uid(), ARRAY['unpositioned'])
    ON CONFLICT (workspace_id, source, external_id) WHERE external_id IS NOT NULL DO NOTHING
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN v_skipped := v_skipped + 1; CONTINUE; END IF;
    INSERT INTO public.time_import_links (workspace_id, provider, source_org_id, entity_type, external_id, segment, target_table, target_id,
           link_kind, source_hash, source_seconds, local_date, meta)
    VALUES (p_ws, 'jibble', r.source_org_id, 'hour_entry', r.external_id, 0, 'project_time_entries', v_id, 'created', r.payload_hash,
            r.seconds::bigint, r.entry_date, jsonb_build_object('materialized_by', auth.uid(), 'note', btrim(p_note), 'semantics', 'duration_without_position'))
    ON CONFLICT DO NOTHING;
    v_n := v_n + 1;
  END LOOP;
  PERFORM set_config('app.clockify_import', 'off', true);
  PERFORM public.project_time_log(p_ws, 'jibble_hour_entry', NULL, 'materialized', NULL, NULL, p_note,
    jsonb_build_object('created', v_n, 'skipped', v_skipped));
  RETURN jsonb_build_object('created', v_n, 'skipped', v_skipped);
END $$;
REVOKE ALL ON FUNCTION public.project_jibble_hour_materialize(uuid, uuid[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_jibble_hour_materialize(uuid, uuid[], text) TO authenticated;

-- =========================================================== escopo de leitura dos apontamentos
-- Corrige o escopo: quem só tem "ver próprios" passa a ver só os próprios. Visão completa exige
-- admin ou permissão de workspace; líderes veem o que aprovam/gerenciam. Subconsultas sem
-- correlação (avaliadas uma vez por consulta), sem custo por linha.
CREATE OR REPLACE FUNCTION public.project_time_full_scope_workspaces()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT w.id FROM public.current_user_workspaces() AS w(id)
   WHERE public.is_workspace_admin_v2(w.id, auth.uid())
      OR public.user_has_permission(auth.uid(), w.id, 'techprojects.time_entries.view.workspace')
      OR public.user_has_permission(auth.uid(), w.id, 'techprojects.timesheet.view.workspace')
      OR public.user_has_permission(auth.uid(), w.id, 'techpeople.timesheet.view.workspace') $$;
REVOKE ALL ON FUNCTION public.project_time_full_scope_workspaces() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_time_full_scope_workspaces() TO authenticated;

CREATE OR REPLACE FUNCTION public.project_time_led_scope()
RETURNS TABLE (project_id uuid, subject_user_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.project_id, a.subject_user_id FROM public.project_time_approvers a
   WHERE a.user_id = auth.uid() AND public.project_time_approver_row_active(a, current_date)
  UNION
  SELECT m.project_id, NULL::uuid FROM public.project_members m
   WHERE m.user_id = auth.uid() AND m.role_in_project = 'manager' $$;
REVOKE ALL ON FUNCTION public.project_time_led_scope() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_time_led_scope() TO authenticated;

CREATE POLICY ptime_scope_select ON public.project_time_entries AS RESTRICTIVE FOR SELECT TO authenticated
  USING (user_id = auth.uid()
         OR workspace_id IN (SELECT public.project_time_full_scope_workspaces())
         OR project_id IN (SELECT s.project_id FROM public.project_time_led_scope() s WHERE s.subject_user_id IS NULL)
         OR (project_id, user_id) IN (SELECT s.project_id, s.subject_user_id FROM public.project_time_led_scope() s WHERE s.subject_user_id IS NOT NULL));
