-- TechProjects Ciclo 5 (itens 12–13): painel por perfil com filtros e detalhamento; capacidade da equipe,
-- central de atenção (riscos/alertas versionados) e previsão de entrega.
-- Aditiva: 4 tabelas novas (regras versionadas, alertas, trilha, execuções) e funções. Nenhuma linha
-- existente é alterada; leituras não gravam nada. Escrita só pelas funções de alerta/regra abaixo.
-- Leituras do painel rodam como o usuário (RLS) sempre que possível; as poucas funções privilegiadas
-- reconferem workspace ativo, membership ativo e permissão antes de devolver agregados sem custo.

INSERT INTO public.permissions (key, module, resource, action, scope, label_pt, description, is_system) VALUES
 ('techprojects.alerts.view.workspace', 'techprojects', 'alerts', 'view', 'workspace',
  'Ver todos os alertas de projetos', 'Central de atenção completa do workspace (sem custos).', true),
 ('techprojects.alerts.manage.workspace', 'techprojects', 'alerts', 'manage', 'workspace',
  'Tratar alertas de projetos', 'Reconhecer, adiar, resolver e reavaliar alertas de qualquer projeto, com justificativa.', true),
 ('techprojects.risk_rules.manage.workspace', 'techprojects', 'risk_rules', 'manage', 'workspace',
  'Configurar regras de risco', 'Cria versões das regras de risco do workspace ou de um projeto.', true)
ON CONFLICT (key) DO NOTHING;

-- =========================================================== tabelas
CREATE TABLE public.project_risk_rule_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version > 0),
  rules jsonb NOT NULL,
  note text NOT NULL CHECK (length(btrim(note)) >= 5),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX project_risk_rule_versions_uniq
  ON public.project_risk_rule_versions (workspace_id, coalesce(project_id, '00000000-0000-0000-0000-000000000000'::uuid), version);

CREATE TABLE public.project_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  dedupe_key text NOT NULL,
  rule_key text NOT NULL,
  rule_version integer,
  severity text NOT NULL CHECK (severity IN ('low','medium','high')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','snoozed','resolved')),
  present boolean NOT NULL DEFAULT true,
  resolution text CHECK (resolution IS NULL OR resolution IN ('auto','manual')),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  person_id uuid REFERENCES public.people(id) ON DELETE CASCADE,
  deal_id uuid REFERENCES public.deals(id) ON DELETE CASCADE,
  subject_user_id uuid,
  owner_user_id uuid,
  period_from date,
  period_to date,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  first_detected_at timestamptz NOT NULL DEFAULT now(),
  last_detected_at timestamptz NOT NULL DEFAULT now(),
  snoozed_until date,
  resolved_at timestamptz,
  reopened_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, dedupe_key)
);
CREATE INDEX project_alerts_ws_status_idx ON public.project_alerts (workspace_id, status, severity);
CREATE INDEX project_alerts_project_idx ON public.project_alerts (project_id) WHERE project_id IS NOT NULL;
CREATE INDEX project_alerts_person_idx ON public.project_alerts (person_id) WHERE person_id IS NOT NULL;

CREATE TABLE public.project_alert_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  alert_id uuid NOT NULL REFERENCES public.project_alerts(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('detected','changed','reappeared','auto_resolved','acknowledged','snoozed','resolved','reopened','snooze_expired')),
  actor uuid,
  run_id uuid,
  note text,
  before jsonb,
  after jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX project_alert_events_alert_idx ON public.project_alert_events (alert_id, created_at);

CREATE TABLE public.project_alert_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  actor uuid,
  trigger text NOT NULL DEFAULT 'manual' CHECK (trigger IN ('manual','scheduled')),
  tz text NOT NULL,
  evaluated_on date NOT NULL,
  started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  finished_at timestamptz,
  counts jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX project_alert_runs_ws_idx ON public.project_alert_runs (workspace_id, started_at DESC);

GRANT SELECT ON public.project_risk_rule_versions TO authenticated;
GRANT SELECT ON public.project_alerts TO authenticated;
GRANT SELECT ON public.project_alert_events TO authenticated;
GRANT SELECT ON public.project_alert_runs TO authenticated;
GRANT ALL ON public.project_risk_rule_versions, public.project_alerts, public.project_alert_events, public.project_alert_runs TO service_role;
ALTER TABLE public.project_risk_rule_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_alert_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_alert_runs ENABLE ROW LEVEL SECURITY;

-- =========================================================== escopo
-- Workspace ativo único do usuário (nunca soma vários tenants).
CREATE OR REPLACE FUNCTION public.project_dash_ws()
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_n int; v uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sessão obrigatória.' USING ERRCODE = '42501'; END IF;
  SELECT count(*), min(w::text)::uuid INTO v_n, v FROM public.current_user_workspaces() AS w;
  IF v_n <> 1 THEN RAISE EXCEPTION 'Selecione um workspace ativo.' USING ERRCODE = '42501'; END IF;
  RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.project_dash_ws() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_dash_ws() TO authenticated;

CREATE OR REPLACE FUNCTION public.project_dash_full(p_ws uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.project_time_full_scope_workspaces() AS w(id) WHERE w.id = p_ws) $$;
REVOKE ALL ON FUNCTION public.project_dash_full(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_dash_full(uuid) TO authenticated;

-- Projetos liderados por p_user: responsável operacional (assigned_to), gestor do projeto ou aprovador vigente.
-- O criador do registro (owner_id) não é líder. Para outro usuário, só devolve projetos visíveis ao chamador.
CREATE OR REPLACE FUNCTION public.project_dash_leader_projects(p_ws uuid, p_user uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id FROM public.projects p
   WHERE auth.uid() IS NOT NULL AND p.workspace_id = p_ws
     AND p_ws IN (SELECT public.current_user_workspaces())
     AND (p.assigned_to = p_user
          OR EXISTS (SELECT 1 FROM public.project_members m WHERE m.project_id = p.id AND m.user_id = p_user AND m.role_in_project = 'manager')
          OR EXISTS (SELECT 1 FROM public.project_time_approvers a WHERE a.project_id = p.id AND a.user_id = p_user
                      AND public.project_time_approver_row_active(a, current_date)))
     AND (p_user = auth.uid() OR public.project_visible_to_current_user(p.id)) $$;
REVOKE ALL ON FUNCTION public.project_dash_leader_projects(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_dash_leader_projects(uuid, uuid) TO authenticated;

-- Escopo "Equipe/Entrega": tudo para visão completa de horas; senão, projetos que o usuário lidera.
CREATE OR REPLACE FUNCTION public.project_dash_team_projects(p_ws uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id FROM public.projects p WHERE p.workspace_id = p_ws AND public.project_dash_full(p_ws)
  UNION
  SELECT x FROM public.project_dash_leader_projects(p_ws, auth.uid()) x $$;
REVOKE ALL ON FUNCTION public.project_dash_team_projects(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_dash_team_projects(uuid) TO authenticated;

-- Projetos do próprio usuário: membro, alocação vigente, tarefa aberta atribuída ou apontamento nos últimos 90 dias.
CREATE OR REPLACE FUNCTION public.project_dash_my_projects(p_ws uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.project_id FROM public.project_members m WHERE m.workspace_id = p_ws AND m.user_id = auth.uid()
  UNION SELECT a.project_id FROM public.people_allocations a JOIN public.people pe ON pe.id = a.person_id
         WHERE a.workspace_id = p_ws AND pe.profile_id = auth.uid() AND a.project_id IS NOT NULL AND a.status = 'active'
           AND (a.ends_at IS NULL OR a.ends_at >= current_date)
  UNION SELECT t.project_id FROM public.project_tasks t WHERE t.workspace_id = p_ws AND t.status <> 'done'
           AND (t.assignee_id = auth.uid() OR auth.uid() = ANY (coalesce(t.assignee_ids, '{}')))
  UNION SELECT e.project_id FROM public.project_time_entries e WHERE e.workspace_id = p_ws AND e.user_id = auth.uid()
           AND e.entry_date >= current_date - 90 $$;
REVOKE ALL ON FUNCTION public.project_dash_my_projects(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_dash_my_projects(uuid) TO authenticated;

-- Projetos em que p_user participa (para o filtro Pessoa em listas de projeto), restritos aos visíveis.
CREATE OR REPLACE FUNCTION public.project_dash_person_projects(p_ws uuid, p_user uuid, p_from date, p_to date)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT x.id FROM (
    SELECT m.project_id id FROM public.project_members m WHERE m.workspace_id = p_ws AND m.user_id = p_user
    UNION SELECT a.project_id FROM public.people_allocations a JOIN public.people pe ON pe.id = a.person_id
           WHERE a.workspace_id = p_ws AND pe.profile_id = p_user AND a.project_id IS NOT NULL
             AND coalesce(a.starts_at, p_to) <= p_to AND (a.ends_at IS NULL OR a.ends_at >= p_from)
    UNION SELECT e.project_id FROM public.project_time_entries e
           WHERE e.workspace_id = p_ws AND e.user_id = p_user AND e.entry_date BETWEEN p_from AND p_to) x
   WHERE auth.uid() IS NOT NULL AND p_ws IN (SELECT public.current_user_workspaces())
     AND x.id IS NOT NULL AND public.project_visible_to_current_user(x.id) $$;
REVOKE ALL ON FUNCTION public.project_dash_person_projects(uuid, uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_dash_person_projects(uuid, uuid, date, date) TO authenticated;

-- Pessoa (People) alocada em projeto liderado pelo chamador: permite ver só o conflito agregado dela.
CREATE OR REPLACE FUNCTION public.project_dash_person_in_led(p_ws uuid, p_person uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.people_allocations a
     WHERE a.workspace_id = p_ws AND a.person_id = p_person AND a.project_id IN (SELECT public.project_dash_leader_projects(p_ws, auth.uid()))) $$;
REVOKE ALL ON FUNCTION public.project_dash_person_in_led(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_dash_person_in_led(uuid, uuid) TO authenticated;

-- Visões disponíveis (por permissão/carteira real, nunca pelo nome do cargo; admin não é o único caminho).
CREATE OR REPLACE FUNCTION public.project_dash_scope()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ws uuid := public.project_dash_ws(); v_uid uuid := auth.uid(); v_admin boolean; v_full boolean; v_led int;
BEGIN
  PERFORM public.project_time_assert_actor(v_ws, false);
  v_admin := public.is_active_workspace_admin(v_ws, v_uid);
  v_full := public.project_dash_full(v_ws);
  SELECT count(*) INTO v_led FROM public.project_dash_leader_projects(v_ws, v_uid);
  RETURN jsonb_build_object(
    'workspace_id', v_ws, 'user_id', v_uid, 'read_only', public.is_read_only_view(),
    'views', jsonb_build_object(
      'me', true,
      'team', v_full OR v_led > 0,
      'commercial', v_admin OR public.user_has_permission(v_uid, v_ws, 'techsales.deals.view.workspace')
                    OR public.user_has_permission(v_uid, v_ws, 'techsales.deals.view.team')
                    OR public.user_has_permission(v_uid, v_ws, 'techsales.deals.view.own'),
      'finance', public.user_has_permission(v_uid, v_ws, 'techprojects.measurements.view.workspace')
                 OR public.user_has_permission(v_uid, v_ws, 'techprojects.profitability.view.workspace'),
      'quality', v_admin),
    'team_scope', CASE WHEN v_full THEN 'workspace' WHEN v_led > 0 THEN 'led' ELSE 'none' END,
    'led_projects', v_led,
    'can_cost', public.user_has_permission(v_uid, v_ws, 'techprojects.rates.view.workspace')
                OR public.user_has_permission(v_uid, v_ws, 'techprojects.profitability.view.workspace'),
    'can_profitability', public.user_has_permission(v_uid, v_ws, 'techprojects.profitability.view.workspace'),
    'can_manage_alerts', v_admin OR public.user_has_permission(v_uid, v_ws, 'techprojects.alerts.manage.workspace'),
    'can_view_all_alerts', v_admin OR public.user_has_permission(v_uid, v_ws, 'techprojects.alerts.view.workspace'),
    'can_manage_rules', v_admin OR public.user_has_permission(v_uid, v_ws, 'techprojects.risk_rules.manage.workspace'),
    'can_export', v_admin OR public.user_has_permission(v_uid, v_ws, 'techprojects.projects.export.workspace'),
    -- Recebimentos (financial_payments) seguem a RLS do Financeiro: sem acesso, o painel diz "sem acesso", nunca 0.
    'can_received', public.is_workspace_admin_v2(v_ws, v_uid) OR public.user_has_permission(v_uid, v_ws, 'finance.read'),
    'can_open_center', v_admin);
END $$;
REVOKE ALL ON FUNCTION public.project_dash_scope() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_dash_scope() TO authenticated;

-- Filtros: período/fuso validados; cada id revalidado como visível ao usuário (RLS) e do workspace ativo.
CREATE OR REPLACE FUNCTION public.project_dash_f(p jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE v_ws uuid := public.project_dash_ws(); v_from date; v_to date; v_tz text := coalesce(p->>'tz', '');
  v_today date; r jsonb; k text; v uuid; v_ok boolean;
BEGIN
  BEGIN v_from := (p->>'from')::date; v_to := (p->>'to')::date;
  EXCEPTION WHEN others THEN RAISE EXCEPTION 'Período inválido.' USING ERRCODE = '22023'; END;
  IF v_from IS NULL OR v_to IS NULL OR v_from > v_to THEN
    RAISE EXCEPTION 'Período inválido: a data inicial deve ser anterior ou igual à final.' USING ERRCODE = '22023';
  END IF;
  IF v_to - v_from > 3700 THEN RAISE EXCEPTION 'Período máximo de 10 anos.' USING ERRCODE = '22023'; END IF;
  IF v_tz !~ '^[A-Za-z_]+(/[A-Za-z0-9_+\-]+){0,2}$' THEN RAISE EXCEPTION 'Fuso horário inválido.' USING ERRCODE = '22023'; END IF;
  BEGIN v_today := (now() AT TIME ZONE v_tz)::date;
  EXCEPTION WHEN others THEN RAISE EXCEPTION 'Fuso horário inválido.' USING ERRCODE = '22023'; END;
  r := jsonb_build_object('ws', v_ws, 'from', v_from, 'to', v_to, 'tz', v_tz, 'today', v_today,
                          'compare', coalesce((p->>'compare')::boolean, false));
  FOREACH k IN ARRAY ARRAY['project','company','service','leader','person'] LOOP
    IF nullif(p->>k, '') IS NOT NULL THEN
      BEGIN v := (p->>k)::uuid;
      EXCEPTION WHEN others THEN RAISE EXCEPTION 'Filtro inválido: %.', k USING ERRCODE = '22023'; END;
      v_ok := CASE k
        WHEN 'project' THEN EXISTS (SELECT 1 FROM public.projects x WHERE x.id = v AND x.workspace_id = v_ws)
        WHEN 'company' THEN EXISTS (SELECT 1 FROM public.companies x WHERE x.id = v AND x.workspace_id = v_ws)
        WHEN 'service' THEN EXISTS (SELECT 1 FROM public.services x WHERE x.id = v AND x.workspace_id = v_ws)
        ELSE EXISTS (SELECT 1 FROM public.workspace_members x WHERE x.user_id = v AND x.workspace_id = v_ws) END;
      IF NOT v_ok THEN RAISE EXCEPTION 'Filtro sem acesso ou de outro workspace: %.', k USING ERRCODE = '42501'; END IF;
      r := r || jsonb_build_object(k, v);
    END IF;
  END LOOP;
  IF nullif(p->>'origin', '') IS NOT NULL THEN
    IF p->>'origin' NOT IN ('manual','timer','clockify','jibble','import_other') THEN
      RAISE EXCEPTION 'Origem inválida.' USING ERRCODE = '22023'; END IF;
    r := r || jsonb_build_object('origin', p->>'origin');
  END IF;
  IF nullif(p->>'status', '') IS NOT NULL THEN
    IF p->>'status' NOT IN ('draft','submitted','approved','rejected','locked','locked_import') THEN
      RAISE EXCEPTION 'Situação inválida.' USING ERRCODE = '22023'; END IF;
    r := r || jsonb_build_object('status', p->>'status');
  END IF;
  IF nullif(p->>'currency', '') IS NOT NULL THEN
    IF upper(p->>'currency') !~ '^[A-Z]{3}$' THEN RAISE EXCEPTION 'Moeda inválida.' USING ERRCODE = '22023'; END IF;
    r := r || jsonb_build_object('currency', upper(p->>'currency'));
  END IF;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.project_dash_f(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_dash_f(jsonb) TO authenticated;

-- =========================================================== conjuntos (fonte única de cartões e listas)
-- Cada conjunto devolve as linhas do escopo com o vetor `m` de indicadores a que a linha pertence.
-- Cartão = contagem/soma por indicador; lista = mesmas linhas filtradas pelo indicador (mesma função).
--
-- Visibilidade: as políticas RLS de apontamentos/tarefas/marcos/projetos chamam user_has_permission por LINHA
-- (dezenas de segundos em 100 mil linhas). `project_dash_vis` calcula uma vez as MESMAS condições daquelas
-- políticas (ws ativo, admin_v2, chaves, escopo liderado) e os conjuntos as aplicam como constantes.
-- A prova isolada confere, por usuário, que o conjunto = o que a RLS devolve (equivalência exata).
CREATE OR REPLACE FUNCTION public.project_dash_vis()
RETURNS TABLE(ws uuid, uid uuid, recon boolean, te_perm boolean, te_full boolean, te_led uuid[], te_pairs text[],
              tk_all boolean, pr_all boolean, ms_all boolean, team uuid[], mine uuid[],
              dl_ws boolean, dl_team boolean, dl_own boolean, dl_team_ids uuid[], dl_restricted boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ws uuid := public.project_dash_ws(); v_uid uuid := auth.uid(); v_adm boolean;
BEGIN
  PERFORM public.project_time_assert_actor(v_ws, false);
  v_adm := public.is_workspace_admin_v2(v_ws, v_uid);
  RETURN QUERY SELECT v_ws, v_uid,
    public.is_active_workspace_admin(v_ws, v_uid),
    -- ptime_perm_select
    v_adm OR public.user_has_permission(v_uid, v_ws, 'techprojects.time_entries.view.workspace')
          OR public.user_has_permission(v_uid, v_ws, 'techprojects.time_entries.view.own')
          OR public.user_has_permission(v_uid, v_ws, 'techpeople.timesheet.view.workspace')
          OR public.user_has_permission(v_uid, v_ws, 'techpeople.timesheet.view.own'),
    -- ptime_scope_select
    EXISTS (SELECT 1 FROM public.project_time_full_scope_workspaces() w WHERE w = v_ws),
    ARRAY(SELECT s.project_id FROM public.project_time_led_scope() s WHERE s.subject_user_id IS NULL),
    ARRAY(SELECT s.project_id::text || ':' || s.subject_user_id::text FROM public.project_time_led_scope() s WHERE s.subject_user_id IS NOT NULL),
    -- project_tasks_perm_select (sem a parte assignee_id, aplicada por linha)
    v_adm OR public.user_has_permission(v_uid, v_ws, 'techprojects.tasks.view.workspace')
          OR public.user_has_permission(v_uid, v_ws, 'techprojects.tasks.view.own'),
    -- projects_perm_select (sem a parte owner_id)
    v_adm OR public.user_has_permission(v_uid, v_ws, 'techprojects.projects.view.workspace')
          OR public.user_has_permission(v_uid, v_ws, 'techprojects.projects.view.own'),
    -- pmilestones_perm_write (ALL, restritiva)
    v_adm OR public.user_has_permission(v_uid, v_ws, 'techprojects.milestones.view.workspace'),
    ARRAY(SELECT public.project_dash_team_projects(v_ws)),
    ARRAY(SELECT public.project_dash_my_projects(v_ws)),
    -- deal_visible_to_current_user
    public.user_has_permission(v_uid, v_ws, 'techsales.deals.view.workspace'),
    public.user_has_permission(v_uid, v_ws, 'techsales.deals.view.team'),
    public.user_has_permission(v_uid, v_ws, 'techsales.deals.view.own'),
    ARRAY(SELECT public.my_team_member_ids()),
    v_ws IN (SELECT public.rep_restricted_workspaces());
END $$;
REVOKE ALL ON FUNCTION public.project_dash_vis() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_dash_vis() TO authenticated;

CREATE OR REPLACE FUNCTION public.project_dash_ds_entries(p_view text, f jsonb, p_prev boolean DEFAULT false)
RETURNS TABLE(id uuid, entry_date date, project_id uuid, user_id uuid, secs numeric, k text, origin text, billable boolean, m text[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH v AS MATERIALIZED (SELECT * FROM public.project_dash_vis()),
  b AS MATERIALIZED (
    SELECT v.*,
           CASE WHEN p_prev THEN (f->>'from')::date - ((f->>'to')::date - (f->>'from')::date + 1) ELSE (f->>'from')::date END d0,
           CASE WHEN p_prev THEN (f->>'from')::date - 1 ELSE (f->>'to')::date END d1,
           nullif(f->>'project', '')::uuid pj, nullif(f->>'company', '')::uuid co, nullif(f->>'service', '')::uuid sv,
           nullif(f->>'person', '')::uuid pe, nullif(f->>'origin', '') og, nullif(f->>'status', '') st,
           CASE WHEN nullif(f->>'leader', '') IS NOT NULL THEN ARRAY(SELECT public.project_dash_leader_projects(v.ws, (f->>'leader')::uuid)) END ld
      FROM v),
  iss AS (
    SELECT DISTINCT i.time_entry_id FROM public.project_reconciliation_issues i, b
     WHERE b.recon AND i.workspace_id = b.ws AND i.present AND i.status IN ('open','deferred') AND i.time_entry_id IS NOT NULL
       AND i.entry_date BETWEEN b.d0 AND b.d1),
  e AS (
    SELECT e.id, e.entry_date, e.project_id, e.user_id, e.billable, e.review_flags,
           coalesce(e.duration_seconds::numeric, public.project_entry_seconds(e.started_at, e.stopped_at, e.duration_minutes, e.hours)) AS secs,
           CASE WHEN e.status = 'locked' AND e.source = 'import' THEN 'locked_import' ELSE e.status END AS k,
           CASE WHEN e.timer_session_id IS NOT NULL OR e.source = 'timer' THEN 'timer'
                WHEN e.source = 'import' AND e.external_id LIKE 'clockify:%' THEN 'clockify'
                WHEN e.source = 'import' AND e.external_id LIKE 'jibble:%' THEN 'jibble'
                WHEN e.source IN ('import','integration','api') THEN 'import_other'
                ELSE 'manual' END AS origin
      FROM public.project_time_entries e CROSS JOIN b
      LEFT JOIN public.projects pr ON pr.id = e.project_id
     WHERE e.workspace_id = b.ws AND e.entry_date BETWEEN b.d0 AND b.d1
       AND b.te_perm AND (e.user_id = b.uid OR b.te_full OR e.project_id = ANY (b.te_led)
                          OR (e.project_id::text || ':' || e.user_id::text) = ANY (b.te_pairs))
       AND (p_view <> 'me' OR e.user_id = b.uid)
       AND (p_view <> 'team' OR e.project_id = ANY (b.team))
       AND (b.pj IS NULL OR e.project_id = b.pj)
       AND (b.co IS NULL OR pr.company_id = b.co)
       AND (b.sv IS NULL OR pr.service_id = b.sv)
       AND (b.ld IS NULL OR e.project_id = ANY (b.ld))
       AND (b.pe IS NULL OR e.user_id = b.pe))
  SELECT e.id, e.entry_date, e.project_id, e.user_id, e.secs, e.k, e.origin, e.billable,
         array_remove(ARRAY['total', e.k, 'origin_' || e.origin,
           CASE WHEN iss.time_entry_id IS NOT NULL THEN 'in_review' END,
           CASE WHEN e.k IN ('approved','locked') THEN 'validated' END,
           CASE WHEN e.k = 'submitted' THEN 'awaiting_review' END,
           CASE WHEN e.k IN ('draft','rejected') THEN 'pending_mine' END,
           CASE WHEN coalesce(array_length(e.review_flags, 1), 0) > 0 THEN 'flagged' END,
           CASE WHEN e.billable THEN 'billable' END], NULL)
    FROM e CROSS JOIN b LEFT JOIN iss ON iss.time_entry_id = e.id
   WHERE (b.og IS NULL OR e.origin = b.og) AND (b.st IS NULL OR e.k = b.st) $$;
REVOKE ALL ON FUNCTION public.project_dash_ds_entries(text, jsonb, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_dash_ds_entries(text, jsonb, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.project_dash_ds_projects(p_view text, f jsonb)
RETURNS TABLE(id uuid, name text, status text, due_at date, planned_hours numeric, assigned_to uuid, company_id uuid,
              deal_id uuid, created_at timestamptz, kind text, m text[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH v AS MATERIALIZED (SELECT * FROM public.project_dash_vis()),
  b AS MATERIALIZED (
    SELECT v.*, (f->>'from')::date d0, (f->>'to')::date d1, (f->>'today')::date td,
           nullif(f->>'project', '')::uuid pj, nullif(f->>'company', '')::uuid co, nullif(f->>'service', '')::uuid sv,
           CASE WHEN nullif(f->>'leader', '') IS NOT NULL THEN ARRAY(SELECT public.project_dash_leader_projects(v.ws, (f->>'leader')::uuid)) END ld,
           CASE WHEN nullif(f->>'person', '') IS NOT NULL THEN ARRAY(SELECT public.project_dash_person_projects(v.ws, (f->>'person')::uuid, (f->>'from')::date, (f->>'to')::date)) END pe
      FROM v),
  p AS (
    SELECT p.id, p.name, p.status::text AS st, p.due_at, p.planned_hours, p.assigned_to, p.company_id, p.deal_id, p.created_at,
           t.delivery_kind AS kind, b.td
      FROM public.projects p CROSS JOIN b
      LEFT JOIN public.project_delivery_template_versions tv ON tv.id = p.delivery_template_version_id
      LEFT JOIN public.project_delivery_templates t ON t.id = tv.template_id
     WHERE p.workspace_id = b.ws AND (p.owner_id = b.uid OR b.pr_all)
       AND (p_view <> 'me' OR p.id = ANY (b.mine))
       AND (p_view <> 'team' OR p.id = ANY (b.team))
       AND (b.pj IS NULL OR p.id = b.pj) AND (b.co IS NULL OR p.company_id = b.co) AND (b.sv IS NULL OR p.service_id = b.sv)
       AND (b.ld IS NULL OR p.id = ANY (b.ld))
       AND (b.pe IS NULL OR p.id = ANY (b.pe)))
  SELECT p.id, p.name, p.st, p.due_at, p.planned_hours, p.assigned_to, p.company_id, p.deal_id, p.created_at, p.kind,
         array_remove(ARRAY['all', 'status_' || p.st,
           CASE WHEN p.st = 'active' THEN 'active_now' END,
           CASE WHEN p.st IN ('active','planning','on_hold') THEN 'open' END,
           CASE WHEN p.st IN ('active','planning') AND p.due_at IS NOT NULL AND p.due_at < p.td THEN 'overdue' END,
           CASE WHEN p.st IN ('active','planning') AND p.due_at IS NOT NULL AND p.due_at BETWEEN p.td AND p.td + 30 THEN 'due_soon' END,
           CASE WHEN p.st IN ('active','planning') AND p.assigned_to IS NULL THEN 'no_owner' END,
           CASE WHEN p.st IN ('active','planning','on_hold') AND p.company_id IS NULL THEN 'no_company' END,
           CASE WHEN p.company_id IS NULL THEN 'no_company_any' END,
           CASE WHEN p.st = 'active' AND NOT public.project_time_has_approver(p.id, NULL) THEN 'no_approver' END,
           CASE WHEN p.st IN ('active','planning','on_hold') AND p.kind IS NULL THEN 'no_template' END,
           CASE WHEN p.deal_id IS NOT NULL THEN 'from_deal' END], NULL)
    FROM p $$;
REVOKE ALL ON FUNCTION public.project_dash_ds_projects(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_dash_ds_projects(text, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.project_dash_ds_tasks(p_view text, f jsonb)
RETURNS TABLE(id uuid, title text, project_id uuid, status text, due_at date, assignee_id uuid, estimated_hours numeric, m text[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH v AS MATERIALIZED (SELECT * FROM public.project_dash_vis()),
  b AS MATERIALIZED (
    SELECT v.*, (f->>'today')::date td,
           nullif(f->>'project', '')::uuid pj, nullif(f->>'company', '')::uuid co, nullif(f->>'service', '')::uuid sv,
           nullif(f->>'person', '')::uuid pe,
           CASE WHEN nullif(f->>'leader', '') IS NOT NULL THEN ARRAY(SELECT public.project_dash_leader_projects(v.ws, (f->>'leader')::uuid)) END ld
      FROM v),
  t AS (
    SELECT t.id, t.title, t.project_id, t.status::text AS st, t.due_at, t.assignee_id, t.estimated_hours,
           (pr.status::text IN ('active','planning','on_hold')) AS live, b.td
      FROM public.project_tasks t CROSS JOIN b
      LEFT JOIN public.projects pr ON pr.id = t.project_id
     WHERE t.workspace_id = b.ws AND (t.assignee_id = b.uid OR b.tk_all)
       AND (p_view <> 'me' OR t.assignee_id = b.uid OR b.uid = ANY (coalesce(t.assignee_ids, '{}')))
       AND (p_view <> 'team' OR t.project_id = ANY (b.team))
       AND (b.pj IS NULL OR t.project_id = b.pj) AND (b.co IS NULL OR pr.company_id = b.co) AND (b.sv IS NULL OR pr.service_id = b.sv)
       AND (b.ld IS NULL OR t.project_id = ANY (b.ld))
       AND (b.pe IS NULL OR t.assignee_id = b.pe OR b.pe = ANY (coalesce(t.assignee_ids, '{}'))))
  SELECT t.id, t.title, t.project_id, t.st, t.due_at, t.assignee_id, t.estimated_hours,
         array_remove(ARRAY['all',
           CASE WHEN t.st = 'done' THEN 'done' END,
           CASE WHEN t.st <> 'done' AND t.live THEN 'open' END,
           CASE WHEN t.st <> 'done' AND NOT coalesce(t.live, false) THEN 'open_in_closed_project' END,
           CASE WHEN t.st <> 'done' AND t.live AND t.due_at IS NOT NULL AND t.due_at < t.td THEN 'overdue' END,
           CASE WHEN t.st <> 'done' AND t.live AND t.due_at BETWEEN t.td AND t.td + 14 THEN 'due_soon' END,
           CASE WHEN t.st <> 'done' AND t.live AND t.estimated_hours IS NULL THEN 'no_estimate' END], NULL)
    FROM t $$;
REVOKE ALL ON FUNCTION public.project_dash_ds_tasks(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_dash_ds_tasks(text, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.project_dash_ds_milestones(p_view text, f jsonb)
RETURNS TABLE(id uuid, name text, project_id uuid, status text, due_at date, assigned_to uuid, m text[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH v AS MATERIALIZED (SELECT * FROM public.project_dash_vis()),
  b AS MATERIALIZED (
    SELECT v.*, (f->>'today')::date td,
           nullif(f->>'project', '')::uuid pj, nullif(f->>'company', '')::uuid co, nullif(f->>'service', '')::uuid sv,
           nullif(f->>'person', '')::uuid pe,
           CASE WHEN nullif(f->>'leader', '') IS NOT NULL THEN ARRAY(SELECT public.project_dash_leader_projects(v.ws, (f->>'leader')::uuid)) END ld
      FROM v)
  SELECT x.id, x.name, x.project_id, x.status::text, x.due_at, x.assigned_to,
         array_remove(ARRAY['all',
           CASE WHEN x.status::text = 'done' THEN 'done' END,
           CASE WHEN x.status::text NOT IN ('done','cancelled') AND pr.status::text IN ('active','planning','on_hold') THEN 'open' END,
           CASE WHEN x.status::text NOT IN ('done','cancelled') AND pr.status::text IN ('active','planning','on_hold')
                     AND x.due_at < b.td THEN 'overdue' END,
           CASE WHEN x.status::text NOT IN ('done','cancelled') AND pr.status::text IN ('active','planning','on_hold')
                     AND x.due_at BETWEEN b.td AND b.td + 14 THEN 'due_soon' END], NULL)
    FROM public.project_milestones x CROSS JOIN b
    LEFT JOIN public.projects pr ON pr.id = x.project_id
   WHERE x.workspace_id = b.ws AND b.ms_all
     AND (p_view <> 'me' OR x.assigned_to = b.uid)
     AND (p_view <> 'team' OR x.project_id = ANY (b.team))
     AND (b.pj IS NULL OR x.project_id = b.pj) AND (b.co IS NULL OR pr.company_id = b.co) AND (b.sv IS NULL OR pr.service_id = b.sv)
     AND (b.ld IS NULL OR x.project_id = ANY (b.ld))
     AND (b.pe IS NULL OR x.assigned_to = b.pe) $$;
REVOKE ALL ON FUNCTION public.project_dash_ds_milestones(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_dash_ds_milestones(text, jsonb) TO authenticated;

-- Capacidade por PESSOA ÚNICA (People). Jornada de people.work_schedule (segundos por dia da semana, data local);
-- nula = desconhecida. Alocações vigentes por dia (pct da jornada ou horas/semana proporcionais à jornada).
-- Feriados/ausências: não há cadastro no TechPeople — nada é descontado (sinalizado pela tela).
-- Privilegiada só para somar alocações de projetos ocultos como número agregado ("outras alocações").
CREATE OR REPLACE FUNCTION public.project_dash_capacity_base(p_view text, f jsonb)
RETURNS TABLE(person_id uuid, user_id uuid, name text, person_status text, schedule_known boolean,
              contracted numeric, allocated_total numeric, allocated_scope numeric, expected_scope_to_date numeric,
              overbooked_days integer, max_load_pct numeric, unquantified integer, allocations_scope integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ws uuid := (f->>'ws')::uuid; v_full boolean; v_d0 date := (f->>'from')::date; v_d1 date := (f->>'to')::date;
  v_td date := (f->>'today')::date; v_pj uuid := nullif(f->>'project', '')::uuid; v_co uuid := nullif(f->>'company', '')::uuid;
  v_sv uuid := nullif(f->>'service', '')::uuid; v_ld uuid := nullif(f->>'leader', '')::uuid; v_pe uuid := nullif(f->>'person', '')::uuid;
BEGIN
  IF v_ws IS DISTINCT FROM public.project_dash_ws() THEN RAISE EXCEPTION 'Workspace inválido.' USING ERRCODE = '42501'; END IF;
  PERFORM public.project_time_assert_actor(v_ws, false);
  IF v_d1 - v_d0 > 400 THEN RAISE EXCEPTION 'Capacidade: período máximo de 400 dias.' USING ERRCODE = '22023'; END IF;
  v_full := public.project_dash_full(v_ws);
  IF p_view = 'team' AND NOT (v_full OR EXISTS (SELECT 1 FROM public.project_dash_leader_projects(v_ws, auth.uid()))) THEN
    RAISE EXCEPTION 'Sem acesso à visão Equipe.' USING ERRCODE = '42501';
  END IF;
  IF p_view NOT IN ('me','team') THEN RAISE EXCEPTION 'Capacidade só nas visões Meu trabalho e Equipe.' USING ERRCODE = '22023'; END IF;
  RETURN QUERY
  WITH sp AS (
    SELECT p.id FROM public.projects p
     WHERE p.workspace_id = v_ws
       AND (p_view = 'me' OR p.id IN (SELECT public.project_dash_team_projects(v_ws)))
       AND (v_pj IS NULL OR p.id = v_pj) AND (v_co IS NULL OR p.company_id = v_co) AND (v_sv IS NULL OR p.service_id = v_sv)
       AND (v_ld IS NULL OR p.id IN (SELECT public.project_dash_leader_projects(v_ws, v_ld)))),
  ppl AS (
    SELECT pe.id, pe.profile_id, coalesce(nullif(btrim(pe.preferred_name), ''), pe.full_name) AS nm, pe.status::text AS st,
           pe.work_schedule ws, pe.hire_date, pe.termination_date
      FROM public.people pe
     WHERE pe.workspace_id = v_ws AND NOT coalesce(pe.archived, false)
       AND (v_pe IS NULL OR pe.profile_id = v_pe)
       AND CASE WHEN p_view = 'me' THEN pe.profile_id = auth.uid()
           ELSE (EXISTS (SELECT 1 FROM public.people_allocations a WHERE a.person_id = pe.id AND a.workspace_id = v_ws
                          AND a.project_id IN (SELECT id FROM sp) AND a.status IN ('active','paused')
                          AND coalesce(a.starts_at, v_d1) <= v_d1 AND (a.ends_at IS NULL OR a.ends_at >= v_d0))
                 OR (pe.profile_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.project_time_entries e
                          WHERE e.workspace_id = v_ws AND e.user_id = pe.profile_id AND e.entry_date BETWEEN v_d0 AND v_d1
                            AND e.project_id IN (SELECT id FROM sp))))
           END),
  days AS (
    SELECT q.id pid, d::date AS day,
           CASE WHEN q.ws IS NULL OR q.st = 'on_leave' OR (q.st = 'terminated' AND q.termination_date IS NULL) THEN NULL
                WHEN (q.hire_date IS NOT NULL AND d::date < q.hire_date) OR (q.termination_date IS NOT NULL AND d::date > q.termination_date) THEN 0
                ELSE coalesce((q.ws->>((ARRAY['sun','mon','tue','wed','thu','fri','sat'])[extract(dow FROM d)::int + 1]))::numeric, 0) END AS cap,
           (SELECT sum(coalesce((q.ws->>k)::numeric, 0)) FROM unnest(ARRAY['sun','mon','tue','wed','thu','fri','sat']) k) AS wcap
      FROM ppl q CROSS JOIN generate_series(v_d0, v_d1, interval '1 day') d),
  al AS (
    SELECT a.id, a.person_id, a.allocation_pct, a.hours_per_week, a.starts_at, a.ends_at, (a.project_id IN (SELECT id FROM sp)) AS in_scope
      FROM public.people_allocations a
     WHERE a.workspace_id = v_ws AND a.person_id IN (SELECT id FROM ppl) AND a.status = 'active'),
  dl AS (
    SELECT dy.pid, dy.day, dy.cap,
           sum(CASE WHEN a.allocation_pct IS NOT NULL THEN dy.cap * a.allocation_pct / 100
                    WHEN a.hours_per_week IS NOT NULL AND dy.wcap > 0 THEN a.hours_per_week * 3600 * dy.cap / dy.wcap END) AS at,
           sum(CASE WHEN a.allocation_pct IS NOT NULL THEN dy.cap * a.allocation_pct / 100
                    WHEN a.hours_per_week IS NOT NULL AND dy.wcap > 0 THEN a.hours_per_week * 3600 * dy.cap / dy.wcap END)
             FILTER (WHERE a.in_scope) AS asc_,
           count(a.id) FILTER (WHERE a.allocation_pct IS NULL AND a.hours_per_week IS NULL) AS unq,
           count(a.id) FILTER (WHERE a.in_scope) AS nsc
      FROM days dy
      LEFT JOIN al a ON a.person_id = dy.pid AND coalesce(a.starts_at, dy.day) <= dy.day AND (a.ends_at IS NULL OR a.ends_at >= dy.day)
     GROUP BY dy.pid, dy.day, dy.cap)
  SELECT q.id, q.profile_id, q.nm, q.st,
         (q.ws IS NOT NULL AND q.st <> 'on_leave' AND NOT (q.st = 'terminated' AND q.termination_date IS NULL)),
         CASE WHEN bool_and(dl.cap IS NOT NULL) THEN sum(dl.cap) END,
         CASE WHEN bool_and(dl.cap IS NOT NULL) THEN coalesce(sum(dl.at), 0) END,
         CASE WHEN bool_and(dl.cap IS NOT NULL) THEN coalesce(sum(dl.asc_), 0) END,
         CASE WHEN bool_and(dl.cap IS NOT NULL) THEN coalesce(sum(dl.asc_) FILTER (WHERE dl.day <= v_td), 0) END,
         count(*) FILTER (WHERE dl.cap > 0 AND coalesce(dl.at, 0) > dl.cap + 1)::int,
         max(CASE WHEN dl.cap > 0 THEN round(coalesce(dl.at, 0) / dl.cap * 100, 1) END),
         max(dl.unq)::int,
         max(dl.nsc)::int
    FROM ppl q JOIN dl ON dl.pid = q.id
   WHERE p_view = 'me' OR v_full OR public.can_view_person(q.id) OR public.project_dash_person_in_led(v_ws, q.id)
   GROUP BY q.id, q.profile_id, q.nm, q.st, q.ws, q.termination_date;
END $$;
REVOKE ALL ON FUNCTION public.project_dash_capacity_base(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_dash_capacity_base(text, jsonb) TO authenticated;

-- Pessoas: capacidade + horas registradas vindas do MESMO conjunto de apontamentos (RLS do usuário).
CREATE OR REPLACE FUNCTION public.project_dash_ds_people(p_view text, f jsonb)
RETURNS TABLE(person_id uuid, user_id uuid, name text, person_status text, schedule_known boolean,
              contracted numeric, allocated_total numeric, allocated_scope numeric, other_allocated numeric,
              available numeric, registered numeric, submitted numeric, gap numeric,
              overbooked_days integer, max_load_pct numeric, secs numeric, m text[])
LANGUAGE sql STABLE SET search_path = public AS $$
  WITH c AS (SELECT * FROM public.project_dash_capacity_base(p_view, f)),
  e AS (SELECT x.user_id, sum(x.secs) AS reg, sum(x.secs) FILTER (WHERE x.k = 'submitted') AS sub,
               sum(x.secs) FILTER (WHERE x.entry_date <= (f->>'today')::date) AS reg_td
          FROM public.project_dash_ds_entries(p_view, f) x WHERE x.k <> 'rejected' GROUP BY x.user_id)
  SELECT c.person_id, c.user_id, c.name, c.person_status, c.schedule_known, c.contracted, c.allocated_total, c.allocated_scope,
         c.allocated_total - c.allocated_scope,
         CASE WHEN c.contracted IS NOT NULL THEN c.contracted - c.allocated_total END,
         coalesce(e.reg, 0), coalesce(e.sub, 0),
         CASE WHEN c.expected_scope_to_date IS NOT NULL THEN greatest(0, c.expected_scope_to_date - coalesce(e.reg_td, 0)) END,
         c.overbooked_days, c.max_load_pct, coalesce(e.reg, 0),
         array_remove(ARRAY['all',
           CASE WHEN c.person_status IN ('active','bench','offboarding') THEN 'active' ELSE 'inactive' END,
           CASE WHEN NOT c.schedule_known THEN 'no_schedule' END,
           CASE WHEN c.overbooked_days > 0 THEN 'overbooked' END,
           CASE WHEN c.expected_scope_to_date IS NOT NULL AND c.expected_scope_to_date - coalesce(e.reg_td, 0) > 0 THEN 'gap' END,
           CASE WHEN c.person_status NOT IN ('active','bench','offboarding') AND coalesce(e.reg, 0) > 0 THEN 'inactive_with_hours' END,
           CASE WHEN c.unquantified > 0 THEN 'unquantified' END,
           CASE WHEN coalesce(e.sub, 0) > 0 THEN 'awaiting_review' END], NULL)
    FROM c LEFT JOIN e ON e.user_id = c.user_id $$;
REVOKE ALL ON FUNCTION public.project_dash_ds_people(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_dash_ds_people(text, jsonb) TO authenticated;

-- Alocações vigentes do próprio usuário (sem tarifas). Projeto oculto aparece sem nome.
CREATE OR REPLACE FUNCTION public.project_dash_my_allocations(f jsonb)
RETURNS TABLE(id uuid, project_id uuid, project_name text, role_title text, allocation_pct numeric, hours_per_week numeric,
              starts_at date, ends_at date, can_track_time boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.id, a.project_id,
         CASE WHEN a.project_id IS NOT NULL AND public.project_visible_to_current_user(a.project_id)
              THEN (SELECT p.name FROM public.projects p WHERE p.id = a.project_id) END,
         a.role_title, a.allocation_pct, a.hours_per_week, a.starts_at, a.ends_at, a.can_track_time
    FROM public.people_allocations a JOIN public.people pe ON pe.id = a.person_id
   WHERE (f->>'ws')::uuid = public.project_dash_ws() AND a.workspace_id = (f->>'ws')::uuid AND pe.profile_id = auth.uid()
     AND a.status = 'active' AND coalesce(a.starts_at, (f->>'to')::date) <= (f->>'to')::date
     AND (a.ends_at IS NULL OR a.ends_at >= (f->>'from')::date) $$;
REVOKE ALL ON FUNCTION public.project_dash_my_allocations(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_dash_my_allocations(jsonb) TO authenticated;

-- Comercial: ganhos visíveis ao usuário (deal_visible_to_current_user), sem valores nem custos.
CREATE OR REPLACE FUNCTION public.project_dash_ds_deals(f jsonb)
RETURNS TABLE(id uuid, name text, closed_at timestamptz, owner_id uuid, company_id uuid, after_policy boolean,
              project_count integer, visible_project_id uuid, visible_project_name text, project_status text,
              contract_status text, transition_seconds numeric, job_status text, m text[])
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ws uuid := (f->>'ws')::uuid; v_tz text := f->>'tz'; v_act timestamptz; v_on boolean;
BEGIN
  IF v_ws IS DISTINCT FROM public.project_dash_ws() THEN RAISE EXCEPTION 'Workspace inválido.' USING ERRCODE = '42501'; END IF;
  PERFORM public.project_time_assert_actor(v_ws, false);
  SELECT pol.activated_at, pol.enabled INTO v_act, v_on FROM public.deal_delivery_policies pol WHERE pol.workspace_id = v_ws;
  RETURN QUERY
  -- vv = mesmas condições de deal_visible_to_current_user, calculadas uma vez (não por negócio).
  WITH vv AS MATERIALIZED (SELECT * FROM public.project_dash_vis()),
  d AS (
    SELECT x.id, x.name, x.closed_at, coalesce(x.assigned_to, x.owner_id) AS own, x.company_id
      FROM public.deals x CROSS JOIN vv
     WHERE x.workspace_id = v_ws AND x.deleted_at IS NULL
       AND public.deal_stage_type(x.pipeline_id, x.stage_id, x.stage::text) = 'won'
       AND x.closed_at IS NOT NULL AND (x.closed_at AT TIME ZONE v_tz)::date BETWEEN (f->>'from')::date AND (f->>'to')::date
       AND (nullif(f->>'company', '') IS NULL OR x.company_id = (f->>'company')::uuid)
       AND (nullif(f->>'person', '') IS NULL OR x.assigned_to = (f->>'person')::uuid OR x.owner_id = (f->>'person')::uuid)
       AND (vv.dl_ws
            OR (vv.dl_team AND (x.assigned_to = vv.uid OR x.owner_id = vv.uid OR x.assigned_to = ANY (vv.dl_team_ids)))
            OR (vv.dl_own AND (x.assigned_to = vv.uid OR x.owner_id = vv.uid)))
       AND (NOT vv.dl_restricted OR x.assigned_to = vv.uid OR x.owner_id = vv.uid)),
  lk AS (
    SELECT d.id AS deal_id, p.id AS pid, p.status::text AS st, p.assigned_to, p.created_at, p.owner_id
      FROM d JOIN public.projects p ON p.deal_id = d.id AND p.workspace_id = v_ws
    UNION
    SELECT d.id, p.id, p.status::text, p.assigned_to, p.created_at, p.owner_id
      FROM d JOIN public.project_deal_links l ON l.deal_id = d.id JOIN public.projects p ON p.id = l.project_id AND p.workspace_id = v_ws),
  agg AS (
    SELECT lk.deal_id, count(*)::int AS n, min(lk.created_at) AS first_at,
           bool_or(lk.st = 'planning') AS prep, bool_or(lk.assigned_to IS NULL AND lk.st IN ('active','planning')) AS no_owner,
           -- projeto legível pelo usuário: mesmas condições de projects_perm_select
           (array_agg(lk.pid ORDER BY lk.created_at) FILTER (WHERE lk.owner_id = vv.uid OR vv.pr_all))[1] AS vis,
           (array_agg(lk.st ORDER BY lk.created_at))[1] AS st
      FROM lk CROSS JOIN vv GROUP BY lk.deal_id),
  ct AS (
    SELECT c.deal_id, CASE WHEN bool_or(c.status::text = 'active') THEN 'active'
                           WHEN bool_or(c.status::text IN ('awaiting_signature','in_review','in_negotiation','draft','renewing')) THEN 'in_progress'
                           ELSE 'ended' END AS cs
      FROM public.contracts c JOIN d ON d.id = c.deal_id
     WHERE c.workspace_id = v_ws AND coalesce(c.document_kind, '') <> 'amendment' GROUP BY c.deal_id),
  jb AS (
    SELECT DISTINCT ON (j.deal_id) j.deal_id, j.status FROM public.deal_delivery_jobs j JOIN d ON d.id = j.deal_id
     ORDER BY j.deal_id, j.created_at DESC)
  SELECT d.id, d.name, d.closed_at, d.own, d.company_id,
         (v_act IS NOT NULL AND d.closed_at >= v_act),
         coalesce(agg.n, 0), agg.vis,
         CASE WHEN agg.vis IS NOT NULL THEN (SELECT p.name FROM public.projects p WHERE p.id = agg.vis) END,
         agg.st, coalesce(ct.cs, 'none'),
         CASE WHEN agg.first_at IS NOT NULL THEN greatest(0, extract(epoch FROM agg.first_at - d.closed_at)) END,
         jb.status,
         array_remove(ARRAY['won',
           CASE WHEN v_act IS NOT NULL AND d.closed_at >= v_act THEN 'after_policy' ELSE 'before_policy' END,
           CASE WHEN coalesce(agg.n, 0) > 0 THEN 'with_project' END,
           CASE WHEN coalesce(agg.n, 0) = 0 AND v_act IS NOT NULL AND d.closed_at >= v_act AND coalesce(jb.status, '') NOT IN ('skipped','cancelled') THEN 'no_project' END,
           CASE WHEN jb.status = 'skipped' THEN 'skipped' END,
           CASE WHEN jb.status IN ('pending','running','failed') THEN 'job_pending' END,
           CASE WHEN agg.prep THEN 'preparation' END,
           CASE WHEN agg.no_owner THEN 'no_owner' END,
           CASE WHEN ct.cs IS NULL THEN 'no_contract' END,
           CASE WHEN EXISTS (SELECT 1 FROM public.deal_delivery_events ev WHERE ev.deal_id = d.id AND ev.needs_review AND ev.resolved_at IS NULL) THEN 'review' END], NULL)
    FROM d LEFT JOIN agg ON agg.deal_id = d.id LEFT JOIN ct ON ct.deal_id = d.id LEFT JOIN jb ON jb.deal_id = d.id;
END $$;
REVOKE ALL ON FUNCTION public.project_dash_ds_deals(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_dash_ds_deals(jsonb) TO authenticated;

-- Medições (RLS do Ciclo 4: exige ver medições). Etapas separadas, nunca somadas; valores por moeda.
CREATE OR REPLACE FUNCTION public.project_dash_ds_measurements(f jsonb)
RETURNS TABLE(id uuid, period_from date, currency text, status text, total_amount numeric, received numeric,
              contract_id uuid, service_id uuid, company_id uuid, kind text, m text[])
LANGUAGE sql STABLE SET search_path = public AS $$
  WITH b AS (SELECT (f->>'ws')::uuid ws, date_trunc('month', (f->>'from')::date)::date d0, (f->>'to')::date d1,
                    nullif(f->>'project', '')::uuid pj, nullif(f->>'company', '')::uuid co, nullif(f->>'service', '')::uuid sv,
                    nullif(f->>'currency', '') cur),
  x AS (
    SELECT ms.*, (SELECT coalesce(sum(fp.amount), 0) FROM public.project_measurement_financial_links l
                    JOIN public.financial_payments fp ON fp.entry_id = l.financial_entry_id
                   WHERE l.measurement_id = ms.id AND l.active) AS rec
      FROM public.project_measurements ms CROSS JOIN b
     WHERE ms.workspace_id = b.ws AND ms.period_from BETWEEN b.d0 AND b.d1
       AND (b.co IS NULL OR ms.company_id = b.co) AND (b.sv IS NULL OR ms.service_id = b.sv)
       AND (b.cur IS NULL OR ms.currency = b.cur)
       AND (b.pj IS NULL OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = b.pj
              AND ((p.contract_id IS NOT NULL AND p.contract_id = ms.contract_id) OR (p.service_id IS NOT NULL AND p.service_id = ms.service_id)))))
  SELECT x.id, x.period_from, x.currency, x.status, x.total_amount, x.rec, x.contract_id, x.service_id, x.company_id, x.kind,
         array_remove(ARRAY['all',
           CASE WHEN x.status IN ('draft','in_review') THEN 'forecast' END,
           CASE WHEN x.status = 'in_review' THEN 'awaiting_approval' END,
           CASE WHEN x.status IN ('approved','ready') THEN 'approved' END,
           CASE WHEN x.status IN ('approved','ready','failed') THEN 'awaiting_generation' END,
           CASE WHEN x.status = 'generated' THEN 'generated' END,
           CASE WHEN x.status = 'failed' THEN 'failed' END,
           CASE WHEN x.status = 'reversed' THEN 'reversed' END,
           CASE WHEN x.status = 'cancelled' THEN 'cancelled' END,
           CASE WHEN x.rec > 0 THEN 'received' END], NULL)
    FROM x $$;
REVOKE ALL ON FUNCTION public.project_dash_ds_measurements(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_dash_ds_measurements(jsonb) TO authenticated;

-- Cobertura de custo (só situação da tarifa, nunca valor): agrupa apontamentos por projeto/pessoa/dia
-- e consulta a tarifa vigente do Ciclo 4. Exige ver tarifas ou rentabilidade.
CREATE OR REPLACE FUNCTION public.project_dash_ds_cost(f jsonb)
RETURNS TABLE(project_id uuid, user_id uuid, entry_date date, n integer, secs numeric, cost_status text, m text[])
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ws uuid := (f->>'ws')::uuid; v_cur text := coalesce(nullif(f->>'currency', ''), 'BRL');
BEGIN
  IF v_ws IS DISTINCT FROM public.project_dash_ws() THEN RAISE EXCEPTION 'Workspace inválido.' USING ERRCODE = '42501'; END IF;
  PERFORM public.project_time_assert_actor(v_ws, false);
  IF NOT (public.user_has_permission(auth.uid(), v_ws, 'techprojects.rates.view.workspace')
          OR public.user_has_permission(auth.uid(), v_ws, 'techprojects.profitability.view.workspace')) THEN
    RAISE EXCEPTION 'Sem permissão para ver a cobertura de custo.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  WITH g AS (
    SELECT e.project_id, e.user_id, e.entry_date, count(*)::int AS n,
           sum(coalesce(e.duration_seconds::numeric, public.project_entry_seconds(e.started_at, e.stopped_at, e.duration_minutes, e.hours))) AS s
      FROM public.project_time_entries e LEFT JOIN public.projects pr ON pr.id = e.project_id
     WHERE e.workspace_id = v_ws AND e.entry_date BETWEEN (f->>'from')::date AND (f->>'to')::date AND e.status <> 'rejected'
       AND (nullif(f->>'project', '') IS NULL OR e.project_id = (f->>'project')::uuid)
       AND (nullif(f->>'company', '') IS NULL OR pr.company_id = (f->>'company')::uuid)
       AND (nullif(f->>'service', '') IS NULL OR pr.service_id = (f->>'service')::uuid)
       AND (nullif(f->>'person', '') IS NULL OR e.user_id = (f->>'person')::uuid)
       AND (nullif(f->>'leader', '') IS NULL OR e.project_id IN (SELECT public.project_dash_leader_projects(v_ws, (f->>'leader')::uuid)))
     GROUP BY 1, 2, 3)
  SELECT g.project_id, g.user_id, g.entry_date, g.n, g.s, r.status,
         ARRAY['all', CASE WHEN r.status IN ('found','monthly') THEN 'cost_known' WHEN r.status = 'ambiguous' THEN 'cost_ambiguous' ELSE 'cost_missing' END]
    FROM g CROSS JOIN LATERAL public.project_rate_pick(v_ws, 'cost', v_cur, g.entry_date, g.project_id, g.user_id) r;
END $$;
REVOKE ALL ON FUNCTION public.project_dash_ds_cost(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_dash_ds_cost(jsonb) TO authenticated;

-- Alocação semanal (segundos) num projeto para os próximos 7 dias; NULL se algum alocado não tem jornada.
CREATE OR REPLACE FUNCTION public.project_dash_project_week_alloc(p_ws uuid, p_project uuid, p_from date)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH a AS (
    SELECT a.allocation_pct, a.hours_per_week, a.starts_at, a.ends_at, pe.work_schedule ws
      FROM public.people_allocations a JOIN public.people pe ON pe.id = a.person_id
     WHERE a.workspace_id = p_ws AND a.project_id = p_project AND a.status = 'active'
       AND public.project_visible_to_current_user(p_project)),
  d AS (SELECT (p_from + i) AS day FROM generate_series(0, 6) i)
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM a) THEN 0
              WHEN EXISTS (SELECT 1 FROM a WHERE a.ws IS NULL OR (a.allocation_pct IS NULL AND a.hours_per_week IS NULL)) THEN NULL
              ELSE (SELECT coalesce(sum(CASE WHEN a.allocation_pct IS NOT NULL
                       THEN coalesce((a.ws->>((ARRAY['sun','mon','tue','wed','thu','fri','sat'])[extract(dow FROM d.day)::int + 1]))::numeric, 0) * a.allocation_pct / 100
                       ELSE a.hours_per_week * 3600 / 7 END), 0)
                      FROM a JOIN d ON coalesce(a.starts_at, d.day) <= d.day AND (a.ends_at IS NULL OR a.ends_at >= d.day)) END $$;
REVOKE ALL ON FUNCTION public.project_dash_project_week_alloc(uuid, uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_dash_project_week_alloc(uuid, uuid, date) TO authenticated;

-- Previsão: estimativa restante (tarefas abertas) ÷ ritmo (cadência das últimas 8 semanas completas, mínimo
-- 4 semanas com horas, e/ou capacidade alocada). Horas consumidas ÷ previstas NÃO é progresso.
CREATE OR REPLACE FUNCTION public.project_dash_ds_forecast(p_view text, f jsonb)
RETURNS TABLE(id uuid, name text, status text, kind text, due_at date, planned_hours numeric, consumed_secs numeric,
              open_tasks integer, est_tasks integer, remaining_secs numeric, tasks_total integer, tasks_done integer,
              ms_total integer, ms_done integer, weeks_with_hours integer, w_p25 numeric, w_p50 numeric, w_p75 numeric,
              alloc_week_secs numeric, method text, eta_low date, eta_mid date, eta_high date, reason text, cut_date date, m text[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  -- Definer só para não reavaliar a RLS por linha: tarefas, marcos e apontamentos usam as MESMAS condições
  -- das políticas (project_dash_vis), e os projetos vêm de ds_projects (já restrito ao visível).
  WITH v AS MATERIALIZED (SELECT * FROM public.project_dash_vis()),
  b AS (SELECT v.*, (f->>'today')::date td, (date_trunc('week', (f->>'today')::date))::date wk0 FROM v),
  pr AS MATERIALIZED (SELECT p.* FROM public.project_dash_ds_projects(p_view, f) p WHERE 'open' = ANY (p.m)),
  tk AS (SELECT t.project_id, count(*) FILTER (WHERE t.status <> 'done')::int o,
                count(*) FILTER (WHERE t.status <> 'done' AND t.estimated_hours IS NOT NULL)::int oe,
                coalesce(sum(t.estimated_hours) FILTER (WHERE t.status <> 'done'), 0) * 3600 rem,
                count(*)::int tt, count(*) FILTER (WHERE t.status = 'done')::int td
           FROM public.project_tasks t CROSS JOIN b
          WHERE t.workspace_id = b.ws AND t.project_id IN (SELECT id FROM pr) AND (t.assignee_id = b.uid OR b.tk_all) GROUP BY 1),
  ms AS (SELECT x.project_id, count(*) FILTER (WHERE x.status::text <> 'cancelled')::int tt, count(*) FILTER (WHERE x.status::text = 'done')::int dn
           FROM public.project_milestones x CROSS JOIN b
          WHERE x.workspace_id = b.ws AND x.project_id IN (SELECT id FROM pr) AND b.ms_all GROUP BY 1),
  ev AS MATERIALIZED (
    SELECT e.project_id, e.entry_date,
           coalesce(e.duration_seconds::numeric, public.project_entry_seconds(e.started_at, e.stopped_at, e.duration_minutes, e.hours)) s
      FROM public.project_time_entries e CROSS JOIN b
     WHERE e.workspace_id = b.ws AND e.project_id IN (SELECT id FROM pr) AND e.status <> 'rejected'
       AND b.te_perm AND (e.user_id = b.uid OR b.te_full OR e.project_id = ANY (b.te_led)
                          OR (e.project_id::text || ':' || e.user_id::text) = ANY (b.te_pairs))),
  ce AS (SELECT ev.project_id, sum(ev.s) s FROM ev GROUP BY 1),
  wk AS (SELECT pr.id pid, g.w, coalesce(sum(ev.s), 0) s
           FROM pr CROSS JOIN b CROSS JOIN LATERAL (SELECT (b.wk0 - 7 * i) AS w FROM generate_series(1, 8) i) g
           LEFT JOIN ev ON ev.project_id = pr.id AND ev.entry_date >= g.w AND ev.entry_date < g.w + 7
          GROUP BY pr.id, g.w),
  wq AS (SELECT pid, count(*) FILTER (WHERE s > 0)::int nw,
                percentile_cont(0.25) WITHIN GROUP (ORDER BY s) p25, percentile_cont(0.5) WITHIN GROUP (ORDER BY s) p50,
                percentile_cont(0.75) WITHIN GROUP (ORDER BY s) p75
           FROM wk GROUP BY pid),
  base AS (
    SELECT pr.id, pr.name, pr.status, pr.kind, pr.due_at, pr.planned_hours, coalesce(ce.s, 0) cs,
           coalesce(tk.o, 0) o, coalesce(tk.oe, 0) oe, coalesce(tk.rem, 0) rem, coalesce(tk.tt, 0) tt, coalesce(tk.td, 0) tdn,
           coalesce(ms.tt, 0) mt, coalesce(ms.dn, 0) md, coalesce(wq.nw, 0) nw,
           CASE WHEN coalesce(wq.nw, 0) >= 4 THEN wq.p25 END p25, CASE WHEN coalesce(wq.nw, 0) >= 4 THEN wq.p50 END p50,
           CASE WHEN coalesce(wq.nw, 0) >= 4 THEN wq.p75 END p75,
           public.project_dash_project_week_alloc(b.ws, pr.id, b.td) aw, b.td
      FROM pr CROSS JOIN b LEFT JOIN tk ON tk.project_id = pr.id LEFT JOIN ms ON ms.project_id = pr.id
      LEFT JOIN ce ON ce.project_id = pr.id LEFT JOIN wq ON wq.pid = pr.id),
  calc AS (
    SELECT base.*,
      CASE WHEN kind = 'hunting' THEN 'techhire' WHEN kind = 'capacity' THEN 'competence'
           WHEN o = 0 OR oe = 0 THEN 'none'
           WHEN p50 IS NULL AND coalesce(aw, 0) = 0 THEN 'none'
           ELSE 'estimate' END AS meth,
      nullif(greatest(coalesce(p75, 0), coalesce(aw, 0)), 0) hi_rate,
      least(coalesce(nullif(p25, 0), nullif(aw, 0)), coalesce(nullif(aw, 0), nullif(p25, 0))) lo_rate,
      coalesce(nullif(p50, 0), nullif(aw, 0)) mid_rate
      FROM base)
  SELECT c.id, c.name, c.status, c.kind, c.due_at, c.planned_hours, c.cs, c.o, c.oe, c.rem, c.tt, c.tdn, c.mt, c.md, c.nw,
         c.p25, c.p50, c.p75, c.aw,
         c.meth,
         CASE WHEN c.meth = 'estimate' AND c.hi_rate > 0 THEN c.td + ceil(c.rem / c.hi_rate * 7)::int END,
         CASE WHEN c.meth = 'estimate' AND c.mid_rate > 0 THEN c.td + ceil(c.rem / c.mid_rate * 7)::int END,
         CASE WHEN c.meth = 'estimate' AND c.lo_rate > 0 THEN c.td + ceil(c.rem / c.lo_rate * 7)::int END,
         CASE WHEN c.kind = 'hunting' THEN 'Hunting é acompanhado no TechHire (vagas e candidaturas); sem previsão aqui.'
              WHEN c.kind = 'capacity' THEN 'Entrega recorrente: acompanhe a cobertura da competência (alocado × registrado).'
              WHEN c.o = 0 THEN 'Sem base para prever: nenhuma tarefa aberta.'
              WHEN c.oe = 0 THEN 'Sem base para prever: tarefas abertas sem estimativa.'
              WHEN c.p50 IS NULL AND coalesce(c.aw, 0) = 0 THEN 'Sem base para prever: menos de 4 das últimas 8 semanas com horas e sem capacidade alocada conhecida.'
              WHEN c.oe < c.o THEN 'Estimativa parcial: só ' || c.oe || ' de ' || c.o || ' tarefas abertas têm estimativa; a data tende a ser otimista.'
              END,
         c.td,
         array_remove(ARRAY['open',
           CASE WHEN c.meth = 'estimate' THEN 'forecast' END,
           CASE WHEN c.meth = 'none' THEN 'no_base' END,
           CASE WHEN c.meth = 'techhire' THEN 'hunting' END,
           CASE WHEN c.meth = 'competence' THEN 'recurring' END,
           CASE WHEN c.meth = 'estimate' AND c.due_at IS NOT NULL AND c.mid_rate > 0 AND c.td + ceil(c.rem / c.mid_rate * 7)::int > c.due_at THEN 'late' END,
           CASE WHEN c.meth = 'estimate' AND c.oe < c.o THEN 'partial_estimate' END,
           CASE WHEN c.planned_hours > 0 AND c.cs >= c.planned_hours * 3600 THEN 'over_budget' END], NULL)
    FROM calc c $$;
REVOKE ALL ON FUNCTION public.project_dash_ds_forecast(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_dash_ds_forecast(text, jsonb) TO authenticated;

-- =========================================================== alertas: regras versionadas
CREATE OR REPLACE FUNCTION public.project_alert_default_rules()
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = pg_catalog AS $$
  SELECT '{
    "milestone_overdue":    {"enabled": true, "severity": "high"},
    "project_overdue":      {"enabled": true, "severity": "medium"},
    "hours_budget":         {"enabled": true, "severity": "medium", "warn_pct": 80, "critical_pct": 100},
    "capacity_exceeded":    {"enabled": true, "severity": "medium", "horizon_days": 30},
    "hours_unreviewed":     {"enabled": true, "severity": "medium", "days": 7},
    "approver_missing":     {"enabled": true, "severity": "medium"},
    "schedule_missing":     {"enabled": true, "severity": "low"},
    "deal_won_no_project":  {"enabled": true, "severity": "high", "grace_days": 2},
    "no_operational_owner": {"enabled": true, "severity": "medium"},
    "_schedule":            {"enabled": false, "tz": "America/Sao_Paulo"}
  }'::jsonb $$;

CREATE OR REPLACE FUNCTION public.project_alert_rules_effective(p_ws uuid, p_project uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.project_alert_default_rules()
      || coalesce((SELECT v.rules FROM public.project_risk_rule_versions v WHERE v.workspace_id = p_ws AND v.project_id IS NULL
                    ORDER BY v.version DESC LIMIT 1), '{}'::jsonb)
      || coalesce((SELECT v.rules FROM public.project_risk_rule_versions v WHERE v.workspace_id = p_ws AND p_project IS NOT NULL
                      AND v.project_id = p_project ORDER BY v.version DESC LIMIT 1), '{}'::jsonb) $$;
REVOKE ALL ON FUNCTION public.project_alert_rules_effective(uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.project_risk_rules_get(p_project uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ws uuid := public.project_dash_ws();
BEGIN
  PERFORM public.project_time_assert_actor(v_ws, false);
  IF p_project IS NOT NULL AND NOT public.project_visible_to_current_user(p_project) THEN
    RAISE EXCEPTION 'Projeto sem acesso.' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'defaults', public.project_alert_default_rules(),
    'effective', public.project_alert_rules_effective(v_ws, p_project),
    'workspace_version', (SELECT to_jsonb(v) - 'workspace_id' FROM public.project_risk_rule_versions v
                           WHERE v.workspace_id = v_ws AND v.project_id IS NULL ORDER BY v.version DESC LIMIT 1),
    'project_version', (SELECT to_jsonb(v) - 'workspace_id' FROM public.project_risk_rule_versions v
                         WHERE v.workspace_id = v_ws AND p_project IS NOT NULL AND v.project_id = p_project ORDER BY v.version DESC LIMIT 1),
    'can_manage', public.is_active_workspace_admin(v_ws, auth.uid())
                  OR public.user_has_permission(auth.uid(), v_ws, 'techprojects.risk_rules.manage.workspace'));
END $$;
REVOKE ALL ON FUNCTION public.project_risk_rules_get(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_risk_rules_get(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.project_risk_rules_save(p_project uuid, p_rules jsonb, p_note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ws uuid := public.project_dash_ws(); v_def jsonb := public.project_alert_default_rules(); v_out jsonb := '{}'::jsonb;
  k text; r jsonb; v_ver int; v_id uuid; n numeric;
BEGIN
  PERFORM public.project_time_assert_actor(v_ws, true);
  IF NOT (public.is_active_workspace_admin(v_ws, auth.uid())
          OR public.user_has_permission(auth.uid(), v_ws, 'techprojects.risk_rules.manage.workspace')) THEN
    RAISE EXCEPTION 'Sem permissão para configurar regras de risco.' USING ERRCODE = '42501';
  END IF;
  IF p_project IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.projects p WHERE p.id = p_project AND p.workspace_id = v_ws) THEN
    RAISE EXCEPTION 'Projeto fora do workspace.' USING ERRCODE = '42501';
  END IF;
  IF length(btrim(coalesce(p_note, ''))) < 5 THEN RAISE EXCEPTION 'Descreva o motivo da mudança (mínimo 5 caracteres).' USING ERRCODE = '22023'; END IF;
  IF p_rules IS NULL OR jsonb_typeof(p_rules) <> 'object' THEN RAISE EXCEPTION 'Regras inválidas.' USING ERRCODE = '22023'; END IF;
  FOR k, r IN SELECT * FROM jsonb_each(p_rules) LOOP
    IF NOT v_def ? k THEN RAISE EXCEPTION 'Regra desconhecida: %.', k USING ERRCODE = '22023'; END IF;
    IF jsonb_typeof(r) <> 'object' THEN RAISE EXCEPTION 'Regra % inválida.', k USING ERRCODE = '22023'; END IF;
    r := (v_def->k) || r;
    IF k = '_schedule' THEN
      -- Avaliação automática diária: só no nível do workspace; desligada por padrão.
      IF p_project IS NOT NULL THEN RAISE EXCEPTION 'A avaliação automática é configurada só para o workspace.' USING ERRCODE = '22023'; END IF;
      IF jsonb_typeof(r->'enabled') <> 'boolean' OR coalesce(r->>'tz', '') !~ '^[A-Za-z_]+(/[A-Za-z0-9_+\-]+){0,2}$'
         OR NOT EXISTS (SELECT 1 FROM pg_timezone_names z WHERE z.name = r->>'tz') THEN
        RAISE EXCEPTION 'Avaliação automática: informe ativa (sim/não) e um fuso válido.' USING ERRCODE = '22023';
      END IF;
      v_out := v_out || jsonb_build_object(k, jsonb_build_object('enabled', r->'enabled', 'tz', r->>'tz'));
      CONTINUE;
    END IF;
    IF jsonb_typeof(r->'enabled') <> 'boolean' THEN RAISE EXCEPTION 'Regra %: "ativa" precisa ser verdadeiro ou falso.', k USING ERRCODE = '22023'; END IF;
    IF NOT (r->>'severity') IN ('low','medium','high') THEN RAISE EXCEPTION 'Regra %: severidade inválida.', k USING ERRCODE = '22023'; END IF;
    FOR n IN SELECT (r->>x)::numeric FROM unnest(ARRAY['warn_pct','critical_pct','horizon_days','days','grace_days']) x WHERE r ? x LOOP
      IF n IS NULL OR n < 0 OR n > 1000 OR n <> trunc(n) THEN RAISE EXCEPTION 'Regra %: limite inválido.', k USING ERRCODE = '22023'; END IF;
    END LOOP;
    IF k = 'hours_budget' AND ((r->>'warn_pct')::int < 1 OR (r->>'critical_pct')::int < (r->>'warn_pct')::int) THEN
      RAISE EXCEPTION 'Orçamento de horas: o limite crítico precisa ser maior ou igual ao de aviso.' USING ERRCODE = '22023';
    END IF;
    IF k = 'capacity_exceeded' AND ((r->>'horizon_days')::int < 1 OR (r->>'horizon_days')::int > 180) THEN
      RAISE EXCEPTION 'Capacidade: horizonte entre 1 e 180 dias.' USING ERRCODE = '22023';
    END IF;
    IF k = 'hours_unreviewed' AND ((r->>'days')::int < 1 OR (r->>'days')::int > 90) THEN
      RAISE EXCEPTION 'Horas sem revisão: entre 1 e 90 dias.' USING ERRCODE = '22023';
    END IF;
    IF k = 'deal_won_no_project' AND (r->>'grace_days')::int > 60 THEN
      RAISE EXCEPTION 'Ganho sem projeto: tolerância máxima de 60 dias.' USING ERRCODE = '22023';
    END IF;
    v_out := v_out || jsonb_build_object(k, r);
  END LOOP;
  PERFORM pg_advisory_xact_lock(hashtextextended('project_risk_rules:' || v_ws || ':' || coalesce(p_project::text, '-'), 0));
  SELECT coalesce(max(v.version), 0) + 1 INTO v_ver FROM public.project_risk_rule_versions v
   WHERE v.workspace_id = v_ws AND v.project_id IS NOT DISTINCT FROM p_project;
  INSERT INTO public.project_risk_rule_versions (workspace_id, project_id, version, rules, note, created_by)
  VALUES (v_ws, p_project, v_ver, v_out, btrim(p_note), auth.uid()) RETURNING id INTO v_id;
  RETURN jsonb_build_object('id', v_id, 'version', v_ver);
END $$;
REVOKE ALL ON FUNCTION public.project_risk_rules_save(uuid, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_risk_rules_save(uuid, jsonb, text) TO authenticated;

-- =========================================================== alertas: avaliação persistida (sob demanda)
-- Idempotente: chave (regra|alvo). Só mudança de estado gera evento; causa que some resolve sozinha
-- e volta a abrir se reaparecer. Nada é enviado para fora (sem e-mail/WhatsApp/notificação).
-- Avaliação persistida (núcleo). Não é chamável pelo app: entra por project_alert_refresh (admin/permissão,
-- manual) ou por project_alert_scheduled_tick (agendador, só para workspaces que ligaram a avaliação automática).
-- Lê o workspace inteiro (regras são do workspace); grava apenas project_alerts/eventos/execuções.
CREATE OR REPLACE FUNCTION public.project_alert_evaluate(p_ws uuid, p_tz text, p_actor uuid, p_trigger text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ws uuid := p_ws; v_today date; v_run uuid; v_wsr jsonb; v_pol record;
  v_new int; v_re int; v_chg int; v_gone int; v_cur int; v_exp int;
BEGIN
  IF p_ws IS NULL OR p_trigger NOT IN ('manual','scheduled') THEN RAISE EXCEPTION 'Avaliação inválida.' USING ERRCODE = '22023'; END IF;
  IF coalesce(p_tz, '') !~ '^[A-Za-z_]+(/[A-Za-z0-9_+\-]+){0,2}$' THEN RAISE EXCEPTION 'Fuso horário inválido.' USING ERRCODE = '22023'; END IF;
  BEGIN v_today := (now() AT TIME ZONE p_tz)::date;
  EXCEPTION WHEN others THEN RAISE EXCEPTION 'Fuso horário inválido.' USING ERRCODE = '22023'; END;
  IF NOT pg_try_advisory_xact_lock(hashtextextended('project_alert_refresh:' || v_ws, 0)) THEN
    RETURN jsonb_build_object('status', 'busy');
  END IF;
  INSERT INTO public.project_alert_runs (workspace_id, actor, trigger, tz, evaluated_on)
  VALUES (v_ws, p_actor, p_trigger, p_tz, v_today) RETURNING id INTO v_run;
  v_wsr := public.project_alert_rules_effective(v_ws, NULL);
  SELECT enabled, activated_at INTO v_pol FROM public.deal_delivery_policies WHERE workspace_id = v_ws;

  DROP TABLE IF EXISTS pg_temp._pa_cur;
  CREATE TEMP TABLE _pa_cur (
    dedupe_key text PRIMARY KEY, rule_key text, severity text, project_id uuid, person_id uuid, deal_id uuid,
    subject_user_id uuid, owner_user_id uuid, period_from date, period_to date, evidence jsonb) ON COMMIT DROP;

  -- Projetos em andamento com regras efetivas (projeto concluído/importado não vira risco atual).
  DROP TABLE IF EXISTS pg_temp._pa_pr;
  CREATE TEMP TABLE _pa_pr ON COMMIT DROP AS
    SELECT p.id, p.name, p.status::text AS st, p.due_at, p.planned_hours, p.assigned_to, p.deal_id,
           public.project_alert_rules_effective(v_ws, p.id) AS r
      FROM public.projects p WHERE p.workspace_id = v_ws AND p.status::text IN ('active','planning','on_hold');

  INSERT INTO _pa_cur
  SELECT 'milestone_overdue|' || m.id, 'milestone_overdue', pr.r->'milestone_overdue'->>'severity', pr.id, NULL, NULL,
         m.assigned_to, pr.assigned_to, m.due_at, v_today,
         jsonb_build_object('milestone_id', m.id, 'milestone', m.name, 'due_at', m.due_at, 'days_late', v_today - m.due_at)
    FROM public.project_milestones m JOIN _pa_pr pr ON pr.id = m.project_id
   WHERE m.status::text NOT IN ('done','cancelled') AND m.due_at < v_today AND (pr.r->'milestone_overdue'->>'enabled')::boolean;

  INSERT INTO _pa_cur
  SELECT 'project_overdue|' || pr.id, 'project_overdue', pr.r->'project_overdue'->>'severity', pr.id, NULL, NULL,
         NULL, pr.assigned_to, pr.due_at, v_today, jsonb_build_object('due_at', pr.due_at, 'days_late', v_today - pr.due_at, 'status', pr.st)
    FROM _pa_pr pr
   WHERE pr.st IN ('active','planning') AND pr.due_at < v_today AND (pr.r->'project_overdue'->>'enabled')::boolean;

  INSERT INTO _pa_cur
  SELECT 'hours_budget|' || x.id, 'hours_budget',
         CASE WHEN x.pct >= (x.r->'hours_budget'->>'critical_pct')::numeric THEN 'high' ELSE x.r->'hours_budget'->>'severity' END,
         x.id, NULL, NULL, NULL, x.assigned_to, NULL, v_today,
         jsonb_build_object('consumed_seconds', x.s, 'planned_hours', x.planned_hours, 'pct', round(x.pct, 1),
                            'warn_pct', x.r->'hours_budget'->'warn_pct', 'critical_pct', x.r->'hours_budget'->'critical_pct',
                            'includes_imported', x.imp > 0)
    FROM (SELECT pr.*, coalesce(sum(coalesce(e.duration_seconds::numeric, public.project_entry_seconds(e.started_at, e.stopped_at, e.duration_minutes, e.hours))), 0) s,
                 coalesce(sum(coalesce(e.duration_seconds::numeric, public.project_entry_seconds(e.started_at, e.stopped_at, e.duration_minutes, e.hours))), 0)
                   / (pr.planned_hours * 3600) * 100 pct,
                 count(*) FILTER (WHERE e.source = 'import') imp
            FROM _pa_pr pr LEFT JOIN public.project_time_entries e ON e.project_id = pr.id AND e.status <> 'rejected'
           WHERE pr.planned_hours > 0 AND (pr.r->'hours_budget'->>'enabled')::boolean
           GROUP BY pr.id, pr.name, pr.st, pr.due_at, pr.planned_hours, pr.assigned_to, pr.deal_id, pr.r) x
   WHERE x.pct >= (x.r->'hours_budget'->>'warn_pct')::numeric;

  IF (v_wsr->'capacity_exceeded'->>'enabled')::boolean THEN
    INSERT INTO _pa_cur
    SELECT 'capacity_exceeded|' || y.pid, 'capacity_exceeded', v_wsr->'capacity_exceeded'->>'severity', NULL, y.pid, NULL,
           y.profile_id, y.manager_id, y.d_first, y.d_last,
           jsonb_build_object('overbooked_days', y.n, 'max_load_pct', y.mx, 'horizon_days', (v_wsr->'capacity_exceeded'->>'horizon_days')::int)
      FROM (SELECT q.pid, q.profile_id, q.manager_id, count(*) n, min(q.day) d_first, max(q.day) d_last, max(round(q.at / q.cap * 100, 1)) mx
              FROM (SELECT pe.id pid, pe.profile_id, pe.manager_id, d::date AS day,
                           coalesce((pe.work_schedule->>((ARRAY['sun','mon','tue','wed','thu','fri','sat'])[extract(dow FROM d)::int + 1]))::numeric, 0) AS cap,
                           (SELECT sum(CASE WHEN a.allocation_pct IS NOT NULL
                                  THEN coalesce((pe.work_schedule->>((ARRAY['sun','mon','tue','wed','thu','fri','sat'])[extract(dow FROM d)::int + 1]))::numeric, 0) * a.allocation_pct / 100
                                  WHEN a.hours_per_week IS NOT NULL AND wc.w > 0
                                  THEN a.hours_per_week * 3600 * coalesce((pe.work_schedule->>((ARRAY['sun','mon','tue','wed','thu','fri','sat'])[extract(dow FROM d)::int + 1]))::numeric, 0) / wc.w END)
                              FROM public.people_allocations a
                             WHERE a.person_id = pe.id AND a.status = 'active'
                               AND coalesce(a.starts_at, d::date) <= d::date AND (a.ends_at IS NULL OR a.ends_at >= d::date)) AS at
                      FROM public.people pe
                      CROSS JOIN LATERAL (SELECT sum(coalesce((pe.work_schedule->>k)::numeric, 0)) w
                                            FROM unnest(ARRAY['sun','mon','tue','wed','thu','fri','sat']) k) wc
                      CROSS JOIN generate_series(v_today, v_today + (v_wsr->'capacity_exceeded'->>'horizon_days')::int, interval '1 day') d
                     WHERE pe.workspace_id = v_ws AND NOT coalesce(pe.archived, false) AND pe.work_schedule IS NOT NULL
                       AND pe.status::text IN ('active','bench','offboarding')
                       AND (pe.termination_date IS NULL OR pe.termination_date >= d::date)) q
             WHERE q.cap > 0 AND coalesce(q.at, 0) > q.cap + 1
             GROUP BY q.pid, q.profile_id, q.manager_id) y;
  END IF;

  INSERT INTO _pa_cur
  SELECT 'hours_unreviewed|' || pr.id, 'hours_unreviewed', pr.r->'hours_unreviewed'->>'severity', pr.id, NULL, NULL,
         NULL, pr.assigned_to, min(e.entry_date), max(e.entry_date),
         jsonb_build_object('entries', count(*), 'seconds', sum(coalesce(e.duration_seconds::numeric, public.project_entry_seconds(e.started_at, e.stopped_at, e.duration_minutes, e.hours))),
                            'oldest_submitted_at', min(e.submitted_at), 'days', (pr.r->'hours_unreviewed'->>'days')::int)
    FROM _pa_pr pr JOIN public.project_time_entries e ON e.project_id = pr.id
   WHERE e.status = 'submitted' AND (pr.r->'hours_unreviewed'->>'enabled')::boolean
     AND e.submitted_at < now() - make_interval(days => (pr.r->'hours_unreviewed'->>'days')::int)
   GROUP BY pr.id, pr.r, pr.assigned_to;

  INSERT INTO _pa_cur
  SELECT 'approver_missing|' || pr.id, 'approver_missing', pr.r->'approver_missing'->>'severity', pr.id, NULL, NULL,
         NULL, pr.assigned_to, NULL, NULL, jsonb_build_object('reason', 'Projeto ativo com apontamento previsto e sem aprovador nomeado.')
    FROM _pa_pr pr
   WHERE pr.st = 'active' AND (pr.r->'approver_missing'->>'enabled')::boolean
     AND NOT public.project_time_has_approver(pr.id, NULL)
     AND (EXISTS (SELECT 1 FROM public.project_members m WHERE m.project_id = pr.id AND m.can_track_time)
          OR EXISTS (SELECT 1 FROM public.people_allocations a WHERE a.project_id = pr.id AND a.status = 'active' AND a.can_track_time
                      AND (a.ends_at IS NULL OR a.ends_at >= v_today))
          OR EXISTS (SELECT 1 FROM public.project_time_entries e WHERE e.project_id = pr.id AND e.source <> 'import'
                      AND e.entry_date >= v_today - 60));

  IF (v_wsr->'schedule_missing'->>'enabled')::boolean THEN
    INSERT INTO _pa_cur
    SELECT 'schedule_missing|' || pe.id, 'schedule_missing', v_wsr->'schedule_missing'->>'severity', NULL, pe.id, NULL,
           pe.profile_id, pe.manager_id, NULL, NULL,
           jsonb_build_object('reason', 'Pessoa com alocação vigente sem jornada no TechPeople: capacidade e meta ficam desconhecidas.')
      FROM public.people pe
     WHERE pe.workspace_id = v_ws AND NOT coalesce(pe.archived, false) AND pe.work_schedule IS NULL
       AND pe.status::text IN ('active','bench','offboarding')
       AND EXISTS (SELECT 1 FROM public.people_allocations a WHERE a.person_id = pe.id AND a.status = 'active'
                    AND coalesce(a.starts_at, v_today) <= v_today AND (a.ends_at IS NULL OR a.ends_at >= v_today));
  END IF;

  IF (v_wsr->'deal_won_no_project'->>'enabled')::boolean AND coalesce(v_pol.enabled, false) AND v_pol.activated_at IS NOT NULL THEN
    INSERT INTO _pa_cur
    SELECT 'deal_won_no_project|' || d.id, 'deal_won_no_project', v_wsr->'deal_won_no_project'->>'severity', NULL, NULL, d.id,
           NULL, coalesce(d.assigned_to, d.owner_id), (d.closed_at AT TIME ZONE p_tz)::date, v_today,
           jsonb_build_object('deal', d.name, 'closed_at', d.closed_at, 'job_status', (SELECT j.status FROM public.deal_delivery_jobs j WHERE j.deal_id = d.id ORDER BY j.created_at DESC LIMIT 1))
      FROM public.deals d
     WHERE d.workspace_id = v_ws AND d.deleted_at IS NULL AND d.closed_at >= v_pol.activated_at
       AND d.closed_at < now() - make_interval(days => (v_wsr->'deal_won_no_project'->>'grace_days')::int)
       AND public.deal_stage_type(d.pipeline_id, d.stage_id, d.stage::text) = 'won'
       AND NOT EXISTS (SELECT 1 FROM public.projects p WHERE p.deal_id = d.id)
       AND NOT EXISTS (SELECT 1 FROM public.project_deal_links l WHERE l.deal_id = d.id)
       AND coalesce((SELECT j.status FROM public.deal_delivery_jobs j WHERE j.deal_id = d.id ORDER BY j.created_at DESC LIMIT 1), '') NOT IN ('skipped','cancelled');
  END IF;

  INSERT INTO _pa_cur
  SELECT 'no_operational_owner|' || pr.id, 'no_operational_owner', pr.r->'no_operational_owner'->>'severity', pr.id, NULL, pr.deal_id,
         NULL, NULL, NULL, NULL, jsonb_build_object('reason', 'Projeto nascido de negócio ganho sem responsável operacional.')
    FROM _pa_pr pr
   WHERE pr.deal_id IS NOT NULL AND pr.st IN ('active','planning') AND pr.assigned_to IS NULL
     AND (pr.r->'no_operational_owner'->>'enabled')::boolean;

  SELECT count(*) INTO v_cur FROM _pa_cur;

  -- Existentes ainda presentes: atualiza evidência; volta a abrir resolvido/adiamento vencido.
  WITH old AS (
    SELECT a.id, a.status, a.severity, a.snoozed_until, a.present FROM public.project_alerts a
      JOIN _pa_cur c ON c.dedupe_key = a.dedupe_key WHERE a.workspace_id = v_ws),
  upd AS (
    UPDATE public.project_alerts a SET
      present = true, last_detected_at = now(), severity = c.severity, evidence = c.evidence,
      period_from = c.period_from, period_to = c.period_to, owner_user_id = c.owner_user_id, subject_user_id = c.subject_user_id,
      status = CASE WHEN a.status = 'resolved' THEN 'open'
                    WHEN a.status = 'snoozed' AND a.snoozed_until <= v_today THEN 'open' ELSE a.status END,
      snoozed_until = CASE WHEN a.status = 'snoozed' AND a.snoozed_until <= v_today THEN NULL ELSE a.snoozed_until END,
      resolution = CASE WHEN a.status = 'resolved' THEN NULL ELSE a.resolution END,
      resolved_at = CASE WHEN a.status = 'resolved' THEN NULL ELSE a.resolved_at END,
      reopened_count = a.reopened_count + CASE WHEN a.status = 'resolved' THEN 1 ELSE 0 END,
      updated_at = CASE WHEN a.status = 'resolved' OR a.severity IS DISTINCT FROM c.severity
                          OR (a.status = 'snoozed' AND a.snoozed_until <= v_today) THEN now() ELSE a.updated_at END
      FROM _pa_cur c
     WHERE a.workspace_id = v_ws AND a.dedupe_key = c.dedupe_key
    RETURNING a.id, a.status AS new_status, a.severity AS new_sev),
  ev AS (
    INSERT INTO public.project_alert_events (workspace_id, alert_id, kind, actor, run_id, before, after, note)
    SELECT v_ws, upd.id,
           CASE WHEN old.status = 'resolved' THEN 'reappeared'
                WHEN old.status = 'snoozed' AND upd.new_status = 'open' THEN 'snooze_expired' ELSE 'changed' END,
           p_actor, v_run,
           jsonb_build_object('status', old.status, 'severity', old.severity),
           jsonb_build_object('status', upd.new_status, 'severity', upd.new_sev),
           CASE WHEN old.status = 'resolved' AND old.present THEN 'Causa ainda presente após resolução manual.' END
      FROM upd JOIN old ON old.id = upd.id
     WHERE old.status IS DISTINCT FROM upd.new_status OR old.severity IS DISTINCT FROM upd.new_sev
    RETURNING kind)
  SELECT count(*) FILTER (WHERE kind = 'reappeared'), count(*) FILTER (WHERE kind = 'changed'), count(*) FILTER (WHERE kind = 'snooze_expired')
    INTO v_re, v_chg, v_exp FROM ev;

  WITH ins AS (
    INSERT INTO public.project_alerts (workspace_id, dedupe_key, rule_key, rule_version, severity, project_id, person_id, deal_id,
                                       subject_user_id, owner_user_id, period_from, period_to, evidence)
    SELECT v_ws, c.dedupe_key, c.rule_key,
           (SELECT max(v.version) FROM public.project_risk_rule_versions v WHERE v.workspace_id = v_ws
             AND (v.project_id IS NULL OR v.project_id = c.project_id)),
           c.severity, c.project_id, c.person_id, c.deal_id, c.subject_user_id, c.owner_user_id, c.period_from, c.period_to, c.evidence
      FROM _pa_cur c
     WHERE NOT EXISTS (SELECT 1 FROM public.project_alerts a WHERE a.workspace_id = v_ws AND a.dedupe_key = c.dedupe_key)
    RETURNING id),
  ev AS (INSERT INTO public.project_alert_events (workspace_id, alert_id, kind, actor, run_id)
         SELECT v_ws, ins.id, 'detected', p_actor, v_run FROM ins RETURNING 1)
  SELECT count(*) INTO v_new FROM ev;

  WITH gone AS (
    UPDATE public.project_alerts a SET present = false, status = 'resolved', resolution = 'auto', resolved_at = now(), updated_at = now()
     WHERE a.workspace_id = v_ws AND a.present
       AND NOT EXISTS (SELECT 1 FROM _pa_cur c WHERE c.dedupe_key = a.dedupe_key)
    RETURNING a.id, a.status),
  ev AS (INSERT INTO public.project_alert_events (workspace_id, alert_id, kind, actor, run_id, note)
         SELECT v_ws, gone.id, 'auto_resolved', p_actor, v_run, 'A causa não foi mais encontrada na avaliação.' FROM gone RETURNING 1)
  SELECT count(*) INTO v_gone FROM ev;

  UPDATE public.project_alert_runs SET finished_at = clock_timestamp(),
         counts = jsonb_build_object('present', v_cur, 'new', v_new, 'reappeared', v_re, 'changed', v_chg,
                                     'snooze_expired', v_exp, 'auto_resolved', v_gone)
   WHERE id = v_run;
  RETURN jsonb_build_object('status', 'done', 'run_id', v_run, 'evaluated_on', v_today, 'present', v_cur, 'new', v_new,
                            'reappeared', v_re, 'changed', v_chg, 'snooze_expired', v_exp, 'auto_resolved', v_gone);
END $$;
REVOKE ALL ON FUNCTION public.project_alert_evaluate(uuid, text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.project_alert_evaluate(uuid, text, uuid, text) TO service_role;

-- Reavaliar agora (manual): admin ativo ou permissão de tratar alertas; Ver Como (somente leitura) recusa.
CREATE OR REPLACE FUNCTION public.project_alert_refresh(p_tz text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ws uuid := public.project_dash_ws();
BEGIN
  PERFORM public.project_time_assert_actor(v_ws, true);
  IF NOT (public.is_active_workspace_admin(v_ws, auth.uid())
          OR public.user_has_permission(auth.uid(), v_ws, 'techprojects.alerts.manage.workspace')) THEN
    RAISE EXCEPTION 'Sem permissão para reavaliar alertas.' USING ERRCODE = '42501';
  END IF;
  RETURN public.project_alert_evaluate(v_ws, p_tz, auth.uid(), 'manual');
END $$;
REVOKE ALL ON FUNCTION public.project_alert_refresh(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_alert_refresh(text) TO authenticated;

-- Agendador (pg_cron, mesmo padrão do Ciclo 2): avalia no máximo uma vez por dia, por workspace que ligou
-- "_schedule.enabled" na versão vigente das regras. Lease = trava consultiva por workspace (dentro da avaliação);
-- falha registra a execução com erro e espera 1 h antes de tentar de novo (backoff). Nunca envia aviso externo.
CREATE OR REPLACE FUNCTION public.project_alert_scheduled_tick(p_limit integer DEFAULT 5)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w record; v_done int := 0; v_fail int := 0; v_skip int := 0; v_res jsonb;
BEGIN
  FOR w IN
    SELECT x.workspace_id, coalesce(x.rules->'_schedule'->>'tz', 'America/Sao_Paulo') AS tz
      FROM (SELECT DISTINCT ON (v.workspace_id) v.workspace_id, v.rules FROM public.project_risk_rule_versions v
             WHERE v.project_id IS NULL ORDER BY v.workspace_id, v.version DESC) x
     WHERE coalesce((x.rules->'_schedule'->>'enabled')::boolean, false)
       AND NOT EXISTS (SELECT 1 FROM public.project_alert_runs r WHERE r.workspace_id = x.workspace_id AND r.trigger = 'scheduled'
                        AND ((r.finished_at IS NOT NULL AND r.started_at > now() - interval '20 hours')
                             OR (r.finished_at IS NULL AND r.started_at > now() - interval '1 hour')))
     LIMIT greatest(1, least(coalesce(p_limit, 5), 50))
  LOOP
    BEGIN
      v_res := public.project_alert_evaluate(w.workspace_id, w.tz, NULL, 'scheduled');
      IF v_res->>'status' = 'busy' THEN v_skip := v_skip + 1; ELSE v_done := v_done + 1; END IF;
    EXCEPTION WHEN others THEN
      v_fail := v_fail + 1;
      INSERT INTO public.project_alert_runs (workspace_id, actor, trigger, tz, evaluated_on, counts)
      VALUES (w.workspace_id, NULL, 'scheduled', w.tz, current_date, jsonb_build_object('error', left(SQLERRM, 300)));
    END;
  END LOOP;
  RETURN jsonb_build_object('evaluated', v_done, 'failed', v_fail, 'busy', v_skip);
END $$;
REVOKE ALL ON FUNCTION public.project_alert_scheduled_tick(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.project_alert_scheduled_tick(integer) TO service_role;

-- Quem pode tratar um alerta: admin, permissão de tratar, líder do projeto, editor do negócio ou líder da pessoa.
CREATE OR REPLACE FUNCTION public.project_alert_can_act(p_alert uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_alerts a
     WHERE a.id = p_alert AND a.workspace_id IN (SELECT public.current_user_workspaces())
       AND (public.is_active_workspace_admin(a.workspace_id, auth.uid())
            OR public.user_has_permission(auth.uid(), a.workspace_id, 'techprojects.alerts.manage.workspace')
            OR (a.project_id IS NOT NULL AND a.project_id IN (SELECT public.project_dash_leader_projects(a.workspace_id, auth.uid())))
            OR (a.deal_id IS NOT NULL AND a.project_id IS NULL AND public.deal_delivery_can_edit_deal(a.deal_id))
            OR (a.person_id IS NOT NULL AND public.project_dash_person_in_led(a.workspace_id, a.person_id)))) $$;
REVOKE ALL ON FUNCTION public.project_alert_can_act(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_alert_can_act(uuid) TO authenticated;

-- Reconhecer/adiar/resolver/reabrir: justificativa obrigatória; nunca altera a fonte (apontamento, projeto, negócio).
CREATE OR REPLACE FUNCTION public.project_alert_act(p_alert uuid, p_action text, p_note text, p_until date DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a record; v_new text; v_today date;
BEGIN
  SELECT * INTO a FROM public.project_alerts WHERE id = p_alert FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Alerta não encontrado.' USING ERRCODE = 'P0002'; END IF;
  PERFORM public.project_time_assert_actor(a.workspace_id, true);
  IF NOT public.project_alert_can_act(p_alert) THEN RAISE EXCEPTION 'Sem permissão para tratar este alerta.' USING ERRCODE = '42501'; END IF;
  IF length(btrim(coalesce(p_note, ''))) < 5 THEN RAISE EXCEPTION 'Descreva a justificativa (mínimo 5 caracteres).' USING ERRCODE = '22023'; END IF;
  v_today := current_date;
  CASE p_action
    WHEN 'ack' THEN
      IF a.status NOT IN ('open','snoozed') THEN RAISE EXCEPTION 'Só alertas abertos ou adiados podem ser reconhecidos.' USING ERRCODE = '22023'; END IF;
      v_new := 'acknowledged';
    WHEN 'snooze' THEN
      IF a.status = 'resolved' THEN RAISE EXCEPTION 'Alerta resolvido não pode ser adiado.' USING ERRCODE = '22023'; END IF;
      IF p_until IS NULL OR p_until <= v_today OR p_until > v_today + 90 THEN
        RAISE EXCEPTION 'Adie para uma data entre amanhã e 90 dias.' USING ERRCODE = '22023';
      END IF;
      v_new := 'snoozed';
    WHEN 'resolve' THEN
      IF a.status = 'resolved' THEN RAISE EXCEPTION 'Alerta já resolvido.' USING ERRCODE = '22023'; END IF;
      v_new := 'resolved';
    WHEN 'reopen' THEN
      IF a.status = 'open' THEN RAISE EXCEPTION 'Alerta já está aberto.' USING ERRCODE = '22023'; END IF;
      v_new := 'open';
    ELSE RAISE EXCEPTION 'Ação inválida.' USING ERRCODE = '22023';
  END CASE;
  UPDATE public.project_alerts SET status = v_new, updated_at = now(),
         snoozed_until = CASE WHEN v_new = 'snoozed' THEN p_until ELSE NULL END,
         resolution = CASE WHEN v_new = 'resolved' THEN 'manual' ELSE NULL END,
         resolved_at = CASE WHEN v_new = 'resolved' THEN now() ELSE NULL END
   WHERE id = p_alert;
  INSERT INTO public.project_alert_events (workspace_id, alert_id, kind, actor, note, before, after)
  VALUES (a.workspace_id, p_alert,
          CASE p_action WHEN 'ack' THEN 'acknowledged' WHEN 'snooze' THEN 'snoozed' WHEN 'resolve' THEN 'resolved' ELSE 'reopened' END,
          auth.uid(), btrim(p_note), jsonb_build_object('status', a.status, 'snoozed_until', a.snoozed_until),
          jsonb_build_object('status', v_new, 'snoozed_until', CASE WHEN v_new = 'snoozed' THEN p_until END));
  RETURN jsonb_build_object('id', p_alert, 'status', v_new);
END $$;
REVOKE ALL ON FUNCTION public.project_alert_act(uuid, text, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_alert_act(uuid, text, text, date) TO authenticated;

-- =========================================================== RLS das tabelas novas
CREATE POLICY project_risk_rule_versions_select ON public.project_risk_rule_versions FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()));

-- Visibilidade de alertas calculada uma vez por consulta (subconsulta não correlacionada): admin ou permissão de
-- ver/tratar alertas; líder do projeto; negócio visível (mesmas condições de deal_visible_to_current_user);
-- pessoa alvo; ou pessoa alocada em projeto liderado.
CREATE OR REPLACE FUNCTION public.project_alert_visible_ids()
RETURNS SETOF uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_ws uuid; v_led uuid[]; v_ppl uuid[]; v_dws boolean; v_dteam boolean; v_down boolean;
  v_tids uuid[]; v_restr boolean;
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;
  FOR v_ws IN SELECT w FROM public.current_user_workspaces() AS w LOOP
    IF public.is_active_workspace_admin(v_ws, v_uid)
       OR public.user_has_permission(v_uid, v_ws, 'techprojects.alerts.view.workspace')
       OR public.user_has_permission(v_uid, v_ws, 'techprojects.alerts.manage.workspace') THEN
      RETURN QUERY SELECT a.id FROM public.project_alerts a WHERE a.workspace_id = v_ws;
      CONTINUE;
    END IF;
    v_led := ARRAY(SELECT public.project_dash_leader_projects(v_ws, v_uid));
    v_ppl := ARRAY(SELECT DISTINCT al.person_id FROM public.people_allocations al WHERE al.workspace_id = v_ws AND al.project_id = ANY (v_led));
    v_dws := public.user_has_permission(v_uid, v_ws, 'techsales.deals.view.workspace');
    v_dteam := public.user_has_permission(v_uid, v_ws, 'techsales.deals.view.team');
    v_down := public.user_has_permission(v_uid, v_ws, 'techsales.deals.view.own');
    v_tids := ARRAY(SELECT public.my_team_member_ids());
    v_restr := v_ws IN (SELECT public.rep_restricted_workspaces());
    RETURN QUERY
      SELECT a.id FROM public.project_alerts a LEFT JOIN public.deals d ON d.id = a.deal_id
       WHERE a.workspace_id = v_ws
         AND (a.project_id = ANY (v_led) OR a.subject_user_id = v_uid OR a.person_id = ANY (v_ppl)
              OR (d.id IS NOT NULL AND d.workspace_id = v_ws AND d.deleted_at IS NULL
                  AND (v_dws OR (v_dteam AND (d.assigned_to = v_uid OR d.owner_id = v_uid OR d.assigned_to = ANY (v_tids)))
                       OR (v_down AND (d.assigned_to = v_uid OR d.owner_id = v_uid)))
                  AND (NOT v_restr OR d.assigned_to = v_uid OR d.owner_id = v_uid)));
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.project_alert_visible_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_alert_visible_ids() TO authenticated;

CREATE POLICY project_alerts_select ON public.project_alerts FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()) AND id IN (SELECT public.project_alert_visible_ids()));

CREATE POLICY project_alert_events_select ON public.project_alert_events FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()) AND alert_id IN (SELECT a.id FROM public.project_alerts a));

CREATE POLICY project_alert_runs_select ON public.project_alert_runs FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces())
         AND (public.is_active_workspace_admin(workspace_id, auth.uid())
              OR public.user_has_permission(auth.uid(), workspace_id, 'techprojects.alerts.view.workspace')
              OR public.user_has_permission(auth.uid(), workspace_id, 'techprojects.alerts.manage.workspace')));

-- Conjunto de alertas para cartões e lista (RLS acima).
CREATE OR REPLACE FUNCTION public.project_dash_ds_alerts(p_view text, f jsonb)
RETURNS TABLE(id uuid, rule_key text, severity text, status text, project_id uuid, person_id uuid, deal_id uuid,
              subject_user_id uuid, owner_user_id uuid, period_from date, period_to date, evidence jsonb,
              first_detected_at timestamptz, last_detected_at timestamptz, snoozed_until date, reopened_count integer, m text[])
LANGUAGE sql STABLE SET search_path = public AS $$
  WITH b0 AS (SELECT (f->>'ws')::uuid ws, (f->>'today')::date td,
                    nullif(f->>'project', '')::uuid pj, nullif(f->>'company', '')::uuid co, nullif(f->>'service', '')::uuid sv,
                    nullif(f->>'leader', '')::uuid ld, nullif(f->>'person', '')::uuid pe),
  b AS MATERIALIZED (
    SELECT b0.*, ARRAY(SELECT public.project_dash_team_projects(b0.ws)) team, public.project_dash_full(b0.ws) full_,
           CASE WHEN b0.ld IS NOT NULL THEN ARRAY(SELECT public.project_dash_leader_projects(b0.ws, b0.ld)) END lds
      FROM b0)
  SELECT a.id, a.rule_key, a.severity, a.status, a.project_id, a.person_id, a.deal_id, a.subject_user_id, a.owner_user_id,
         a.period_from, a.period_to, a.evidence, a.first_detected_at, a.last_detected_at, a.snoozed_until, a.reopened_count,
         array_remove(ARRAY['all', 'status_' || a.status, 'rule_' || a.rule_key,
           CASE WHEN a.status <> 'resolved' THEN 'active' END,
           CASE WHEN a.status <> 'resolved' THEN 'sev_' || a.severity END,
           CASE WHEN a.status = 'open' OR (a.status = 'snoozed' AND a.snoozed_until <= b.td) THEN 'needs_action' END], NULL)
    FROM public.project_alerts a CROSS JOIN b
    LEFT JOIN public.projects pr ON pr.id = a.project_id
   WHERE a.workspace_id = b.ws
     AND (p_view <> 'me' OR a.subject_user_id = auth.uid() OR a.owner_user_id = auth.uid())
     AND (p_view <> 'team' OR a.project_id = ANY (b.team)
          OR (a.person_id IS NOT NULL AND (b.full_ OR public.project_dash_person_in_led(b.ws, a.person_id))))
     AND (p_view <> 'commercial' OR a.rule_key IN ('deal_won_no_project','no_operational_owner'))
     AND (b.pj IS NULL OR a.project_id = b.pj) AND (b.co IS NULL OR pr.company_id = b.co) AND (b.sv IS NULL OR pr.service_id = b.sv)
     AND (b.ld IS NULL OR a.project_id = ANY (b.lds))
     AND (b.pe IS NULL OR a.subject_user_id = b.pe) $$;
REVOKE ALL ON FUNCTION public.project_dash_ds_alerts(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_dash_ds_alerts(text, jsonb) TO authenticated;

-- Envios de outras pessoas que o usuário pode aprovar (só contagem). Avalia o direito de aprovar uma vez por
-- par projeto/pessoa, não por apontamento; quem pode aprovar já enxerga esses registros pela RLS de horas.
CREATE OR REPLACE FUNCTION public.project_dash_pending_approvals(p_ws uuid)
RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(sum(c.n), 0)::bigint FROM (
    SELECT e.project_id, e.user_id, count(*) n FROM public.project_time_entries e
     WHERE p_ws = public.project_dash_ws() AND e.workspace_id = p_ws AND e.status = 'submitted' AND e.user_id <> auth.uid()
     GROUP BY 1, 2) c
   WHERE public.project_time_can_approve(auth.uid(), c.project_id, c.user_id) $$;
REVOKE ALL ON FUNCTION public.project_dash_pending_approvals(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_dash_pending_approvals(uuid) TO authenticated;

-- =========================================================== resumo e lista
CREATE OR REPLACE FUNCTION public.project_dash_summary(p_view text, p_filters jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE f jsonb; sc jsonb; r jsonb; v_ws uuid;
BEGIN
  IF p_view NOT IN ('me','team','commercial','finance','quality') THEN RAISE EXCEPTION 'Visão inválida.' USING ERRCODE = '22023'; END IF;
  sc := public.project_dash_scope();
  IF NOT coalesce((sc->'views'->>p_view)::boolean, false) THEN RAISE EXCEPTION 'Visão não disponível para seu acesso.' USING ERRCODE = '42501'; END IF;
  f := public.project_dash_f(p_filters);
  v_ws := (f->>'ws')::uuid;
  r := jsonb_build_object('view', p_view, 'filters', f - 'ws', 'generated_at', now(), 'scope', sc);

  IF p_view IN ('me','team','quality','finance') THEN
    r := r || jsonb_build_object('entries', (SELECT coalesce(jsonb_object_agg(mm, jsonb_build_object('n', n, 'secs', s)), '{}')
      FROM (SELECT mm, count(*) n, coalesce(sum(x.secs), 0) s FROM public.project_dash_ds_entries(p_view, f) x, unnest(x.m) mm GROUP BY mm) q));
    IF (f->>'compare')::boolean AND p_view IN ('me','team') THEN
      r := r || jsonb_build_object('entries_prev', (SELECT coalesce(jsonb_object_agg(mm, jsonb_build_object('n', n, 'secs', s)), '{}')
        FROM (SELECT mm, count(*) n, coalesce(sum(x.secs), 0) s FROM public.project_dash_ds_entries(p_view, f, true) x, unnest(x.m) mm GROUP BY mm) q));
    END IF;
  END IF;
  IF p_view IN ('me','team','quality') THEN
    r := r || jsonb_build_object('projects', (SELECT coalesce(jsonb_object_agg(mm, jsonb_build_object('n', n)), '{}')
      FROM (SELECT mm, count(*) n FROM public.project_dash_ds_projects(p_view, f) x, unnest(x.m) mm GROUP BY mm) q));
  END IF;
  IF p_view IN ('me','team') THEN
    r := r || jsonb_build_object(
      'tasks', (SELECT coalesce(jsonb_object_agg(mm, jsonb_build_object('n', n)), '{}')
        FROM (SELECT mm, count(*) n FROM public.project_dash_ds_tasks(p_view, f) x, unnest(x.m) mm GROUP BY mm) q),
      'milestones', (SELECT coalesce(jsonb_object_agg(mm, jsonb_build_object('n', n)), '{}')
        FROM (SELECT mm, count(*) n FROM public.project_dash_ds_milestones(p_view, f) x, unnest(x.m) mm GROUP BY mm) q),
      'people', (SELECT coalesce(jsonb_object_agg(mm, jsonb_build_object('n', n, 'contracted', ct, 'allocated_total', at,
                   'allocated_scope', asc_, 'registered', rg, 'submitted', sb, 'gap', gp, 'known', kn)), '{}')
        FROM (SELECT mm, count(*) n, sum(x.contracted) ct, sum(x.allocated_total) at, sum(x.allocated_scope) asc_,
                     sum(x.registered) rg, sum(x.submitted) sb, sum(x.gap) gp, count(*) FILTER (WHERE x.schedule_known) kn
                FROM public.project_dash_ds_people(p_view, f) x, unnest(x.m) mm GROUP BY mm) q));
  END IF;
  IF p_view = 'me' THEN
    r := r || jsonb_build_object('my_allocations', (SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.starts_at), '[]')
      FROM public.project_dash_my_allocations(f) a),
      'pending_approvals', public.project_dash_pending_approvals(v_ws));
  END IF;
  IF p_view = 'team' THEN
    r := r || jsonb_build_object('forecast', (SELECT coalesce(jsonb_object_agg(mm, jsonb_build_object('n', n)), '{}')
      FROM (SELECT mm, count(*) n FROM public.project_dash_ds_forecast(p_view, f) x, unnest(x.m) mm GROUP BY mm) q));
  END IF;
  IF p_view = 'commercial' THEN
    r := r || jsonb_build_object('deals', (SELECT coalesce(jsonb_object_agg(mm, jsonb_build_object('n', n, 'transition_median_s', med)), '{}')
      FROM (SELECT mm, count(*) n, percentile_cont(0.5) WITHIN GROUP (ORDER BY x.transition_seconds) med
              FROM public.project_dash_ds_deals(f) x, unnest(x.m) mm GROUP BY mm) q),
      'policy', (SELECT jsonb_build_object('enabled', p.enabled, 'activated_at', p.activated_at) FROM public.deal_delivery_policies p WHERE p.workspace_id = v_ws));
  END IF;
  IF p_view = 'finance' THEN
    r := r || jsonb_build_object('measurements', (SELECT coalesce(jsonb_object_agg(mm, v), '{}') FROM (
        SELECT mm, jsonb_agg(jsonb_build_object('currency', cur, 'n', n, 'amount', amt, 'received', rec) ORDER BY cur) v FROM (
          SELECT mm, x.currency cur, count(*) n, coalesce(sum(x.total_amount), 0) amt, coalesce(sum(x.received), 0) rec
            FROM public.project_dash_ds_measurements(f) x, unnest(x.m) mm GROUP BY mm, x.currency) q GROUP BY mm) z));
    IF (sc->>'can_cost')::boolean THEN
      r := r || jsonb_build_object('cost', (SELECT coalesce(jsonb_object_agg(mm, jsonb_build_object('n', n, 'secs', s)), '{}')
        FROM (SELECT mm, sum(x.n) n, coalesce(sum(x.secs), 0) s FROM public.project_dash_ds_cost(f) x, unnest(x.m) mm GROUP BY mm) q),
        'cost_currency', coalesce(nullif(f->>'currency', ''), 'BRL'));
    END IF;
  END IF;
  IF p_view = 'quality' THEN
    r := r || jsonb_build_object('quality', jsonb_build_object(
      'issues', (SELECT coalesce(jsonb_object_agg(issue_type, jsonb_build_object('alerts', n, 'entries', ne)), '{}') FROM (
         SELECT i.issue_type, count(*) n, count(DISTINCT i.time_entry_id) ne FROM public.project_reconciliation_issues i
          WHERE i.workspace_id = v_ws AND i.present AND i.status IN ('open','deferred')
            AND (i.entry_date IS NULL OR i.entry_date BETWEEN (f->>'from')::date AND (f->>'to')::date)
            AND (nullif(f->>'project', '') IS NULL OR i.project_id = (f->>'project')::uuid)
            AND (nullif(f->>'person', '') IS NULL OR i.user_id = (f->>'person')::uuid)
          GROUP BY 1) q),
      'issues_total', (SELECT jsonb_build_object('alerts', count(*), 'entries', count(DISTINCT i.time_entry_id),
                         'without_entry', count(*) FILTER (WHERE i.time_entry_id IS NULL))
          FROM public.project_reconciliation_issues i
          WHERE i.workspace_id = v_ws AND i.present AND i.status IN ('open','deferred')
            AND (i.entry_date IS NULL OR i.entry_date BETWEEN (f->>'from')::date AND (f->>'to')::date)
            AND (nullif(f->>'project', '') IS NULL OR i.project_id = (f->>'project')::uuid)
            AND (nullif(f->>'person', '') IS NULL OR i.user_id = (f->>'person')::uuid)),
      'last_refresh', (SELECT jsonb_build_object('finished_at', x.finished_at, 'counts', x.counts) FROM public.project_reconciliation_refreshes x
                        WHERE x.workspace_id = v_ws AND x.finished_at IS NOT NULL ORDER BY x.finished_at DESC LIMIT 1),
      'links', (SELECT jsonb_build_object('entries', count(*), 'with_person', count(*) FILTER (WHERE e.person_id IS NOT NULL),
                         'with_allocation', count(*) FILTER (WHERE e.allocation_id IS NOT NULL),
                         'without_people_record', count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM public.people pe WHERE pe.workspace_id = v_ws AND pe.profile_id = e.user_id)))
          FROM public.project_time_entries e JOIN public.project_dash_ds_entries(p_view, f) x ON x.id = e.id)));
  END IF;
  r := r || jsonb_build_object('alerts', (SELECT coalesce(jsonb_object_agg(mm, jsonb_build_object('n', n)), '{}')
      FROM (SELECT mm, count(*) n FROM public.project_dash_ds_alerts(p_view, f) x, unnest(x.m) mm GROUP BY mm) q),
    'alert_last_run', (SELECT jsonb_build_object('finished_at', x.finished_at, 'evaluated_on', x.evaluated_on, 'counts', x.counts)
                         FROM public.project_alert_runs x WHERE x.workspace_id = v_ws AND x.finished_at IS NOT NULL
                        ORDER BY x.started_at DESC LIMIT 1));
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.project_dash_summary(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_dash_summary(text, jsonb) TO authenticated;

-- Lista paginada: mesma função de conjunto do cartão, filtrada pelo indicador; total real sempre informado.
CREATE OR REPLACE FUNCTION public.project_dash_drill(p_view text, p_dataset text, p_metric text, p_filters jsonb,
                                                     p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE f jsonb; sc jsonb; v_total bigint; v_secs numeric; v_rows jsonb; v_lim int := least(greatest(coalesce(p_limit, 50), 1), 1000);
  v_off int := greatest(coalesce(p_offset, 0), 0);
BEGIN
  IF p_view NOT IN ('me','team','commercial','finance','quality') THEN RAISE EXCEPTION 'Visão inválida.' USING ERRCODE = '22023'; END IF;
  sc := public.project_dash_scope();
  IF NOT coalesce((sc->'views'->>p_view)::boolean, false) THEN RAISE EXCEPTION 'Visão não disponível para seu acesso.' USING ERRCODE = '42501'; END IF;
  IF coalesce(p_metric, '') !~ '^[a-z_]{1,48}$' THEN RAISE EXCEPTION 'Indicador inválido.' USING ERRCODE = '22023'; END IF;
  f := public.project_dash_f(p_filters);
  CASE p_dataset
  WHEN 'entries' THEN
    IF p_view NOT IN ('me','team','quality','finance') THEN RAISE EXCEPTION 'Lista indisponível nesta visão.' USING ERRCODE = '22023'; END IF;
    SELECT count(*), coalesce(sum(x.secs), 0) INTO v_total, v_secs FROM public.project_dash_ds_entries(p_view, f) x WHERE p_metric = ANY (x.m);
    SELECT coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'date', x.entry_date, 'project_id', x.project_id,
             'project', pr.name, 'user_id', x.user_id, 'person', pf.full_name, 'seconds', x.secs, 'status', x.k, 'origin', x.origin,
             'billable', x.billable, 'in_review', 'in_review' = ANY (x.m)) ORDER BY x.entry_date DESC, x.id), '[]')
      INTO v_rows FROM (SELECT * FROM public.project_dash_ds_entries(p_view, f) x WHERE p_metric = ANY (x.m)
                         ORDER BY x.entry_date DESC, x.id LIMIT v_lim OFFSET v_off) x
      LEFT JOIN public.projects pr ON pr.id = x.project_id LEFT JOIN public.profiles pf ON pf.id = x.user_id;
  WHEN 'projects' THEN
    IF p_view NOT IN ('me','team','quality') THEN RAISE EXCEPTION 'Lista indisponível nesta visão.' USING ERRCODE = '22023'; END IF;
    SELECT count(*) INTO v_total FROM public.project_dash_ds_projects(p_view, f) x WHERE p_metric = ANY (x.m);
    SELECT coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name, 'status', x.status, 'due_at', x.due_at,
             'planned_hours', x.planned_hours, 'owner', pf.full_name, 'kind', x.kind, 'from_deal', x.deal_id IS NOT NULL)
             ORDER BY x.due_at NULLS LAST, x.name, x.id), '[]')
      INTO v_rows FROM (SELECT * FROM public.project_dash_ds_projects(p_view, f) x WHERE p_metric = ANY (x.m)
                         ORDER BY x.due_at NULLS LAST, x.name, x.id LIMIT v_lim OFFSET v_off) x
      LEFT JOIN public.profiles pf ON pf.id = x.assigned_to;
  WHEN 'tasks' THEN
    IF p_view NOT IN ('me','team') THEN RAISE EXCEPTION 'Lista indisponível nesta visão.' USING ERRCODE = '22023'; END IF;
    SELECT count(*) INTO v_total FROM public.project_dash_ds_tasks(p_view, f) x WHERE p_metric = ANY (x.m);
    SELECT coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'title', x.title, 'project_id', x.project_id, 'project', pr.name,
             'status', x.status, 'due_at', x.due_at, 'assignee', pf.full_name, 'estimated_hours', x.estimated_hours)
             ORDER BY x.due_at NULLS LAST, x.id), '[]')
      INTO v_rows FROM (SELECT * FROM public.project_dash_ds_tasks(p_view, f) x WHERE p_metric = ANY (x.m)
                         ORDER BY x.due_at NULLS LAST, x.id LIMIT v_lim OFFSET v_off) x
      LEFT JOIN public.projects pr ON pr.id = x.project_id LEFT JOIN public.profiles pf ON pf.id = x.assignee_id;
  WHEN 'milestones' THEN
    IF p_view NOT IN ('me','team') THEN RAISE EXCEPTION 'Lista indisponível nesta visão.' USING ERRCODE = '22023'; END IF;
    SELECT count(*) INTO v_total FROM public.project_dash_ds_milestones(p_view, f) x WHERE p_metric = ANY (x.m);
    SELECT coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name, 'project_id', x.project_id, 'project', pr.name,
             'status', x.status, 'due_at', x.due_at, 'assignee', pf.full_name) ORDER BY x.due_at NULLS LAST, x.id), '[]')
      INTO v_rows FROM (SELECT * FROM public.project_dash_ds_milestones(p_view, f) x WHERE p_metric = ANY (x.m)
                         ORDER BY x.due_at NULLS LAST, x.id LIMIT v_lim OFFSET v_off) x
      LEFT JOIN public.projects pr ON pr.id = x.project_id LEFT JOIN public.profiles pf ON pf.id = x.assigned_to;
  WHEN 'people' THEN
    IF p_view NOT IN ('me','team') THEN RAISE EXCEPTION 'Lista indisponível nesta visão.' USING ERRCODE = '22023'; END IF;
    SELECT count(*), coalesce(sum(x.registered), 0) INTO v_total, v_secs FROM public.project_dash_ds_people(p_view, f) x WHERE p_metric = ANY (x.m);
    SELECT coalesce(jsonb_agg(to_jsonb(x) - 'm' - 'secs' ORDER BY x.name, x.person_id), '[]')
      INTO v_rows FROM (SELECT * FROM public.project_dash_ds_people(p_view, f) x WHERE p_metric = ANY (x.m)
                         ORDER BY x.name, x.person_id LIMIT v_lim OFFSET v_off) x;
  WHEN 'forecast' THEN
    IF p_view <> 'team' THEN RAISE EXCEPTION 'Lista indisponível nesta visão.' USING ERRCODE = '22023'; END IF;
    SELECT count(*) INTO v_total FROM public.project_dash_ds_forecast(p_view, f) x WHERE p_metric = ANY (x.m);
    SELECT coalesce(jsonb_agg(to_jsonb(x) - 'm' ORDER BY x.eta_mid NULLS LAST, x.name, x.id), '[]')
      INTO v_rows FROM (SELECT * FROM public.project_dash_ds_forecast(p_view, f) x WHERE p_metric = ANY (x.m)
                         ORDER BY x.eta_mid NULLS LAST, x.name, x.id LIMIT v_lim OFFSET v_off) x;
  WHEN 'deals' THEN
    IF p_view <> 'commercial' THEN RAISE EXCEPTION 'Lista indisponível nesta visão.' USING ERRCODE = '22023'; END IF;
    SELECT count(*) INTO v_total FROM public.project_dash_ds_deals(f) x WHERE p_metric = ANY (x.m);
    SELECT coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name, 'closed_at', x.closed_at, 'owner', pf.full_name,
             'after_policy', x.after_policy, 'project_count', x.project_count, 'project_id', x.visible_project_id,
             'project', x.visible_project_name, 'project_status', x.project_status, 'contract_status', x.contract_status,
             'transition_seconds', x.transition_seconds, 'job_status', x.job_status, 'flags', x.m) ORDER BY x.closed_at DESC, x.id), '[]')
      INTO v_rows FROM (SELECT * FROM public.project_dash_ds_deals(f) x WHERE p_metric = ANY (x.m)
                         ORDER BY x.closed_at DESC, x.id LIMIT v_lim OFFSET v_off) x
      LEFT JOIN public.profiles pf ON pf.id = x.owner_id;
  WHEN 'measurements' THEN
    IF p_view <> 'finance' THEN RAISE EXCEPTION 'Lista indisponível nesta visão.' USING ERRCODE = '22023'; END IF;
    SELECT count(*) INTO v_total FROM public.project_dash_ds_measurements(f) x WHERE p_metric = ANY (x.m);
    SELECT coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'period_from', x.period_from, 'currency', x.currency, 'status', x.status,
             'amount', x.total_amount, 'received', x.received, 'contract_id', x.contract_id, 'contract', ct.title,
             'service', sv.name, 'company', co.name, 'kind', x.kind) ORDER BY x.period_from DESC, x.id), '[]')
      INTO v_rows FROM (SELECT * FROM public.project_dash_ds_measurements(f) x WHERE p_metric = ANY (x.m)
                         ORDER BY x.period_from DESC, x.id LIMIT v_lim OFFSET v_off) x
      LEFT JOIN public.contracts ct ON ct.id = x.contract_id LEFT JOIN public.services sv ON sv.id = x.service_id
      LEFT JOIN public.companies co ON co.id = x.company_id;
  WHEN 'cost' THEN
    IF p_view <> 'finance' THEN RAISE EXCEPTION 'Lista indisponível nesta visão.' USING ERRCODE = '22023'; END IF;
    SELECT coalesce(sum(x.n), 0), coalesce(sum(x.secs), 0) INTO v_total, v_secs FROM public.project_dash_ds_cost(f) x WHERE p_metric = ANY (x.m);
    SELECT coalesce(jsonb_agg(jsonb_build_object('date', x.entry_date, 'project_id', x.project_id, 'project', pr.name,
             'person', pf.full_name, 'entries', x.n, 'seconds', x.secs, 'cost_status', x.cost_status)
             ORDER BY x.entry_date DESC, x.project_id, x.user_id), '[]')
      INTO v_rows FROM (SELECT * FROM public.project_dash_ds_cost(f) x WHERE p_metric = ANY (x.m)
                         ORDER BY x.entry_date DESC, x.project_id, x.user_id LIMIT v_lim OFFSET v_off) x
      LEFT JOIN public.projects pr ON pr.id = x.project_id LEFT JOIN public.profiles pf ON pf.id = x.user_id;
  WHEN 'alerts' THEN
    SELECT count(*) INTO v_total FROM public.project_dash_ds_alerts(p_view, f) x WHERE p_metric = ANY (x.m);
    SELECT coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'rule_key', x.rule_key, 'severity', x.severity, 'status', x.status,
             'project_id', x.project_id, 'project', pr.name, 'deal_id', x.deal_id, 'person_id', x.person_id,
             'subject', ps.full_name, 'owner', po.full_name, 'period_from', x.period_from, 'period_to', x.period_to,
             'evidence', x.evidence, 'first_detected_at', x.first_detected_at, 'last_detected_at', x.last_detected_at,
             'snoozed_until', x.snoozed_until, 'reopened_count', x.reopened_count,
             'can_act', public.project_alert_can_act(x.id))
             ORDER BY CASE x.severity WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, x.last_detected_at DESC, x.id), '[]')
      INTO v_rows FROM (SELECT * FROM public.project_dash_ds_alerts(p_view, f) x WHERE p_metric = ANY (x.m)
                         ORDER BY CASE x.severity WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, x.last_detected_at DESC, x.id
                         LIMIT v_lim OFFSET v_off) x
      LEFT JOIN public.projects pr ON pr.id = x.project_id LEFT JOIN public.profiles ps ON ps.id = x.subject_user_id
      LEFT JOIN public.profiles po ON po.id = x.owner_user_id;
  ELSE RAISE EXCEPTION 'Conjunto inválido.' USING ERRCODE = '22023';
  END CASE;
  RETURN jsonb_build_object('total', v_total, 'seconds', v_secs, 'limit', v_lim, 'offset', v_off, 'rows', v_rows, 'generated_at', now());
END $$;
REVOKE ALL ON FUNCTION public.project_dash_drill(text, text, text, jsonb, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_dash_drill(text, text, text, jsonb, integer, integer) TO authenticated;

-- Autocompletar de filtros: só o que o usuário já enxerga (RLS), no máximo 20 itens por busca.
CREATE OR REPLACE FUNCTION public.project_dash_filter_options(p_kind text, p_q text)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE v_ws uuid := public.project_dash_ws(); v_q text := '%' || replace(replace(left(btrim(coalesce(p_q, '')), 80), '%', ''), '_', '') || '%';
BEGIN
  PERFORM public.project_time_assert_actor(v_ws, false);
  RETURN CASE p_kind
    WHEN 'project' THEN (SELECT coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'label', x.name, 'hint', x.status) ), '[]') FROM (
       SELECT p.id, p.name, p.status::text status FROM public.projects p WHERE p.workspace_id = v_ws AND p.name ILIKE v_q
        ORDER BY (p.status::text = 'active') DESC, p.name LIMIT 20) x)
    WHEN 'company' THEN (SELECT coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'label', x.name)), '[]') FROM (
       SELECT c.id, c.name FROM public.companies c WHERE c.workspace_id = v_ws AND c.deleted_at IS NULL AND c.name ILIKE v_q
          AND EXISTS (SELECT 1 FROM public.projects p WHERE p.company_id = c.id) ORDER BY c.name LIMIT 20) x)
    WHEN 'service' THEN (SELECT coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'label', x.name)), '[]') FROM (
       SELECT s.id, s.name FROM public.services s WHERE s.workspace_id = v_ws AND s.name ILIKE v_q
          AND EXISTS (SELECT 1 FROM public.projects p WHERE p.service_id = s.id) ORDER BY s.name LIMIT 20) x)
    WHEN 'person' THEN (SELECT coalesce(jsonb_agg(jsonb_build_object('id', x.user_id, 'label', x.full_name, 'hint', x.st)), '[]') FROM (
       SELECT wm.user_id, coalesce(pf.full_name, 'Sem nome') full_name, CASE WHEN wm.status = 'active' THEN NULL ELSE 'inativo' END st
         FROM public.workspace_members wm JOIN public.profiles pf ON pf.id = wm.user_id
        WHERE wm.workspace_id = v_ws AND pf.full_name ILIKE v_q ORDER BY (wm.status = 'active') DESC, pf.full_name LIMIT 20) x)
    WHEN 'leader' THEN (SELECT coalesce(jsonb_agg(jsonb_build_object('id', x.user_id, 'label', x.full_name)), '[]') FROM (
       SELECT DISTINCT wm.user_id, coalesce(pf.full_name, 'Sem nome') full_name
         FROM public.workspace_members wm JOIN public.profiles pf ON pf.id = wm.user_id
        WHERE wm.workspace_id = v_ws AND pf.full_name ILIKE v_q
          AND (EXISTS (SELECT 1 FROM public.projects p WHERE p.workspace_id = v_ws AND p.assigned_to = wm.user_id)
               OR EXISTS (SELECT 1 FROM public.project_members m WHERE m.workspace_id = v_ws AND m.user_id = wm.user_id AND m.role_in_project = 'manager'))
        ORDER BY full_name LIMIT 20) x)
    ELSE '[]'::jsonb END;
END $$;
REVOKE ALL ON FUNCTION public.project_dash_filter_options(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_dash_filter_options(text, text) TO authenticated;
