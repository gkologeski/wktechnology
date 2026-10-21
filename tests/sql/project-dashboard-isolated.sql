-- Prova isolada do ciclo 5 do TechProjects (painel por perfil, capacidade, alertas e previsão).
-- Roda SOMENTE no banco descartável do harness via
--   bash tests/sql/project-dashboard-isolated.sh drizzle/migrations/0177_*.sql
-- Asserções de acesso rodam como `authenticated` com claims de JWT (nunca service_role).
-- Fixtures sintéticas (> 5.000 apontamentos e > 5.000 tarefas) são gravadas como superusuário do harness.
\set ON_ERROR_STOP 1
\set QUIET 1
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.__isolated_marker WHERE id = 1 AND label = 'techerp-isolated-harness') THEN
    RAISE EXCEPTION 'recusado: banco sem marcador do harness';
  END IF;
END $$;

DROP SCHEMA IF EXISTS t_c5 CASCADE;
CREATE SCHEMA t_c5;
GRANT USAGE ON SCHEMA t_c5 TO authenticated, anon;
CREATE FUNCTION t_c5.ok(p_name text, p_cond boolean) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  IF p_cond IS DISTINCT FROM true THEN RAISE EXCEPTION 'FALHOU: %', p_name; END IF;
  RAISE NOTICE 'ok: %', p_name; RETURN 'ok';
END $$;
CREATE FUNCTION t_c5.err(p_sql text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN EXECUTE p_sql; RETURN 'NO ERROR';
EXCEPTION WHEN others THEN RETURN SQLERRM; END $$;
CREATE FUNCTION t_c5.as_user(p_uid uuid, p_session uuid DEFAULT NULL) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated', 'session_id', p_session)::text, true) $$;
CREATE TABLE t_c5.kv (k text PRIMARY KEY, v text);
GRANT ALL ON t_c5.kv TO authenticated;
CREATE FUNCTION t_c5.put(p text, v text) RETURNS text LANGUAGE sql AS $$
  INSERT INTO t_c5.kv VALUES (p, v) ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v RETURNING v $$;
CREATE FUNCTION t_c5.get(p text) RETURNS text LANGUAGE sql AS $$ SELECT v FROM t_c5.kv WHERE k = p $$;
-- Leituras privilegiadas apenas para conferir valores esperados (nunca como prova de acesso).
CREATE FUNCTION t_c5.n_entries(p_ws uuid, p_from date, p_to date, p_where text DEFAULT 'true') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE r jsonb;
BEGIN
  EXECUTE format('SELECT jsonb_build_object(''n'', count(*), ''secs'', coalesce(sum(coalesce(e.duration_seconds::numeric, public.project_entry_seconds(e.started_at, e.stopped_at, e.duration_minutes, e.hours))), 0))
                    FROM public.project_time_entries e WHERE e.workspace_id = %L AND e.entry_date BETWEEN %L AND %L AND (%s)', p_ws, p_from, p_to, p_where) INTO r;
  RETURN r;
END $$;
CREATE FUNCTION t_c5.hash_sources() RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT md5(coalesce((SELECT string_agg(id::text || status || coalesce(updated_at::text, '') || coalesce(duration_seconds::text, ''), ',' ORDER BY id) FROM public.project_time_entries), '')
          || coalesce((SELECT string_agg(id::text || status::text || coalesce(updated_at::text, '') || coalesce(assigned_to::text, ''), ',' ORDER BY id) FROM public.projects), '')
          || coalesce((SELECT string_agg(id::text || status::text || coalesce(updated_at::text, ''), ',' ORDER BY id) FROM public.project_milestones), '')
          || coalesce((SELECT string_agg(id::text || coalesce(updated_at::text, ''), ',' ORDER BY id) FROM public.financial_entries), '')
          || coalesce((SELECT string_agg(id::text || coalesce(updated_at::text, ''), ',' ORDER BY id) FROM public.people), '')) $$;
CREATE FUNCTION t_c5.n_events() RETURNS bigint LANGUAGE sql SECURITY DEFINER AS $$ SELECT count(*) FROM public.project_alert_events $$;
CREATE FUNCTION t_c5.alert(p_key text) RETURNS public.project_alerts LANGUAGE sql SECURITY DEFINER AS $$
  SELECT * FROM public.project_alerts WHERE dedupe_key = p_key $$;
CREATE FUNCTION t_c5.n(p jsonb, p_path text[]) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$ SELECT coalesce((p #>> p_path)::numeric, 0) $$;
-- Referências para a prova de equivalência (avaliação linha a linha, como a política original).
CREATE FUNCTION t_c5.won_deals(p_from date, p_to date) RETURNS TABLE(id uuid) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT x.id FROM public.deals x
   WHERE x.workspace_id = public.project_dash_ws() AND x.deleted_at IS NULL AND x.closed_at IS NOT NULL
     AND public.deal_stage_type(x.pipeline_id, x.stage_id, x.stage::text) = 'won'
     AND (x.closed_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_from AND p_to $$;
CREATE FUNCTION t_c5.alerts_by_old_policy() RETURNS TABLE(id uuid) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT a.id FROM public.project_alerts a
   WHERE a.workspace_id IN (SELECT public.current_user_workspaces())
     AND (public.is_active_workspace_admin(a.workspace_id, auth.uid())
          OR public.user_has_permission(auth.uid(), a.workspace_id, 'techprojects.alerts.view.workspace')
          OR public.user_has_permission(auth.uid(), a.workspace_id, 'techprojects.alerts.manage.workspace')
          OR (a.project_id IS NOT NULL AND a.project_id IN (SELECT public.project_dash_leader_projects(a.workspace_id, auth.uid())))
          OR (a.deal_id IS NOT NULL AND public.deal_visible_to_current_user(a.deal_id))
          OR a.subject_user_id = auth.uid()
          OR (a.person_id IS NOT NULL AND public.project_dash_person_in_led(a.workspace_id, a.person_id))) $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA t_c5 TO authenticated;

\set A '''aaaaaaaa-0000-4000-8000-00000000000a'''
\set B '''aaaaaaaa-0000-4000-8000-00000000000b'''
\set U1 '''10000000-0000-4000-8000-000000000001'''
\set U2 '''10000000-0000-4000-8000-000000000002'''
\set U3 '''10000000-0000-4000-8000-000000000003'''
\set U4 '''10000000-0000-4000-8000-000000000004'''
\set U5 '''10000000-0000-4000-8000-000000000005'''
\set U6 '''10000000-0000-4000-8000-000000000006'''
\set U7 '''10000000-0000-4000-8000-000000000007'''
\set P1 '''c5200000-0000-4000-8000-000000000001'''
\set P2 '''c5200000-0000-4000-8000-000000000002'''
\set P3 '''c5200000-0000-4000-8000-000000000003'''
\set P4 '''c5200000-0000-4000-8000-000000000004'''
\set P5 '''c5200000-0000-4000-8000-000000000005'''
\set PB '''c5200000-0000-4000-8000-0000000000b6'''

-- ------------------------------------------------------------------ permissões (só conjuntos sintéticos)
INSERT INTO public.permission_sets (id, module, name) VALUES
 ('20000000-0000-4000-8000-0000000000e1','techprojects','[ISO] C5 Profissional'),
 ('20000000-0000-4000-8000-0000000000e2','techprojects','[ISO] C5 Financeiro') ON CONFLICT DO NOTHING;
INSERT INTO public.permission_set_items (set_id, permission_key)
SELECT '20000000-0000-4000-8000-0000000000e1', key FROM public.permissions WHERE key IN (
  'techprojects.time_entries.view.own','techprojects.projects.view.own','techprojects.tasks.view.own','techprojects.milestones.view.workspace')
ON CONFLICT DO NOTHING;
INSERT INTO public.permission_set_items (set_id, permission_key)
SELECT '20000000-0000-4000-8000-0000000000e2', key FROM public.permissions WHERE key IN (
  'techprojects.measurements.view.workspace','techprojects.profitability.view.workspace','finance.read')
ON CONFLICT DO NOTHING;
INSERT INTO public.user_permission_sets (user_id, owner_id, workspace_id, set_id) VALUES
 (:U2, :A, :A, '20000000-0000-4000-8000-0000000000e1'),
 (:U3, :A, :A, '20000000-0000-4000-8000-0000000000e1'),
 (:U7, :A, :A, '20000000-0000-4000-8000-0000000000e1'),
 (:U4, :A, :A, '20000000-0000-4000-8000-0000000000e2');
SELECT t_c5.ok('três chaves novas no catálogo, sem concessão a cargos',
  (SELECT count(*) FROM public.permissions WHERE key IN ('techprojects.alerts.view.workspace','techprojects.alerts.manage.workspace',
    'techprojects.risk_rules.manage.workspace')) = 3
  AND NOT EXISTS (SELECT 1 FROM public.permission_set_items WHERE permission_key LIKE 'techprojects.alerts.%' OR permission_key LIKE 'techprojects.risk_rules.%'));

-- ------------------------------------------------------------------ fixtures
SELECT set_config('app.project_time_workflow', 'on', false), set_config('app.clockify_import', 'on', false),
       set_config('app.project_billing_flow', 'on', false) \g /dev/null
INSERT INTO public.companies (id, workspace_id, owner_id, name) VALUES
 ('c5100000-0000-4000-8000-0000000000c1', :A, :U1, '[ISO] Cliente Um'),
 ('c5100000-0000-4000-8000-0000000000c2', :A, :U1, '[ISO] Cliente Dois'),
 ('c5100000-0000-4000-8000-0000000000cb', :B, :U6, '[ISO] Cliente SegredoB');
INSERT INTO public.contracts (id, workspace_id, owner_id, role, title, currency, starts_at, status) VALUES
 ('c5000000-0000-4000-8000-000000000001', :A, :U1, 'provider', '[ISO] Contrato C5', 'BRL', '2026-01-01', 'active');
INSERT INTO public.services (id, workspace_id, owner_id, contract_id, role, name, type, status, quantity, unit_price, currency, starts_at) VALUES
 ('c5010000-0000-4000-8000-000000000001', :A, :U1, 'c5000000-0000-4000-8000-000000000001', 'provider', '[ISO] Horas C5', 'usage_based', 'active', 1, 0, 'BRL', '2026-01-01'),
 ('c5010000-0000-4000-8000-000000000002', :A, :U1, 'c5000000-0000-4000-8000-000000000001', 'provider', '[ISO] Horas USD', 'usage_based', 'active', 1, 0, 'USD', '2026-01-01');
INSERT INTO public.project_delivery_templates (id, workspace_id, name, delivery_kind) VALUES
 ('c5600000-0000-4000-8000-000000000001', :A, '[ISO] Escopo', 'scope'),
 ('c5600000-0000-4000-8000-000000000002', :A, '[ISO] Hunting', 'hunting');
INSERT INTO public.project_delivery_template_versions (id, workspace_id, template_id, version, definition) VALUES
 ('c5610000-0000-4000-8000-000000000001', :A, 'c5600000-0000-4000-8000-000000000001', 1, '{}'),
 ('c5610000-0000-4000-8000-000000000002', :A, 'c5600000-0000-4000-8000-000000000002', 1, '{}');
-- Negócios: D1 ganho recente sem projeto; D2 ganho com P2 (sem responsável operacional); D3 ganho antes da política.
INSERT INTO public.deals (id, workspace_id, owner_id, name, value, stage, company_id) VALUES
 ('c5300000-0000-4000-8000-0000000000d1', :A, :U4, '[ISO] Ganho sem projeto', 5000, 'won', 'c5100000-0000-4000-8000-0000000000c1'),
 ('c5300000-0000-4000-8000-0000000000d2', :A, :U4, '[ISO] Ganho com projeto', 7000, 'won', 'c5100000-0000-4000-8000-0000000000c2'),
 ('c5300000-0000-4000-8000-0000000000d3', :A, :U4, '[ISO] Ganho histórico', 9000, 'won', 'c5100000-0000-4000-8000-0000000000c1');
UPDATE public.deals SET closed_at = now() - interval '5 days' WHERE id = 'c5300000-0000-4000-8000-0000000000d1';
UPDATE public.deals SET closed_at = now() - interval '10 days' WHERE id = 'c5300000-0000-4000-8000-0000000000d2';
UPDATE public.deals SET closed_at = '2025-12-01 12:00Z' WHERE id = 'c5300000-0000-4000-8000-0000000000d3';
-- Negócios do seed ficam como históricos (antes da política) para não interferir nas contagens.
UPDATE public.deals SET closed_at = '2025-11-01 12:00Z' WHERE id IN ('51000000-0000-4000-8000-0000000000a1','51000000-0000-4000-8000-0000000000a7');
INSERT INTO public.deal_delivery_policies (workspace_id, enabled, activated_at, project_creator_id, created_by) VALUES (:A, true, now() - interval '60 days', :U1, :U1);

INSERT INTO public.projects (id, workspace_id, owner_id, name, status, company_id, service_id, contract_id, planned_hours, due_at, assigned_to, deal_id, delivery_group_key, delivery_template_version_id) VALUES
 (:P1, :A, :U1, '[ISO] P1 Entrega', 'active', 'c5100000-0000-4000-8000-0000000000c1', 'c5010000-0000-4000-8000-000000000001', 'c5000000-0000-4000-8000-000000000001', 100, '2026-02-01', :U3, NULL, NULL, NULL),
 (:P2, :A, :U1, '[ISO] P2 Do negócio', 'active', 'c5100000-0000-4000-8000-0000000000c2', NULL, NULL, NULL, NULL, NULL, 'c5300000-0000-4000-8000-0000000000d2', 'main', NULL),
 (:P3, :A, :U1, '[ISO] P3 Concluído importado', 'done', NULL, NULL, NULL, NULL, '2025-06-01', NULL, NULL, NULL, NULL),
 (:P4, :A, :U1, '[ISO] P4 Software', 'planning', 'c5100000-0000-4000-8000-0000000000c1', NULL, NULL, NULL, '2027-01-31', :U1, NULL, NULL, 'c5610000-0000-4000-8000-000000000001'),
 (:P5, :A, :U1, '[ISO] P5 Hunting', 'active', 'c5100000-0000-4000-8000-0000000000c1', NULL, NULL, NULL, NULL, :U1, NULL, NULL, 'c5610000-0000-4000-8000-000000000002'),
 (:PB, :B, :U6, '[ISO] Projeto SegredoB', 'active', 'c5100000-0000-4000-8000-0000000000cb', NULL, NULL, 50, '2026-01-01', :U6, NULL, NULL, NULL);
-- O gatilho de responsável copia o criador; P2 precisa ficar sem responsável operacional.
UPDATE public.projects SET assigned_to = NULL WHERE id = :P2;
INSERT INTO public.project_members (workspace_id, project_id, user_id, role_in_project) VALUES
 (:A, :P1, :U3, 'manager'), (:A, :P1, :U2, 'contributor'), (:A, :P1, :U7, 'contributor'), (:A, :P2, :U7, 'contributor');
UPDATE public.project_members SET can_track_time = true WHERE project_id = :P2;
INSERT INTO public.project_time_approvers (workspace_id, project_id, role, user_id, valid_from, created_by) VALUES
 (:A, :P1, 'approver', :U3, '2026-01-01', :U1);

INSERT INTO public.people (id, owner_id, workspace_id, full_name, profile_id, status, work_schedule, hire_date, termination_date) VALUES
 ('c5400000-0000-4000-8000-000000000002', :U1, :A, '[ISO] Pessoa Dois', :U2, 'active', '{"mon":28800,"tue":28800,"wed":28800,"thu":28800,"fri":28800}', '2025-01-01', NULL),
 ('c5400000-0000-4000-8000-000000000007', :U1, :A, '[ISO] Pessoa Sete', :U7, 'active', '{"mon":21600,"tue":21600,"wed":21600,"thu":21600,"fri":21600}', '2025-01-01', NULL),
 ('c5400000-0000-4000-8000-000000000003', :U1, :A, '[ISO] Pessoa Três', :U3, 'active', NULL, NULL, NULL),
 ('c5400000-0000-4000-8000-000000000005', :U1, :A, '[ISO] Pessoa Cinco', :U5, 'terminated', '{"mon":28800,"tue":28800,"wed":28800,"thu":28800,"fri":28800}', '2024-01-01', '2026-03-15'),
 ('c5400000-0000-4000-8000-0000000000b6', :U6, :B, '[ISO] Pessoa SegredoB', :U6, 'active', '{"mon":28800}', NULL, NULL);
INSERT INTO public.people_allocations (id, workspace_id, owner_id, person_id, project_id, allocation_pct, hours_per_week, starts_at, ends_at, currency, status, overbook_justification) VALUES
 ('c5500000-0000-4000-8000-000000000001', :A, :U1, 'c5400000-0000-4000-8000-000000000002', :P1, 100, NULL, '2026-01-01', '2026-06-30', 'BRL', 'active', NULL),
 ('c5500000-0000-4000-8000-000000000002', :A, :U1, 'c5400000-0000-4000-8000-000000000002', :P2, 25, 10, '2026-07-01', NULL, 'BRL', 'active', NULL),
 ('c5500000-0000-4000-8000-000000000003', :A, :U1, 'c5400000-0000-4000-8000-000000000007', :P1, 60, NULL, '2026-01-01', NULL, 'BRL', 'active', NULL),
 ('c5500000-0000-4000-8000-000000000004', :A, :U1, 'c5400000-0000-4000-8000-000000000007', :P2, 60, NULL, '2026-01-01', NULL, 'BRL', 'active', '[ISO] sobrealocação proposital do teste'),
 ('c5500000-0000-4000-8000-000000000005', :A, :U1, 'c5400000-0000-4000-8000-000000000003', :P1, 50, NULL, '2026-01-01', NULL, 'BRL', 'active', NULL),
 ('c5500000-0000-4000-8000-000000000006', :A, :U1, 'c5400000-0000-4000-8000-000000000002', :P4, 50, NULL, '2026-10-01', NULL, 'BRL', 'active', NULL);

-- Apontamentos: 3 pessoas × 6 faixas/dia de 01/01 a 20/10/2026 (+ pessoa desligada até 15/03). Situação e origem variam.
INSERT INTO public.project_time_entries (workspace_id, project_id, user_id, entry_date, start_time, end_time, hours, status, source, external_id,
                                         submitted_at, approved_at, billable, timezone)
SELECT :A, CASE WHEN s.slot <= 3 THEN :P1 ELSE :P2 END::uuid, u.uid, d::date,
       make_time(CASE WHEN s.slot <= 3 THEN 8 + s.slot ELSE 10 + s.slot END, 0, 0),
       make_time(CASE WHEN s.slot <= 3 THEN 9 + s.slot ELSE 11 + s.slot END, 0, CASE WHEN s.slot = 3 THEN 15 ELSE 0 END),
       CASE WHEN s.slot = 3 THEN 3615.0 / 3600 ELSE 1 END,
       (ARRAY['draft','submitted','approved','rejected','locked','locked'])[((extract(doy FROM d)::int + s.slot) % 6) + 1],
       CASE WHEN ((extract(doy FROM d)::int + s.slot) % 6) IN (4, 5) THEN 'import' ELSE 'manual' END,
       CASE ((extract(doy FROM d)::int + s.slot) % 6) WHEN 4 THEN 'clockify:' || u.k || d::date || s.slot WHEN 5 THEN 'jibble:' || u.k || d::date || s.slot END,
       CASE WHEN ((extract(doy FROM d)::int + s.slot) % 6) = 1 THEN d::timestamptz + interval '20 hours' END,
       CASE WHEN ((extract(doy FROM d)::int + s.slot) % 6) = 2 THEN d::timestamptz + interval '21 hours' END,
       s.slot % 2 = 0, 'America/Sao_Paulo'
  FROM generate_series('2026-01-01'::date, '2026-10-20'::date, interval '1 day') d
 CROSS JOIN (VALUES (:U2::uuid, 'u2'), (:U7::uuid, 'u7'), (:U3::uuid, 'u3')) u(uid, k)
 CROSS JOIN generate_series(1, 6) s(slot);
INSERT INTO public.project_time_entries (workspace_id, project_id, user_id, entry_date, start_time, end_time, hours, status, approved_at, billable, timezone)
SELECT :A, :P1, :U5, d::date, '07:00', '08:00', 1, 'approved', now(), true, 'America/Sao_Paulo'
  FROM generate_series('2026-01-01'::date, '2026-03-15'::date, interval '1 day') d;
INSERT INTO public.project_time_entries (workspace_id, project_id, user_id, entry_date, start_time, end_time, hours, status, approved_at, billable, timezone)
SELECT :B, :PB, :U6, d::date, '09:00', '10:00', 1, 'approved', now(), true, 'America/Sao_Paulo'
  FROM generate_series('2026-01-01'::date, '2026-04-10'::date, interval '1 day') d;
SELECT t_c5.ok('fixture com mais de 5.000 apontamentos no workspace A',
  (SELECT count(*) FROM public.project_time_entries WHERE workspace_id = :A) > 5000);

-- Tarefas: 5.200 em P4 (1/4 concluídas; metade das abertas com estimativa), 10 em P1 para a pessoa 2, 5 abertas em projeto concluído.
INSERT INTO public.project_tasks (workspace_id, project_id, title, status, estimated_hours, due_at)
SELECT :A, :P4, '[ISO] Tarefa ' || i, CASE WHEN i % 4 = 0 THEN 'done' ELSE 'todo' END::public.project_task_status,
       CASE WHEN i % 4 = 2 THEN 2 END, '2026-12-01'::date + (i % 30)
  FROM generate_series(1, 5200) i;
INSERT INTO public.project_tasks (workspace_id, project_id, title, status, assignee_id, due_at)
SELECT :A, :P1, '[ISO] P1 tarefa ' || i,
       CASE WHEN i > 7 THEN 'done' ELSE 'todo' END::public.project_task_status, :U2,
       CASE WHEN i <= 4 THEN '2026-09-01'::date ELSE (now() AT TIME ZONE 'America/Sao_Paulo')::date + 3 END
  FROM generate_series(1, 10) i;
INSERT INTO public.project_tasks (workspace_id, project_id, title, status) SELECT :A, :P3, '[ISO] P3 legado ' || i, 'todo' FROM generate_series(1, 5) i;
SELECT t_c5.ok('fixture com mais de 5.000 tarefas', (SELECT count(*) FROM public.project_tasks WHERE workspace_id = :A) > 5000);
INSERT INTO public.project_milestones (id, workspace_id, project_id, name, due_at, status, assigned_to) VALUES
 ('c5700000-0000-4000-8000-000000000001', :A, :P1, '[ISO] Marco atrasado', '2026-01-15', 'pending', :U2),
 ('c5700000-0000-4000-8000-000000000002', :A, :P1, '[ISO] Marco feito', '2026-01-10', 'done', :U2);

-- Financeiro sintético: tarifa de custo ZERO (≠ ausente) só para a pessoa 2; medições em duas moedas e quatro etapas.
INSERT INTO public.project_rates (workspace_id, kind, scope, person_id, unit, currency, amount, valid_from, reason, created_by)
VALUES (:A, 'cost', 'person', 'c5400000-0000-4000-8000-000000000002', 'hour', 'BRL', 0, '2026-01-01', '[ISO] custo zero autorizado', :U1);
INSERT INTO public.project_billing_configs (id, workspace_id, contract_id, service_id, model, currency, valid_from, reason, created_by) VALUES
 ('c5800000-0000-4000-8000-000000000001', :A, 'c5000000-0000-4000-8000-000000000001', 'c5010000-0000-4000-8000-000000000001', 'per_hour', 'BRL', '2026-01-01', '[ISO] config BRL', :U1),
 ('c5800000-0000-4000-8000-000000000002', :A, 'c5000000-0000-4000-8000-000000000001', 'c5010000-0000-4000-8000-000000000002', 'per_hour', 'USD', '2026-01-01', '[ISO] config USD', :U1);
INSERT INTO public.financial_entries (id, workspace_id, owner_id, direction, description, amount, currency, competence_date, due_date, status)
VALUES ('c5900000-0000-4000-8000-000000000001', :A, :U1, 'receivable', '[ISO] título da medição', 1000, 'BRL', '2026-08-01', '2026-09-10', 'partial');
INSERT INTO public.financial_payments (workspace_id, entry_id, paid_at, amount) VALUES (:A, 'c5900000-0000-4000-8000-000000000001', '2026-09-10', 400);
INSERT INTO public.project_measurements (id, workspace_id, config_id, config_version, contract_id, service_id, company_id, model, currency, period_from, period_to, timezone, status, total_amount, created_by) VALUES
 ('c5810000-0000-4000-8000-000000000001', :A, 'c5800000-0000-4000-8000-000000000001', 1, 'c5000000-0000-4000-8000-000000000001', 'c5010000-0000-4000-8000-000000000001', 'c5100000-0000-4000-8000-0000000000c1', 'per_hour', 'BRL', '2026-08-01', '2026-08-31', 'America/Sao_Paulo', 'generated', 1000, :U1),
 ('c5810000-0000-4000-8000-000000000002', :A, 'c5800000-0000-4000-8000-000000000002', 1, 'c5000000-0000-4000-8000-000000000001', 'c5010000-0000-4000-8000-000000000002', 'c5100000-0000-4000-8000-0000000000c1', 'per_hour', 'USD', '2026-09-01', '2026-09-30', 'America/Sao_Paulo', 'approved', 200, :U1),
 ('c5810000-0000-4000-8000-000000000003', :A, 'c5800000-0000-4000-8000-000000000001', 1, 'c5000000-0000-4000-8000-000000000001', 'c5010000-0000-4000-8000-000000000001', 'c5100000-0000-4000-8000-0000000000c1', 'per_hour', 'BRL', '2026-09-01', '2026-09-30', 'America/Sao_Paulo', 'reversed', 300, :U1),
 ('c5810000-0000-4000-8000-000000000004', :A, 'c5800000-0000-4000-8000-000000000001', 1, 'c5000000-0000-4000-8000-000000000001', 'c5010000-0000-4000-8000-000000000001', 'c5100000-0000-4000-8000-0000000000c1', 'per_hour', 'BRL', '2026-10-01', '2026-10-31', 'America/Sao_Paulo', 'draft', 50, :U1);
INSERT INTO public.project_measurement_financial_links (workspace_id, measurement_id, financial_entry_id, kind, active, created_by)
VALUES (:A, 'c5810000-0000-4000-8000-000000000001', 'c5900000-0000-4000-8000-000000000001', 'generated', true, :U1);
SELECT set_config('app.project_time_workflow', '', false), set_config('app.clockify_import', '', false),
       set_config('app.project_billing_flow', '', false) \g /dev/null
SELECT t_c5.put('H0', t_c5.hash_sources()) \g /dev/null

\set F '''{"from":"2026-01-01","to":"2026-10-31","tz":"America/Sao_Paulo"}'''

-- ================================================================== admin: totais exatos e equivalência cartão ↔ lista
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c5.as_user(:U1) \g /dev/null
SELECT t_c5.put('S_ADMIN', public.project_dash_summary('team', :F)::text) \g /dev/null
SELECT t_c5.ok('admin vê as cinco visões (inclusive Qualidade)',
  (SELECT bool_and(v::boolean) FROM jsonb_each_text(t_c5.get('S_ADMIN')::jsonb->'scope'->'views') x(k, v)));
SELECT t_c5.ok('total de horas do período = soma exata do banco (sem limite de 1.000/5.000 linhas)',
  t_c5.n(t_c5.get('S_ADMIN')::jsonb, '{entries,total,n}') = t_c5.n(t_c5.n_entries(:A, '2026-01-01', '2026-10-31'), '{n}')
  AND t_c5.n(t_c5.get('S_ADMIN')::jsonb, '{entries,total,secs}') = t_c5.n(t_c5.n_entries(:A, '2026-01-01', '2026-10-31'), '{secs}')
  AND t_c5.n(t_c5.get('S_ADMIN')::jsonb, '{entries,total,n}') > 5000);
SELECT t_c5.ok('cada indicador de horas: cartão = total e segundos da lista com os mesmos filtros',
  (SELECT bool_and(t_c5.n(t_c5.get('S_ADMIN')::jsonb, ARRAY['entries', k, 'n']) = (d->>'total')::numeric
                   AND t_c5.n(t_c5.get('S_ADMIN')::jsonb, ARRAY['entries', k, 'secs']) = (d->>'seconds')::numeric)
     FROM unnest(ARRAY['total','draft','submitted','approved','rejected','locked_import','validated','awaiting_review',
                       'origin_clockify','origin_jibble','origin_manual','billable','pending_mine']) k
     CROSS JOIN LATERAL (SELECT public.project_dash_drill('team', 'entries', k, :F, 1, 0) d) z));
SELECT t_c5.ok('importado bloqueado nunca conta como aprovado/validado',
  t_c5.n(t_c5.get('S_ADMIN')::jsonb, '{entries,validated,n}') = t_c5.n(t_c5.n_entries(:A, '2026-01-01', '2026-10-31', 'e.status = ''approved'' OR (e.status = ''locked'' AND e.source <> ''import'')'), '{n}')
  AND t_c5.n(t_c5.get('S_ADMIN')::jsonb, '{entries,locked_import,n}') = t_c5.n(t_c5.n_entries(:A, '2026-01-01', '2026-10-31', 'e.status = ''locked'' AND e.source = ''import'''), '{n}')
  AND t_c5.n(t_c5.get('S_ADMIN')::jsonb, '{entries,locked_import,n}') > 0);
SELECT t_c5.ok('lista paginada informa o total real e respeita o limite de 1.000 por página',
  (public.project_dash_drill('team', 'entries', 'total', :F, 5000, 5000)->>'total')::int = t_c5.n(t_c5.get('S_ADMIN')::jsonb, '{entries,total,n}')
  AND jsonb_array_length(public.project_dash_drill('team', 'entries', 'total', :F, 5000, 5000)->'rows') =
      least(1000, t_c5.n(t_c5.get('S_ADMIN')::jsonb, '{entries,total,n}')::int - 5000));
SELECT t_c5.ok('borda do período: só o dia 08/03 (troca de horário nos EUA) traz exatamente 19 apontamentos; 16/03 (após o desligamento) 18',
  t_c5.n(public.project_dash_summary('team', '{"from":"2026-03-08","to":"2026-03-08","tz":"America/New_York"}'), '{entries,total,n}') = 19
  AND t_c5.n(public.project_dash_summary('team', '{"from":"2026-03-16","to":"2026-03-16","tz":"America/New_York"}'), '{entries,total,n}') = 18);
SELECT t_c5.ok('filtros combinados (projeto + pessoa + situação + origem) = contagem exata',
  t_c5.n(public.project_dash_summary('team', '{"from":"2026-01-01","to":"2026-10-31","tz":"America/Sao_Paulo","project":"c5200000-0000-4000-8000-000000000001","person":"10000000-0000-4000-8000-000000000002","status":"approved","origin":"manual"}'), '{entries,total,n}')
  = t_c5.n(t_c5.n_entries(:A, '2026-01-01', '2026-10-31', format('e.project_id = %L AND e.user_id = %L AND e.status = ''approved'' AND e.source = ''manual''', 'c5200000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002')), '{n}'));
SELECT t_c5.ok('filtro por cliente e por serviço via projeto',
  t_c5.n(public.project_dash_summary('team', '{"from":"2026-01-01","to":"2026-10-31","tz":"America/Sao_Paulo","company":"c5100000-0000-4000-8000-0000000000c2"}'), '{entries,total,n}')
  = t_c5.n(t_c5.n_entries(:A, '2026-01-01', '2026-10-31', format('e.project_id = %L', 'c5200000-0000-4000-8000-000000000002')), '{n}')
  AND t_c5.n(public.project_dash_summary('team', '{"from":"2026-01-01","to":"2026-10-31","tz":"America/Sao_Paulo","service":"c5010000-0000-4000-8000-000000000001"}'), '{entries,total,n}')
  = t_c5.n(t_c5.n_entries(:A, '2026-01-01', '2026-10-31', format('e.project_id = %L', 'c5200000-0000-4000-8000-000000000001')), '{n}'));
SELECT t_c5.ok('comparação com período anterior usa a mesma duração imediatamente antes',
  t_c5.n(public.project_dash_summary('team', '{"from":"2026-03-01","to":"2026-03-31","tz":"America/Sao_Paulo","compare":true}'), '{entries_prev,total,n}')
  = t_c5.n(t_c5.n_entries(:A, '2026-01-29', '2026-02-28'), '{n}'));
SELECT t_c5.ok('filtro de outro workspace é recusado (não ignorado)',
  t_c5.err(format('select public.project_dash_summary(%L, %L)', 'team', '{"from":"2026-01-01","to":"2026-10-31","tz":"America/Sao_Paulo","project":"c5200000-0000-4000-8000-0000000000b6"}')) ~ 'outro workspace');
SELECT t_c5.ok('fuso e período inválidos são recusados',
  t_c5.err($$select public.project_dash_summary('team', '{"from":"2026-02-01","to":"2026-01-01","tz":"America/Sao_Paulo"}')$$) ~ 'Período inválido'
  AND t_c5.err($$select public.project_dash_summary('team', '{"from":"2026-01-01","to":"2026-01-31","tz":"Mars/Base"}')$$) ~ 'Fuso');
-- Projetos, tarefas e marcos: situação atual separada de período; projeto concluído não vira pendência.
SELECT t_c5.ok('projetos: ativos agora, atrasados, sem responsável e sem aprovador (cartão = lista)',
  t_c5.n(t_c5.get('S_ADMIN')::jsonb, '{projects,active_now,n}') = 3
  AND t_c5.n(t_c5.get('S_ADMIN')::jsonb, '{projects,overdue,n}') = 1
  AND t_c5.n(t_c5.get('S_ADMIN')::jsonb, '{projects,no_owner,n}') = 1
  AND t_c5.n(t_c5.get('S_ADMIN')::jsonb, '{projects,no_approver,n}') = 2
  AND (public.project_dash_drill('team', 'projects', 'no_approver', :F, 50, 0)->>'total')::int = 2);
SELECT t_c5.ok('tarefas: abertas só em projetos em andamento; legadas de projeto concluído separadas',
  t_c5.n(t_c5.get('S_ADMIN')::jsonb, '{tasks,open,n}') = 3900 + 7
  AND t_c5.n(t_c5.get('S_ADMIN')::jsonb, '{tasks,open_in_closed_project,n}') = 5
  AND t_c5.n(t_c5.get('S_ADMIN')::jsonb, '{tasks,overdue,n}') = 4
  AND (public.project_dash_drill('team', 'tasks', 'open', :F, 1000, 3000)->>'total')::int = 3907);
SELECT t_c5.ok('marcos atrasados', t_c5.n(t_c5.get('S_ADMIN')::jsonb, '{milestones,overdue,n}') = 1);
-- Capacidade por pessoa única, jornada real, sem 8 h presumidas.
SELECT t_c5.ok('pessoa com duas alocações aparece uma vez; sobrealocação 120% detectada',
  (SELECT count(*) FROM public.project_dash_ds_people('team', public.project_dash_f('{"from":"2026-10-01","to":"2026-10-31","tz":"America/Sao_Paulo"}')) x
    WHERE x.user_id = :U7) = 1
  AND (SELECT x.max_load_pct = 120 AND x.overbooked_days > 0 AND 'overbooked' = ANY (x.m)
         FROM public.project_dash_ds_people('team', public.project_dash_f('{"from":"2026-10-01","to":"2026-10-31","tz":"America/Sao_Paulo"}')) x WHERE x.user_id = :U7));
SELECT t_c5.ok('sem jornada: capacidade desconhecida (nula), nunca 8 h',
  (SELECT x.contracted IS NULL AND x.allocated_total IS NULL AND x.gap IS NULL AND 'no_schedule' = ANY (x.m)
     FROM public.project_dash_ds_people('team', public.project_dash_f(:F)) x WHERE x.user_id = :U3));
SELECT t_c5.ok('pessoa desligada em 15/03: capacidade só até o desligamento; horas sinalizadas como de inativo',
  (SELECT x.contracted = 288000 AND 'inactive' = ANY (x.m) AND 'inactive_with_hours' = ANY (x.m)
     FROM public.project_dash_ds_people('team', public.project_dash_f('{"from":"2026-03-01","to":"2026-03-31","tz":"America/Sao_Paulo"}')) x WHERE x.user_id = :U5));
SELECT t_c5.ok('lista de pessoas = cartão (contagem)',
  t_c5.n(t_c5.get('S_ADMIN')::jsonb, '{people,all,n}') = (public.project_dash_drill('team', 'people', 'all', :F, 50, 0)->>'total')::numeric
  AND t_c5.n(t_c5.get('S_ADMIN')::jsonb, '{people,all,n}') = 4);
-- Previsão: estimativa ÷ capacidade alocada; sem base = sem data; Hunting fora; concluído fora.
SELECT t_c5.put('FC', (SELECT jsonb_object_agg(x.name, to_jsonb(x)) FROM public.project_dash_ds_forecast('team', public.project_dash_f(:F)) x)::text) \g /dev/null
SELECT t_c5.ok('software com estimativa parcial e capacidade alocada: data = hoje + restante ÷ ritmo semanal',
  (t_c5.get('FC')::jsonb->'[ISO] P4 Software'->>'method') = 'estimate'
  AND (t_c5.get('FC')::jsonb->'[ISO] P4 Software'->>'eta_mid')::date = (now() AT TIME ZONE 'America/Sao_Paulo')::date + ceil(9360000::numeric / 72000 * 7)::int
  AND (t_c5.get('FC')::jsonb->'[ISO] P4 Software'->'m') ? 'partial_estimate'
  AND (t_c5.get('FC')::jsonb->'[ISO] P4 Software'->'m') ? 'late');
SELECT t_c5.ok('Hunting não gera previsão (TechHire); projeto sem estimativa = sem base (data nula, não 0%)',
  (t_c5.get('FC')::jsonb->'[ISO] P5 Hunting'->>'method') = 'techhire' AND (t_c5.get('FC')::jsonb->'[ISO] P5 Hunting'->>'eta_mid') IS NULL
  AND (t_c5.get('FC')::jsonb->'[ISO] P1 Entrega'->>'method') = 'none' AND (t_c5.get('FC')::jsonb->'[ISO] P1 Entrega'->>'eta_mid') IS NULL
  AND (t_c5.get('FC')::jsonb->'[ISO] P2 Do negócio'->>'method') = 'none');
SELECT t_c5.ok('projeto concluído/importado não entra na previsão', NOT (t_c5.get('FC')::jsonb ? '[ISO] P3 Concluído importado'));
SELECT t_c5.ok('horas consumidas acima do previsto ≠ progresso (marcado como orçamento estourado)',
  (t_c5.get('FC')::jsonb->'[ISO] P1 Entrega'->'m') ? 'over_budget' AND (t_c5.get('FC')::jsonb->'[ISO] P1 Entrega'->>'eta_mid') IS NULL);
-- Qualidade: pendências únicas × alertas, vínculo de pessoa, registro sem People.
SELECT t_c5.ok('admin (com acesso ao Financeiro) vê o recebido real da medição gerada',
  (public.project_dash_summary('finance', :F)->'measurements'->'received') = '[{"n":1,"amount":1000,"currency":"BRL","received":400}]'::jsonb
  AND (public.project_dash_summary('finance', :F)->'scope'->>'can_received')::boolean);
SELECT t_c5.ok('qualidade disponível só para admin e mostra cobertura de vínculos',
  (public.project_dash_summary('quality', :F)->'quality'->'links'->>'entries')::int = t_c5.n(t_c5.get('S_ADMIN')::jsonb, '{entries,total,n}'));
COMMIT;

-- ================================================================== profissional (U2)
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c5.as_user(:U2) \g /dev/null
SELECT t_c5.put('S_ME', public.project_dash_summary('me', :F)::text) \g /dev/null
SELECT t_c5.ok('profissional: Meu trabalho + Comercial só porque tem negócios próprios no TechSales (permissão, não cargo)',
  (t_c5.get('S_ME')::jsonb->'scope'->'views') = '{"me":true,"team":false,"quality":false,"finance":false,"commercial":true}'::jsonb);
SELECT t_c5.ok('profissional vê apenas os próprios apontamentos (cartão = banco)',
  t_c5.n(t_c5.get('S_ME')::jsonb, '{entries,total,n}') = t_c5.n(t_c5.n_entries(:A, '2026-01-01', '2026-10-31', format('e.user_id = %L', '10000000-0000-4000-8000-000000000002')), '{n}'));
SELECT t_c5.ok('filtro Pessoa de outro profissional não amplia o escopo em Meu trabalho',
  t_c5.n(public.project_dash_summary('me', '{"from":"2026-01-01","to":"2026-10-31","tz":"America/Sao_Paulo","person":"10000000-0000-4000-8000-000000000007"}'), '{entries,total,n}') = 0);
SELECT t_c5.ok('profissional não abre Equipe, Comercial, Financeiro, Qualidade nem as listas delas',
  t_c5.err(format('select public.project_dash_summary(%L, %L)', 'team', :F)) ~ 'não disponível'
  AND t_c5.err(format('select public.project_dash_summary(%L, %L)', 'quality', :F)) ~ 'não disponível'
  AND t_c5.err(format('select public.project_dash_summary(%L, %L)', 'finance', :F)) ~ 'não disponível'
  AND t_c5.err(format('select public.project_dash_drill(%L, %L, %L, %L)', 'team', 'people', 'all', :F)) ~ 'não disponível'
  AND t_c5.err(format('select public.project_dash_ds_cost(public.project_dash_f(%L))', :F)) ~ 'Sem permissão'
  AND t_c5.err(format('select * from public.project_dash_capacity_base(%L, public.project_dash_f(%L))', 'team', :F)) ~ 'Sem acesso');
SELECT t_c5.ok('capacidade própria com semana parcial e troca de alocação: 144.000 s contratados, 79.200 s alocados',
  (SELECT x.contracted = 144000 AND x.allocated_total = 79200 AND x.allocated_scope = 79200
     FROM public.project_dash_ds_people('me', public.project_dash_f('{"from":"2026-06-29","to":"2026-07-05","tz":"America/Sao_Paulo"}')) x));
SELECT t_c5.ok('profissional sem papel de aprovador: nada aguardando sua aprovação', (t_c5.get('S_ME')::jsonb->>'pending_approvals')::int = 0);
SELECT t_c5.ok('minhas alocações sem tarifas nem custo',
  jsonb_array_length(t_c5.get('S_ME')::jsonb->'my_allocations') = 3
  AND NOT (t_c5.get('S_ME')::text ~ 'billable_rate|cost_rate'));
SELECT t_c5.ok('próximas entregas e tarefas atrasadas do profissional',
  t_c5.n(t_c5.get('S_ME')::jsonb, '{tasks,overdue,n}') = 4 AND t_c5.n(t_c5.get('S_ME')::jsonb, '{tasks,due_soon,n}') = 3);
SELECT t_c5.ok('autocompletar não lista projetos de outro workspace',
  NOT (public.project_dash_filter_options('project', '')::text ~ 'SegredoB'));
COMMIT;

-- ================================================================== líder (U3): só projetos liderados, conflito agregado
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c5.as_user(:U3) \g /dev/null
SELECT t_c5.put('S_LEAD', public.project_dash_summary('team', :F)::text) \g /dev/null
SELECT t_c5.ok('aprovador: "aguardando sua aprovação" = envios de outras pessoas no projeto que aprova (P1)',
  (public.project_dash_summary('me', :F)->>'pending_approvals')::numeric
    = t_c5.n(t_c5.n_entries(:A, '1900-01-01', '2100-12-31', format('e.project_id = %L AND e.status = %L AND e.user_id <> %L',
        'c5200000-0000-4000-8000-000000000001', 'submitted', '10000000-0000-4000-8000-000000000003')), '{n}')
  AND (public.project_dash_summary('me', :F)->>'pending_approvals')::numeric > 0);
SELECT t_c5.ok('líder: visão Equipe por carteira (aprovador/gestor), sem Qualidade nem Financeiro',
  (t_c5.get('S_LEAD')::jsonb->'scope'->>'team_scope') = 'led'
  AND NOT (t_c5.get('S_LEAD')::jsonb->'scope'->'views'->>'quality')::boolean
  AND NOT (t_c5.get('S_LEAD')::jsonb->'scope'->'views'->>'finance')::boolean);
SELECT t_c5.ok('líder: horas apenas do projeto liderado (P1), cartão = lista',
  t_c5.n(t_c5.get('S_LEAD')::jsonb, '{entries,total,n}') = t_c5.n(t_c5.n_entries(:A, '2026-01-01', '2026-10-31', format('e.project_id = %L', 'c5200000-0000-4000-8000-000000000001')), '{n}')
  AND t_c5.n(t_c5.get('S_LEAD')::jsonb, '{entries,total,n}') = (public.project_dash_drill('team', 'entries', 'total', :F, 1, 0)->>'total')::numeric);
SELECT t_c5.ok('líder vê a carga total da pessoa só como número (outras alocações), sem o projeto oculto',
  (SELECT x.other_allocated = x.allocated_scope AND x.other_allocated > 0
     FROM public.project_dash_ds_people('team', public.project_dash_f('{"from":"2026-10-01","to":"2026-10-31","tz":"America/Sao_Paulo"}')) x WHERE x.user_id = :U7)
  AND NOT (public.project_dash_drill('team', 'people', 'all', '{"from":"2026-10-01","to":"2026-10-31","tz":"America/Sao_Paulo"}', 50, 0)::text
           ~ 'c5200000-0000-4000-8000-000000000002|P2 Do negócio'));
SELECT t_c5.ok('líder não lê tarifas nem cobertura de custo', t_c5.err(format('select public.project_dash_ds_cost(public.project_dash_f(%L))', :F)) ~ 'Sem permissão');
COMMIT;

-- ================================================================== comercial + financeiro (U4, dois perfis)
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c5.as_user(:U4) \g /dev/null
SELECT t_c5.put('S_COM', public.project_dash_summary('commercial', '{"from":"2025-01-01","to":"2026-10-31","tz":"America/Sao_Paulo"}')::text) \g /dev/null
SELECT t_c5.ok('usuário com dois perfis vê Comercial e Financeiro, sem Equipe/Qualidade',
  (t_c5.get('S_COM')::jsonb->'scope'->'views'->>'commercial')::boolean AND (t_c5.get('S_COM')::jsonb->'scope'->'views'->>'finance')::boolean
  AND NOT (t_c5.get('S_COM')::jsonb->'scope'->'views'->>'team')::boolean AND NOT (t_c5.get('S_COM')::jsonb->'scope'->'views'->>'quality')::boolean);
SELECT t_c5.ok('ganhos: após a política sem projeto = 1; anteriores separados; sem responsável operacional = 1',
  t_c5.n(t_c5.get('S_COM')::jsonb, '{deals,no_project,n}') = 1 AND t_c5.n(t_c5.get('S_COM')::jsonb, '{deals,before_policy,n}') = 3
  AND t_c5.n(t_c5.get('S_COM')::jsonb, '{deals,no_owner,n}') = 1 AND t_c5.n(t_c5.get('S_COM')::jsonb, '{deals,with_project,n}') = 1
  AND (public.project_dash_drill('commercial', 'deals', 'no_project', '{"from":"2025-01-01","to":"2026-10-31","tz":"America/Sao_Paulo"}', 50, 0)->>'total')::int = 1);
SELECT t_c5.ok('lista comercial não expõe valor do negócio nem custo',
  NOT (public.project_dash_drill('commercial', 'deals', 'won', '{"from":"2025-01-01","to":"2026-10-31","tz":"America/Sao_Paulo"}', 50, 0)::text ~ '"value"|"amount"|cost_rate|billable_rate'));
SELECT t_c5.put('S_FIN', public.project_dash_summary('finance', :F)::text) \g /dev/null
SELECT t_c5.ok('medições por etapa e moeda, nunca somadas entre si; sem acesso aos recebimentos o painel sinaliza (não afirma zero)',
  (t_c5.get('S_FIN')::jsonb->'measurements'->'generated') = '[{"n":1,"amount":1000,"currency":"BRL","received":0}]'::jsonb
  AND (t_c5.get('S_FIN')::jsonb->'measurements'->'approved') = '[{"n":1,"amount":200,"currency":"USD","received":0}]'::jsonb
  AND (t_c5.get('S_FIN')::jsonb->'measurements'->'reversed') = '[{"n":1,"amount":300,"currency":"BRL","received":0}]'::jsonb
  AND (t_c5.get('S_FIN')::jsonb->'measurements'->'forecast') = '[{"n":1,"amount":50,"currency":"BRL","received":0}]'::jsonb
  AND NOT (t_c5.get('S_FIN')::jsonb->'scope'->>'can_received')::boolean);
SELECT t_c5.ok('custo: tarifa zero conta como conhecida; ausência = desconhecida (cartão = lista)',
  t_c5.n(t_c5.get('S_FIN')::jsonb, '{cost,cost_known,secs}') = t_c5.n(t_c5.n_entries(:A, '2026-01-01', '2026-10-31', format('e.status <> ''rejected'' AND e.user_id = %L', '10000000-0000-4000-8000-000000000002')), '{secs}')
  AND t_c5.n(t_c5.get('S_FIN')::jsonb, '{cost,cost_missing,secs}') = t_c5.n(t_c5.n_entries(:A, '2026-01-01', '2026-10-31', format('e.status <> ''rejected'' AND e.user_id <> %L', '10000000-0000-4000-8000-000000000002')), '{secs}')
  AND t_c5.n(t_c5.get('S_FIN')::jsonb, '{cost,cost_known,n}') = (public.project_dash_drill('finance', 'cost', 'cost_known', :F, 1, 0)->>'total')::numeric);
SELECT t_c5.ok('cobertura de custo não serializa valores de tarifa',
  NOT (public.project_dash_drill('finance', 'cost', 'all', :F, 50, 0)::text ~ '"amount"|rate_id'));
COMMIT;

-- ================================================================== negação, inativo, segundo workspace, Ver como
INSERT INTO public.job_role_permission_overrides (workspace_id, role_id, permission_key, effect, created_by)
VALUES (:A, '30000000-0000-4000-8000-0000000000a3', 'techsales.deals.view.workspace', 'deny', :U1);
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c5.as_user(:U4) \g /dev/null
SELECT t_c5.ok('negação explícita tira a visão Comercial', NOT (public.project_dash_scope()->'views'->>'commercial')::boolean
  AND t_c5.err(format('select public.project_dash_summary(%L, %L)', 'commercial', :F)) ~ 'não disponível');
COMMIT;
DELETE FROM public.job_role_permission_overrides WHERE workspace_id = :A AND role_id = '30000000-0000-4000-8000-0000000000a3' AND effect = 'deny';
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c5.as_user(:U5) \g /dev/null
SELECT t_c5.ok('membro inativo não lê o painel', t_c5.err(format('select public.project_dash_summary(%L, %L)', 'me', :F)) ~ 'workspace ativo');
COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c5.as_user(:U6) \g /dev/null
SELECT t_c5.ok('admin de outro workspace só vê o próprio tenant',
  t_c5.n(public.project_dash_summary('team', :F), '{entries,total,n}') = t_c5.n(t_c5.n_entries(:B, '2026-01-01', '2026-10-31'), '{n}')
  AND NOT (public.project_dash_filter_options('project', '')::text ~ 'P1 Entrega')
  AND NOT (public.project_dash_drill('team', 'projects', 'all', :F, 50, 0)::text ~ 'P1 Entrega'));
COMMIT;

-- ================================================================== alertas: avaliação idempotente, tratamento e reaparecimento
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c5.as_user(:U2) \g /dev/null
SELECT t_c5.ok('profissional não reavalia alertas', t_c5.err($$select public.project_alert_refresh('America/Sao_Paulo')$$) ~ 'Sem permissão');
COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c5.as_user(:U1) \g /dev/null
SELECT t_c5.put('R1', public.project_alert_refresh('America/Sao_Paulo')::text) \g /dev/null
COMMIT;
SELECT t_c5.ok('primeira avaliação: 10 causas reais (uma por regra/alvo)',
  (t_c5.get('R1')::jsonb->>'new')::int = 10 AND (t_c5.get('R1')::jsonb->>'present')::int = 10
  AND (SELECT count(*) FROM public.project_alerts WHERE workspace_id = :A) = 10
  AND (SELECT count(DISTINCT rule_key) FROM public.project_alerts WHERE workspace_id = :A) = 9
  AND (SELECT count(*) FROM public.project_alerts WHERE workspace_id = :A AND rule_key = 'hours_unreviewed') = 2
  AND (SELECT severity FROM public.project_alerts WHERE dedupe_key = 'hours_budget|c5200000-0000-4000-8000-000000000001') = 'high'
  AND NOT EXISTS (SELECT 1 FROM public.project_alerts WHERE project_id IN ('c5200000-0000-4000-8000-000000000003', 'c5200000-0000-4000-8000-0000000000b6')));
SELECT t_c5.put('E1', t_c5.n_events()::text) \g /dev/null
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c5.as_user(:U1) \g /dev/null
SELECT t_c5.put('R2', public.project_alert_refresh('America/Sao_Paulo')::text) \g /dev/null
COMMIT;
SELECT t_c5.ok('reavaliar de novo não cria alerta nem evento (sem spam)',
  (t_c5.get('R2')::jsonb->>'new')::int = 0 AND t_c5.n_events() = t_c5.get('E1')::bigint
  AND (SELECT count(*) FROM public.project_alerts WHERE workspace_id = :A) = 10);
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c5.as_user(:U3) \g /dev/null
SELECT t_c5.ok('líder vê alertas do projeto liderado e de pessoas alocadas nele; não vê negócio nem P2',
  (SELECT count(*) FROM public.project_alerts) = 6
  AND NOT EXISTS (SELECT 1 FROM public.project_alerts WHERE project_id = 'c5200000-0000-4000-8000-000000000002' OR rule_key = 'deal_won_no_project'));
SELECT t_c5.ok('reconhecer exige justificativa',
  t_c5.err(format('select public.project_alert_act(%L, %L, %L)', (t_c5.alert('project_overdue|c5200000-0000-4000-8000-000000000001')).id, 'ack', 'ok')) ~ 'justificativa');
SELECT t_c5.ok('líder reconhece alerta do próprio projeto',
  public.project_alert_act((t_c5.alert('project_overdue|c5200000-0000-4000-8000-000000000001')).id, 'ack', 'Cliente ciente; novo prazo em negociação')->>'status' = 'acknowledged');
SELECT t_c5.ok('líder não trata alerta de projeto que não lidera',
  t_c5.err(format('select public.project_alert_act(%L, %L, %L)', (t_c5.alert('approver_missing|c5200000-0000-4000-8000-000000000002')).id, 'ack', 'tentativa indevida')) ~ 'Sem permissão');
COMMIT;
SELECT t_c5.ok('reconhecer não altera apontamentos, projetos, marcos, títulos nem pessoas', t_c5.hash_sources() = t_c5.get('H0'));
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c5.as_user(:U2) \g /dev/null
SELECT t_c5.ok('profissional vê o próprio marco atrasado e não trata alertas do projeto',
  EXISTS (SELECT 1 FROM public.project_alerts WHERE rule_key = 'milestone_overdue')
  AND NOT EXISTS (SELECT 1 FROM public.project_alerts WHERE rule_key = 'hours_budget')
  AND t_c5.err(format('select public.project_alert_act(%L, %L, %L)', (t_c5.alert('milestone_overdue|c5700000-0000-4000-8000-000000000001')).id, 'ack', 'tentativa do profissional')) ~ 'Sem permissão');
COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c5.as_user(:U4) \g /dev/null
SELECT t_c5.ok('comercial vê alertas dos negócios que enxerga', (SELECT count(*) FROM public.project_alerts) = 2);
COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c5.as_user(:U6) \g /dev/null
SELECT t_c5.ok('outro workspace não vê alertas de A', (SELECT count(*) FROM public.project_alerts) = 0 AND (SELECT count(*) FROM public.project_alert_events) = 0);
COMMIT;
INSERT INTO public.view_as_sessions (workspace_id, admin_id, target_user_id, mode, nonce, session_id)
VALUES (:A, :U1, :U3, 'role', 'n-iso-c5', 'b0000000-0000-4000-8000-0000000000c5');
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c5.as_user(:U3, 'b0000000-0000-4000-8000-0000000000c5') \g /dev/null
SELECT t_c5.ok('Ver como lê o painel mas não trata alertas',
  t_c5.n(public.project_dash_summary('team', :F), '{entries,total,n}') > 0
  AND t_c5.err(format('select public.project_alert_act(%L, %L, %L)', (t_c5.alert('hours_budget|c5200000-0000-4000-8000-000000000001')).id, 'ack', 'tentativa em Ver como')) ~ 'somente leitura');
COMMIT;
UPDATE public.view_as_sessions SET ended_at = now() WHERE session_id = 'b0000000-0000-4000-8000-0000000000c5';
-- Resolver manualmente com causa presente → volta a abrir na próxima avaliação (com nota).
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c5.as_user(:U1) \g /dev/null
SELECT public.project_alert_act((t_c5.alert('milestone_overdue|c5700000-0000-4000-8000-000000000001')).id, 'resolve', 'Marcado como resolvido para teste') \g /dev/null
SELECT public.project_alert_refresh('America/Sao_Paulo') \g /dev/null
COMMIT;
SELECT t_c5.ok('resolvido com causa presente reaparece, uma vez, com nota',
  (t_c5.alert('milestone_overdue|c5700000-0000-4000-8000-000000000001')).status = 'open'
  AND (t_c5.alert('milestone_overdue|c5700000-0000-4000-8000-000000000001')).reopened_count = 1
  AND (SELECT count(*) FROM public.project_alert_events WHERE kind = 'reappeared' AND note ~ 'Causa ainda presente') = 1);
-- Causa corrigida → resolve sozinho; volta → reaparece.
UPDATE public.project_milestones SET status = 'done' WHERE id = 'c5700000-0000-4000-8000-000000000001';
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c5.as_user(:U1) \g /dev/null
SELECT t_c5.put('R3', public.project_alert_refresh('America/Sao_Paulo')::text) \g /dev/null
COMMIT;
SELECT t_c5.ok('causa que some é resolvida automaticamente',
  (t_c5.get('R3')::jsonb->>'auto_resolved')::int = 1 AND (t_c5.alert('milestone_overdue|c5700000-0000-4000-8000-000000000001')).status = 'resolved'
  AND (t_c5.alert('milestone_overdue|c5700000-0000-4000-8000-000000000001')).resolution = 'auto');
UPDATE public.project_milestones SET status = 'pending' WHERE id = 'c5700000-0000-4000-8000-000000000001';
SELECT t_c5.put('H1', t_c5.hash_sources()) \g /dev/null
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c5.as_user(:U1) \g /dev/null
SELECT t_c5.put('R4', public.project_alert_refresh('America/Sao_Paulo')::text) \g /dev/null
COMMIT;
SELECT t_c5.ok('causa que volta reabre o mesmo alerta (sem duplicar)',
  (t_c5.get('R4')::jsonb->>'reappeared')::int = 1 AND (t_c5.get('R4')::jsonb->>'new')::int = 0
  AND (SELECT count(*) FROM public.project_alerts WHERE rule_key = 'milestone_overdue') = 1);
-- Regras versionadas: desligar uma regra resolve os alertas dela; profissional não configura.
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c5.as_user(:U2) \g /dev/null
SELECT t_c5.ok('profissional não configura regras', t_c5.err($$select public.project_risk_rules_save(null, '{"project_overdue":{"enabled":false}}', 'tentativa indevida')$$) ~ 'Sem permissão');
COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c5.as_user(:U1) \g /dev/null
SELECT t_c5.ok('regra desconhecida e limite inválido são recusados',
  t_c5.err($$select public.project_risk_rules_save(null, '{"inventada":{"enabled":true}}', 'teste de validação')$$) ~ 'desconhecida'
  AND t_c5.err($$select public.project_risk_rules_save(null, '{"hours_budget":{"warn_pct":90,"critical_pct":50}}', 'teste de validação')$$) ~ 'crítico');
SELECT t_c5.put('V1', public.project_risk_rules_save(null, '{"project_overdue":{"enabled":false}}', 'Prazos tratados fora do painel')::text) \g /dev/null
SELECT t_c5.put('V2', public.project_risk_rules_save('c5200000-0000-4000-8000-000000000001', '{"hours_budget":{"enabled":false}}', 'Orçamento P1 revisto')::text) \g /dev/null
SELECT t_c5.put('V3', public.project_risk_rules_save(null, '{"project_overdue":{"enabled":false},"schedule_missing":{"severity":"medium"}}', 'Segunda versão do workspace')::text) \g /dev/null
SELECT t_c5.ok('versões incrementais por escopo (workspace 1→2, projeto 1) e regra efetiva com precedência do projeto',
  (t_c5.get('V1')::jsonb->>'version')::int = 1 AND (t_c5.get('V2')::jsonb->>'version')::int = 1 AND (t_c5.get('V3')::jsonb->>'version')::int = 2
  AND NOT (public.project_risk_rules_get('c5200000-0000-4000-8000-000000000001')->'effective'->'hours_budget'->>'enabled')::boolean
  AND (public.project_risk_rules_get(null)->'effective'->'hours_budget'->>'enabled')::boolean
  AND NOT (public.project_risk_rules_get(null)->'effective'->'project_overdue'->>'enabled')::boolean);
SELECT t_c5.put('R5', public.project_alert_refresh('America/Sao_Paulo')::text) \g /dev/null
COMMIT;
SELECT t_c5.ok('regra desligada e limite revisto resolvem os alertas correspondentes',
  (t_c5.alert('project_overdue|c5200000-0000-4000-8000-000000000001')).status = 'resolved'
  AND (t_c5.alert('hours_budget|c5200000-0000-4000-8000-000000000001')).status = 'resolved'
  AND (t_c5.alert('schedule_missing|c5400000-0000-4000-8000-000000000003')).severity = 'medium');
-- Agendador: só avalia workspace que ligou a avaliação automática; uma vez por dia; app não chama o núcleo.
SELECT t_c5.ok('agendador ignora workspace sem avaliação automática', (public.project_alert_scheduled_tick()->>'evaluated')::int = 0);
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c5.as_user(:U1) \g /dev/null
SELECT t_c5.ok('app não chama o núcleo nem o agendador; avaliação automática só no workspace',
  t_c5.err($$select public.project_alert_scheduled_tick()$$) ~ 'permission denied'
  AND t_c5.err(format('select public.project_alert_evaluate(%L, %L, null, %L)', 'aaaaaaaa-0000-4000-8000-00000000000a', 'America/Sao_Paulo', 'scheduled')) ~ 'permission denied'
  AND t_c5.err($$select public.project_risk_rules_save('c5200000-0000-4000-8000-000000000001', '{"_schedule":{"enabled":true}}', 'tentativa no projeto')$$) ~ 'só para o workspace'
  AND t_c5.err($$select public.project_risk_rules_save(null, '{"_schedule":{"enabled":true,"tz":"Marte/Base"}}', 'fuso inexistente')$$) ~ 'fuso válido');
SELECT public.project_risk_rules_save(null, '{"project_overdue":{"enabled":false},"schedule_missing":{"severity":"medium"},"_schedule":{"enabled":true,"tz":"America/Sao_Paulo"}}', 'Liga a avaliação diária') \g /dev/null
COMMIT;
SELECT t_c5.put('TK1', public.project_alert_scheduled_tick()::text) \g /dev/null
SELECT t_c5.put('TK2', public.project_alert_scheduled_tick()::text) \g /dev/null
SELECT t_c5.ok('agendador avalia uma vez (execução agendada registrada) e não repete no mesmo dia',
  (t_c5.get('TK1')::jsonb->>'evaluated')::int = 1 AND (t_c5.get('TK2')::jsonb->>'evaluated')::int = 0
  AND (SELECT count(*) FROM public.project_alert_runs WHERE trigger = 'scheduled' AND finished_at IS NOT NULL AND actor IS NULL) = 1
  AND (SELECT count(*) FROM (SELECT dedupe_key FROM public.project_alerts GROUP BY 1 HAVING count(*) > 1) d) = 0);
-- Equivalência exata: os conjuntos calculam a visibilidade uma vez (project_dash_vis); para cada usuário,
-- as linhas devem ser EXATAMENTE as que a RLS das tabelas devolve (apontamentos, tarefas, marcos, projetos,
-- negócios ganhos via deal_visible_to_current_user e alertas pela expressão original da política).
BEGIN; SET LOCAL ROLE authenticated;
DO $eq$
DECLARE u uuid; f jsonb; a bigint; b bigint; n int := 0;
BEGIN
  FOREACH u IN ARRAY ARRAY['10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002',
                           '10000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000004',
                           '10000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000007']::uuid[] LOOP
    PERFORM t_c5.as_user(u);
    BEGIN f := public.project_dash_f('{"from":"2026-01-01","to":"2026-10-31","tz":"America/Sao_Paulo"}');
    EXCEPTION WHEN others THEN CONTINUE; END;
    n := n + 1;
    SELECT count(*) INTO a FROM (SELECT id FROM public.project_dash_ds_entries('quality', f)
      EXCEPT SELECT id FROM public.project_time_entries WHERE entry_date BETWEEN '2026-01-01' AND '2026-10-31') x;
    SELECT count(*) INTO b FROM (SELECT id FROM public.project_time_entries WHERE entry_date BETWEEN '2026-01-01' AND '2026-10-31'
      EXCEPT SELECT id FROM public.project_dash_ds_entries('quality', f)) x;
    PERFORM t_c5.ok(format('apontamentos = RLS (%s)', u), a = 0 AND b = 0);
    SELECT count(*) INTO a FROM ((SELECT id FROM public.project_dash_ds_tasks('quality', f) EXCEPT SELECT id FROM public.project_tasks)
                                 UNION ALL (SELECT id FROM public.project_tasks EXCEPT SELECT id FROM public.project_dash_ds_tasks('quality', f))) x;
    PERFORM t_c5.ok(format('tarefas = RLS (%s)', u), a = 0);
    SELECT count(*) INTO a FROM ((SELECT id FROM public.project_dash_ds_milestones('quality', f) EXCEPT SELECT id FROM public.project_milestones)
                                 UNION ALL (SELECT id FROM public.project_milestones EXCEPT SELECT id FROM public.project_dash_ds_milestones('quality', f))) x;
    PERFORM t_c5.ok(format('marcos = RLS (%s)', u), a = 0);
    SELECT count(*) INTO a FROM ((SELECT id FROM public.project_dash_ds_projects('quality', f) EXCEPT SELECT id FROM public.projects)
                                 UNION ALL (SELECT id FROM public.projects EXCEPT SELECT id FROM public.project_dash_ds_projects('quality', f))) x;
    PERFORM t_c5.ok(format('projetos = RLS (%s)', u), a = 0);
    SELECT count(*) INTO a FROM (
      (SELECT id FROM public.project_dash_ds_deals(f)
        EXCEPT SELECT d.id FROM t_c5.won_deals('2026-01-01', '2026-10-31') d WHERE public.deal_visible_to_current_user(d.id))
      UNION ALL
      (SELECT d.id FROM t_c5.won_deals('2026-01-01', '2026-10-31') d WHERE public.deal_visible_to_current_user(d.id)
        EXCEPT SELECT id FROM public.project_dash_ds_deals(f))) x;
    PERFORM t_c5.ok(format('negócios ganhos = deal_visible_to_current_user (%s)', u), a = 0);
    SELECT count(*) INTO a FROM ((SELECT id FROM public.project_alerts EXCEPT SELECT id FROM t_c5.alerts_by_old_policy())
                                 UNION ALL (SELECT id FROM t_c5.alerts_by_old_policy() EXCEPT SELECT id FROM public.project_alerts)) x;
    PERFORM t_c5.ok(format('alertas = expressão original da política (%s)', u), a = 0);
  END LOOP;
  PERFORM t_c5.ok('equivalência conferida para ao menos 5 perfis', n >= 5);
END $eq$;
COMMIT;
SELECT t_c5.ok('leituras e alertas não alteraram fontes (apontamentos, projetos, títulos, pessoas)',
  t_c5.hash_sources() = t_c5.get('H1'));
SELECT 'fim' AS marker;
