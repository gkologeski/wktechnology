-- Prova isolada do ciclo 1 do TechProjects (conciliação, vínculos, fila e painel).
-- Roda SOMENTE no banco descartável do harness (estrutura real extraída, sem dados):
--   bash scripts/isolated-db/start.sh && psql -f scripts/isolated-db/seed.sql
--   psql -f drizzle/migrations/0169_*.sql && psql -v ON_ERROR_STOP=1 -f tests/sql/project-reconciliation-isolated.sql
-- Asserções rodam como `authenticated` com claims de JWT (nunca service_role).
\set ON_ERROR_STOP 1
\set QUIET 1
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.__isolated_marker WHERE id = 1 AND label = 'techerp-isolated-harness') THEN
    RAISE EXCEPTION 'recusado: banco sem marcador do harness';
  END IF;
END $$;

DROP SCHEMA IF EXISTS t_recon CASCADE;
CREATE SCHEMA t_recon;
GRANT USAGE ON SCHEMA t_recon TO authenticated, anon;
CREATE FUNCTION t_recon.ok(p_name text, p_cond boolean) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  IF p_cond IS DISTINCT FROM true THEN RAISE EXCEPTION 'FALHOU: %', p_name; END IF;
  RAISE NOTICE 'ok: %', p_name; RETURN 'ok';
END $$;
GRANT EXECUTE ON FUNCTION t_recon.ok(text, boolean) TO authenticated, anon;

\set A '''aaaaaaaa-0000-4000-8000-00000000000a'''
\set B '''aaaaaaaa-0000-4000-8000-00000000000b'''
\set U1 '''10000000-0000-4000-8000-000000000001'''
\set U2 '''10000000-0000-4000-8000-000000000002'''
\set U3 '''10000000-0000-4000-8000-000000000003'''
\set U4 '''10000000-0000-4000-8000-000000000004'''
\set U5 '''10000000-0000-4000-8000-000000000005'''
\set U6 '''10000000-0000-4000-8000-000000000006'''
\set U7 '''10000000-0000-4000-8000-000000000007'''

-- ------------------------------------------------------------------ permissões de projeto
INSERT INTO public.permission_sets (id, module, name) VALUES
 ('20000000-0000-4000-8000-0000000000c1','techprojects','[ISO] Projetos workspace') ON CONFLICT DO NOTHING;
INSERT INTO public.permission_set_items (set_id, permission_key)
SELECT '20000000-0000-4000-8000-0000000000c1', p.key FROM public.permissions p
 WHERE p.key IN ('techprojects.projects.view.workspace','techprojects.tasks.view.workspace',
                 'techprojects.time_entries.view.workspace') ON CONFLICT DO NOTHING;
INSERT INTO public.job_roles (id, name, workspace_id, owner_id) VALUES
 ('30000000-0000-4000-8000-0000000000c1','[ISO] Projetos leitura',:A,:A),
 ('30000000-0000-4000-8000-0000000000c2','[ISO] Projetos negado',:A,:A) ON CONFLICT DO NOTHING;
INSERT INTO public.job_role_sets (role_id, set_id) VALUES
 ('30000000-0000-4000-8000-0000000000c1','20000000-0000-4000-8000-0000000000c1'),
 ('30000000-0000-4000-8000-0000000000c2','20000000-0000-4000-8000-0000000000c1') ON CONFLICT DO NOTHING;
INSERT INTO public.job_role_permission_overrides (workspace_id, role_id, permission_key, effect, created_by)
VALUES (:A, '30000000-0000-4000-8000-0000000000c2', 'techprojects.time_entries.view.workspace', 'deny', :U1)
ON CONFLICT DO NOTHING;
INSERT INTO public.user_job_roles (user_id, owner_id, workspace_id, role_id) VALUES
 (:U4, :A, :A, '30000000-0000-4000-8000-0000000000c1'),
 (:U5, :A, :A, '30000000-0000-4000-8000-0000000000c1'),
 (:U3, :A, :A, '30000000-0000-4000-8000-0000000000c2');
SELECT t_recon.ok('u4 tem leitura de apontamentos do workspace',
  public.user_has_permission(:U4, :A, 'techprojects.time_entries.view.workspace'));
SELECT t_recon.ok('negação prevalece para u3',
  NOT public.user_has_permission(:U3, :A, 'techprojects.time_entries.view.workspace'));
SELECT t_recon.ok('inativo u5 não herda permissão',
  NOT public.user_has_permission(:U5, :A, 'techprojects.time_entries.view.workspace'));

-- ------------------------------------------------------------------ fixtures
UPDATE public.profiles SET full_name = '[ISO] Proprio A' WHERE id = :U2;
INSERT INTO public.companies (id, owner_id, name, workspace_id) VALUES
 ('60000000-0000-4000-8000-0000000000c1', :U1, '[ISO] Cliente A', :A),
 ('60000000-0000-4000-8000-0000000000c3', :U1, '[ISO] Cliente A3', :A),
 ('60000000-0000-4000-8000-0000000000c2', :U6, '[ISO] Cliente B', :B);
INSERT INTO public.people (id, owner_id, full_name, email, workspace_id) VALUES
 ('70000000-0000-4000-8000-000000000001', :U1, '[ISO] Pessoa WS', ' WS-A@techerp-test.invalid ', :A),
 ('70000000-0000-4000-8000-000000000002', :U1, '[ISO] Par 1', 'peer-a@techerp-test.invalid', :A),
 ('70000000-0000-4000-8000-000000000003', :U1, '[ISO] Par 2', 'peer-a@techerp-test.invalid', :A),
 ('70000000-0000-4000-8000-000000000004', :U1, '[ISO]  proprio a', NULL, :A),
 ('70000000-0000-4000-8000-0000000000b1', :U6, '[ISO] Pessoa B', 'ws-a@techerp-test.invalid', :B);
INSERT INTO public.projects (id, workspace_id, owner_id, name, status, due_at, metadata) VALUES
 ('80000000-0000-4000-8000-000000000001', :A, :U1, '[ISO] Projeto X', 'active', '2030-01-01',
   jsonb_build_object('clockify', jsonb_build_object('company_id','60000000-0000-4000-8000-0000000000c1','client_id','c1c1c1c1c1c1c1c1c1c1c1c1'))),
 ('80000000-0000-4000-8000-000000000002', :A, :U1, '[ISO] Projeto Y', 'active', NULL,
   jsonb_build_object('jibble', jsonb_build_object('company_id','60000000-0000-4000-8000-0000000000c2','client_id','jb-client-y'))),
 ('80000000-0000-4000-8000-000000000003', :A, :U1, '[ISO] Projeto Z', 'active', NULL,
   jsonb_build_object('clockify', jsonb_build_object('company_id','60000000-0000-4000-8000-0000000000c1','client_id','c3c3c3c3c3c3c3c3c3c3c3c3'))),
 ('80000000-0000-4000-8000-000000000004', :A, :U1, '[ISO] Projeto W', 'on_hold', NULL, '{}'),
 ('80000000-0000-4000-8000-000000000005', :A, :U1, '[ISO] Projeto V', 'planning', '2020-01-01', '{}'),
 ('80000000-0000-4000-8000-000000000006', :A, :U1, '[ISO] Projeto D', 'done', NULL, '{}'),
 ('80000000-0000-4000-8000-0000000000b1', :B, :U6, '[ISO] Projeto B', 'active', NULL, '{}');
INSERT INTO public.clockify_mappings (workspace_id, source_workspace_id, entity_type, external_id, target_id, decision)
VALUES (:A, 'abcabcabcabcabcabcabcabc', 'client', 'c3c3c3c3c3c3c3c3c3c3c3c3', '60000000-0000-4000-8000-0000000000c3', 'confirmed');

-- 6000 tarefas (4000 concluídas, 500 atrasadas abertas)
INSERT INTO public.project_tasks (workspace_id, project_id, title, status, due_at)
SELECT :A, '80000000-0000-4000-8000-000000000001', '[ISO] T' || g,
       (CASE WHEN g <= 4000 THEN 'done' ELSE 'todo' END)::public.project_task_status,
       CASE WHEN g > 5500 THEN date '2020-02-01' END
  FROM generate_series(1, 6000) g;

-- 6000 apontamentos importados (u4, 1201 s cada, sem sobreposição, bloqueados), 2026-01..2026-06 (America/Sao_Paulo)
INSERT INTO public.project_time_entries (id, workspace_id, project_id, user_id, entry_date, duration_minutes,
  started_at, stopped_at, source, external_id, status, billable)
SELECT ('90000000-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid, :A, '80000000-0000-4000-8000-000000000001', :U4,
       ((timestamptz '2026-01-01 03:00:00+00' + make_interval(secs => (g - 1) * 2400)) AT TIME ZONE 'America/Sao_Paulo')::date, 20,
       timestamptz '2026-01-01 03:00:00+00' + make_interval(secs => (g - 1) * 2400),
       timestamptz '2026-01-01 03:00:00+00' + make_interval(secs => (g - 1) * 2400 + 1201),
       'import', lpad(to_hex(g), 24, '0'), 'locked', false
  FROM generate_series(1, 6000) g;
INSERT INTO public.clockify_import_links (workspace_id, source_workspace_id, entity_type, external_id, segment,
  target_table, target_id, source_hash, source_seconds)
SELECT :A, 'abcabcabcabcabcabcabcabc', 'time_entry', lpad(to_hex(g), 24, '0'), 0, 'project_time_entries',
       ('90000000-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid, 'h', 1201
  FROM generate_series(1, 6000) g;

-- Manuais do u2 (rascunho), um par sobreposto e um zerado; data pré-2020 vinda da origem
INSERT INTO public.project_time_entries (id, workspace_id, project_id, user_id, entry_date, duration_minutes, started_at, stopped_at, source, status)
VALUES
 ('91000000-0000-4000-8000-000000000001', :A, '80000000-0000-4000-8000-000000000003', :U2, '2026-03-02', 60, '2026-03-02 12:00:00+00', '2026-03-02 13:00:00+00', 'manual', 'draft'),
 ('91000000-0000-4000-8000-000000000002', :A, '80000000-0000-4000-8000-000000000003', :U2, '2026-03-02', 60, '2026-03-02 12:30:00+00', '2026-03-02 13:30:00+00', 'manual', 'draft'),
 ('91000000-0000-4000-8000-000000000003', :A, '80000000-0000-4000-8000-000000000003', :U2, '2026-03-03', 0,  '2026-03-03 12:00:00+00', '2026-03-03 12:00:00+00', 'import', 'locked');
INSERT INTO public.project_time_entries (id, workspace_id, project_id, user_id, entry_date, duration_minutes, started_at, stopped_at, source, external_id, status)
VALUES ('91000000-0000-4000-8000-000000000004', :A, '80000000-0000-4000-8000-000000000003', :U7, '1899-12-31', 30,
        '1899-12-31 03:00:00+00', '1899-12-31 03:30:00+00', 'import', 'dddddddddddddddddddddddd', 'locked');
INSERT INTO public.clockify_import_links (workspace_id, source_workspace_id, entity_type, external_id, segment, target_table, target_id, source_hash, source_seconds)
VALUES (:A, 'abcabcabcabcabcabcabcabc', 'time_entry', 'dddddddddddddddddddddddd', 0, 'project_time_entries', '91000000-0000-4000-8000-000000000004', 'h', 1800);
INSERT INTO public.clockify_staging_records (workspace_id, source_workspace_id, entity_type, external_id, payload, payload_hash, status)
VALUES (:A, 'abcabcabcabcabcabcabcabc', 'time_entry', 'dddddddddddddddddddddddd',
        '{"timeInterval":{"start":"1899-12-31T03:00:00Z","end":"1899-12-31T03:30:00Z","timeZone":"America/Sao_Paulo"}}', 'h', 'imported');

-- Mesmo id externo em provedores diferentes + mesmos carimbos (possível duplicidade entre fontes)
INSERT INTO public.project_time_entries (id, workspace_id, project_id, user_id, entry_date, duration_minutes, started_at, stopped_at, source, external_id, status)
VALUES ('91000000-0000-4000-8000-000000000005', :A, '80000000-0000-4000-8000-000000000002', :U4, '2027-01-04', 60,
        '2027-01-04 12:00:00+00', '2027-01-04 13:00:00+00', 'import', 'ffffffffffffffffffffffff', 'locked'),
       ('91000000-0000-4000-8000-000000000006', :A, '80000000-0000-4000-8000-000000000002', :U4, '2027-01-04', 60,
        '2027-01-04 12:00:00+00', '2027-01-04 13:00:00+00', 'import', 'jibble:ffffffffffffffffffffffff', 'locked');
INSERT INTO public.clockify_import_links (workspace_id, source_workspace_id, entity_type, external_id, segment, target_table, target_id, source_hash, source_seconds)
VALUES (:A, 'abcabcabcabcabcabcabcabc', 'time_entry', 'ffffffffffffffffffffffff', 0, 'project_time_entries', '91000000-0000-4000-8000-000000000005', 'h', 3600);
INSERT INTO public.time_import_links (workspace_id, provider, source_org_id, entity_type, external_id, segment, target_table, target_id, source_hash, source_seconds)
VALUES (:A, 'jibble', 'org-a', 'interval', 'ffffffffffffffffffffffff', 0, 'project_time_entries', '91000000-0000-4000-8000-000000000006', 'h', 3600);

-- Staging Jibble: evento desconhecido, intervalo aberto e hour_entry (coberto e não coberto)
INSERT INTO public.time_import_mappings (workspace_id, provider, source_org_id, entity_type, external_id, target_id, decision)
VALUES (:A, 'jibble', 'org-a', 'person', 'jp-1', :U4, 'auto');
INSERT INTO public.time_import_staging (workspace_id, provider, source_org_id, entity_type, external_id, person_external_id, period, payload, payload_hash, status, reason_code)
VALUES
 (:A,'jibble','org-a','time_entry','ev-1','jp-1','2026-03-01','{"type":"Weird","time":"2026-03-01T12:00:00Z","localTime":"2026-03-01T09:00:00-03:00","offset":"-PT3H"}','h','pending_review','unknown_event'),
 (:A,'jibble','org-a','interval','iv-open','jp-1','2026-03-01','{"personId":"jp-1","seconds":0,"startUtc":1772366400,"segments":[]}','h','staged','open_interval'),
 (:A,'jibble','org-a','interval','iv-1','jp-1','2026-03-02','{"personId":"jp-1","seconds":3600,"segments":[{"localDate":"2026-03-02","seconds":3600}]}','h','imported',NULL),
 (:A,'jibble','org-a','interval','iv-2','jp-1','2026-03-03','{"personId":"jp-1","seconds":3600,"segments":[{"localDate":"2026-03-03","seconds":3600}]}','h','imported',NULL),
 (:A,'jibble','org-a','hour_entry','he-1','jp-1','2026-03-02','{"personId":"jp-1","date":"2026-03-02","duration":"PT2H","status":"Active"}','h','staged',NULL),
 (:A,'jibble','org-a','hour_entry','he-2','jp-1','2026-03-03','{"personId":"jp-1","date":"2026-03-03","duration":"PT1H","status":"Active"}','h','staged',NULL);

-- Alocação de u4 só em 2026 no projeto X
INSERT INTO public.people_allocations (id, workspace_id, owner_id, person_id, project_id, starts_at, ends_at)
VALUES ('a0000000-0000-4000-8000-000000000001', :A, :U1, '70000000-0000-4000-8000-000000000001', '80000000-0000-4000-8000-000000000001', '2026-01-01', '2026-03-31');

-- Segundo workspace: 100 apontamentos de u6
INSERT INTO public.project_time_entries (workspace_id, project_id, user_id, entry_date, duration_minutes, started_at, stopped_at, source, status)
SELECT :B, '80000000-0000-4000-8000-0000000000b1', :U6, date '2026-02-01', 60,
       timestamptz '2026-02-01 00:00:00+00' + make_interval(hours => g), timestamptz '2026-02-01 00:00:00+00' + make_interval(hours => g, secs => 3599),
       'manual', 'draft'
  FROM generate_series(1, 100) g;

-- ------------------------------------------------------------------ verdade (calculada como dono do banco)
SELECT count(*) AS truth_rows, sum(public.project_entry_seconds(started_at, stopped_at, duration_minutes, hours)) AS truth_secs
  FROM public.project_time_entries WHERE workspace_id = :A AND entry_date BETWEEN '2026-01-01' AND '2026-06-30' \gset
SELECT count(*) FILTER (WHERE status <> 'done') AS truth_open, count(*) FILTER (WHERE status <> 'done' AND due_at < current_date) AS truth_overdue
  FROM public.project_tasks WHERE workspace_id = :A \gset
SELECT t_recon.ok('fixture tem mais de 5000 apontamentos e tarefas', :truth_rows > 5000 AND :truth_open + 4000 > 5000);
SELECT t_recon.ok('segundos exatos (1201 s) e não minutos arredondados', :truth_secs = 6000 * 1201 + 3600 + 3600 + 0);

CREATE TABLE t_recon.hash_before AS
SELECT md5(string_agg(concat_ws('|', id, entry_date, hours, duration_minutes, started_at, stopped_at, status,
                                billable, source, external_id, updated_at, approved_at, locked_at), ',' ORDER BY id)) AS h,
       (SELECT count(*) FROM public.audit_logs) AS audits,
       (SELECT count(*) FROM public.workflow_events) AS wf
  FROM public.project_time_entries;
ALTER TABLE t_recon.hash_before ADD COLUMN raw text;
UPDATE t_recon.hash_before SET raw = (SELECT md5(string_agg(concat_ws('|', id, payload_hash, payload::text, status), ',' ORDER BY id)) FROM (
  SELECT id, payload_hash, payload, status FROM public.time_import_staging
  UNION ALL SELECT id, payload_hash, payload, status FROM public.clockify_staging_records) s);

-- ------------------------------------------------------------------ painel como não-admin autorizado (u4)
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated"}', true) \g /dev/null
SELECT public.project_dashboard_summary('2026-01-01', '2026-06-30', 'America/Sao_Paulo') AS d \gset
SELECT t_recon.ok('painel: linhas do período = verdade (> 5000, sem limite)', (:'d'::jsonb->'period'->>'rows')::bigint = :truth_rows);
SELECT t_recon.ok('painel: segundos do período = verdade', (:'d'::jsonb->'period'->>'seconds')::numeric = :truth_secs);
SELECT t_recon.ok('painel: tarefas abertas/atrasadas = verdade',
  (:'d'::jsonb->'tasks'->>'open')::bigint = :truth_open AND (:'d'::jsonb->'tasks'->>'overdue')::bigint = :truth_overdue);
SELECT t_recon.ok('painel: bloqueado importado separado e nunca aprovado',
  EXISTS (SELECT 1 FROM jsonb_array_elements(:'d'::jsonb->'period'->'by_status') x WHERE x->>'status' = 'locked_import')
  AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(:'d'::jsonb->'period'->'by_status') x WHERE x->>'status' = 'approved'));
SELECT t_recon.ok('painel: ativos agora (3) independem do período; atenção inclui pausado e atrasado',
  (:'d'::jsonb->>'in_progress_total')::int = 3 AND (:'d'::jsonb->>'attention_total')::int = 2);
SELECT t_recon.ok('painel: progresso só com base de tarefas (1 ativo com base)',
  (:'d'::jsonb->>'active_with_task_base')::int = 1 AND round((:'d'::jsonb->>'active_task_completion')::numeric, 4) = round(4000 / 6000.0, 4));
SELECT t_recon.ok('painel: segundo workspace fora', NOT EXISTS (
  SELECT 1 FROM public.project_time_entries WHERE workspace_id = :B));
SELECT public.project_dashboard_summary('2027-01-01', '2027-01-31', 'Asia/Tokyo') AS d2 \gset
SELECT t_recon.ok('painel: filtro de período isola 2027', (:'d2'::jsonb->'period'->>'rows')::int = 2);
ROLLBACK;

-- período/fuso inválidos
DO $$ BEGIN
  PERFORM public.project_dashboard_summary('2026-02-01', '2026-01-01', 'America/Sao_Paulo');
  RAISE EXCEPTION 'FALHOU: período invertido aceito';
EXCEPTION WHEN invalid_parameter_value THEN RAISE NOTICE 'ok: período invertido recusado'; END $$;
DO $$ BEGIN
  PERFORM public.project_dashboard_summary('2026-01-01', '2026-01-31', 'Mars/Olympus');
  RAISE EXCEPTION 'FALHOU: fuso inválido aceito';
EXCEPTION WHEN invalid_parameter_value THEN RAISE NOTICE 'ok: fuso inválido recusado'; END $$;

-- negado (u3), inativo (u5), outro workspace (u6), anônimo
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}', true) \g /dev/null
SELECT t_recon.ok('negação: u3 não soma horas', (public.project_dashboard_summary('2026-01-01','2026-06-30','UTC')->'period'->>'rows')::int = 0);
SELECT t_recon.ok('negação: u3 não lê alertas', (SELECT count(*) FROM public.project_reconciliation_issues) = 0);
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000005","role":"authenticated"}', true) \g /dev/null
SELECT t_recon.ok('inativo: u5 não vê nada', (public.project_dashboard_summary('2026-01-01','2026-06-30','UTC')->'projects'->>'total')::int = 0);
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000006","role":"authenticated"}', true) \g /dev/null
SELECT t_recon.ok('workspace B: só os 100 dele', (public.project_dashboard_summary('2026-01-01','2026-06-30','UTC')->'period'->>'rows')::int = 100);
ROLLBACK;
BEGIN;
SET LOCAL ROLE anon;
DO $$ BEGIN
  PERFORM public.project_dashboard_summary('2026-01-01','2026-01-31','UTC');
  RAISE EXCEPTION 'FALHOU: anônimo executou o painel';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: anônimo sem acesso ao painel'; END $$;
ROLLBACK;

-- ------------------------------------------------------------------ fila de inconsistências
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated"}', true) \g /dev/null
DO $$ BEGIN
  PERFORM public.project_reconciliation_refresh('aaaaaaaa-0000-4000-8000-00000000000a');
  RAISE EXCEPTION 'FALHOU: não-admin atualizou a fila';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: não-admin não atualiza a fila'; END $$;
ROLLBACK;

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true) \g /dev/null
SELECT public.project_reconciliation_refresh(:A) AS r1 \gset
COMMIT;
SELECT t_recon.ok('fila: tipos detectados', (:'r1'::jsonb->'by_type') @> '{"date_before_2020":1,"non_positive_duration":1,"possible_duplicate":1,"unknown_event":1,"open_interval":1,"hour_entry_unmatched":1}'::jsonb);
SELECT t_recon.ok('fila: sobreposições (par manual + duplicado)', (:'r1'::jsonb->'by_type'->>'overlap')::int = 2);
SELECT t_recon.ok('fila: hour_entry coberto por intervalos não vira alerta', (:'r1'::jsonb->>'hour_entries_covered_by_intervals')::int = 1);
SELECT t_recon.ok('fila: 1899 diagnosticado como vindo da origem', (SELECT detail->>'diagnosis' FROM public.project_reconciliation_issues WHERE issue_type = 'date_before_2020') = 'origin_payload');
SELECT t_recon.ok('fila: uma linha pode ter mais de um alerta (duplicado = sobreposto)',
  (SELECT count(*) FROM public.project_reconciliation_issues WHERE time_entry_id = '91000000-0000-4000-8000-000000000006') = 2);
SELECT t_recon.ok('fila: hour_entry não coberto = 1 h de impacto', (SELECT seconds_impact FROM public.project_reconciliation_issues WHERE issue_type = 'hour_entry_unmatched') = 3600);
SELECT count(*) AS issues_n FROM public.project_reconciliation_issues \gset
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true) \g /dev/null
SELECT public.project_reconciliation_refresh(:A) \g /dev/null
COMMIT;
SELECT t_recon.ok('fila: atualização idempotente', (SELECT count(*) FROM public.project_reconciliation_issues) = :issues_n);

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true) \g /dev/null
DO $$ BEGIN
  PERFORM public.project_reconciliation_decide('aaaaaaaa-0000-4000-8000-00000000000a',
    ARRAY(SELECT id FROM public.project_reconciliation_issues WHERE issue_type = 'non_positive_duration'), 'dismiss', '');
  RAISE EXCEPTION 'FALHOU: descarte sem justificativa';
EXCEPTION WHEN invalid_parameter_value THEN RAISE NOTICE 'ok: descarte exige justificativa'; END $$;
SELECT t_recon.ok('fila: descarte justificado', (public.project_reconciliation_decide(:A,
  ARRAY(SELECT id FROM public.project_reconciliation_issues WHERE issue_type = 'non_positive_duration'), 'dismiss',
  'Cronômetro zerado na origem; mantido como registro.')->>'updated')::int = 1);
COMMIT;
SELECT t_recon.ok('fila: evento de auditoria do descarte', (SELECT count(*) FROM public.project_reconciliation_issue_events WHERE action = 'dismiss') = 1);
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated"}', true) \g /dev/null
SELECT t_recon.ok('u4 lê a fila', (SELECT count(*) FROM public.project_reconciliation_issues) = :issues_n);
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}', true) \g /dev/null
SELECT t_recon.ok('u2 não lê a fila', (SELECT count(*) FROM public.project_reconciliation_issues) = 0);
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000006","role":"authenticated"}', true) \g /dev/null
SELECT t_recon.ok('admin do workspace B não lê fila do A', (SELECT count(*) FROM public.project_reconciliation_issues) = 0);
ROLLBACK;

-- Ver como somente leitura bloqueia decisão
INSERT INTO public.view_as_sessions (workspace_id, admin_id, target_user_id, mode, nonce, session_id)
VALUES (:A, :U1, :U1, 'role', 'n-iso', 'b0000000-0000-4000-8000-000000000001');
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"b0000000-0000-4000-8000-000000000001"}', true) \g /dev/null
DO $$ BEGIN
  PERFORM public.project_reconciliation_decide('aaaaaaaa-0000-4000-8000-00000000000a',
    ARRAY(SELECT id FROM public.project_reconciliation_issues LIMIT 1), 'defer', NULL);
  RAISE EXCEPTION 'FALHOU: Ver como gravou';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: Ver como somente leitura bloqueia a fila'; END $$;
DO $$ BEGIN
  PERFORM public.project_links_apply_exact('aaaaaaaa-0000-4000-8000-00000000000a');
  RAISE EXCEPTION 'FALHOU: Ver como vinculou';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: Ver como somente leitura bloqueia vínculos'; END $$;
ROLLBACK;

-- ------------------------------------------------------------------ vínculos exatos
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true) \g /dev/null
SELECT public.project_links_apply_exact(:A) AS l1 \gset
COMMIT;
SELECT t_recon.ok('vínculo empresa: só X (Y é de outro workspace, Z conflita com o mapeamento)',
  (:'l1'::jsonb->>'company_links')::int = 1
  AND (SELECT company_id FROM public.projects WHERE id = '80000000-0000-4000-8000-000000000001') = '60000000-0000-4000-8000-0000000000c1'
  AND (SELECT company_id FROM public.projects WHERE id = '80000000-0000-4000-8000-000000000002') IS NULL
  AND (SELECT company_id FROM public.projects WHERE id = '80000000-0000-4000-8000-000000000003') IS NULL);
SELECT t_recon.ok('conflito de empresa vira sugestão', EXISTS (SELECT 1 FROM public.project_link_suggestions
  WHERE kind = 'company' AND subject_id = '80000000-0000-4000-8000-000000000003' AND criterion = 'source_conflict'));
SELECT t_recon.ok('vínculo pessoa: e-mail normalizado único (u4: 6002 linhas; u7 ambíguo fica fora)',
  (:'l1'::jsonb->>'person_links')::int = 6002
  AND (SELECT count(*) FROM public.project_time_entries WHERE user_id = :U4 AND person_id = '70000000-0000-4000-8000-000000000001') = 6002);
SELECT t_recon.ok('pessoa de outro workspace nunca usada', NOT EXISTS (SELECT 1 FROM public.project_time_entries WHERE person_id = '70000000-0000-4000-8000-0000000000b1'));
SELECT t_recon.ok('e-mail ambíguo vira sugestões (2 candidatos de u7)', (SELECT count(*) FROM public.project_link_suggestions WHERE kind = 'person' AND subject_id = :U7 AND criterion = 'email_ambiguous') = 2
  AND NOT EXISTS (SELECT 1 FROM public.project_time_entries WHERE user_id = :U7 AND person_id IS NOT NULL));
SELECT t_recon.ok('nome exato vira sugestão, não vínculo', EXISTS (SELECT 1 FROM public.project_link_suggestions WHERE subject_id = :U2 AND criterion = 'name_exact')
  AND NOT EXISTS (SELECT 1 FROM public.project_time_entries WHERE user_id = :U2 AND person_id IS NOT NULL));
SELECT count(*) AS alloc_truth FROM public.project_time_entries WHERE user_id = :U4 AND project_id = '80000000-0000-4000-8000-000000000001' AND entry_date BETWEEN '2026-01-01' AND '2026-03-31' \gset
SELECT t_recon.ok('alocação só dentro da vigência', (:'l1'::jsonb->>'allocation_links')::int = :alloc_truth
  AND (SELECT count(*) FROM public.project_time_entries WHERE allocation_id IS NOT NULL) = :alloc_truth AND :alloc_truth BETWEEN 1 AND 5999);
SELECT t_recon.ok('duração/data/status/ids/updated_at intocados (hash)', (SELECT md5(string_agg(concat_ws('|', id, entry_date, hours, duration_minutes, started_at, stopped_at, status,
  billable, source, external_id, updated_at, approved_at, locked_at), ',' ORDER BY id)) FROM public.project_time_entries) = (SELECT h FROM t_recon.hash_before));
SELECT t_recon.ok('sem auditoria genérica nem workflow para o vínculo', (SELECT count(*) FROM public.audit_logs) = (SELECT audits FROM t_recon.hash_before)
  AND (SELECT count(*) FROM public.workflow_events) = (SELECT wf FROM t_recon.hash_before));
SELECT t_recon.ok('rastreio antes/depois por linha', (SELECT count(*) FROM public.project_link_changes) = 1 + 6002 + :alloc_truth
  AND NOT EXISTS (SELECT 1 FROM public.project_link_changes WHERE old_value IS NOT NULL));

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true) \g /dev/null
SELECT public.project_links_apply_exact(:A) AS l2 \gset
COMMIT;
SELECT t_recon.ok('vínculos idempotentes', (:'l2'::jsonb->>'company_links')::int = 0 AND (:'l2'::jsonb->>'person_links')::int = 0 AND (:'l2'::jsonb->>'allocation_links')::int = 0);

-- desvincular (reverte só o rastreado) e conferir hash
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true) \g /dev/null
SELECT public.project_links_revert(:A, 'person', ARRAY[:U4]::uuid[]) AS rv \gset
COMMIT;
SELECT t_recon.ok('reversão: pessoa e alocação voltam a vazio', (:'rv'::jsonb->>'reverted')::int = 6002 + :alloc_truth
  AND NOT EXISTS (SELECT 1 FROM public.project_time_entries WHERE person_id IS NOT NULL OR allocation_id IS NOT NULL));
SELECT t_recon.ok('reversão não toca duração/status (hash)', (SELECT md5(string_agg(concat_ws('|', id, entry_date, hours, duration_minutes, started_at, stopped_at, status,
  billable, source, external_id, updated_at, approved_at, locked_at), ',' ORDER BY id)) FROM public.project_time_entries) = (SELECT h FROM t_recon.hash_before));

-- concorrência: duas sessões aplicando ao mesmo tempo (o shell roda este trecho em paralelo; aqui confere)
\echo 'concurrency-point'
