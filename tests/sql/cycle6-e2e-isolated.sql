-- Ciclo 6 — fluxo integrado NÃO ADMIN, ponta a ponta, em banco descartável com dados fictícios:
-- negócio ganho (vendedor) → projeto em planejamento (agendador) → configuração/alocação (admin/RH,
-- única etapa administrativa) → apontamento offline + API (profissional) → envio (profissional) →
-- aprovação (líder nomeado) → fechamento (responsável pelo fechamento) → medição (preparador) →
-- aprovação e geração no Financeiro (aprovador financeiro) → painel e drill-down (cada perfil).
-- Roda depois da prova C4 (billing) no MESMO banco, reaproveitando suas fixtures sintéticas
-- (contrato, serviço "Horas fechadas", tarifa e modelo por hora). A política de entrega (C2) é
-- ativada aqui pelo admin, como no produto.
\set ON_ERROR_STOP 1
\set QUIET 1
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.__isolated_marker WHERE id = 1 AND label = 'techerp-isolated-harness') THEN
    RAISE EXCEPTION 'recusado: banco sem marcador do harness';
  END IF;
END $$;
DROP SCHEMA IF EXISTS t_e2e CASCADE;
CREATE SCHEMA t_e2e;
GRANT USAGE ON SCHEMA t_e2e TO authenticated, service_role;
CREATE FUNCTION t_e2e.ok(p_name text, p_cond boolean) RETURNS text LANGUAGE plpgsql AS $$
BEGIN IF p_cond IS DISTINCT FROM true THEN RAISE EXCEPTION 'FALHOU: %', p_name; END IF; RAISE NOTICE 'ok: %', p_name; RETURN 'ok'; END $$;
CREATE FUNCTION t_e2e.err(p_sql text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN EXECUTE p_sql; RETURN 'NO ERROR'; EXCEPTION WHEN others THEN RETURN SQLERRM; END $$;
CREATE FUNCTION t_e2e.as_user(p_uid uuid, p_session uuid DEFAULT NULL) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated', 'session_id', p_session)::text, true) $$;
CREATE TABLE t_e2e.kv (k text PRIMARY KEY, v text);
GRANT ALL ON t_e2e.kv TO authenticated, service_role;
CREATE FUNCTION t_e2e.put(p text, v text) RETURNS text LANGUAGE sql AS $$
  INSERT INTO t_e2e.kv VALUES (p, v) ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v RETURNING v $$;
CREATE FUNCTION t_e2e.get(p text) RETURNS text LANGUAGE sql AS $$ SELECT v FROM t_e2e.kv WHERE k = p $$;
-- Conferências privilegiadas (nunca usadas como prova de acesso).
CREATE FUNCTION t_e2e.entry(p uuid) RETURNS public.project_time_entries LANGUAGE sql SECURITY DEFINER AS $$ SELECT * FROM public.project_time_entries WHERE id = p $$;
CREATE FUNCTION t_e2e.item(p uuid) RETURNS uuid LANGUAGE sql SECURITY DEFINER AS $$
  SELECT id FROM public.project_timesheet_submission_items WHERE time_entry_id = p AND decision = 'pending' ORDER BY id LIMIT 1 $$;
CREATE FUNCTION t_e2e.m(p uuid) RETURNS public.project_measurements LANGUAGE sql SECURITY DEFINER AS $$ SELECT * FROM public.project_measurements WHERE id = p $$;
CREATE FUNCTION t_e2e.fe(p uuid) RETURNS public.financial_entries LANGUAGE sql SECURITY DEFINER AS $$ SELECT * FROM public.financial_entries WHERE id = p $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA t_e2e TO authenticated, service_role;

\set A '''aaaaaaaa-0000-4000-8000-00000000000a'''
\set U1 '''10000000-0000-4000-8000-000000000001'''
\set U2 '''10000000-0000-4000-8000-000000000002'''
\set U3 '''10000000-0000-4000-8000-000000000003'''
\set U4 '''10000000-0000-4000-8000-000000000004'''
\set U6 '''10000000-0000-4000-8000-000000000006'''
\set U7 '''10000000-0000-4000-8000-000000000007'''
\set C1 '''61000000-0000-4000-8000-0000000000e1'''
\set DE '''52000000-0000-4000-8000-0000000000e6'''
\set KE '''c6200000-0000-4000-8000-0000000000e2'''
\set CONTRACT '''c4000000-0000-4000-8000-0000000000c1'''
\set SVC '''c4100000-0000-4000-8000-000000000007'''
\set CFG '''c4800000-0000-4000-8000-000000000007'''
\set PERSON2 '''c4300000-0000-4000-8000-000000000002'''
\set TZ '''America/Sao_Paulo'''

-- Permissão de fechamento para o cargo do u4 (chave real do catálogo) e chave de API do profissional.
INSERT INTO public.permission_sets (id, module, name) VALUES
 ('20000000-0000-4000-8000-0000000006e1','techprojects','[ISO] E2E horas próprias'),
 ('20000000-0000-4000-8000-0000000006e3','techprojects','[ISO] E2E fechamento') ON CONFLICT DO NOTHING;
INSERT INTO public.permission_set_items (set_id, permission_key)
SELECT '20000000-0000-4000-8000-0000000006e1', p.key FROM public.permissions p
 WHERE p.key IN ('techprojects.time_entries.create.own','techprojects.time_entries.view.own','techprojects.time_entries.update.own') ON CONFLICT DO NOTHING;
INSERT INTO public.permission_set_items (set_id, permission_key)
SELECT '20000000-0000-4000-8000-0000000006e3', p.key FROM public.permissions p
 WHERE p.key IN ('techprojects.timesheet_closing.manage.workspace') ON CONFLICT DO NOTHING;
INSERT INTO public.job_role_sets (role_id, set_id) VALUES
 ('30000000-0000-4000-8000-0000000000a1','20000000-0000-4000-8000-0000000006e1'),
 ('30000000-0000-4000-8000-0000000000a3','20000000-0000-4000-8000-0000000006e3') ON CONFLICT DO NOTHING;
INSERT INTO public.api_keys (id, owner_id, workspace_id, name, prefix, key_hash, scopes)
VALUES (:KE, :U2, :A, '[ISO] E2E chave do profissional', 'lvb_isoe', 'h-iso-e2e', ARRAY['write']);
INSERT INTO public.permission_sets (id, module, name) VALUES ('20000000-0000-4000-8000-0000000006e2','techsales','[ISO] E2E vendas') ON CONFLICT DO NOTHING;
INSERT INTO public.permission_set_items (set_id, permission_key)
SELECT '20000000-0000-4000-8000-0000000006e2', p.key FROM public.permissions p
 WHERE p.key IN ('techsales.deals.update.workspace','techsales.deals.view.workspace') ON CONFLICT DO NOTHING;
INSERT INTO public.job_roles (id, name, workspace_id, owner_id) VALUES ('30000000-0000-4000-8000-0000000006e2','[ISO] E2E vendedor',:A,:A) ON CONFLICT DO NOTHING;
INSERT INTO public.job_role_sets (role_id, set_id) VALUES ('30000000-0000-4000-8000-0000000006e2','20000000-0000-4000-8000-0000000006e2') ON CONFLICT DO NOTHING;
INSERT INTO public.user_job_roles (user_id, owner_id, workspace_id, role_id) VALUES (:U4, :A, :A, '30000000-0000-4000-8000-0000000006e2');
INSERT INTO public.companies (id, owner_id, name, workspace_id) VALUES (:C1, :U1, '[ISO] E2E Cliente', :A);
INSERT INTO public.deals (id, workspace_id, owner_id, assigned_to, name, value, stage, company_id)
VALUES (:DE, :A, :U4, :U4, '[ISO] E2E venda de horas', 12345, 'negotiation', :C1);
BEGIN; SET LOCAL ROLE authenticated; SELECT t_e2e.as_user(:U1) \g /dev/null
SELECT public.deal_delivery_policy_save(:A, true, true, '{"user":true,"system":true,"workflow":true,"import":false}', :U1, NULL) \g /dev/null
COMMIT;
SELECT public.deal_delivery_run_jobs(50) \g /dev/null
SELECT t_e2e.ok('0. vendedor edita negócios; profissional não', public.user_has_permission(:U4, :A, 'techsales.deals.update.workspace')
  AND NOT public.user_has_permission(:U2, :A, 'techsales.deals.update.workspace'));

-- ------------------------------------------------------------------ 1. vendedor ganha o negócio
BEGIN; SET LOCAL ROLE authenticated; SELECT t_e2e.as_user(:U4) \g /dev/null
UPDATE public.deals SET stage = 'won' WHERE id = :DE;
COMMIT;
SELECT public.deal_delivery_run_jobs(50) \g /dev/null
SELECT t_e2e.put('P', (SELECT id::text FROM public.projects WHERE deal_id = :DE)) \g /dev/null
SELECT t_e2e.ok('1. ganho do vendedor vira exatamente 1 projeto em planejamento (agendador)',
  (SELECT count(*) FROM public.projects WHERE deal_id = :DE AND status = 'planning') = 1);
BEGIN; SET LOCAL ROLE authenticated; SELECT t_e2e.as_user(:U2) \g /dev/null
SELECT t_e2e.ok('1. profissional ainda não aponta (sem vínculo)',
  t_e2e.err(format('select public.project_time_entry_sync(%L,%L,%L,%L)', :A, 'c6e00000-0000-4000-8000-000000000000', repeat('0', 64),
    json_build_object('project_id', t_e2e.get('P'), 'task_id', gen_random_uuid(), 'entry_date', '2026-10-05', 'mode', 'duration', 'duration_seconds', 600))) <> 'NO ERROR');
COMMIT;

-- ------------------------------------------------------------------ 2. configuração e alocação (admin/RH)
BEGIN; SET LOCAL ROLE authenticated; SELECT t_e2e.as_user(:U1) \g /dev/null
UPDATE public.projects SET contract_id = :CONTRACT, service_id = :SVC, status = 'active' WHERE id = t_e2e.get('P')::uuid;
WITH x AS (INSERT INTO public.project_tasks (workspace_id, project_id, title) VALUES (:A, t_e2e.get('P')::uuid, '[ISO] E2E execução') RETURNING id)
SELECT t_e2e.put('T', id::text) FROM x \g /dev/null
INSERT INTO public.people_allocations (workspace_id, owner_id, person_id, project_id, allocation_pct, starts_at, currency, status)
VALUES (:A, :U1, :PERSON2, t_e2e.get('P')::uuid, 50, '2026-10-01', 'BRL', 'active');
SELECT public.project_time_approver_set(t_e2e.get('P')::uuid, :U3, 'approver', null, '2026-10-01', null, null, null) \g /dev/null
COMMIT;
SELECT t_e2e.ok('2. projeto ativo ligado ao contrato/serviço, alocação vigente e aprovador nomeado',
  (SELECT contract_id = :CONTRACT AND service_id = :SVC FROM public.projects WHERE id = t_e2e.get('P')::uuid)
  AND public.project_time_can_track(:U2, t_e2e.get('P')::uuid, '2026-10-05'));

-- ------------------------------------------------------------------ 3. profissional aponta (fila offline e API)
BEGIN; SET LOCAL ROLE authenticated; SELECT t_e2e.as_user(:U2) \g /dev/null
SELECT t_e2e.put('E1', public.project_time_entry_sync(:A, 'c6e00000-0000-4000-8000-000000000001', repeat('1', 64),
  json_build_object('project_id', t_e2e.get('P'), 'task_id', t_e2e.get('T'), 'entry_date', '2026-10-05', 'mode', 'interval',
                    'start_time', '09:00:00', 'end_time', '11:30:00', 'timezone', 'America/Sao_Paulo')::jsonb)->'entry'->>'id') \g /dev/null
COMMIT;
BEGIN; SET LOCAL ROLE service_role; SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true) \g /dev/null
SELECT t_e2e.put('E2', public.project_api_create_time_entry(:KE, :U2, :A, 'iso-e2e-api-0001', repeat('2', 64),
  json_build_object('project_id', t_e2e.get('P'), 'task_id', t_e2e.get('T'), 'entry_date', '2026-10-06', 'mode', 'duration', 'duration_seconds', 5400)::jsonb)->'data'->>'id') \g /dev/null
COMMIT;
SELECT t_e2e.ok('3. dois rascunhos do profissional: 9000 s (offline) + 5400 s (API)',
  (SELECT status = 'draft' AND duration_seconds = 9000 AND user_id = :U2 FROM t_e2e.entry(t_e2e.get('E1')::uuid))
  AND (SELECT status = 'draft' AND duration_seconds = 5400 AND source = 'api' FROM t_e2e.entry(t_e2e.get('E2')::uuid)));

-- ------------------------------------------------------------------ 4. envio pelo profissional
BEGIN; SET LOCAL ROLE authenticated; SELECT t_e2e.as_user(:U2) \g /dev/null
SELECT t_e2e.put('pv', public.project_timesheet_preview(:A, '2026-10-05', '2026-10-11')::text) \g /dev/null
SELECT t_e2e.ok('4. prévia do envio sem bloqueio', jsonb_array_length(t_e2e.get('pv')::jsonb->'blockers') = 0);
SELECT public.project_timesheet_submit(:A, '2026-10-05', '2026-10-11', t_e2e.get('pv')::jsonb->>'hash', :TZ) \g /dev/null
SELECT t_e2e.ok('4. profissional não aprova as próprias horas',
  t_e2e.err(format('select public.project_timesheet_decide(%L,%L,%L,null)', :A,
    json_build_array(json_build_object('item_id', t_e2e.item(t_e2e.get('E1')::uuid))), 'approve')) ~ 'autoriza|aprovador|permiss');
COMMIT;
SELECT t_e2e.ok('4. itens enviados', (SELECT status FROM t_e2e.entry(t_e2e.get('E1')::uuid)) = 'submitted' AND (SELECT status FROM t_e2e.entry(t_e2e.get('E2')::uuid)) = 'submitted');

-- ------------------------------------------------------------------ 5. aprovação pelo líder nomeado
BEGIN; SET LOCAL ROLE authenticated; SELECT t_e2e.as_user(:U3) \g /dev/null
SELECT public.project_timesheet_decide(:A, json_build_array(
  json_build_object('item_id', t_e2e.item(t_e2e.get('E1')::uuid), 'revision', 0),
  json_build_object('item_id', t_e2e.item(t_e2e.get('E2')::uuid), 'revision', 0))::jsonb, 'approve', null) \g /dev/null
COMMIT;
SELECT t_e2e.ok('5. aprovados pelo líder', (SELECT status = 'approved' FROM t_e2e.entry(t_e2e.get('E1')::uuid)) AND (SELECT status = 'approved' FROM t_e2e.entry(t_e2e.get('E2')::uuid)));

-- ------------------------------------------------------------------ 6. fechamento da competência
BEGIN; SET LOCAL ROLE authenticated; SELECT t_e2e.as_user(:U2) \g /dev/null
SELECT t_e2e.ok('6. profissional não fecha competência',
  t_e2e.err(format('select public.project_period_close(%L,%L,%L,null,%L,%L,%L)', :A, 'project', t_e2e.get('P'), '2026-10-01', '2026-10-31', 'America/Sao_Paulo')) <> 'NO ERROR');
COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SELECT t_e2e.as_user(:U4) \g /dev/null
SELECT t_e2e.put('CL', public.project_period_close(:A, 'project', t_e2e.get('P')::uuid, null, '2026-10-01', '2026-10-31', :TZ)->>'closing_id') \g /dev/null
COMMIT;
SELECT t_e2e.ok('6. competência de outubro fechada com os 2 apontamentos (14400 s)',
  (SELECT entry_count = 2 AND total_seconds = 14400 FROM public.project_period_closings WHERE id = t_e2e.get('CL')::uuid));
BEGIN; SET LOCAL ROLE authenticated; SELECT t_e2e.as_user(:U2) \g /dev/null
SELECT t_e2e.ok('6. depois de fechar, não entra apontamento novo em outubro (nem pela fila)',
  t_e2e.err(format('select public.project_time_entry_sync(%L,%L,%L,%L)', :A, 'c6e00000-0000-4000-8000-000000000009', repeat('9', 64),
    json_build_object('project_id', t_e2e.get('P'), 'task_id', t_e2e.get('T'), 'entry_date', '2026-10-07', 'mode', 'duration', 'duration_seconds', 600))) ~ 'PERIOD_CLOSED');
COMMIT;

-- ------------------------------------------------------------------ 7. medição (preparador) e Financeiro (aprovador)
BEGIN; SET LOCAL ROLE authenticated; SELECT t_e2e.as_user(:U2) \g /dev/null
SELECT t_e2e.ok('7. profissional não prepara medição', t_e2e.err(format('select public.project_measurement_build(%L,%L,%L,%L)', :CFG, '2026-10-01', 'regular', 'America/Sao_Paulo')) ~ 'Sem permissão');
COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SELECT t_e2e.as_user(:U3) \g /dev/null
SELECT t_e2e.put('M', public.project_measurement_build(:CFG, '2026-10-01', 'regular', :TZ)::text) \g /dev/null
COMMIT;
SELECT t_e2e.ok('7. medição de outubro: 14400 s × R$ 100/h = R$ 400,00 (só horas aprovadas e fechadas)',
  (SELECT total_seconds = 14400 AND total_amount = 400 AND status = 'draft' FROM t_e2e.m(t_e2e.get('M')::uuid)));
BEGIN; SET LOCAL ROLE authenticated; SELECT t_e2e.as_user(:U3) \g /dev/null
SELECT public.project_measurement_submit(t_e2e.get('M')::uuid, (SELECT lines_hash FROM t_e2e.m(t_e2e.get('M')::uuid))) \g /dev/null
SELECT t_e2e.ok('7. preparador não aprova', t_e2e.err(format('select public.project_measurement_approve(%L,%L)', t_e2e.get('M'), (SELECT lines_hash FROM t_e2e.m(t_e2e.get('M')::uuid)))) ~ 'Sem permissão');
COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SELECT t_e2e.as_user(:U4) \g /dev/null
SELECT t_e2e.ok('7. aprovador financeiro aprova', public.project_measurement_approve(t_e2e.get('M')::uuid, (SELECT lines_hash FROM t_e2e.m(t_e2e.get('M')::uuid))) = 'ready');
SELECT t_e2e.put('FE', public.project_measurement_generate(t_e2e.get('M')::uuid, (SELECT lines_hash FROM t_e2e.m(t_e2e.get('M')::uuid)), '2026-11-10')->>'financial_entry_id') \g /dev/null
COMMIT;
SELECT t_e2e.ok('7. título a receber único no Financeiro existente, R$ 400,00, origem medição',
  (SELECT amount = 400 AND direction::text = 'receivable' AND origin_type::text = 'project_measurement' AND workspace_id = :A FROM t_e2e.fe(t_e2e.get('FE')::uuid))
  AND (SELECT count(*) FROM public.financial_entries WHERE origin_type::text = 'project_measurement' AND origin_id::text = t_e2e.get('M')) <= 1);
BEGIN; SET LOCAL ROLE authenticated; SELECT t_e2e.as_user(:U4) \g /dev/null
SELECT t_e2e.ok('7. gerar de novo é idempotente (mesmo título)',
  (public.project_measurement_generate(t_e2e.get('M')::uuid, (SELECT lines_hash FROM t_e2e.m(t_e2e.get('M')::uuid)), '2026-11-10')->>'financial_entry_id') = t_e2e.get('FE'));
COMMIT;

-- ------------------------------------------------------------------ 8. painel por perfil e drill-down
BEGIN; SET LOCAL ROLE authenticated; SELECT t_e2e.as_user(:U2) \g /dev/null
SELECT t_e2e.put('me', public.project_dash_summary('me', jsonb_build_object('from','2026-10-01','to','2026-10-31','tz','America/Sao_Paulo'))::text) \g /dev/null
COMMIT;
SELECT t_e2e.ok('8. "Meu trabalho" do profissional em outubro: 14400 s aprovados (as duas horas do fluxo)',
  (t_e2e.get('me')::jsonb #>> '{entries,validated,secs}')::numeric = 14400);
BEGIN; SET LOCAL ROLE authenticated; SELECT t_e2e.as_user(:U2) \g /dev/null
SELECT t_e2e.ok('8. profissional não vê medição nem título', (SELECT count(*) FROM public.project_measurements WHERE id = t_e2e.get('M')::uuid) = 0
  AND (SELECT count(*) FROM public.financial_entries WHERE id = t_e2e.get('FE')::uuid) = 0);
COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SELECT t_e2e.as_user(:U4) \g /dev/null
SELECT t_e2e.put('fin', public.project_dash_drill('finance', 'measurements', 'generated', '{"from":"2026-10-01","to":"2026-10-31","tz":"America/Sao_Paulo"}'::jsonb, 50, 0)::text) \g /dev/null
COMMIT;
SELECT t_e2e.ok('8. drill "Gerada no Financeiro" do aprovador lista a medição do fluxo',
  EXISTS (SELECT 1 FROM jsonb_array_elements(t_e2e.get('fin')::jsonb->'rows') r WHERE r::text LIKE '%' || t_e2e.get('M') || '%'));
BEGIN; SET LOCAL ROLE authenticated; SELECT t_e2e.as_user(:U6) \g /dev/null
SELECT t_e2e.ok('8. outro workspace não vê nada do fluxo',
  (SELECT count(*) FROM public.projects WHERE id = t_e2e.get('P')::uuid) = 0 AND (SELECT count(*) FROM public.project_time_entries WHERE project_id = t_e2e.get('P')::uuid) = 0);
COMMIT;
SELECT 'fim' AS marcador;
