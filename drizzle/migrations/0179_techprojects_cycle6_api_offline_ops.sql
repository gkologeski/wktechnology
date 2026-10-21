-- TechProjects — ciclo 6: API v1 sob RLS do dono da chave, idempotência e limite por chave,
-- fila offline idempotente de apontamentos, competência fechada também na criação,
-- painel de operação (admin) e higiene de privilégios. Aditivo: nenhum dado existente muda.

-- ============================================================ 1. sujeito da API (RLS real do dono da chave)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'techerp_api_subject') THEN
    CREATE ROLE techerp_api_subject NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS INHERIT;
  END IF;
END $$;
GRANT authenticated TO techerp_api_subject;
GRANT techerp_api_subject TO current_user;

CREATE SCHEMA IF NOT EXISTS techerp_api;
REVOKE ALL ON SCHEMA techerp_api FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA techerp_api TO techerp_api_subject;
GRANT USAGE ON SCHEMA techerp_api TO service_role;

CREATE TABLE IF NOT EXISTS techerp_api.subject_sessions (
  txid bigint PRIMARY KEY,
  user_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  api_key_id uuid NOT NULL,
  prev_claims text,
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON techerp_api.subject_sessions FROM PUBLIC;
GRANT SELECT, INSERT, DELETE ON techerp_api.subject_sessions TO techerp_api_subject;

CREATE OR REPLACE FUNCTION public.current_user_workspaces()
 RETURNS SETOF uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_active uuid;
  v_api uuid;
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;
  IF current_setting('app.api_subject', true) = 'on' THEN
    SELECT s.workspace_id INTO v_api FROM techerp_api.subject_sessions s
     WHERE s.txid = txid_current_if_assigned() AND s.user_id = v_uid;
    IF v_api IS NOT NULL THEN
      IF EXISTS (SELECT 1 FROM public.workspace_members
                  WHERE workspace_id = v_api AND user_id = v_uid AND status = 'active') THEN
        RETURN QUERY SELECT v_api;
      END IF;
      RETURN;
    END IF;
  END IF;
  SELECT active_workspace_id INTO v_active FROM public.profiles WHERE id = v_uid;
  IF v_active IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = v_active AND user_id = v_uid AND status = 'active'
  ) THEN
    RETURN QUERY SELECT v_active;
    RETURN;
  END IF;
  RETURN QUERY SELECT workspace_id FROM public.workspace_members WHERE user_id = v_uid AND status = 'active';
END;
$function$;

-- ============================================================ 2. idempotência e limite por chave
CREATE TABLE IF NOT EXISTS public.api_idempotency_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  api_key_id uuid NOT NULL,
  idem_key text NOT NULL CHECK (length(idem_key) BETWEEN 8 AND 200),
  request_hash text NOT NULL CHECK (length(request_hash) BETWEEN 16 AND 128),
  endpoint text NOT NULL,
  response jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
  UNIQUE (api_key_id, idem_key)
);
GRANT ALL ON public.api_idempotency_keys TO service_role;
GRANT SELECT, INSERT, DELETE ON public.api_idempotency_keys TO techerp_api_subject;
ALTER TABLE public.api_idempotency_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY api_idem_subject ON public.api_idempotency_keys FOR ALL TO techerp_api_subject
  USING (workspace_id IN (SELECT public.current_user_workspaces()))
  WITH CHECK (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE INDEX IF NOT EXISTS api_idempotency_keys_expiry_idx ON public.api_idempotency_keys (api_key_id, expires_at);

CREATE TABLE IF NOT EXISTS public.api_rate_buckets (
  api_key_id uuid NOT NULL,
  window_start timestamptz NOT NULL,
  hits integer NOT NULL DEFAULT 0,
  PRIMARY KEY (api_key_id, window_start)
);
GRANT ALL ON public.api_rate_buckets TO service_role;
ALTER TABLE public.api_rate_buckets ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.api_rate_hit(p_key uuid, p_limit integer, p_window_seconds integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_win timestamptz; v_hits integer;
BEGIN
  IF p_key IS NULL OR p_limit < 1 OR p_window_seconds < 1 OR p_window_seconds > 3600 THEN
    RAISE EXCEPTION 'Parâmetros de limite inválidos.';
  END IF;
  v_win := to_timestamp(floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds);
  INSERT INTO public.api_rate_buckets (api_key_id, window_start, hits) VALUES (p_key, v_win, 1)
  ON CONFLICT (api_key_id, window_start) DO UPDATE SET hits = api_rate_buckets.hits + 1
  RETURNING hits INTO v_hits;
  DELETE FROM public.api_rate_buckets WHERE api_key_id = p_key AND window_start < v_win - make_interval(secs => p_window_seconds);
  RETURN jsonb_build_object('allowed', v_hits <= p_limit, 'limit', p_limit, 'remaining', greatest(p_limit - v_hits, 0),
    'reset_at', v_win + make_interval(secs => p_window_seconds));
END $function$;
REVOKE ALL ON FUNCTION public.api_rate_hit(uuid, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_rate_hit(uuid, integer, integer) TO service_role;

-- ============================================================ 3. competência fechada também na criação
CREATE OR REPLACE FUNCTION public.project_time_closed_period_for(p_ws uuid, p_project uuid, p_user uuid, p_date date)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT c.id FROM public.project_period_closings c
   WHERE c.workspace_id = p_ws AND c.status = 'closed' AND p_date BETWEEN c.period_from AND c.period_to
     AND ((c.scope = 'project' AND c.project_id = p_project) OR (c.scope = 'person' AND c.user_id = p_user))
   LIMIT 1 $function$;
REVOKE ALL ON FUNCTION public.project_time_closed_period_for(uuid, uuid, uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_time_closed_period_for(uuid, uuid, uuid, date) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.project_time_entries_closed_insert_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF coalesce(current_setting('app.clockify_import', true), '') = 'on'
     OR coalesce(current_setting('app.project_time_workflow', true), '') = 'on'
     OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF public.project_time_closed_period_for(NEW.workspace_id, NEW.project_id, NEW.user_id, NEW.entry_date) IS NOT NULL THEN
    RAISE EXCEPTION 'PERIOD_CLOSED: competência fechada para esta data; peça a reabertura antes de apontar.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $function$;
DROP TRIGGER IF EXISTS project_time_entries_closed_insert_guard ON public.project_time_entries;
CREATE TRIGGER project_time_entries_closed_insert_guard BEFORE INSERT ON public.project_time_entries
  FOR EACH ROW EXECUTE FUNCTION public.project_time_entries_closed_insert_guard();

-- ============================================================ 4. criação validada (UI offline e API usam a mesma regra)
CREATE OR REPLACE FUNCTION public.project_time_task_in_project(p_task uuid, p_project uuid, p_ws uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.project_tasks t WHERE t.id = p_task AND t.project_id = p_project AND t.workspace_id = p_ws)
     AND p_ws IN (SELECT public.current_user_workspaces()) $function$;
REVOKE ALL ON FUNCTION public.project_time_task_in_project(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_time_task_in_project(uuid, uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.project_time_entry_insert_checked(p_ws uuid, p_payload jsonb, p_source text)
 RETURNS public.project_time_entries
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_mode text := coalesce(nullif(p_payload->>'mode', ''), 'interval');
  v_project uuid; v_task uuid; v_date date; v_start time; v_end time; v_secs integer;
  v_tz text := nullif(btrim(coalesce(p_payload->>'timezone', '')), '');
  v_desc text := nullif(p_payload->>'description', '');
  v_bill boolean;
  v_ext text := nullif(btrim(coalesce(p_payload->>'external_id', '')), '');
  v_row public.project_time_entries;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sessão obrigatória.' USING ERRCODE = '42501'; END IF;
  IF p_source NOT IN ('manual', 'api') THEN RAISE EXCEPTION 'INVALID_INPUT: origem inválida.' USING ERRCODE = '22023'; END IF;
  IF p_ws IS NULL OR NOT (p_ws IN (SELECT public.current_user_workspaces())) THEN
    RAISE EXCEPTION 'WORKSPACE_MISMATCH: o workspace do pedido não é o workspace ativo desta sessão.' USING ERRCODE = '42501';
  END IF;
  IF public.is_read_only_view() THEN RAISE EXCEPTION 'Sessão "Ver como" é somente leitura.' USING ERRCODE = '42501'; END IF;
  IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'INVALID_INPUT: corpo inválido.' USING ERRCODE = '22023'; END IF;
  BEGIN
    v_project := (p_payload->>'project_id')::uuid;
    v_task := (p_payload->>'task_id')::uuid;
    v_date := (p_payload->>'entry_date')::date;
    v_bill := coalesce((p_payload->>'billable')::boolean, true);
    IF v_mode = 'interval' THEN
      v_start := (p_payload->>'start_time')::time; v_end := (p_payload->>'end_time')::time;
    ELSE
      v_secs := (p_payload->>'duration_seconds')::integer;
    END IF;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'INVALID_INPUT: identificador, data, horário ou duração em formato inválido.' USING ERRCODE = '22023';
  END;
  IF v_project IS NULL OR v_task IS NULL OR v_date IS NULL THEN
    RAISE EXCEPTION 'INVALID_INPUT: informe projeto, atividade e data.' USING ERRCODE = '22023';
  END IF;
  IF v_mode NOT IN ('interval', 'duration') THEN RAISE EXCEPTION 'INVALID_INPUT: modo deve ser interval ou duration.' USING ERRCODE = '22023'; END IF;
  IF v_mode = 'interval' AND (v_start IS NULL OR v_end IS NULL OR v_end <= v_start) THEN
    RAISE EXCEPTION 'INVALID_INPUT: o horário final deve ser maior que o inicial.' USING ERRCODE = '22023';
  END IF;
  IF v_mode = 'duration' AND (v_secs IS NULL OR v_secs < 60 OR v_secs > 86400) THEN
    RAISE EXCEPTION 'INVALID_INPUT: duração entre 60 e 86400 segundos.' USING ERRCODE = '22023';
  END IF;
  IF v_desc IS NOT NULL AND length(v_desc) > 2000 THEN RAISE EXCEPTION 'INVALID_INPUT: descrição acima de 2000 caracteres.' USING ERRCODE = '22023'; END IF;
  IF v_ext IS NOT NULL AND length(v_ext) > 180 THEN RAISE EXCEPTION 'INVALID_INPUT: external_id acima de 180 caracteres.' USING ERRCODE = '22023'; END IF;
  IF v_date > current_date + 31 OR v_date < date '2000-01-01' THEN
    RAISE EXCEPTION 'INVALID_INPUT: data fora do intervalo aceito.' USING ERRCODE = '22023';
  END IF;
  IF NOT public.project_time_task_in_project(v_task, v_project, p_ws) THEN
    RAISE EXCEPTION 'NOT_FOUND: atividade não encontrada neste projeto.' USING ERRCODE = 'P0002';
  END IF;
  INSERT INTO public.project_time_entries (workspace_id, project_id, task_id, user_id, entry_date, entry_kind,
                                           start_time, end_time, duration_seconds, timezone, description, billable, source, external_id)
  VALUES (p_ws, v_project, v_task, v_uid, v_date, v_mode,
          CASE WHEN v_mode = 'interval' THEN v_start END, CASE WHEN v_mode = 'interval' THEN v_end END,
          CASE WHEN v_mode = 'duration' THEN v_secs END, v_tz, v_desc, v_bill, p_source, v_ext)
  RETURNING * INTO v_row;
  RETURN v_row;
END $function$;
REVOKE ALL ON FUNCTION public.project_time_entry_insert_checked(uuid, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_time_entry_insert_checked(uuid, jsonb, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.project_time_entry_public_json(e public.project_time_entries)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object('id', e.id, 'project_id', e.project_id, 'task_id', e.task_id, 'user_id', e.user_id,
    'entry_date', e.entry_date, 'entry_kind', e.entry_kind, 'start_time', e.start_time, 'end_time', e.end_time,
    'duration_seconds', e.duration_seconds, 'timezone', e.timezone, 'description', e.description, 'billable', e.billable,
    'status', e.status, 'source', e.source, 'external_id', e.external_id, 'revision', e.revision,
    'review_flags', e.review_flags, 'submitted_at', e.submitted_at, 'approved_at', e.approved_at,
    'locked', e.locked_at IS NOT NULL, 'period_closed', e.period_closing_id IS NOT NULL,
    'created_at', e.created_at, 'updated_at', e.updated_at) $function$;
GRANT EXECUTE ON FUNCTION public.project_time_entry_public_json(public.project_time_entries) TO authenticated, service_role;

-- ============================================================ 5. fila offline idempotente
CREATE TABLE IF NOT EXISTS public.project_time_client_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  user_id uuid NOT NULL,
  client_request_id uuid NOT NULL,
  request_hash text NOT NULL CHECK (length(request_hash) BETWEEN 16 AND 128),
  time_entry_id uuid,
  device_recorded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, client_request_id)
);
GRANT SELECT, INSERT ON public.project_time_client_requests TO authenticated;
GRANT ALL ON public.project_time_client_requests TO service_role;
ALTER TABLE public.project_time_client_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY ptcr_select_own ON public.project_time_client_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND workspace_id IN (SELECT public.current_user_workspaces()));
CREATE POLICY ptcr_insert_own ON public.project_time_client_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND workspace_id IN (SELECT public.current_user_workspaces()) AND NOT public.is_read_only_view());

CREATE OR REPLACE FUNCTION public.project_time_entry_sync(p_ws uuid, p_client_request_id uuid, p_request_hash text,
                                                          p_payload jsonb, p_device_recorded_at timestamptz DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_uid uuid := auth.uid(); v_prev public.project_time_client_requests; v_row public.project_time_entries;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sessão obrigatória.' USING ERRCODE = '42501'; END IF;
  IF p_client_request_id IS NULL OR p_request_hash IS NULL OR length(p_request_hash) NOT BETWEEN 16 AND 128 THEN
    RAISE EXCEPTION 'INVALID_INPUT: identificador do pedido ausente.' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_uid::text || ':' || p_client_request_id::text, 61));
  SELECT * INTO v_prev FROM public.project_time_client_requests WHERE user_id = v_uid AND client_request_id = p_client_request_id;
  IF FOUND THEN
    IF v_prev.request_hash <> p_request_hash THEN
      RAISE EXCEPTION 'OFFLINE_REQUEST_CONFLICT: este pedido já foi enviado com conteúdo diferente.' USING ERRCODE = 'P0001';
    END IF;
    SELECT * INTO v_row FROM public.project_time_entries WHERE id = v_prev.time_entry_id;
    RETURN jsonb_build_object('replay', true, 'entry', CASE WHEN v_row.id IS NULL THEN NULL ELSE public.project_time_entry_public_json(v_row) END);
  END IF;
  v_row := public.project_time_entry_insert_checked(p_ws, p_payload, 'manual');
  INSERT INTO public.project_time_client_requests (workspace_id, user_id, client_request_id, request_hash, time_entry_id, device_recorded_at)
  VALUES (p_ws, v_uid, p_client_request_id, p_request_hash, v_row.id, p_device_recorded_at);
  RETURN jsonb_build_object('replay', false, 'entry', public.project_time_entry_public_json(v_row));
END $function$;
REVOKE ALL ON FUNCTION public.project_time_entry_sync(uuid, uuid, text, jsonb, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_time_entry_sync(uuid, uuid, text, jsonb, timestamptz) TO authenticated;

-- ============================================================ 6. funções do sujeito da API
CREATE OR REPLACE FUNCTION techerp_api.enter(p_key uuid, p_user uuid, p_ws uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_prev text := current_setting('request.jwt.claims', true);
BEGIN
  IF p_key IS NULL OR p_user IS NULL OR p_ws IS NULL THEN RAISE EXCEPTION 'API_SUBJECT_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF current_setting('app.api_subject', true) = 'on' THEN RAISE EXCEPTION 'API_SUBJECT_NESTED' USING ERRCODE = '42501'; END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated', 'aud', 'authenticated', 'api_key_id', p_key)::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  INSERT INTO techerp_api.subject_sessions (txid, user_id, workspace_id, api_key_id, prev_claims)
  VALUES (txid_current(), p_user, p_ws, p_key, v_prev);
  PERFORM set_config('app.api_subject', 'on', true);
  IF NOT EXISTS (SELECT 1 FROM public.api_keys k WHERE k.id = p_key AND k.owner_id = p_user AND k.workspace_id = p_ws
                    AND k.revoked_at IS NULL AND (k.expires_at IS NULL OR k.expires_at > now())) THEN
    RAISE EXCEPTION 'API_KEY_INVALID' USING ERRCODE = '28000';
  END IF;
  IF NOT (p_ws IN (SELECT public.current_user_workspaces())) THEN
    RAISE EXCEPTION 'API_SUBJECT_INACTIVE: o dono da chave não é membro ativo do workspace.' USING ERRCODE = '42501';
  END IF;
END $function$;

CREATE OR REPLACE FUNCTION techerp_api.leave()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_prev text;
BEGIN
  DELETE FROM techerp_api.subject_sessions WHERE txid = txid_current() RETURNING prev_claims INTO v_prev;
  PERFORM set_config('app.api_subject', 'off', true);
  PERFORM set_config('request.jwt.claims', coalesce(v_prev, ''), true);
  PERFORM set_config('request.jwt.claim.sub', coalesce(v_prev::jsonb->>'sub', ''), true);
  PERFORM set_config('request.jwt.claim.role', coalesce(v_prev::jsonb->>'role', ''), true);
END $function$;

CREATE OR REPLACE FUNCTION techerp_api.list_projects(p_key uuid, p_user uuid, p_ws uuid, p_status text, p_search text, p_limit integer, p_offset integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_total bigint; v_data jsonb; v_lim integer := least(greatest(coalesce(p_limit, 50), 1), 200); v_off integer := greatest(coalesce(p_offset, 0), 0);
BEGIN
  PERFORM techerp_api.enter(p_key, p_user, p_ws);
  SELECT count(*) INTO v_total FROM public.projects p
   WHERE p.workspace_id = p_ws AND (p_status IS NULL OR p.status::text = p_status)
     AND (p_search IS NULL OR p.name ILIKE '%' || p_search || '%');
  SELECT coalesce(jsonb_agg(x.j ORDER BY x.name, x.id), '[]'::jsonb) INTO v_data FROM (
    SELECT p.name, p.id, jsonb_build_object('id', p.id, 'name', p.name, 'status', p.status, 'company_id', p.company_id,
             'starts_at', p.starts_at, 'due_at', p.due_at, 'deal_id', p.deal_id,
             'can_track', public.project_time_can_track(p_user, p.id, current_date),
             'created_at', p.created_at, 'updated_at', p.updated_at) j
      FROM public.projects p
     WHERE p.workspace_id = p_ws AND (p_status IS NULL OR p.status::text = p_status)
       AND (p_search IS NULL OR p.name ILIKE '%' || p_search || '%')
     ORDER BY p.name, p.id LIMIT v_lim OFFSET v_off) x;
  PERFORM techerp_api.leave();
  RETURN jsonb_build_object('data', v_data, 'total', v_total, 'limit', v_lim, 'offset', v_off);
END $function$;

CREATE OR REPLACE FUNCTION techerp_api.list_tasks(p_key uuid, p_user uuid, p_ws uuid, p_project uuid, p_status text, p_search text, p_limit integer, p_offset integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_total bigint; v_data jsonb; v_lim integer := least(greatest(coalesce(p_limit, 50), 1), 200); v_off integer := greatest(coalesce(p_offset, 0), 0);
BEGIN
  PERFORM techerp_api.enter(p_key, p_user, p_ws);
  SELECT count(*) INTO v_total FROM public.project_tasks t
   WHERE t.workspace_id = p_ws AND (p_project IS NULL OR t.project_id = p_project)
     AND (p_status IS NULL OR t.status::text = p_status) AND (p_search IS NULL OR t.title ILIKE '%' || p_search || '%');
  SELECT coalesce(jsonb_agg(x.j ORDER BY x.updated_at DESC, x.id), '[]'::jsonb) INTO v_data FROM (
    SELECT t.updated_at, t.id, jsonb_build_object('id', t.id, 'project_id', t.project_id, 'title', t.title, 'status', t.status,
             'assignee_id', t.assignee_id, 'start_at', t.start_at, 'due_at', t.due_at, 'priority', t.priority,
             'created_at', t.created_at, 'updated_at', t.updated_at) j
      FROM public.project_tasks t
     WHERE t.workspace_id = p_ws AND (p_project IS NULL OR t.project_id = p_project)
       AND (p_status IS NULL OR t.status::text = p_status) AND (p_search IS NULL OR t.title ILIKE '%' || p_search || '%')
     ORDER BY t.updated_at DESC, t.id LIMIT v_lim OFFSET v_off) x;
  PERFORM techerp_api.leave();
  RETURN jsonb_build_object('data', v_data, 'total', v_total, 'limit', v_lim, 'offset', v_off);
END $function$;

CREATE OR REPLACE FUNCTION techerp_api.list_time_entries(p_key uuid, p_user uuid, p_ws uuid, p_project uuid, p_subject uuid, p_status text,
                                                         p_from date, p_to date, p_ascending boolean, p_limit integer, p_offset integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_total bigint; v_data jsonb; v_lim integer := least(greatest(coalesce(p_limit, 50), 1), 200); v_off integer := greatest(coalesce(p_offset, 0), 0);
BEGIN
  PERFORM techerp_api.enter(p_key, p_user, p_ws);
  IF p_from IS NOT NULL AND p_to IS NOT NULL AND p_to < p_from THEN RAISE EXCEPTION 'INVALID_INPUT: período invertido.' USING ERRCODE = '22023'; END IF;
  SELECT count(*) INTO v_total FROM public.project_time_entries e
   WHERE e.workspace_id = p_ws AND (p_project IS NULL OR e.project_id = p_project) AND (p_subject IS NULL OR e.user_id = p_subject)
     AND (p_status IS NULL OR e.status = p_status) AND (p_from IS NULL OR e.entry_date >= p_from) AND (p_to IS NULL OR e.entry_date <= p_to);
  SELECT coalesce(jsonb_agg(x.j ORDER BY x.rn), '[]'::jsonb) INTO v_data FROM (
    SELECT row_number() OVER () rn, public.project_time_entry_public_json(e) j FROM (
      SELECT e.* FROM public.project_time_entries e
       WHERE e.workspace_id = p_ws AND (p_project IS NULL OR e.project_id = p_project) AND (p_subject IS NULL OR e.user_id = p_subject)
         AND (p_status IS NULL OR e.status = p_status) AND (p_from IS NULL OR e.entry_date >= p_from) AND (p_to IS NULL OR e.entry_date <= p_to)
       ORDER BY CASE WHEN p_ascending THEN e.entry_date END ASC, CASE WHEN NOT p_ascending THEN e.entry_date END DESC, e.id
       LIMIT v_lim OFFSET v_off) e) x;
  PERFORM techerp_api.leave();
  RETURN jsonb_build_object('data', v_data, 'total', v_total, 'limit', v_lim, 'offset', v_off);
END $function$;

CREATE OR REPLACE FUNCTION techerp_api.create_time_entry(p_key uuid, p_user uuid, p_ws uuid, p_idem text, p_hash text, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_prev public.api_idempotency_keys; v_row public.project_time_entries; v_out jsonb;
BEGIN
  PERFORM techerp_api.enter(p_key, p_user, p_ws);
  IF p_idem IS NULL OR length(p_idem) NOT BETWEEN 8 AND 200 THEN
    RAISE EXCEPTION 'IDEMPOTENCY_KEY_REQUIRED: envie Idempotency-Key (8 a 200 caracteres) ou external_id.' USING ERRCODE = '22023';
  END IF;
  IF p_hash IS NULL OR length(p_hash) NOT BETWEEN 16 AND 128 THEN RAISE EXCEPTION 'INVALID_INPUT: hash do pedido ausente.' USING ERRCODE = '22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_key::text || ':' || p_idem, 62));
  DELETE FROM public.api_idempotency_keys WHERE api_key_id = p_key AND expires_at < now();
  SELECT * INTO v_prev FROM public.api_idempotency_keys WHERE api_key_id = p_key AND idem_key = p_idem;
  IF FOUND THEN
    IF v_prev.request_hash <> p_hash THEN
      RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT: a mesma Idempotency-Key já foi usada com outro conteúdo.' USING ERRCODE = 'P0001';
    END IF;
    PERFORM techerp_api.leave();
    RETURN v_prev.response || jsonb_build_object('replay', true);
  END IF;
  v_row := public.project_time_entry_insert_checked(p_ws, p_payload, 'api');
  v_out := jsonb_build_object('data', public.project_time_entry_public_json(v_row));
  INSERT INTO public.api_idempotency_keys (workspace_id, api_key_id, idem_key, request_hash, endpoint, response)
  VALUES (p_ws, p_key, p_idem, p_hash, 'POST /v1/time-entries', v_out);
  PERFORM techerp_api.leave();
  RETURN v_out || jsonb_build_object('replay', false);
END $function$;

ALTER FUNCTION techerp_api.enter(uuid, uuid, uuid) OWNER TO techerp_api_subject;
ALTER FUNCTION techerp_api.leave() OWNER TO techerp_api_subject;
ALTER FUNCTION techerp_api.list_projects(uuid, uuid, uuid, text, text, integer, integer) OWNER TO techerp_api_subject;
ALTER FUNCTION techerp_api.list_tasks(uuid, uuid, uuid, uuid, text, text, integer, integer) OWNER TO techerp_api_subject;
ALTER FUNCTION techerp_api.list_time_entries(uuid, uuid, uuid, uuid, uuid, text, date, date, boolean, integer, integer) OWNER TO techerp_api_subject;
ALTER FUNCTION techerp_api.create_time_entry(uuid, uuid, uuid, text, text, jsonb) OWNER TO techerp_api_subject;
REVOKE EXECUTE ON FUNCTION techerp_api.enter(uuid, uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION techerp_api.leave() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION techerp_api.list_projects(uuid, uuid, uuid, text, text, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION techerp_api.list_tasks(uuid, uuid, uuid, uuid, text, text, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION techerp_api.list_time_entries(uuid, uuid, uuid, uuid, uuid, text, date, date, boolean, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION techerp_api.create_time_entry(uuid, uuid, uuid, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION techerp_api.enter(uuid, uuid, uuid) TO techerp_api_subject;
GRANT EXECUTE ON FUNCTION techerp_api.leave() TO techerp_api_subject;
GRANT EXECUTE ON FUNCTION techerp_api.list_projects(uuid, uuid, uuid, text, text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION techerp_api.list_tasks(uuid, uuid, uuid, uuid, text, text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION techerp_api.list_time_entries(uuid, uuid, uuid, uuid, uuid, text, date, date, boolean, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION techerp_api.create_time_entry(uuid, uuid, uuid, text, text, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.project_api_list_projects(p_key uuid, p_user uuid, p_ws uuid, p_status text, p_search text, p_limit integer, p_offset integer)
 RETURNS jsonb LANGUAGE sql SET search_path TO 'public', 'pg_temp'
AS $function$ SELECT techerp_api.list_projects(p_key, p_user, p_ws, p_status, p_search, p_limit, p_offset) $function$;
CREATE OR REPLACE FUNCTION public.project_api_list_tasks(p_key uuid, p_user uuid, p_ws uuid, p_project uuid, p_status text, p_search text, p_limit integer, p_offset integer)
 RETURNS jsonb LANGUAGE sql SET search_path TO 'public', 'pg_temp'
AS $function$ SELECT techerp_api.list_tasks(p_key, p_user, p_ws, p_project, p_status, p_search, p_limit, p_offset) $function$;
CREATE OR REPLACE FUNCTION public.project_api_list_time_entries(p_key uuid, p_user uuid, p_ws uuid, p_project uuid, p_subject uuid, p_status text,
                                                               p_from date, p_to date, p_ascending boolean, p_limit integer, p_offset integer)
 RETURNS jsonb LANGUAGE sql SET search_path TO 'public', 'pg_temp'
AS $function$ SELECT techerp_api.list_time_entries(p_key, p_user, p_ws, p_project, p_subject, p_status, p_from, p_to, p_ascending, p_limit, p_offset) $function$;
CREATE OR REPLACE FUNCTION public.project_api_create_time_entry(p_key uuid, p_user uuid, p_ws uuid, p_idem text, p_hash text, p_payload jsonb)
 RETURNS jsonb LANGUAGE sql SET search_path TO 'public', 'pg_temp'
AS $function$ SELECT techerp_api.create_time_entry(p_key, p_user, p_ws, p_idem, p_hash, p_payload) $function$;
REVOKE ALL ON FUNCTION public.project_api_list_projects(uuid, uuid, uuid, text, text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.project_api_list_tasks(uuid, uuid, uuid, uuid, text, text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.project_api_list_time_entries(uuid, uuid, uuid, uuid, uuid, text, date, date, boolean, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.project_api_create_time_entry(uuid, uuid, uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.project_api_list_projects(uuid, uuid, uuid, text, text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.project_api_list_tasks(uuid, uuid, uuid, uuid, text, text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.project_api_list_time_entries(uuid, uuid, uuid, uuid, uuid, text, date, date, boolean, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.project_api_create_time_entry(uuid, uuid, uuid, text, text, jsonb) TO service_role;

-- ============================================================ 7. operação (somente admin ativo; sem comando nem segredo de agendamento)
CREATE OR REPLACE FUNCTION public.project_ops_status(p_ws uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_uid uuid := auth.uid(); v_jobs jsonb; v_queues jsonb;
  v_expected text[] := ARRAY['deal-delivery-jobs','webhook-dispatch-tick','clockify-import-tick','project-alerts-tick',
                             'services-billing-tick','recurrences-tick','dunning-tick','cleanup-cron-logs-daily'];
BEGIN
  IF v_uid IS NULL OR NOT (p_ws IN (SELECT public.current_user_workspaces())) OR NOT public.is_active_workspace_admin(p_ws, v_uid) THEN
    RAISE EXCEPTION 'Somente administradores ativos do workspace veem a operação.' USING ERRCODE = '42501';
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'name', n.name, 'scheduled', j.jobid IS NOT NULL, 'active', coalesce(j.active, false), 'schedule', j.schedule,
           'last_run', (SELECT jsonb_build_object('status', d.status, 'started_at', d.start_time, 'finished_at', d.end_time)
                          FROM cron.job_run_details d WHERE d.jobid = j.jobid ORDER BY d.start_time DESC LIMIT 1),
           'last_log', (SELECT jsonb_build_object('status', l.status, 'started_at', l.started_at, 'duration_ms', l.duration_ms)
                          FROM public.cron_run_logs l WHERE l.job_name = n.name ORDER BY l.started_at DESC LIMIT 1))
         ORDER BY n.ord), '[]'::jsonb)
    INTO v_jobs
    FROM unnest(v_expected) WITH ORDINALITY n(name, ord) LEFT JOIN cron.job j ON j.jobname = n.name;
  v_queues := jsonb_build_object(
    'deal_delivery', (SELECT jsonb_build_object('by_status', coalesce(jsonb_object_agg(s, c), '{}'::jsonb),
        'oldest_pending', (SELECT min(created_at) FROM public.deal_delivery_jobs WHERE workspace_id = p_ws AND status = 'pending'),
        'expired_leases', (SELECT count(*) FROM public.deal_delivery_jobs WHERE workspace_id = p_ws AND status = 'running' AND lease_until < now()))
      FROM (SELECT status s, count(*) c FROM public.deal_delivery_jobs WHERE workspace_id = p_ws GROUP BY status) x),
    'webhooks', (SELECT jsonb_build_object('by_status', coalesce(jsonb_object_agg(s, c), '{}'::jsonb))
      FROM (SELECT status::text s, count(*) c FROM public.webhook_deliveries WHERE workspace_id = p_ws GROUP BY status) x),
    'imports', (SELECT coalesce(jsonb_agg(jsonb_build_object('status', r.status, 'started_at', r.started_at, 'finished_at', r.finished_at) ORDER BY r.started_at DESC), '[]'::jsonb)
      FROM (SELECT status, started_at, finished_at FROM public.clockify_import_runs WHERE workspace_id = p_ws ORDER BY started_at DESC NULLS LAST LIMIT 5) r),
    'alerts', (SELECT jsonb_build_object('last_run', max(started_at), 'runs', count(*)) FROM public.project_alert_runs WHERE workspace_id = p_ws));
  RETURN jsonb_build_object('generated_at', now(), 'jobs', v_jobs, 'queues', v_queues);
END $function$;
REVOKE ALL ON FUNCTION public.project_ops_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_ops_status(uuid) TO authenticated;

-- ============================================================ 8. webhooks: id de evento estável
ALTER TABLE public.webhook_deliveries ADD COLUMN IF NOT EXISTS event_id uuid DEFAULT gen_random_uuid();

-- ============================================================ 9. higiene de privilégios
REVOKE EXECUTE ON FUNCTION public.project_time_has_approver(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_time_has_approver(uuid, uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.project_time_approver_row_active(public.project_time_approvers, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_time_approver_row_active(public.project_time_approvers, date) TO authenticated, service_role;
