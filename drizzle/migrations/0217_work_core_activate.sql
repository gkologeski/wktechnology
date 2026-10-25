-- Activate only after compatible handlers/screens are published. Preserve restrictive policies.
DO $$ DECLARE t text;p record;r text;s text;BEGIN
 FOR t,r IN SELECT * FROM (VALUES('contracts','techcontracts.contracts'),('projects','techprojects.projects'),('project_tasks','techprojects.tasks'))v(t,r) LOOP
 FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t AND (permissive='PERMISSIVE' OR policyname IN(t||'_perm_select',t||'_perm_insert',t||'_perm_update',t||'_perm_delete')) LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,t);END LOOP;
 s:=CASE WHEN t='project_tasks' THEN 'array_append(coalesce(assignee_ids,''{}''),assignee_id)' ELSE 'ARRAY[coalesce(assigned_to,owner_id)]' END;
 EXECUTE format('CREATE POLICY work_view ON public.%I FOR SELECT TO authenticated USING(work_context_access((SELECT work_access_context()),workspace_id,%L,''view'',%s))',t,r,s);
 EXECUTE format('CREATE POLICY work_create ON public.%I FOR INSERT TO authenticated WITH CHECK(work_context_access((SELECT work_access_context()),workspace_id,%L,''create'',%s) AND work_context_access((SELECT work_access_context()),workspace_id,%L,''view'',%s))',t,r,s,r,s);
 EXECUTE format('CREATE POLICY work_update ON public.%I FOR UPDATE TO authenticated USING(work_context_access((SELECT work_access_context()),workspace_id,%L,''update'',%s) AND work_context_access((SELECT work_access_context()),workspace_id,%L,''view'',%s)) WITH CHECK(work_context_access((SELECT work_access_context()),workspace_id,%L,''update'',%s) AND work_context_access((SELECT work_access_context()),workspace_id,%L,''view'',%s))',t,r,s,r,s,r,s,r,s);
 EXECUTE format('CREATE POLICY work_delete ON public.%I FOR DELETE TO authenticated USING(work_context_access((SELECT work_access_context()),workspace_id,%L,''delete'',%s) AND work_context_access((SELECT work_access_context()),workspace_id,%L,''view'',%s))',t,r,s,r,s);
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION public.work_core_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE r text;c jsonb;v jsonb;prior jsonb;ref record;i uuid;w uuid;u uuid;assignees uuid[];BEGIN
 IF current_user IN('postgres','supabase_admin','service_role') THEN RETURN coalesce(NEW,OLD);END IF;
 IF auth.uid() IS NULL OR is_read_only_view() THEN RAISE EXCEPTION 'Ação não autorizada.' USING ERRCODE='42501';END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;END IF;
 v:=to_jsonb(NEW);prior:=CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE '{}'::jsonb END;
 r:=CASE TG_TABLE_NAME WHEN 'contracts' THEN 'techcontracts.contracts' WHEN 'projects' THEN 'techprojects.projects' ELSE 'techprojects.tasks' END;
 IF TG_OP='UPDATE' AND (v->'id',v->'workspace_id',v->'owner_id',v->'created_at') IS DISTINCT FROM (prior->'id',prior->'workspace_id',prior->'owner_id',prior->'created_at') THEN RAISE EXCEPTION 'Identidade, autoria e workspace são imutáveis.' USING ERRCODE='42501';END IF;
 IF TG_OP='INSERT' AND TG_TABLE_NAME<>'project_tasks' AND (v->>'owner_id')::uuid IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Autoria inválida.' USING ERRCODE='42501';END IF;
 IF TG_OP='INSERT' OR (v->'assignee_id',v->'assignee_ids',v->'assigned_to') IS DISTINCT FROM (prior->'assignee_id',prior->'assignee_ids',prior->'assigned_to') THEN c:=work_access_context();END IF;
 -- Assignment never follows from generic edit. Existing historical inactive assignees remain readable/editable.
 IF TG_TABLE_NAME='project_tasks' THEN
 assignees:=array_append(coalesce(NEW.assignee_ids,'{}'),NEW.assignee_id);
 IF TG_OP='UPDATE' AND (v->'assignee_id',v->'assignee_ids') IS DISTINCT FROM (prior->'assignee_id',prior->'assignee_ids') AND NOT (c->'keys' ? (r||'.assign.workspace')) THEN RAISE EXCEPTION 'Sem permissão para reatribuir.' USING ERRCODE='42501';END IF;
 ELSE assignees:=ARRAY[(v->>'assigned_to')::uuid];
 IF TG_OP='UPDATE' AND v->'assigned_to' IS DISTINCT FROM prior->'assigned_to' AND NOT (c->'keys' ? (r||'.assign.workspace')) THEN RAISE EXCEPTION 'Sem permissão para reatribuir.' USING ERRCODE='42501';END IF;
 END IF;
 IF TG_OP='INSERT' AND EXISTS(SELECT 1 FROM unnest(assignees)x WHERE x IS NOT NULL AND x<>auth.uid()) AND NOT (c->'keys' ? (r||'.assign.workspace')) THEN RAISE EXCEPTION 'Sem permissão para atribuir a outra pessoa.' USING ERRCODE='42501';END IF;
 IF TG_OP='INSERT' OR (v->'assignee_id',v->'assignee_ids',v->'assigned_to') IS DISTINCT FROM (prior->'assignee_id',prior->'assignee_ids',prior->'assigned_to') THEN
 FOREACH u IN ARRAY assignees LOOP IF u IS NOT NULL AND NOT is_workspace_member(NEW.workspace_id,u) THEN RAISE EXCEPTION 'Responsável inativo ou de outro workspace.' USING ERRCODE='23514';END IF;END LOOP;
 END IF;
 -- Validate only new/changed links through caller RLS. Historical links are not rewritten.
 FOR ref IN SELECT * FROM (VALUES('contract_id','contracts'),('service_id','services'),('project_id','projects'),('parent_contract_id','contracts'),('amendment_of_id','contracts'),('parent_task_id','project_tasks'),('list_id','project_lists'),('milestone_id','project_milestones'),('counterparty_company_id','companies'),('company_id','companies'),('deal_id','deals'),('legal_entity_id','legal_entities'))x(col,tbl) LOOP
 i:=(v->>ref.col)::uuid;
 IF i IS NOT NULL AND (TG_OP='INSERT' OR v->ref.col IS DISTINCT FROM prior->ref.col) THEN
 EXECUTE format('SELECT workspace_id FROM public.%I WHERE id=$1',ref.tbl) INTO w USING i;
 IF w IS NULL AND TG_TABLE_NAME='project_tasks' AND ref.col='project_id' AND work_time_project_reference_allowed(i) THEN w:=NEW.workspace_id;END IF;
 IF w IS DISTINCT FROM NEW.workspace_id THEN RAISE EXCEPTION 'Vínculo indisponível ou de outro workspace.' USING ERRCODE='23514';END IF;
 IF i=NEW.id AND ref.tbl=TG_TABLE_NAME THEN RAISE EXCEPTION 'Um registro não pode ser seu próprio pai.' USING ERRCODE='23514';END IF;
 END IF;END LOOP;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.work_core_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER zzz_work_core_guard BEFORE INSERT OR UPDATE OR DELETE ON contracts FOR EACH ROW EXECUTE FUNCTION work_core_guard();
CREATE TRIGGER zzz_work_core_guard BEFORE INSERT OR UPDATE OR DELETE ON projects FOR EACH ROW EXECUTE FUNCTION work_core_guard();
CREATE TRIGGER zzz_work_core_guard BEFORE INSERT OR UPDATE OR DELETE ON project_tasks FOR EACH ROW EXECUTE FUNCTION work_core_guard();

-- The creator membership is part of the same INSERT transaction. No ignored second write.
CREATE OR REPLACE FUNCTION public.work_project_creator_member()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.owner_id=auth.uid() AND work_context_access(work_access_context(),NEW.workspace_id,'techprojects.projects','create',ARRAY[coalesce(NEW.assigned_to,NEW.owner_id)]) THEN
 INSERT INTO project_members(workspace_id,project_id,user_id,role_in_project) VALUES(NEW.workspace_id,NEW.id,NEW.owner_id,'manager') ON CONFLICT(project_id,user_id) DO NOTHING;
 END IF;RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.work_project_creator_member() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER work_creator_member AFTER INSERT ON projects FOR EACH ROW EXECUTE FUNCTION work_project_creator_member();

-- Dashboard datasets use the identical predicates, materializing effective permissions once.
CREATE OR REPLACE FUNCTION public.project_dash_ds_deals(f jsonb)
 RETURNS TABLE(id uuid, name text, closed_at timestamp with time zone, owner_id uuid, company_id uuid, after_policy boolean, project_count integer, visible_project_id uuid, visible_project_name text, project_status text, contract_status text, transition_seconds numeric, job_status text, m text[])
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_ws uuid := (f->>'ws')::uuid; v_tz text := f->>'tz'; v_act timestamptz; v_on boolean;
BEGIN
  IF v_ws IS DISTINCT FROM public.project_dash_ws() THEN RAISE EXCEPTION 'Workspace inválido.' USING ERRCODE = '42501'; END IF;
  PERFORM public.project_time_assert_actor(v_ws, false);
  SELECT pol.activated_at, pol.enabled INTO v_act, v_on FROM public.deal_delivery_policies pol WHERE pol.workspace_id = v_ws;
  RETURN QUERY
  -- vv = mesmas condições de deal_visible_to_current_user, calculadas uma vez (não por negócio).
  WITH vv AS MATERIALIZED (SELECT v.*, public.work_access_context() AS work_ctx FROM public.project_dash_vis() v),
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
      FROM d JOIN public.projects p ON p.deal_id = d.id AND p.workspace_id = v_ws AND public.work_context_access((SELECT public.work_access_context()),p.workspace_id,'techprojects.projects','view',ARRAY[coalesce(p.assigned_to,p.owner_id)])
    UNION
    SELECT d.id, p.id, p.status::text, p.assigned_to, p.created_at, p.owner_id
      FROM d JOIN public.project_deal_links l ON l.deal_id = d.id JOIN public.projects p ON p.id = l.project_id AND p.workspace_id = v_ws AND public.work_context_access((SELECT public.work_access_context()),p.workspace_id,'techprojects.projects','view',ARRAY[coalesce(p.assigned_to,p.owner_id)])),
  agg AS (
    SELECT lk.deal_id, count(*)::int AS n, min(lk.created_at) AS first_at,
           bool_or(lk.st = 'planning') AS prep, bool_or(lk.assigned_to IS NULL AND lk.st IN ('active','planning')) AS no_owner,
           -- projeto legível pelo usuário: mesmas condições de projects_perm_select
           (array_agg(lk.pid ORDER BY lk.created_at) FILTER (WHERE public.work_context_access(vv.work_ctx,v_ws,'techprojects.projects','view',ARRAY[coalesce(lk.assigned_to,lk.owner_id)])))[1] AS vis,
           (array_agg(lk.st ORDER BY lk.created_at))[1] AS st
      FROM lk CROSS JOIN vv GROUP BY lk.deal_id),
  ct AS (
    SELECT c.deal_id, CASE WHEN bool_or(c.status::text = 'active') THEN 'active'
                           WHEN bool_or(c.status::text IN ('awaiting_signature','in_review','in_negotiation','draft','renewing')) THEN 'in_progress'
                           ELSE 'ended' END AS cs
      FROM public.contracts c JOIN d ON d.id = c.deal_id
     WHERE c.workspace_id = v_ws AND public.work_context_access((SELECT public.work_access_context()),c.workspace_id,'techcontracts.contracts','view',ARRAY[coalesce(c.assigned_to,c.owner_id)]) AND coalesce(c.document_kind, '') <> 'amendment' GROUP BY c.deal_id),
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
END $function$;

CREATE OR REPLACE FUNCTION public.project_dash_ds_forecast(p_view text, f jsonb)
 RETURNS TABLE(id uuid, name text, status text, kind text, due_at date, planned_hours numeric, consumed_secs numeric, open_tasks integer, est_tasks integer, remaining_secs numeric, tasks_total integer, tasks_done integer, ms_total integer, ms_done integer, weeks_with_hours integer, w_p25 numeric, w_p50 numeric, w_p75 numeric, alloc_week_secs numeric, method text, eta_low date, eta_mid date, eta_high date, reason text, cut_date date, m text[])
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  -- Definer só para não reavaliar a RLS por linha: tarefas, marcos e apontamentos usam as MESMAS condições
  -- das políticas (project_dash_vis), e os projetos vêm de ds_projects (já restrito ao visível).
  WITH v AS MATERIALIZED (SELECT v.*, public.work_access_context() AS work_ctx FROM public.project_dash_vis() v),
  b AS (SELECT v.*, (f->>'today')::date td, (date_trunc('week', (f->>'today')::date))::date wk0 FROM v),
  pr AS MATERIALIZED (SELECT p.* FROM public.project_dash_ds_projects(p_view, f) p WHERE 'open' = ANY (p.m)),
  tk AS (SELECT t.project_id, count(*) FILTER (WHERE t.status <> 'done')::int o,
                count(*) FILTER (WHERE t.status <> 'done' AND t.estimated_hours IS NOT NULL)::int oe,
                coalesce(sum(t.estimated_hours) FILTER (WHERE t.status <> 'done'), 0) * 3600 rem,
                count(*)::int tt, count(*) FILTER (WHERE t.status = 'done')::int td
           FROM public.project_tasks t CROSS JOIN b
          WHERE t.workspace_id = b.ws AND t.project_id IN (SELECT id FROM pr) AND public.work_context_access(b.work_ctx,t.workspace_id,'techprojects.tasks','view',array_append(coalesce(t.assignee_ids,'{}'),t.assignee_id)) GROUP BY 1),
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

CREATE OR REPLACE FUNCTION public.project_dash_ds_projects(p_view text, f jsonb)
 RETURNS TABLE(id uuid, name text, status text, due_at date, planned_hours numeric, assigned_to uuid, company_id uuid, deal_id uuid, created_at timestamp with time zone, kind text, m text[])
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH v AS MATERIALIZED (SELECT v.*, public.work_access_context() AS work_ctx FROM public.project_dash_vis() v),
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
     WHERE p.workspace_id = b.ws AND public.work_context_access(b.work_ctx,p.workspace_id,'techprojects.projects','view',ARRAY[coalesce(p.assigned_to,p.owner_id)])
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
    FROM p $function$;

CREATE OR REPLACE FUNCTION public.project_dash_ds_tasks(p_view text, f jsonb)
 RETURNS TABLE(id uuid, title text, project_id uuid, status text, due_at date, assignee_id uuid, estimated_hours numeric, m text[])
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH v AS MATERIALIZED (SELECT v.*, public.work_access_context() AS work_ctx FROM public.project_dash_vis() v),
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
     WHERE t.workspace_id = b.ws AND public.work_context_access(b.work_ctx,t.workspace_id,'techprojects.tasks','view',array_append(coalesce(t.assignee_ids,'{}'),t.assignee_id))
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
    FROM t $function$;


NOTIFY pgrst,'reload schema';
