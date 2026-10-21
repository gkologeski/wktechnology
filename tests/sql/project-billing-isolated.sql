-- Prova isolada do ciclo 4 do TechProjects (tarifas com vigência, medições, Financeiro e rentabilidade).
-- Roda SOMENTE no banco descartável do harness via
--   bash tests/sql/project-billing-isolated.sh drizzle/migrations/0175_*.sql
-- Asserções de acesso rodam como `authenticated` com claims de JWT (nunca service_role).
-- Fixtures sintéticas são gravadas como superusuário do harness apenas para montar o cenário.
\set ON_ERROR_STOP 1
\set QUIET 1
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.__isolated_marker WHERE id = 1 AND label = 'techerp-isolated-harness') THEN
    RAISE EXCEPTION 'recusado: banco sem marcador do harness';
  END IF;
END $$;

DROP SCHEMA IF EXISTS t_c4 CASCADE;
CREATE SCHEMA t_c4;
GRANT USAGE ON SCHEMA t_c4 TO authenticated, anon;
CREATE FUNCTION t_c4.ok(p_name text, p_cond boolean) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  IF p_cond IS DISTINCT FROM true THEN RAISE EXCEPTION 'FALHOU: %', p_name; END IF;
  RAISE NOTICE 'ok: %', p_name; RETURN 'ok';
END $$;
CREATE FUNCTION t_c4.err(p_sql text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN EXECUTE p_sql; RETURN 'NO ERROR';
EXCEPTION WHEN others THEN RETURN SQLERRM; END $$;
CREATE FUNCTION t_c4.as_user(p_uid uuid, p_session uuid DEFAULT NULL) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated', 'session_id', p_session)::text, true) $$;
CREATE TABLE t_c4.kv (k text PRIMARY KEY, v text);
GRANT ALL ON t_c4.kv TO authenticated;
CREATE FUNCTION t_c4.get(p text) RETURNS text LANGUAGE sql AS $$ SELECT v FROM t_c4.kv WHERE k = p $$;
CREATE FUNCTION t_c4.put(p text, v text) RETURNS text LANGUAGE sql AS $$
  INSERT INTO t_c4.kv VALUES (p, v) ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v RETURNING v $$;
-- Leitura privilegiada só para conferir resultado (nunca usada como prova de acesso).
CREATE FUNCTION t_c4.m(p uuid) RETURNS public.project_measurements LANGUAGE sql SECURITY DEFINER AS $$
  SELECT * FROM public.project_measurements WHERE id = p $$;
CREATE FUNCTION t_c4.mid(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT t_c4.get(p)::uuid $$;
CREATE FUNCTION t_c4.hash(p text) RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT lines_hash FROM public.project_measurements WHERE id = t_c4.get(p)::uuid $$;
CREATE FUNCTION t_c4.codes(p jsonb) RETURNS text[] LANGUAGE sql AS $$ SELECT coalesce(array_agg(x->>'code'), '{}') FROM jsonb_array_elements(p) x $$;
CREATE FUNCTION t_c4.n_fe(p_ref text) RETURNS bigint LANGUAGE sql SECURITY DEFINER AS $$
  SELECT count(*) FROM public.financial_entries WHERE external_ref LIKE p_ref $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA t_c4 TO authenticated;

\set A '''aaaaaaaa-0000-4000-8000-00000000000a'''
\set B '''aaaaaaaa-0000-4000-8000-00000000000b'''
\set U1 '''10000000-0000-4000-8000-000000000001'''
\set U2 '''10000000-0000-4000-8000-000000000002'''
\set U3 '''10000000-0000-4000-8000-000000000003'''
\set U4 '''10000000-0000-4000-8000-000000000004'''
\set U5 '''10000000-0000-4000-8000-000000000005'''
\set U6 '''10000000-0000-4000-8000-000000000006'''
\set U7 '''10000000-0000-4000-8000-000000000007'''
\set TZ '''America/Sao_Paulo'''

-- ------------------------------------------------------------------ permissões (chaves novas, só em conjuntos sintéticos)
SELECT t_c4.ok('nove chaves novas no catálogo',
  (SELECT count(*) FROM public.permissions WHERE key IN ('techprojects.rates.view.workspace','techprojects.rates.manage.workspace',
   'techprojects.billing_config.manage.workspace','techprojects.measurements.view.workspace','techprojects.measurements.manage.workspace',
   'techprojects.measurements.approve.workspace','techprojects.measurement_finance.create.workspace',
   'techprojects.measurement_reverse.manage.workspace','techprojects.profitability.view.workspace')) = 9);
INSERT INTO public.permission_sets (id, module, name) VALUES
 ('20000000-0000-4000-8000-0000000000d1','techprojects','[ISO] Preparar medição'),
 ('20000000-0000-4000-8000-0000000000d2','techprojects','[ISO] Aprovar e gerar'),
 ('20000000-0000-4000-8000-0000000000d3','techprojects','[ISO] Só rentabilidade') ON CONFLICT DO NOTHING;
INSERT INTO public.permission_set_items (set_id, permission_key) SELECT '20000000-0000-4000-8000-0000000000d1', k FROM unnest(ARRAY[
  'techprojects.measurements.view.workspace','techprojects.measurements.manage.workspace','techprojects.rates.view.workspace']) k ON CONFLICT DO NOTHING;
INSERT INTO public.permission_set_items (set_id, permission_key) SELECT '20000000-0000-4000-8000-0000000000d2', k FROM unnest(ARRAY[
  'techprojects.measurements.view.workspace','techprojects.measurements.approve.workspace','techprojects.measurement_finance.create.workspace',
  'techfinance.entries.create.own','techprojects.measurement_reverse.manage.workspace','techprojects.profitability.view.workspace']) k ON CONFLICT DO NOTHING;
INSERT INTO public.permission_set_items (set_id, permission_key) SELECT '20000000-0000-4000-8000-0000000000d3', k FROM unnest(ARRAY[
  'techprojects.profitability.view.workspace']) k ON CONFLICT DO NOTHING;
INSERT INTO public.job_role_sets (role_id, set_id) VALUES
 ('30000000-0000-4000-8000-0000000000a2','20000000-0000-4000-8000-0000000000d1'),
 ('30000000-0000-4000-8000-0000000000a3','20000000-0000-4000-8000-0000000000d2') ON CONFLICT DO NOTHING;
INSERT INTO public.user_permission_sets (user_id, owner_id, workspace_id, set_id)
VALUES (:U7, :A, :A, '20000000-0000-4000-8000-0000000000d3');
SELECT t_c4.ok('papéis: u3 prepara, u4 aprova/gera, u7 só rentabilidade, u2 nada, u5 inativo nada',
  public.user_has_permission(:U3, :A, 'techprojects.measurements.manage.workspace')
  AND NOT public.user_has_permission(:U3, :A, 'techprojects.measurements.approve.workspace')
  AND public.user_has_permission(:U4, :A, 'techprojects.measurements.approve.workspace')
  AND NOT public.user_has_permission(:U4, :A, 'techprojects.rates.view.workspace')
  AND public.user_has_permission(:U7, :A, 'techprojects.profitability.view.workspace')
  AND NOT public.user_has_permission(:U7, :A, 'techprojects.rates.view.workspace')
  AND NOT public.user_has_permission(:U2, :A, 'techprojects.measurements.view.workspace')
  AND NOT public.user_has_permission(:U5, :A, 'techprojects.measurements.approve.workspace')
  AND public.user_has_permission(:U1, :A, 'techprojects.rates.manage.workspace'));

-- ------------------------------------------------------------------ fixtures sintéticas
INSERT INTO public.contracts (id, workspace_id, owner_id, role, title, currency, starts_at, status) VALUES
 ('c4000000-0000-4000-8000-0000000000c1', :A, :U1, 'provider', '[ISO] Contrato C4', 'BRL', '2026-01-01', 'active'),
 ('c4000000-0000-4000-8000-0000000000c2', :A, :U1, 'client', '[ISO] Contrato compra', 'BRL', '2026-01-01', 'active'),
 ('c4000000-0000-4000-8000-0000000000cb', :B, :U6, 'provider', '[ISO] Contrato B', 'BRL', '2026-01-01', 'active');
INSERT INTO public.services (id, workspace_id, owner_id, contract_id, role, name, type, status, quantity, unit_price, currency, cadence, starts_at, percent, percent_base_amount) VALUES
 ('c4100000-0000-4000-8000-000000000001', :A, :U1, 'c4000000-0000-4000-8000-0000000000c1', 'provider', '[ISO] Mensalidade', 'recurring', 'active', 2, 1500, 'BRL', 'monthly', '2026-09-16', NULL, NULL),
 ('c4100000-0000-4000-8000-000000000002', :A, :U1, 'c4000000-0000-4000-8000-0000000000c1', 'provider', '[ISO] Horas', 'usage_based', 'active', 1, 0, 'BRL', NULL, '2026-01-01', NULL, NULL),
 ('c4100000-0000-4000-8000-000000000003', :A, :U1, 'c4000000-0000-4000-8000-0000000000c1', 'provider', '[ISO] Pacote', 'usage_based', 'active', 1, 0, 'BRL', NULL, '2026-01-01', NULL, NULL),
 ('c4100000-0000-4000-8000-000000000004', :A, :U1, 'c4000000-0000-4000-8000-0000000000c1', 'provider', '[ISO] Hunting', 'one_time', 'active', 1, 0, 'BRL', NULL, '2026-01-01', 20, 10000),
 ('c4100000-0000-4000-8000-000000000005', :A, :U1, 'c4000000-0000-4000-8000-0000000000c1', 'provider', '[ISO] Marcos', 'milestone', 'active', 1, 0, 'BRL', NULL, '2026-01-01', NULL, NULL),
 ('c4100000-0000-4000-8000-000000000007', :A, :U1, 'c4000000-0000-4000-8000-0000000000c1', 'provider', '[ISO] Horas fechadas', 'usage_based', 'active', 1, 0, 'BRL', NULL, '2026-01-01', NULL, NULL),
 ('c4100000-0000-4000-8000-000000000008', :A, :U1, 'c4000000-0000-4000-8000-0000000000c1', 'provider', '[ISO] Horas tarifa zero', 'usage_based', 'active', 1, 0, 'BRL', NULL, '2026-01-01', NULL, NULL),
 ('c4100000-0000-4000-8000-000000000009', :A, :U1, 'c4000000-0000-4000-8000-0000000000c1', 'provider', '[ISO] Em dólar', 'usage_based', 'active', 1, 0, 'USD', NULL, '2026-01-01', NULL, NULL);
INSERT INTO public.projects (id, workspace_id, owner_id, name, status, contract_id, service_id) VALUES
 ('c4200000-0000-4000-8000-000000000001', :A, :U1, '[ISO] P1 horas', 'active', 'c4000000-0000-4000-8000-0000000000c1', 'c4100000-0000-4000-8000-000000000002'),
 ('c4200000-0000-4000-8000-000000000002', :A, :U1, '[ISO] P2 mensal', 'active', 'c4000000-0000-4000-8000-0000000000c1', 'c4100000-0000-4000-8000-000000000001'),
 ('c4200000-0000-4000-8000-000000000003', :A, :U1, '[ISO] P3 mensal', 'active', 'c4000000-0000-4000-8000-0000000000c1', 'c4100000-0000-4000-8000-000000000001'),
 ('c4200000-0000-4000-8000-000000000004', :A, :U1, '[ISO] P4 pacote', 'active', 'c4000000-0000-4000-8000-0000000000c1', 'c4100000-0000-4000-8000-000000000003'),
 ('c4200000-0000-4000-8000-000000000005', :A, :U1, '[ISO] P5 marcos', 'active', 'c4000000-0000-4000-8000-0000000000c1', 'c4100000-0000-4000-8000-000000000005'),
 ('c4200000-0000-4000-8000-000000000007', :A, :U1, '[ISO] P7 fechado', 'active', 'c4000000-0000-4000-8000-0000000000c1', 'c4100000-0000-4000-8000-000000000007'),
 ('c4200000-0000-4000-8000-000000000008', :A, :U1, '[ISO] P8 zero', 'active', 'c4000000-0000-4000-8000-0000000000c1', 'c4100000-0000-4000-8000-000000000008');
INSERT INTO public.project_members (workspace_id, project_id, user_id, role_in_project)
SELECT :A, p, u, 'contributor' FROM unnest(ARRAY['c4200000-0000-4000-8000-000000000001','c4200000-0000-4000-8000-000000000004',
  'c4200000-0000-4000-8000-000000000007','c4200000-0000-4000-8000-000000000008']::uuid[]) p CROSS JOIN unnest(ARRAY[:U2, :U7]::uuid[]) u;
INSERT INTO public.people (id, owner_id, workspace_id, full_name, profile_id) VALUES
 ('c4300000-0000-4000-8000-000000000002', :U1, :A, '[ISO] Pessoa Dois', :U2),
 ('c4300000-0000-4000-8000-000000000007', :U1, :A, '[ISO] Pessoa Sete', :U7);
INSERT INTO public.people_allocations (id, workspace_id, owner_id, person_id, project_id, allocation_pct, starts_at, currency, status) VALUES
 ('c4400000-0000-4000-8000-000000000001', :A, :U1, 'c4300000-0000-4000-8000-000000000007', 'c4200000-0000-4000-8000-000000000001', 50, '2026-01-01', 'BRL', 'active'),
 ('c4400000-0000-4000-8000-000000000002', :A, :U1, 'c4300000-0000-4000-8000-000000000007', 'c4200000-0000-4000-8000-000000000001', 50, '2026-01-01', 'BRL', 'active');

-- Apontamentos: inseridos pelo harness já na situação desejada (fluxo C3 provado no ciclo 3).
SELECT set_config('app.project_time_workflow', 'on', false) \g /dev/null
INSERT INTO public.project_time_entries (id, workspace_id, project_id, user_id, entry_date, start_time, end_time, status, approved_at, billable) VALUES
 ('c4500000-0000-4000-8000-000000000001', :A, 'c4200000-0000-4000-8000-000000000001', :U2, '2026-08-10', '09:00', '10:00', 'approved', now(), true),
 ('c4500000-0000-4000-8000-000000000002', :A, 'c4200000-0000-4000-8000-000000000001', :U2, '2026-08-20', '09:00:00', '10:30:15', 'approved', now(), true),
 ('c4500000-0000-4000-8000-000000000003', :A, 'c4200000-0000-4000-8000-000000000001', :U7, '2026-08-21', '10:00', '11:00', 'approved', now(), true),
 ('c4500000-0000-4000-8000-000000000004', :A, 'c4200000-0000-4000-8000-000000000001', :U2, '2026-08-22', '10:00', '11:00', 'draft', NULL, true),
 ('c4500000-0000-4000-8000-000000000005', :A, 'c4200000-0000-4000-8000-000000000001', :U2, '2026-08-23', '10:00', '11:00', 'approved', now(), false),
 -- pacote: agosto 4800 s; setembro 10000 s
 ('c4500000-0000-4000-8000-000000000011', :A, 'c4200000-0000-4000-8000-000000000004', :U2, '2026-08-11', '09:00', '09:50', 'approved', now(), true),
 ('c4500000-0000-4000-8000-000000000012', :A, 'c4200000-0000-4000-8000-000000000004', :U2, '2026-08-12', '09:00', '09:30', 'approved', now(), true),
 ('c4500000-0000-4000-8000-000000000013', :A, 'c4200000-0000-4000-8000-000000000004', :U2, '2026-09-11', '09:00', '10:40', 'approved', now(), true),
 ('c4500000-0000-4000-8000-000000000014', :A, 'c4200000-0000-4000-8000-000000000004', :U2, '2026-09-12', '09:00', '10:06:40', 'approved', now(), true),
 -- competência fechada (P7): dois fechados + um aprovado fora do fechamento
 ('c4500000-0000-4000-8000-000000000021', :A, 'c4200000-0000-4000-8000-000000000007', :U2, '2026-09-02', '09:00', '10:00', 'approved', now(), true),
 ('c4500000-0000-4000-8000-000000000022', :A, 'c4200000-0000-4000-8000-000000000007', :U2, '2026-09-03', '09:00', '10:00', 'approved', now(), true),
 ('c4500000-0000-4000-8000-000000000023', :A, 'c4200000-0000-4000-8000-000000000007', :U2, '2026-09-04', '09:00', '10:00', 'approved', now(), true),
 -- tarifa zero explícita (P8)
 ('c4500000-0000-4000-8000-000000000031', :A, 'c4200000-0000-4000-8000-000000000008', :U2, '2026-09-02', '13:00', '14:00', 'approved', now(), true);
SELECT set_config('app.project_time_workflow', 'off', false) \g /dev/null
SELECT set_config('app.clockify_import', 'on', false) \g /dev/null
INSERT INTO public.project_time_entries (id, workspace_id, project_id, user_id, started_at, stopped_at, hours, entry_date, status, source, external_id, locked_at, billable)
VALUES ('c4500000-0000-4000-8000-0000000000f1', :A, 'c4200000-0000-4000-8000-000000000001', :U2, '2026-08-05 12:00:00+00', '2026-08-05 13:30:15+00', 1.504,
        '2026-08-05', 'locked', 'import', 'iso-c4-imp-1', now(), true);
SELECT set_config('app.clockify_import', 'off', false) \g /dev/null
INSERT INTO public.project_period_closings (id, workspace_id, scope, project_id, period_from, period_to, timezone, status, entries_snapshot, entry_count, total_seconds, closed_by)
VALUES ('c4600000-0000-4000-8000-000000000001', :A, 'project', 'c4200000-0000-4000-8000-000000000007', '2026-09-01', '2026-09-03', :TZ, 'closed', '[]', 2, 7200, :U1);
SELECT set_config('app.project_time_workflow', 'on', false) \g /dev/null
UPDATE public.project_time_entries SET period_closing_id = 'c4600000-0000-4000-8000-000000000001'
 WHERE id IN ('c4500000-0000-4000-8000-000000000021','c4500000-0000-4000-8000-000000000022');
SELECT set_config('app.project_time_workflow', 'off', false) \g /dev/null
CREATE TABLE t_c4.entries_before AS
SELECT md5(string_agg(concat_ws('|', id, financial_entry_id, invoiced_at, invoice_id), ',' ORDER BY id)) AS h,
       count(*) FILTER (WHERE financial_entry_id IS NOT NULL OR invoiced_at IS NOT NULL OR invoice_id IS NOT NULL) AS billed
  FROM public.project_time_entries;
SELECT t_c4.ok('segundos exatos do intervalo 09:00:00–10:30:15 = 5415 s',
  (SELECT duration_seconds FROM public.project_time_entries WHERE id = 'c4500000-0000-4000-8000-000000000002') = 5415);

-- Título legado do serviço mensal de setembro, anterior à configuração (gerado pelo tick antigo).
INSERT INTO public.financial_entries (id, workspace_id, owner_id, direction, origin_type, origin_id, service_id, contract_id, description, amount, currency, competence_date, due_date, status)
VALUES ('c4700000-0000-4000-8000-000000000001', :A, :U1, 'receivable', 'service', 'c4100000-0000-4000-8000-000000000001', 'c4100000-0000-4000-8000-000000000001',
        'c4000000-0000-4000-8000-0000000000c1', '[ISO] legado', 1400, 'BRL', '2026-09-01', '2026-09-01', 'open');

-- ------------------------------------------------------------------ 1. tarifas
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c4.as_user(:U2) \g /dev/null
SELECT t_c4.ok('sem permissão não cria tarifa',
  t_c4.err(format('select public.project_rate_create(%L,%L,%L,%L,%L,null,%L,100,%L,null,%L,true)', :A, 'price', 'service',
    '{"service_id":"c4100000-0000-4000-8000-000000000002"}', 'hour', 'BRL', '2026-08-01', 'teste iso')) ~ 'Sem permissão');
COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c4.as_user(:U1) \g /dev/null
SELECT t_c4.ok('retroativo sem confirmação é recusado',
  t_c4.err(format('select public.project_rate_create(%L,%L,%L,%L,%L,null,%L,100,%L,null,%L,false)', :A, 'price', 'service',
    '{"service_id":"c4100000-0000-4000-8000-000000000002"}', 'hour', 'BRL', '2026-08-01', 'teste iso')) ~ 'RETROACTIVE_CONFIRM');
SELECT t_c4.ok('prévia de impacto mostra apontamentos do escopo',
  (public.project_rate_impact(:A, 'service', '{"service_id":"c4100000-0000-4000-8000-000000000002"}', '2026-08-01', NULL)->>'entries')::int = 6);
SELECT t_c4.put('R_S2', public.project_rate_create(:A, 'price', 'service', '{"service_id":"c4100000-0000-4000-8000-000000000002"}', 'hour', NULL, 'brl',
  100, '2026-08-01', NULL, '[ISO] preço contratado', true)::text) \g /dev/null
SELECT t_c4.ok('sobreposição no mesmo escopo/moeda/unidade é recusada',
  t_c4.err(format('select public.project_rate_create(%L,%L,%L,%L,%L,null,%L,90,%L,null,%L,true)', :A, 'price', 'service',
    '{"service_id":"c4100000-0000-4000-8000-000000000002"}', 'hour', 'BRL', '2026-09-01', 'teste iso')) ~ 'RATE_OVERLAP');
SELECT t_c4.put('R_S2b', public.project_rate_split(t_c4.get('R_S2')::uuid, '2026-08-15', 150, '[ISO] reajuste no meio do mês', true)::text) \g /dev/null
SELECT t_c4.ok('divisão: antiga termina em 15/08 e nova (v2) começa nela',
  (SELECT valid_to = '2026-08-15' AND amount = 100 FROM public.project_rates WHERE id = t_c4.get('R_S2')::uuid)
  AND (SELECT valid_from = '2026-08-15' AND valid_to IS NULL AND amount = 150 AND version = 2 AND supersedes_id = t_c4.get('R_S2')::uuid
         FROM public.project_rates WHERE id = t_c4.get('R_S2b')::uuid));
SELECT t_c4.ok('mesmo serviço em USD não conflita (moeda distinta)',
  public.project_rate_create(:A, 'price', 'service', '{"service_id":"c4100000-0000-4000-8000-000000000002"}', 'hour', NULL, 'USD',
    30, '2026-08-01', NULL, '[ISO] preço em dólar', true) IS NOT NULL);
SELECT t_c4.ok('exceção exige confirmação explícita',
  t_c4.err(format('select public.project_rate_create(%L,%L,%L,%L,%L,null,%L,200,%L,null,%L,true)', :A, 'price', 'exception',
    json_build_object('project_id','c4200000-0000-4000-8000-000000000001','user_id',:U7)::text, 'hour', 'BRL', '2026-08-01', 'teste iso')) ~ 'confirmação');
SELECT public.project_rate_create(:A, 'price', 'exception', json_build_object('project_id','c4200000-0000-4000-8000-000000000001','user_id',:U7,'confirm_exception',true)::jsonb,
  'hour', NULL, 'BRL', 200, '2026-08-01', NULL, '[ISO] exceção sênior', true) \g /dev/null
SELECT public.project_rate_create(:A, 'cost', 'person', '{"person_id":"c4300000-0000-4000-8000-000000000002"}', 'hour', NULL, 'BRL', 40, '2026-01-01', NULL, '[ISO] custo/hora', true) \g /dev/null
SELECT public.project_rate_create(:A, 'cost', 'allocation', '{"allocation_id":"c4400000-0000-4000-8000-000000000001"}', 'hour', NULL, 'BRL', 60, '2026-01-01', NULL, '[ISO] custo alocação 1', true) \g /dev/null
SELECT public.project_rate_create(:A, 'cost', 'allocation', '{"allocation_id":"c4400000-0000-4000-8000-000000000002"}', 'hour', NULL, 'BRL', 70, '2026-01-01', NULL, '[ISO] custo alocação 2', true) \g /dev/null
SELECT t_c4.ok('custo mensal convertido para hora não existe (só alocação/pessoa, sem conversão)',
  t_c4.err(format('select public.project_rate_create(%L,%L,%L,%L,%L,%L,%L,9000,%L,null,%L,true)', :A, 'price', 'service',
    '{"service_id":"c4100000-0000-4000-8000-000000000002"}', 'month', 'full_month', 'BRL', '2026-12-01', 'teste iso')) ~ 'month_only_cost');
SELECT t_c4.ok('valor ausente é recusado (desconhecido não vira zero)',
  t_c4.err(format('select public.project_rate_create(%L,%L,%L,%L,%L,null,%L,null,%L,null,%L,true)', :A, 'price', 'service',
    '{"service_id":"c4100000-0000-4000-8000-000000000003"}', 'hour', 'BRL', '2026-08-01', 'teste iso')) ~ 'Informe o valor');
SELECT public.project_rate_create(:A, 'price', 'service', '{"service_id":"c4100000-0000-4000-8000-000000000003"}', 'hour', NULL, 'BRL', 90, '2026-08-01', NULL, '[ISO] excedente pacote', true) \g /dev/null
SELECT public.project_rate_create(:A, 'price', 'service', '{"service_id":"c4100000-0000-4000-8000-000000000007"}', 'hour', NULL, 'BRL', 100, '2026-08-01', NULL, '[ISO] preço fechado', true) \g /dev/null
COMMIT;
-- Precedência e ambiguidade (função interna lida pelo harness).
SELECT t_c4.ok('precedência: preço antes de 15/08 = 100, depois = 150, exceção do u7 = 200',
  (SELECT amount FROM public.project_rate_pick(:A, 'price', 'BRL', '2026-08-10', 'c4200000-0000-4000-8000-000000000001', :U2)) = 100
  AND (SELECT amount FROM public.project_rate_pick(:A, 'price', 'BRL', '2026-08-20', 'c4200000-0000-4000-8000-000000000001', :U2)) = 150
  AND (SELECT scope = 'exception' AND amount = 200 FROM public.project_rate_pick(:A, 'price', 'BRL', '2026-08-21', 'c4200000-0000-4000-8000-000000000001', :U7)));
SELECT t_c4.ok('duas alocações com custo no mesmo nível = ambíguo (não escolhe a primeira)',
  (SELECT status FROM public.project_rate_pick(:A, 'cost', 'BRL', '2026-08-21', 'c4200000-0000-4000-8000-000000000001', :U7)) = 'ambiguous');
SELECT t_c4.ok('sem tarifa = desconhecido (missing), nunca zero',
  (SELECT status = 'missing' AND amount IS NULL FROM public.project_rate_pick(:A, 'price', 'BRL', '2026-09-02', 'c4200000-0000-4000-8000-000000000008', :U2)));
SELECT t_c4.ok('alteração direta da tarifa é bloqueada mesmo para o superusuário',
  t_c4.err(format('update public.project_rates set amount = 1 where id = %L', t_c4.get('R_S2'))) ~ 'bloqueada');
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c4.as_user(:U4) \g /dev/null
SELECT t_c4.ok('sem permissão de tarifas não lê custos/preços (RLS)', (SELECT count(*) FROM public.project_rates) = 0);
COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c4.as_user(:U6) \g /dev/null
SELECT t_c4.ok('outro workspace não lê tarifas de A', (SELECT count(*) FROM public.project_rates) = 0);
COMMIT;

-- ------------------------------------------------------------------ 2. modelos de cobrança
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c4.as_user(:U1) \g /dev/null
SELECT t_c4.ok('sem retroatividade: modelo não começa no passado',
  t_c4.err(format('select public.project_billing_config_save(%L,%L,%L,%L,%L,%L,%L)', :A, 'c4000000-0000-4000-8000-0000000000c1',
    'c4100000-0000-4000-8000-000000000002', 'per_hour', '{}', '2026-08-01', 'teste isolado c4')) ~ 'retroatividade');
SELECT t_c4.ok('contrato de compra não recebe medição',
  t_c4.err(format('select public.project_billing_config_save(%L,%L,null,%L,%L,%L,%L)', :A, 'c4000000-0000-4000-8000-0000000000c2',
    'per_hour', '{}', date_trunc('month', current_date)::date, 'teste isolado c4')) ~ 'presta');
SELECT t_c4.ok('moedas diferentes não convertem',
  t_c4.err(format('select public.project_billing_config_save(%L,%L,%L,%L,%L,%L,%L)', :A, 'c4000000-0000-4000-8000-0000000000c1',
    'c4100000-0000-4000-8000-000000000009', 'per_hour', '{}', date_trunc('month', current_date)::date, 'teste isolado c4')) ~ 'Moeda');
SELECT t_c4.ok('dias úteis sem calendário não é aceito',
  t_c4.err(format('select public.project_billing_config_save(%L,%L,%L,%L,%L,%L,%L)', :A, 'c4000000-0000-4000-8000-0000000000c1',
    'c4100000-0000-4000-8000-000000000001', 'fixed_recurring', '{"amount_source":"service","proration":"business_days"}',
    date_trunc('month', current_date)::date, 'teste isolado c4')) ~ 'dias úteis');
SELECT t_c4.ok('regra desconhecida é recusada',
  t_c4.err(format('select public.project_billing_config_save(%L,%L,%L,%L,%L,%L,%L)', :A, 'c4000000-0000-4000-8000-0000000000c1',
    'c4100000-0000-4000-8000-000000000002', 'per_hour', '{"desconto_magico":5}', date_trunc('month', current_date)::date, 'teste isolado c4')) ~ 'desconhecida');
COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c4.as_user(:U3) \g /dev/null
SELECT t_c4.ok('preparar medição não dá direito a configurar cobrança',
  t_c4.err(format('select public.project_billing_config_save(%L,%L,%L,%L,%L,%L,%L)', :A, 'c4000000-0000-4000-8000-0000000000c1',
    'c4100000-0000-4000-8000-000000000002', 'per_hour', '{}', date_trunc('month', current_date)::date, 'teste isolado c4')) ~ 'Sem permissão');
COMMIT;
-- Modelos com vigência desde agosto: gravados pelo harness (o produto só permite do mês corrente em diante, provado acima).
SELECT set_config('app.project_billing_flow', 'on', false) \g /dev/null
INSERT INTO public.project_billing_configs (id, workspace_id, contract_id, service_id, model, currency, params, valid_from, reason, created_by) VALUES
 ('c4800000-0000-4000-8000-000000000002', :A, 'c4000000-0000-4000-8000-0000000000c1', 'c4100000-0000-4000-8000-000000000002', 'per_hour', 'BRL',
   '{"require_closed_period":false}', '2026-08-01', '[ISO] horas', :U1),
 ('c4800000-0000-4000-8000-000000000001', :A, 'c4000000-0000-4000-8000-0000000000c1', 'c4100000-0000-4000-8000-000000000001', 'fixed_recurring', 'BRL',
   '{"amount_source":"service","proration":"calendar_days"}', '2026-08-01', '[ISO] mensal', :U1),
 ('c4800000-0000-4000-8000-000000000003', :A, 'c4000000-0000-4000-8000-0000000000c1', 'c4100000-0000-4000-8000-000000000003', 'package', 'BRL',
   '{"included_seconds":7200,"carryover_months":1,"package_amount":2000,"require_closed_period":false}', '2026-08-01', '[ISO] pacote', :U1),
 ('c4800000-0000-4000-8000-000000000004', :A, 'c4000000-0000-4000-8000-0000000000c1', 'c4100000-0000-4000-8000-000000000004', 'percent', 'BRL',
   '{}', '2026-08-01', '[ISO] hunting', :U1),
 ('c4800000-0000-4000-8000-000000000005', :A, 'c4000000-0000-4000-8000-0000000000c1', 'c4100000-0000-4000-8000-000000000005', 'milestone', 'BRL',
   '{}', '2026-08-01', '[ISO] marcos', :U1),
 ('c4800000-0000-4000-8000-000000000007', :A, 'c4000000-0000-4000-8000-0000000000c1', 'c4100000-0000-4000-8000-000000000007', 'per_hour', 'BRL',
   '{"require_closed_period":true,"rounding":"line"}', '2026-08-01', '[ISO] horas fechadas', :U1),
 ('c4800000-0000-4000-8000-000000000008', :A, 'c4000000-0000-4000-8000-0000000000c1', 'c4100000-0000-4000-8000-000000000008', 'per_hour', 'BRL',
   '{"require_closed_period":false}', '2026-08-01', '[ISO] tarifa zero', :U1);
SELECT set_config('app.project_billing_flow', 'off', false) \g /dev/null
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c4.as_user(:U1) \g /dev/null
SELECT t_c4.ok('modelo do contrato inteiro não convive com modelo de serviço do mesmo contrato',
  t_c4.err(format('select public.project_billing_config_save(%L,%L,null,%L,%L,%L,%L)', :A, 'c4000000-0000-4000-8000-0000000000c1',
    'per_hour', '{}', date_trunc('month', current_date)::date, 'teste isolado c4')) ~ 'CONFIG_OVERLAP');
SELECT t_c4.put('CFG8v2', public.project_billing_config_save(:A, 'c4000000-0000-4000-8000-0000000000c1', 'c4100000-0000-4000-8000-000000000008', 'per_hour',
     '{"require_closed_period":false}', (date_trunc('month', current_date) + interval '1 month')::date, '[ISO] nova versão futura')->>'version') \g /dev/null
SELECT t_c4.ok('nova versão do mesmo escopo encerra a anterior (versão 2, sem sobrepor)', t_c4.get('CFG8v2') = '2'
  AND (SELECT valid_to = (date_trunc('month', current_date) + interval '1 month')::date FROM public.project_billing_configs WHERE id = 'c4800000-0000-4000-8000-000000000008'));
COMMIT;
-- Tick legado × Medições: o serviço com dono "Medições" não recebe título do mecanismo antigo.
SELECT t_c4.ok('tick legado bloqueado para serviço/competência com dono Medições',
  t_c4.err(format('insert into public.financial_entries (workspace_id, owner_id, direction, origin_type, origin_id, service_id, description, amount, currency, competence_date, due_date, status) values (%L,%L,%L,%L,%L,%L,%L,1,%L,%L,%L,%L)',
    :A, :U1, 'receivable', 'service', 'c4100000-0000-4000-8000-000000000002', 'c4100000-0000-4000-8000-000000000002', 'tick', 'BRL', '2026-10-01', '2026-10-01', 'open')) ~ 'BILLING_OWNER');
SELECT t_c4.ok('serviço sem dono Medições segue com o tick legado',
  NOT public.project_billing_service_owned('c4100000-0000-4000-8000-000000000009', '2026-10-01')
  AND public.project_billing_service_owned('c4100000-0000-4000-8000-000000000002', '2026-10-01'));

-- ------------------------------------------------------------------ 3. por hora (tarifa muda no meio do mês, segundos, arredondamento)
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c4.as_user(:U2) \g /dev/null
SELECT t_c4.ok('profissional não prepara medição',
  t_c4.err(format('select public.project_measurement_build(%L,%L,%L,%L)', 'c4800000-0000-4000-8000-000000000002', '2026-08-01', 'regular', :TZ)) ~ 'Sem permissão');
COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c4.as_user(:U3) \g /dev/null
SELECT t_c4.put('MH', public.project_measurement_build('c4800000-0000-4000-8000-000000000002', '2026-08-15', 'regular', :TZ)::text) \g /dev/null
SELECT t_c4.ok('composição por hora: 3600 s×100 + 5415 s×150 + 3600 s×200 = 525,63 (arredondado no total)',
  (SELECT total_amount = 525.63 AND total_seconds = 12615 AND status = 'draft' FROM t_c4.m(t_c4.mid('MH'))));
SELECT t_c4.ok('linha da tarifa nova guarda o valor exato antes de arredondar (225,625)',
  (SELECT amount = 225.625 AND rate_amount = 150 FROM public.project_measurement_lines WHERE source_id = 'c4500000-0000-4000-8000-000000000002'));
SELECT t_c4.ok('importado bloqueado fica fora mesmo faturável; rascunho e não faturável também',
  (SELECT t_c4.codes(warnings) @> ARRAY['imported_locked','not_approved','not_billable'] FROM t_c4.m(t_c4.mid('MH')))
  AND (SELECT NOT included AND NOT active FROM public.project_measurement_lines WHERE source_id = 'c4500000-0000-4000-8000-0000000000f1'));
SELECT t_c4.ok('mesma competência regular devolve o mesmo rascunho (idempotente)',
  public.project_measurement_build('c4800000-0000-4000-8000-000000000002', '2026-08-01', 'regular', :TZ) = t_c4.mid('MH'));
SELECT t_c4.ok('hash diferente do lido recusa envio', t_c4.err(format('select public.project_measurement_submit(%L,%L)', t_c4.get('MH'), 'x')) ~ 'PREVIEW_STALE');
COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c4.as_user(:U2) \g /dev/null
SELECT t_c4.ok('profissional não lê medições nem linhas (RLS)',
  (SELECT count(*) FROM public.project_measurements) = 0 AND (SELECT count(*) FROM public.project_measurement_lines) = 0);
COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c4.as_user(:U3) \g /dev/null
SELECT t_c4.ok('preparador lê a medição', (SELECT count(*) FROM public.project_measurements) = 1);
COMMIT;
-- Tarifa nova no período depois da prévia: a prévia fica velha.
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c4.as_user(:U1) \g /dev/null
SELECT public.project_rate_create(:A, 'price', 'exception', json_build_object('project_id','c4200000-0000-4000-8000-000000000001','user_id',:U2,'confirm_exception',true)::jsonb,
  'hour', NULL, 'BRL', 120, '2026-08-01', '2026-08-12', '[ISO] exceção curta', true) \g /dev/null
COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c4.as_user(:U3) \g /dev/null
SELECT t_c4.ok('fonte mudou (tarifa) → envio recusado mesmo com o hash lido',
  t_c4.err(format('select public.project_measurement_submit(%L,%L)', t_c4.get('MH'), t_c4.hash('MH'))) ~ 'PREVIEW_STALE');
SELECT public.project_measurement_refresh(t_c4.mid('MH')) \g /dev/null
SELECT t_c4.ok('atualizada: 3600 s×120 + 5415 s×150 + 3600 s×200 = 545,63, revisão 2',
  (SELECT total_amount = 545.63 AND revision = 2 FROM t_c4.m(t_c4.mid('MH'))));
SELECT public.project_measurement_submit(t_c4.mid('MH'), t_c4.hash('MH')) \g /dev/null
SELECT t_c4.ok('preparador não aprova (sem permissão)', t_c4.err(format('select public.project_measurement_approve(%L,%L)', t_c4.get('MH'), t_c4.hash('MH'))) ~ 'Sem permissão');
COMMIT;
SELECT t_c4.ok('apontamento em medição revisada não é editado (nem pelo superusuário)',
  t_c4.err('update public.project_time_entries set billable = false where id = ''c4500000-0000-4000-8000-000000000001''') ~ 'MEASURED_ENTRY');
SELECT t_c4.ok('apontamento medido não é faturado por outro mecanismo (gerar de horas antigo)',
  t_c4.err('update public.project_time_entries set financial_entry_id = ''c4700000-0000-4000-8000-000000000001'' where id = ''c4500000-0000-4000-8000-000000000003''') ~ 'MEASURED_ENTRY');
-- Negação vence permissão; inativo, outro workspace e Ver como não aprovam.
INSERT INTO public.job_role_permission_overrides (workspace_id, role_id, permission_key, effect, created_by)
VALUES (:A, '30000000-0000-4000-8000-0000000000a3', 'techprojects.measurements.approve.workspace', 'deny', :U1);
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c4.as_user(:U4) \g /dev/null
SELECT t_c4.ok('negação explícita bloqueia a aprovação', t_c4.err(format('select public.project_measurement_approve(%L,%L)', t_c4.get('MH'), t_c4.hash('MH'))) ~ 'Sem permissão');
COMMIT;
DELETE FROM public.job_role_permission_overrides WHERE workspace_id = :A AND role_id = '30000000-0000-4000-8000-0000000000a3' AND effect = 'deny';
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c4.as_user(:U5) \g /dev/null
SELECT t_c4.ok('membro inativo não aprova', t_c4.err(format('select public.project_measurement_approve(%L,%L)', t_c4.get('MH'), t_c4.hash('MH'))) ~ 'membros ativos');
COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c4.as_user(:U6) \g /dev/null
SELECT t_c4.ok('outro workspace não aprova', t_c4.err(format('select public.project_measurement_approve(%L,%L)', t_c4.get('MH'), t_c4.hash('MH'))) ~ 'membros ativos');
COMMIT;
INSERT INTO public.view_as_sessions (workspace_id, admin_id, target_user_id, mode, nonce, session_id)
VALUES (:A, :U1, :U4, 'role', 'n-iso-c4', 'b0000000-0000-4000-8000-0000000000c4');
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c4.as_user(:U4, 'b0000000-0000-4000-8000-0000000000c4') \g /dev/null
SELECT t_c4.ok('Ver como é somente leitura', t_c4.err(format('select public.project_measurement_approve(%L,%L)', t_c4.get('MH'), t_c4.hash('MH'))) ~ 'somente leitura');
COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c4.as_user(:U4) \g /dev/null
SELECT t_c4.ok('aprovador nomeado aprova → pronta para o Financeiro',
  public.project_measurement_approve(t_c4.mid('MH'), t_c4.hash('MH')) = 'ready');
COMMIT;
-- Falha de geração preserva a aprovação, não deixa título órfão e permite nova tentativa.
CREATE FUNCTION t_c4.boom() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'falha simulada do Financeiro'; END $$;
CREATE TRIGGER t_c4_boom BEFORE INSERT ON public.financial_entries FOR EACH ROW WHEN (NEW.origin_type::text = 'project_measurement') EXECUTE FUNCTION t_c4.boom();
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c4.as_user(:U4) \g /dev/null
SELECT t_c4.ok('falha registrada como "failed" com motivo',
  (public.project_measurement_generate(t_c4.mid('MH'), t_c4.hash('MH'), '2026-09-10')->>'status') = 'failed');
COMMIT;
SELECT t_c4.ok('falha: nenhum título nem vínculo, aprovação mantida',
  t_c4.n_fe('project_measurement:' || t_c4.get('MH') || ':%') = 0
  AND (SELECT count(*) FROM public.project_measurement_financial_links WHERE measurement_id = t_c4.mid('MH')) = 0
  AND (SELECT status = 'failed' AND approved_by = :U4 AND attempts = 1 AND failure_reason ~ 'simulada' FROM t_c4.m(t_c4.mid('MH'))));
DROP TRIGGER t_c4_boom ON public.financial_entries;
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c4.as_user(:U4) \g /dev/null
SELECT t_c4.put('FE_MH', public.project_measurement_generate(t_c4.mid('MH'), t_c4.hash('MH'), '2026-09-10')->>'financial_entry_id') \g /dev/null
SELECT t_c4.ok('nova tentativa gera e repetir é idempotente',
  (public.project_measurement_generate(t_c4.mid('MH'), t_c4.hash('MH'), '2026-09-10')->>'financial_entry_id') = t_c4.get('FE_MH'));
COMMIT;
SELECT t_c4.ok('um único título a receber em aberto, origem medição, valor 545,63, sem nota/boleto',
  t_c4.n_fe('project_measurement:' || t_c4.get('MH') || ':%') = 1
  AND (SELECT direction::text = 'receivable' AND origin_type::text = 'project_measurement' AND amount = 545.63 AND status::text = 'open'
          AND competence_date = '2026-08-01' AND notes ~ 'Não é nota fiscal' FROM public.financial_entries WHERE id = t_c4.get('FE_MH')::uuid)
  AND NOT EXISTS (SELECT 1 FROM public.bank_charges WHERE financial_entry_id = t_c4.get('FE_MH')::uuid));
SELECT t_c4.ok('apontamentos não recebem invoice/financial_entry inventados',
  (SELECT h FROM t_c4.entries_before) = (SELECT md5(string_agg(concat_ws('|', id, financial_entry_id, invoiced_at, invoice_id), ',' ORDER BY id))
     FROM public.project_time_entries));
-- Complemento: hora aprovada depois entra em complemento, sem repetir as já medidas.
SELECT set_config('app.project_time_workflow', 'on', false) \g /dev/null
UPDATE public.project_time_entries SET status = 'approved', approved_at = now() WHERE id = 'c4500000-0000-4000-8000-000000000004';
SELECT set_config('app.project_time_workflow', 'off', false) \g /dev/null
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c4.as_user(:U3) \g /dev/null
SELECT t_c4.put('MHC', public.project_measurement_build('c4800000-0000-4000-8000-000000000002', '2026-08-01', 'complement', :TZ)::text) \g /dev/null
SELECT t_c4.ok('complemento só com a hora nova (3600 s × 150 = 150,00); demais "já medidas"',
  (SELECT total_amount = 150 AND total_seconds = 3600 FROM t_c4.m(t_c4.mid('MHC')))
  AND (SELECT count(*) FROM public.project_measurement_lines WHERE measurement_id = t_c4.mid('MHC') AND issue = 'excluded:already_measured') = 3);
SELECT public.project_measurement_cancel(t_c4.mid('MHC'), '[ISO] complemento de teste') \g /dev/null
COMMIT;
-- Estorno: pagamento bloqueia; sem pagamento cancela o título (sem apagar) e libera as fontes.
INSERT INTO public.financial_payments (workspace_id, entry_id, paid_at, amount) VALUES (:A, t_c4.get('FE_MH')::uuid, '2026-09-11', 10);
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c4.as_user(:U4) \g /dev/null
SELECT t_c4.ok('título com pagamento não é estornado', t_c4.err(format('select public.project_measurement_reverse(%L,%L)', t_c4.get('MH'), 'estorno de teste isolado')) ~ 'REVERSE_BLOCKED');
COMMIT;
DELETE FROM public.financial_payments WHERE entry_id = t_c4.get('FE_MH')::uuid;
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c4.as_user(:U4) \g /dev/null
SELECT public.project_measurement_reverse(t_c4.mid('MH'), '[ISO] estorno sem pagamento') \g /dev/null
COMMIT;
SELECT t_c4.ok('estorno: título cancelado e preservado, linhas liberadas, trilha registrada',
  (SELECT status::text = 'cancelled' AND notes ~ 'Estornado' FROM public.financial_entries WHERE id = t_c4.get('FE_MH')::uuid)
  AND (SELECT status = 'reversed' FROM t_c4.m(t_c4.mid('MH')))
  AND NOT EXISTS (SELECT 1 FROM public.project_measurement_lines WHERE measurement_id = t_c4.mid('MH') AND active)
  AND EXISTS (SELECT 1 FROM public.project_billing_events WHERE entity_id = t_c4.mid('MH') AND action = 'reversed'));
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c4.as_user(:U3) \g /dev/null
SELECT t_c4.put('MH2', public.project_measurement_build('c4800000-0000-4000-8000-000000000002', '2026-08-01', 'regular', :TZ)::text) \g /dev/null
SELECT t_c4.ok('nova medição regular após estorno inclui as horas de novo (4 horas = 695,63)',
  (SELECT total_amount = 695.63 FROM t_c4.m(t_c4.mid('MH2'))) AND t_c4.mid('MH2') <> t_c4.mid('MH'));
SELECT public.project_measurement_submit(t_c4.mid('MH2'), t_c4.hash('MH2')) \g /dev/null
COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c4.as_user(:U4) \g /dev/null
SELECT public.project_measurement_approve(t_c4.mid('MH2'), t_c4.hash('MH2')) \g /dev/null
COMMIT;

-- ------------------------------------------------------------------ 4. competência fechada (C3) e reabertura
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c4.as_user(:U3) \g /dev/null
SELECT t_c4.put('MF', public.project_measurement_build('c4800000-0000-4000-8000-000000000007', '2026-09-01', 'regular', :TZ)::text) \g /dev/null
SELECT t_c4.ok('exige competência fechada: só as 2 horas fechadas (200,00, por linha); a aprovada sem fechamento fica fora',
  (SELECT total_amount = 200 FROM t_c4.m(t_c4.mid('MF')))
  AND (SELECT t_c4.codes(warnings) @> ARRAY['not_closed'] FROM t_c4.m(t_c4.mid('MF'))));
SELECT public.project_measurement_submit(t_c4.mid('MF'), t_c4.hash('MF')) \g /dev/null
COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c4.as_user(:U1) \g /dev/null
SELECT t_c4.ok('reabrir competência com horas medidas é bloqueado',
  t_c4.err(format('select public.project_period_reopen(%L,%L)', 'c4600000-0000-4000-8000-000000000001', 'reabertura de teste isolado')) ~ 'MEASURED_');
COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c4.as_user(:U3) \g /dev/null
SELECT public.project_measurement_return(t_c4.mid('MF'), '[ISO] devolvida para reabrir') \g /dev/null
COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c4.as_user(:U1) \g /dev/null
SELECT t_c4.ok('devolvida ao rascunho, a reabertura C3 passa',
  (public.project_period_reopen('c4600000-0000-4000-8000-000000000001', '[ISO] reabertura de teste')->>'reopened_entries')::int = 2);
COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c4.as_user(:U3) \g /dev/null
SELECT t_c4.ok('após a reabertura a prévia fica velha (horas não estão mais fechadas)',
  t_c4.err(format('select public.project_measurement_submit(%L,%L)', t_c4.get('MF'), t_c4.hash('MF'))) ~ 'PREVIEW_STALE');
COMMIT;

-- ------------------------------------------------------------------ 5. mensalidade: N projetos, 1 cobrança, pró-rata explícita, legado
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c4.as_user(:U1) \g /dev/null
SELECT t_c4.put('MM', public.project_measurement_build('c4800000-0000-4000-8000-000000000001', '2026-09-01', 'regular', :TZ)::text) \g /dev/null
SELECT t_c4.ok('dois projetos no serviço, uma mensalidade: 3000 × 15/30 dias = 1500,00',
  (SELECT count(*) FROM public.project_measurement_lines WHERE measurement_id = t_c4.mid('MM') AND included) = 1
  AND (SELECT total_amount = 1500 FROM t_c4.m(t_c4.mid('MM'))));
SELECT t_c4.ok('título legado da competência aparece como pendência (não é ignorado)',
  (SELECT t_c4.codes(gates) @> ARRAY['legacy_entry_exists'] FROM t_c4.m(t_c4.mid('MM'))));
SELECT t_c4.ok('mês sem vigência do serviço não gera mensalidade',
  (SELECT t_c4.codes(blockers) @> ARRAY['no_included_lines'] FROM t_c4.m(public.project_measurement_build('c4800000-0000-4000-8000-000000000001', '2026-08-01', 'regular', :TZ))));
SELECT public.project_measurement_submit(t_c4.mid('MM'), t_c4.hash('MM')) \g /dev/null
SELECT t_c4.ok('quem preparou e enviou não aprova (autoaprovação)',
  t_c4.err(format('select public.project_measurement_approve(%L,%L)', t_c4.get('MM'), t_c4.hash('MM'))) ~ 'SELF_APPROVAL');
COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c4.as_user(:U4) \g /dev/null
SELECT t_c4.ok('aprovada mas não pronta: há título legado', public.project_measurement_approve(t_c4.mid('MM'), t_c4.hash('MM')) = 'approved');
SELECT t_c4.ok('gerar com legado pendente é bloqueado', t_c4.err(format('select public.project_measurement_generate(%L,%L,%L)', t_c4.get('MM'), t_c4.hash('MM'), '2026-09-10')) ~ 'GENERATE_BLOCKED');
SELECT t_c4.ok('vincular legado com valor diferente é recusado',
  t_c4.err(format('select public.project_measurement_link_legacy(%L,%L,%L,%L)', t_c4.get('MM'), 'c4700000-0000-4000-8000-000000000001', t_c4.hash('MM'), 'vínculo de teste isolado')) ~ 'LEGACY_AMOUNT_MISMATCH');
SELECT public.project_measurement_return(t_c4.mid('MM'), '[ISO] ajustar ao legado') \g /dev/null
COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c4.as_user(:U3) \g /dev/null
SELECT public.project_measurement_add_adjustment(t_c4.mid('MM'), 'Desconto comercial', -100, '[ISO] desconto acordado em contrato') \g /dev/null
SELECT t_c4.ok('ajuste explícito versionado: 1500 − 100 = 1400, revisão nova',
  (SELECT total_amount = 1400 AND revision = 2 FROM t_c4.m(t_c4.mid('MM'))));
SELECT public.project_measurement_submit(t_c4.mid('MM'), t_c4.hash('MM')) \g /dev/null
COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c4.as_user(:U4) \g /dev/null
SELECT public.project_measurement_approve(t_c4.mid('MM'), t_c4.hash('MM')) \g /dev/null
SELECT public.project_measurement_link_legacy(t_c4.mid('MM'), 'c4700000-0000-4000-8000-000000000001', t_c4.hash('MM'), '[ISO] título já gerado pelo tick') \g /dev/null
COMMIT;
SELECT t_c4.ok('legado vinculado: medição gerada sem segundo título do serviço',
  (SELECT status = 'generated' AND financial_entry_id = 'c4700000-0000-4000-8000-000000000001' FROM t_c4.m(t_c4.mid('MM')))
  AND (SELECT count(*) FROM public.financial_entries WHERE service_id = 'c4100000-0000-4000-8000-000000000001') = 1);
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c4.as_user(:U1) \g /dev/null
SELECT t_c4.ok('segunda medição regular da mesma competência é recusada (use complemento/estorno)',
  t_c4.err(format('select public.project_measurement_build(%L,%L,%L,%L)', 'c4800000-0000-4000-8000-000000000001', '2026-09-01', 'regular', :TZ)) ~ 'Já existe');
COMMIT;

-- ------------------------------------------------------------------ 6. pacote: franquia, saldo carregado, excedente
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c4.as_user(:U3) \g /dev/null
SELECT t_c4.put('PS', public.project_measurement_build('c4800000-0000-4000-8000-000000000003', '2026-09-01', 'regular', :TZ)::text) \g /dev/null
SELECT t_c4.ok('setembro sem agosto aprovado: saldo anterior desconhecido bloqueia',
  (SELECT t_c4.codes(blockers) @> ARRAY['previous_period_unmeasured'] FROM t_c4.m(t_c4.mid('PS'))));
SELECT t_c4.put('PA', public.project_measurement_build('c4800000-0000-4000-8000-000000000003', '2026-08-01', 'regular', :TZ)::text) \g /dev/null
SELECT t_c4.ok('agosto: 4800 s dentro da franquia de 7200 s → só o valor do pacote (2000,00)',
  (SELECT total_amount = 2000 AND total_seconds = 4800 FROM t_c4.m(t_c4.mid('PA'))));
SELECT public.project_measurement_submit(t_c4.mid('PA'), t_c4.hash('PA')) \g /dev/null
COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c4.as_user(:U4) \g /dev/null
SELECT public.project_measurement_approve(t_c4.mid('PA'), t_c4.hash('PA')) \g /dev/null
COMMIT;
SELECT t_c4.ok('saldo de agosto: consumiu 4800, sobra 2400 s para setembro',
  (SELECT consumed_seconds = 4800 AND overage_seconds = 0 AND (carry_out->0->>'seconds')::int = 2400 FROM public.project_package_balances WHERE measurement_id = t_c4.mid('PA') AND active));
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c4.as_user(:U3) \g /dev/null
SELECT public.project_measurement_refresh(t_c4.mid('PS')) \g /dev/null
SELECT t_c4.ok('setembro: 10000 s contra 7200 + 2400 → excedente 400 s × 90 = 10,00; total 2010,00',
  (SELECT total_amount = 2010 AND jsonb_array_length(blockers) = 0 FROM t_c4.m(t_c4.mid('PS'))));
SELECT public.project_measurement_submit(t_c4.mid('PS'), t_c4.hash('PS')) \g /dev/null
COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c4.as_user(:U4) \g /dev/null
SELECT public.project_measurement_approve(t_c4.mid('PS'), t_c4.hash('PS')) \g /dev/null
COMMIT;
SELECT t_c4.ok('saldo de setembro: herdou 2400, consumiu 9600, excedente 400, nada negativo',
  (SELECT carry_in_seconds = 2400 AND consumed_seconds = 9600 AND overage_seconds = 400
     AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(carry_out) x WHERE (x->>'seconds')::int < 0)
     FROM public.project_package_balances WHERE measurement_id = t_c4.mid('PS') AND active));
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c4.as_user(:U3) \g /dev/null
SELECT t_c4.ok('não desfaz agosto com setembro apoiado no saldo dele',
  t_c4.err(format('select public.project_measurement_cancel(%L,%L)', t_c4.get('PA'), 'cancelamento de teste isolado')) ~ 'CHAIN_BLOCKED');
COMMIT;

-- ------------------------------------------------------------------ 7. marcos
INSERT INTO public.financial_entries (id, workspace_id, owner_id, direction, origin_type, origin_id, contract_id, description, amount, currency, competence_date, due_date, status)
VALUES ('c4700000-0000-4000-8000-000000000002', :A, :U1, 'receivable', 'project_milestone', 'c4900000-0000-4000-8000-000000000002',
        'c4000000-0000-4000-8000-0000000000c1', '[ISO] marco já cobrado', 3000, 'BRL', '2026-09-05', '2026-09-05', 'open');
INSERT INTO public.project_milestones (id, workspace_id, project_id, name, status, billable, bill_amount, completed_at, financial_entry_id) VALUES
 ('c4900000-0000-4000-8000-000000000001', :A, 'c4200000-0000-4000-8000-000000000005', '[ISO] Entrega 1', 'done', true, 5000, '2026-09-10 15:00+00', NULL),
 ('c4900000-0000-4000-8000-000000000002', :A, 'c4200000-0000-4000-8000-000000000005', '[ISO] Entrega 2', 'done', true, 3000, '2026-09-05 15:00+00', 'c4700000-0000-4000-8000-000000000002'),
 ('c4900000-0000-4000-8000-000000000003', :A, 'c4200000-0000-4000-8000-000000000005', '[ISO] Entrega 3', 'done', true, NULL, '2026-09-12 15:00+00', NULL);
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c4.as_user(:U3) \g /dev/null
SELECT t_c4.put('MS', public.project_measurement_build('c4800000-0000-4000-8000-000000000005', '2026-09-01', 'regular', :TZ)::text) \g /dev/null
SELECT t_c4.ok('marco já cobrado fica fora; marco sem valor bloqueia',
  (SELECT t_c4.codes(warnings) @> ARRAY['already_billed'] AND t_c4.codes(blockers) @> ARRAY['amount_missing'] FROM t_c4.m(t_c4.mid('MS'))));
COMMIT;
SELECT t_c4.ok('concluir marco de novo não gera título paralelo (marco reservado pela medição)',
  t_c4.err(format('insert into public.financial_entries (workspace_id, owner_id, direction, origin_type, origin_id, description, amount, currency, competence_date, due_date, status) values (%L,%L,%L,%L,%L,%L,5000,%L,%L,%L,%L)',
    :A, :U1, 'receivable', 'project_milestone', 'c4900000-0000-4000-8000-000000000001', 'marco', 'BRL', '2026-09-10', '2026-09-10', 'open')) ~ 'BILLING_OWNER');
UPDATE public.project_milestones SET billable = false WHERE id = 'c4900000-0000-4000-8000-000000000003';
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c4.as_user(:U3) \g /dev/null
SELECT public.project_measurement_refresh(t_c4.mid('MS')) \g /dev/null
SELECT t_c4.ok('marcos: 5000,00 sem pendências', (SELECT total_amount = 5000 AND jsonb_array_length(blockers) = 0 FROM t_c4.m(t_c4.mid('MS'))));
COMMIT;

-- ------------------------------------------------------------------ 8. percentual (Hunting) só com evento explícito
INSERT INTO public.ats_candidates (id, owner_id, full_name, workspace_id) VALUES ('c4a00000-0000-4000-8000-000000000001', :U1, '[ISO] Candidata', :A);
INSERT INTO public.ats_offers (id, owner_id, candidate_id, workspace_id) VALUES ('c4a10000-0000-4000-8000-000000000001', :U1, 'c4a00000-0000-4000-8000-000000000001', :A);
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c4.as_user(:U3) \g /dev/null
SELECT t_c4.put('MP', public.project_measurement_build('c4800000-0000-4000-8000-000000000004', '2026-09-01', 'regular', :TZ)::text) \g /dev/null
SELECT t_c4.ok('percentual não infere receita de horas (sem evento = sem linha)',
  (SELECT t_c4.codes(blockers) @> ARRAY['no_included_lines'] FROM t_c4.m(t_c4.mid('MP'))));
SELECT public.project_measurement_add_success_event(t_c4.mid('MP'), 'ats_offer', 'c4a10000-0000-4000-8000-000000000001', NULL, '[ISO] proposta aceita pela candidata') \g /dev/null
SELECT t_c4.ok('evento de sucesso: 20% de 10000 = 2000,00', (SELECT total_amount = 2000 FROM t_c4.m(t_c4.mid('MP'))));
SELECT t_c4.ok('mesmo evento não entra duas vezes',
  t_c4.err(format('select public.project_measurement_add_success_event(%L,%L,%L,null,%L)', t_c4.get('MP'), 'ats_offer', 'c4a10000-0000-4000-8000-000000000001', 'evento repetido teste')) ~ 'duplicate|uniq');
COMMIT;

-- ------------------------------------------------------------------ 9. tarifa ausente × zero explícito
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c4.as_user(:U3) \g /dev/null
SELECT t_c4.put('MZ', public.project_measurement_build('c4800000-0000-4000-8000-000000000008', '2026-09-01', 'regular', :TZ)::text) \g /dev/null
SELECT t_c4.ok('tarifa ausente: valor desconhecido (nulo) e pendência bloqueante',
  (SELECT total_amount IS NULL AND t_c4.codes(blockers) @> ARRAY['rate_missing'] FROM t_c4.m(t_c4.mid('MZ'))));
COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c4.as_user(:U1) \g /dev/null
SELECT public.project_rate_create(:A, 'price', 'service', '{"service_id":"c4100000-0000-4000-8000-000000000008"}', 'hour', NULL, 'BRL', 0, '2026-08-01', NULL, '[ISO] cortesia autorizada', true) \g /dev/null
COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c4.as_user(:U3) \g /dev/null
SELECT public.project_measurement_refresh(t_c4.mid('MZ')) \g /dev/null
SELECT t_c4.ok('zero explícito: valor 0,00 sem pendência de tarifa, mas sem título de valor zero',
  (SELECT total_amount = 0 AND jsonb_array_length(blockers) = 0 AND t_c4.codes(gates) @> ARRAY['zero_total'] FROM t_c4.m(t_c4.mid('MZ'))));
COMMIT;

-- ------------------------------------------------------------------ 10. rentabilidade e vazamento de custo
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c4.as_user(:U7) \g /dev/null
SELECT t_c4.put('PR7', public.project_profitability(:A, 'c4200000-0000-4000-8000-000000000001', NULL, '2026-08-01', '2026-08-31', 'BRL')::text) \g /dev/null
COMMIT;
SELECT t_c4.ok('sem permissão de tarifas: sem custo por pessoa',
  (t_c4.get('PR7')::jsonb->'people') = 'null'::jsonb AND (t_c4.get('PR7')::jsonb->>'can_view_rates') = 'false');
SELECT t_c4.ok('custo ambíguo do u7 → cobertura parcial → margem total desconhecida (não presumida)',
  (t_c4.get('PR7')::jsonb->'margin'->>'status') = 'unknown' AND (t_c4.get('PR7')::jsonb->'margin'->'estimated') = 'null'::jsonb
  AND (t_c4.get('PR7')::jsonb->'coverage'->>'cost_pct')::numeric < 100);
SELECT t_c4.ok('receitas separadas: aprovada 695,63, estornada 545,63 (não somadas), lançada 0',
  (t_c4.get('PR7')::jsonb->'revenue'->>'approved')::numeric = 695.63
  AND (t_c4.get('PR7')::jsonb->'revenue'->>'reversed')::numeric = 545.63
  AND (t_c4.get('PR7')::jsonb->'finance'->>'launched')::numeric = 0);
SELECT t_c4.ok('outra moeda listada, não somada', (t_c4.get('PR7')::jsonb->'other_currencies') ? 'USD');
SELECT t_c4.ok('custo estimado = horas do u2 × 40 (importado incluso como esforço) = 7 horas cobertas',
  (t_c4.get('PR7')::jsonb->'cost'->>'hourly')::numeric = round((3600 + 5415 + 3600 + 3600 + 5415)::numeric * 40 / 3600, 2));
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c4.as_user(:U1) \g /dev/null
SELECT t_c4.ok('com permissão de tarifas: custo por pessoa disponível',
  jsonb_array_length(public.project_profitability(:A, 'c4200000-0000-4000-8000-000000000001', NULL, '2026-08-01', '2026-08-31', 'BRL')->'people') = 2);
SELECT t_c4.ok('receita zero → margem % não aplicável (sem divisão por zero)',
  (public.project_profitability(:A, 'c4200000-0000-4000-8000-000000000008', NULL, '2026-09-01', '2026-09-30', 'BRL')->'margin'->'estimated_pct') = 'null'::jsonb);
SELECT t_c4.ok('período fora de meses completos é recusado',
  t_c4.err(format('select public.project_profitability(%L,%L,null,%L,%L,%L)', :A, 'c4200000-0000-4000-8000-000000000001', '2026-08-05', '2026-08-31', 'BRL')) ~ 'meses completos');
COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c4.as_user(:U2) \g /dev/null
SELECT t_c4.ok('profissional não vê rentabilidade', t_c4.err(format('select public.project_profitability(%L,%L,null,%L,%L,%L)', :A, 'c4200000-0000-4000-8000-000000000001', '2026-08-01', '2026-08-31', 'BRL')) ~ 'Sem permissão');
COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c4.as_user(:U6) \g /dev/null
SELECT t_c4.ok('outro workspace não vê rentabilidade de A', t_c4.err(format('select public.project_profitability(%L,%L,null,%L,%L,%L)', :A, 'c4200000-0000-4000-8000-000000000001', '2026-08-01', '2026-08-31', 'BRL')) ~ 'membros ativos');
SELECT t_c4.ok('outro workspace não lê medições de A', (SELECT count(*) FROM public.project_measurements) = 0);
COMMIT;
SELECT t_c4.ok('gravação direta em medições é bloqueada (sem GRANT e com guarda)',
  t_c4.err(format('update public.project_measurements set total_amount = 1 where id = %L', t_c4.get('MM'))) ~ 'bloqueada');
SELECT t_c4.put('MREADY', t_c4.get('MH2')) \g /dev/null
SELECT 'concurrency-point' AS marker;
