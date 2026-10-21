-- TechProjects — ciclo 6: desempenho do painel (C5) medido com 1 milhão de apontamentos.
-- Mesmos resultados; muda só a forma de execução:
-- 1) pendências de aprovação agrupam antes de checar a permissão (antes: 1 checagem por apontamento);
-- 2) lista de apontamentos do painel usa o índice (workspace, data) com limites calculados uma vez;
-- 3) escopo do painel calcula as permissões efetivas uma vez e reaproveita na mesma transação;
-- 4) previsão agrega consumo e cadência direto da tabela.
CREATE OR REPLACE FUNCTION public.project_dash_pending_approvals(p_ws uuid)
 RETURNS bigint
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- Agrupa ANTES de checar a permissão (uma checagem por projeto+pessoa, não por apontamento) e só
  -- considera projetos em que o usuário tem linha de aprovador (pré-condição de project_time_can_approve).
  WITH c AS MATERIALIZED (
    SELECT e.project_id, e.user_id, count(*) n FROM public.project_time_entries e
     WHERE p_ws = public.project_dash_ws() AND e.workspace_id = p_ws AND e.status = 'submitted' AND e.user_id <> auth.uid()
       AND e.project_id IN (SELECT a.project_id FROM public.project_time_approvers a WHERE a.user_id = auth.uid() AND a.role = 'approver')
     GROUP BY 1, 2)
  SELECT coalesce(sum(c.n), 0)::bigint FROM c
   WHERE public.project_time_can_approve(auth.uid(), c.project_id, c.user_id) $function$;

CREATE OR REPLACE FUNCTION public.project_dash_ds_entries(p_view text, f jsonb, p_prev boolean DEFAULT false)
 RETURNS TABLE(id uuid, entry_date date, project_id uuid, user_id uuid, secs numeric, k text, origin text, billable boolean, m text[])
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH v AS MATERIALIZED (SELECT * FROM public.project_dash_vis()),
  b AS MATERIALIZED (
    SELECT v.*,
           CASE WHEN p_prev THEN (f->>'from')::date - ((f->>'to')::date - (f->>'from')::date + 1) ELSE (f->>'from')::date END d0,
           CASE WHEN p_prev THEN (f->>'from')::date - 1 ELSE (f->>'to')::date END d1,
           nullif(f->>'project', '')::uuid pj, nullif(f->>'company', '')::uuid co, nullif(f->>'service', '')::uuid sv,
           nullif(f->>'person', '')::uuid pe, nullif(f->>'origin', '') og, nullif(f->>'status', '') st,
           CASE WHEN nullif(f->>'leader', '') IS NOT NULL THEN ARRAY(SELECT public.project_dash_leader_projects(v.ws, (f->>'leader')::uuid)) END ld
      FROM v),
  iss AS MATERIALIZED (
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
     WHERE e.workspace_id = (SELECT b0.ws FROM b b0) AND e.entry_date BETWEEN (SELECT b0.d0 FROM b b0) AND (SELECT b0.d1 FROM b b0)
       AND e.workspace_id = b.ws AND e.entry_date BETWEEN b.d0 AND b.d1
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
   WHERE (b.og IS NULL OR e.origin = b.og) AND (b.st IS NULL OR e.k = b.st) $function$;

CREATE OR REPLACE FUNCTION public.project_dash_vis()
 RETURNS TABLE(ws uuid, uid uuid, recon boolean, te_perm boolean, te_full boolean, te_led uuid[], te_pairs text[], tk_all boolean, pr_all boolean, ms_all boolean, team uuid[], mine uuid[], dl_ws boolean, dl_team boolean, dl_own boolean, dl_team_ids uuid[], dl_restricted boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_ws uuid; v_uid uuid := auth.uid(); v_adm boolean; v_p text[]; v_row jsonb;
  v_key text := concat_ws('|', pg_backend_pid(), now(), auth.uid(), current_setting('request.jwt.claims', true));
  v_c text := current_setting('app.project_dash_vis_cache', true);
BEGIN
  -- Reaproveita o escopo dentro da MESMA transação, usuário e claims (chave inclui processo e início da
  -- transação). Clientes não definem configurações arbitrárias (mesmo modelo das flags app.* existentes).
  IF v_c IS NOT NULL AND v_c <> '' AND (v_c::jsonb->>'k') = v_key THEN
    RETURN QUERY SELECT x.* FROM jsonb_to_record(v_c::jsonb->'v') AS x(ws uuid, uid uuid, recon boolean, te_perm boolean, te_full boolean,
      te_led uuid[], te_pairs text[], tk_all boolean, pr_all boolean, ms_all boolean, team uuid[], mine uuid[], dl_ws boolean,
      dl_team boolean, dl_own boolean, dl_team_ids uuid[], dl_restricted boolean);
    RETURN;
  END IF;
  v_ws := public.project_dash_ws();
  PERFORM public.project_time_assert_actor(v_ws, false);
  v_adm := public.is_workspace_admin_v2(v_ws, v_uid);
  -- Mesma regra de user_has_permission(u, w, k): k pertence a user_effective_permissions(u, w).
  v_p := ARRAY(SELECT k::text FROM public.user_effective_permissions(v_uid, v_ws) k);
  SELECT to_jsonb(r) INTO v_row FROM (SELECT v_ws AS ws, v_uid AS uid,
    public.is_active_workspace_admin(v_ws, v_uid) AS recon,
    v_adm OR v_p && ARRAY['techprojects.time_entries.view.workspace','techprojects.time_entries.view.own',
                          'techpeople.timesheet.view.workspace','techpeople.timesheet.view.own'] AS te_perm,
    (v_ws IN (SELECT public.current_user_workspaces()))
      AND (v_adm OR v_p && ARRAY['techprojects.time_entries.view.workspace','techprojects.timesheet.view.workspace',
                                 'techpeople.timesheet.view.workspace']) AS te_full,
    ARRAY(SELECT s.project_id FROM public.project_time_led_scope() s WHERE s.subject_user_id IS NULL) AS te_led,
    ARRAY(SELECT s.project_id::text || ':' || s.subject_user_id::text FROM public.project_time_led_scope() s WHERE s.subject_user_id IS NOT NULL) AS te_pairs,
    v_adm OR v_p && ARRAY['techprojects.tasks.view.workspace','techprojects.tasks.view.own'] AS tk_all,
    v_adm OR v_p && ARRAY['techprojects.projects.view.workspace','techprojects.projects.view.own'] AS pr_all,
    v_adm OR 'techprojects.milestones.view.workspace' = ANY (v_p) AS ms_all,
    ARRAY(SELECT public.project_dash_team_projects(v_ws)) AS team,
    ARRAY(SELECT public.project_dash_my_projects(v_ws)) AS mine,
    'techsales.deals.view.workspace' = ANY (v_p) AS dl_ws,
    'techsales.deals.view.team' = ANY (v_p) AS dl_team,
    'techsales.deals.view.own' = ANY (v_p) AS dl_own,
    ARRAY(SELECT public.my_team_member_ids()) AS dl_team_ids,
    v_ws IN (SELECT public.rep_restricted_workspaces()) AS dl_restricted) r;
  PERFORM set_config('app.project_dash_vis_cache', jsonb_build_object('k', v_key, 'v', v_row)::text, true);
  RETURN QUERY SELECT x.* FROM jsonb_to_record(v_row) AS x(ws uuid, uid uuid, recon boolean, te_perm boolean, te_full boolean,
      te_led uuid[], te_pairs text[], tk_all boolean, pr_all boolean, ms_all boolean, team uuid[], mine uuid[], dl_ws boolean,
      dl_team boolean, dl_own boolean, dl_team_ids uuid[], dl_restricted boolean);
END $function$;

CREATE OR REPLACE FUNCTION public.project_dash_ds_forecast(p_view text, f jsonb)
 RETURNS TABLE(id uuid, name text, status text, kind text, due_at date, planned_hours numeric, consumed_secs numeric, open_tasks integer, est_tasks integer, remaining_secs numeric, tasks_total integer, tasks_done integer, ms_total integer, ms_done integer, weeks_with_hours integer, w_p25 numeric, w_p50 numeric, w_p75 numeric, alloc_week_secs numeric, method text, eta_low date, eta_mid date, eta_high date, reason text, cut_date date, m text[])
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  -- Consumo total por projeto e cadência das últimas 8 semanas, agregados direto da tabela (antes:
  -- todo o histórico materializado e cruzado com cada semana). Mesmos filtros e mesmas somas.
  ce AS (
    SELECT e.project_id, sum(coalesce(e.duration_seconds::numeric, public.project_entry_seconds(e.started_at, e.stopped_at, e.duration_minutes, e.hours))) s
      FROM public.project_time_entries e CROSS JOIN b
     WHERE e.workspace_id = b.ws AND e.project_id IN (SELECT id FROM pr) AND e.status <> 'rejected'
       AND b.te_perm AND (e.user_id = b.uid OR b.te_full OR e.project_id = ANY (b.te_led)
                          OR (e.project_id::text || ':' || e.user_id::text) = ANY (b.te_pairs))
     GROUP BY 1),
  ew AS (
    SELECT e.project_id, b.wk0 - 7 * (((b.wk0 - e.entry_date) - 1) / 7 + 1) AS w,
           sum(coalesce(e.duration_seconds::numeric, public.project_entry_seconds(e.started_at, e.stopped_at, e.duration_minutes, e.hours))) s
      FROM public.project_time_entries e CROSS JOIN b
     WHERE e.workspace_id = b.ws AND e.project_id IN (SELECT id FROM pr) AND e.status <> 'rejected'
       AND e.entry_date >= (SELECT b0.wk0 - 56 FROM b b0) AND e.entry_date < (SELECT b0.wk0 FROM b b0)
       AND b.te_perm AND (e.user_id = b.uid OR b.te_full OR e.project_id = ANY (b.te_led)
                          OR (e.project_id::text || ':' || e.user_id::text) = ANY (b.te_pairs))
     GROUP BY 1, 2),
  wk AS (SELECT pr.id pid, g.w, coalesce(ew.s, 0) s
           FROM pr CROSS JOIN b CROSS JOIN LATERAL (SELECT (b.wk0 - 7 * i) AS w FROM generate_series(1, 8) i) g
           LEFT JOIN ew ON ew.project_id = pr.id AND ew.w = g.w),
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
    FROM calc c $function$;
