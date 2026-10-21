-- Prova isolada do ciclo 6 do TechProjects: API v1 sob a RLS do dono da chave, idempotência,
-- fila offline idempotente, competência fechada na criação, painel de operação e privilégios.
-- Roda SOMENTE no banco descartável do harness via
--   bash tests/sql/cycle6-isolated.sh drizzle/migrations/0179_*.sql
-- Acesso de usuário: `authenticated` + claims. Servidor da API: `service_role` chamando as portas
-- `project_api_*` (o sujeito da API aplica a RLS do dono da chave; service_role nunca lê direto).
\set ON_ERROR_STOP 1
\set QUIET 1
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.__isolated_marker WHERE id = 1 AND label = 'techerp-isolated-harness') THEN
    RAISE EXCEPTION 'recusado: banco sem marcador do harness';
  END IF;
END $$;

DROP SCHEMA IF EXISTS t_c6 CASCADE;
CREATE SCHEMA t_c6;
GRANT USAGE ON SCHEMA t_c6 TO authenticated, anon, service_role;
CREATE FUNCTION t_c6.ok(p_name text, p_cond boolean) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  IF p_cond IS DISTINCT FROM true THEN RAISE EXCEPTION 'FALHOU: %', p_name; END IF;
  RAISE NOTICE 'ok: %', p_name; RETURN 'ok';
END $$;
CREATE FUNCTION t_c6.err(p_sql text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN EXECUTE p_sql; RETURN 'NO ERROR';
EXCEPTION WHEN others THEN RETURN SQLERRM; END $$;
CREATE FUNCTION t_c6.as_user(p_uid uuid, p_session uuid DEFAULT NULL) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated', 'session_id', p_session)::text, true) $$;
CREATE FUNCTION t_c6.as_service() RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true) $$;
CREATE TABLE t_c6.kv (k text PRIMARY KEY, v text);
GRANT ALL ON t_c6.kv TO authenticated, service_role;
CREATE FUNCTION t_c6.put(p text, v text) RETURNS text LANGUAGE sql AS $$
  INSERT INTO t_c6.kv VALUES (p, v) ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v RETURNING v $$;
CREATE FUNCTION t_c6.get(p text) RETURNS text LANGUAGE sql AS $$ SELECT v FROM t_c6.kv WHERE k = p $$;
-- Conferência privilegiada (nunca usada como prova de acesso).
CREATE FUNCTION t_c6.entry(p uuid) RETURNS public.project_time_entries LANGUAGE sql SECURITY DEFINER AS $$
  SELECT * FROM public.project_time_entries WHERE id = p $$;
CREATE FUNCTION t_c6.n_entries(p_where text) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE n bigint; BEGIN EXECUTE 'select count(*) from public.project_time_entries where ' || p_where INTO n; RETURN n; END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA t_c6 TO authenticated, service_role;

\set A '''aaaaaaaa-0000-4000-8000-00000000000a'''
\set B '''aaaaaaaa-0000-4000-8000-00000000000b'''
\set U1 '''10000000-0000-4000-8000-000000000001'''
\set U2 '''10000000-0000-4000-8000-000000000002'''
\set U3 '''10000000-0000-4000-8000-000000000003'''
\set U4 '''10000000-0000-4000-8000-000000000004'''
\set U5 '''10000000-0000-4000-8000-000000000005'''
\set U6 '''10000000-0000-4000-8000-000000000006'''
\set U7 '''10000000-0000-4000-8000-000000000007'''
\set U8 '''10000000-0000-4000-8000-000000000008'''
\set P1 '''c6000000-0000-4000-8000-000000000001'''
\set P2 '''c6000000-0000-4000-8000-000000000002'''
\set PB '''c6000000-0000-4000-8000-0000000000b1'''
\set T1 '''c6100000-0000-4000-8000-000000000001'''
\set T2 '''c6100000-0000-4000-8000-000000000002'''
\set TB '''c6100000-0000-4000-8000-0000000000b1'''
\set K2 '''c6200000-0000-4000-8000-000000000002'''
\set K3 '''c6200000-0000-4000-8000-000000000003'''
\set K5 '''c6200000-0000-4000-8000-000000000005'''
\set K7R '''c6200000-0000-4000-8000-000000000077'''
\set K7E '''c6200000-0000-4000-8000-000000000078'''
\set K8 '''c6200000-0000-4000-8000-000000000008'''
\set KB '''c6200000-0000-4000-8000-0000000000b6'''

-- ------------------------------------------------------------------ fixtures sintéticas
INSERT INTO public.permission_sets (id, module, name) VALUES
 ('20000000-0000-4000-8000-0000000006c1','techprojects','[ISO] C6 horas próprias'),
 ('20000000-0000-4000-8000-0000000006c2','techprojects','[ISO] C6 fechamento') ON CONFLICT DO NOTHING;
INSERT INTO public.permission_set_items (set_id, permission_key)
SELECT '20000000-0000-4000-8000-0000000006c1', p.key FROM public.permissions p
 WHERE p.key IN ('techprojects.time_entries.create.own','techprojects.time_entries.view.own','techprojects.time_entries.update.own',
                 'techprojects.projects.view.own') ON CONFLICT DO NOTHING;
INSERT INTO public.permission_set_items (set_id, permission_key)
SELECT '20000000-0000-4000-8000-0000000006c2', p.key FROM public.permissions p
 WHERE p.key IN ('techprojects.timesheet_closing.manage.workspace','techprojects.projects.view.workspace') ON CONFLICT DO NOTHING;
INSERT INTO public.job_role_sets (role_id, set_id) VALUES
 ('30000000-0000-4000-8000-0000000000a1','20000000-0000-4000-8000-0000000006c1'),
 ('30000000-0000-4000-8000-0000000000a2','20000000-0000-4000-8000-0000000006c1'),
 ('30000000-0000-4000-8000-0000000000a3','20000000-0000-4000-8000-0000000006c1'),
 ('30000000-0000-4000-8000-0000000000a3','20000000-0000-4000-8000-0000000006c2') ON CONFLICT DO NOTHING;

-- u8: membro de A e de B, com B como workspace ativo (prova que a chave fixa o workspace).
INSERT INTO auth.users (id, email, aud, role, email_confirmed_at, raw_user_meta_data) VALUES
 (:U8, 'dual-a-b@techerp-test.invalid', 'authenticated', 'authenticated', now(), '{"full_name":"[ISO] Duplo A/B"}') ON CONFLICT DO NOTHING;
INSERT INTO public.workspace_members (workspace_id, user_id, role, status) VALUES
 (:A, :U8, 'member', 'active'), (:B, :U8, 'member', 'active') ON CONFLICT DO NOTHING;
UPDATE public.profiles SET active_workspace_id = :B WHERE id = :U8;
INSERT INTO public.user_job_roles (user_id, owner_id, workspace_id, role_id) VALUES (:U8, :A, :A, '30000000-0000-4000-8000-0000000000a1');

INSERT INTO public.projects (id, workspace_id, owner_id, name, status) VALUES
 (:P1, :A, :U1, '[ISO] C6 Projeto API', 'active'), (:P2, :A, :U1, '[ISO] C6 Sem vínculo', 'active'),
 (:PB, :B, :U6, '[ISO] C6 SegredoB', 'active');
INSERT INTO public.project_tasks (id, workspace_id, project_id, title) VALUES
 (:T1, :A, :P1, '[ISO] C6 Desenvolvimento'), (:T2, :A, :P2, '[ISO] C6 Outra'), (:TB, :B, :PB, '[ISO] C6 B');
INSERT INTO public.project_members (workspace_id, project_id, user_id, role_in_project) VALUES
 (:A, :P1, :U2, 'contributor'), (:A, :P1, :U7, 'contributor'), (:A, :P1, :U8, 'contributor'), (:A, :P1, :U5, 'contributor');

INSERT INTO public.api_keys (id, owner_id, workspace_id, name, prefix, key_hash, scopes) VALUES
 (:K2, :U2, :A, '[ISO] chave u2', 'lvb_iso2', 'h-iso-2', ARRAY['write']),
 (:K3, :U3, :A, '[ISO] chave u3', 'lvb_iso3', 'h-iso-3', ARRAY['read']),
 (:K5, :U5, :A, '[ISO] chave u5 inativo', 'lvb_iso5', 'h-iso-5', ARRAY['write']),
 (:K8, :U8, :A, '[ISO] chave u8 em A', 'lvb_iso8', 'h-iso-8', ARRAY['write']),
 (:KB, :U6, :B, '[ISO] chave admin B', 'lvb_isob', 'h-iso-b', ARRAY['write']);
INSERT INTO public.api_keys (id, owner_id, workspace_id, name, prefix, key_hash, scopes, revoked_at) VALUES
 (:K7R, :U7, :A, '[ISO] chave revogada', 'lvb_iso7', 'h-iso-7r', ARRAY['write'], now());
INSERT INTO public.api_keys (id, owner_id, workspace_id, name, prefix, key_hash, scopes, expires_at) VALUES
 (:K7E, :U7, :A, '[ISO] chave vencida', 'lvb_is7e', 'h-iso-7e', ARRAY['write'], now() - interval '1 day');

-- Apontamentos de partida: u2 (2) e u7 (1) em A; u6 (1) em B.
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c6.as_user(:U2) \g /dev/null
INSERT INTO public.project_time_entries (workspace_id, project_id, task_id, user_id, entry_date, start_time, end_time)
VALUES (:A, :P1, :T1, :U2, '2026-03-02', '09:00', '10:00'), (:A, :P1, :T1, :U2, '2026-03-03', '09:00', '10:00');
COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c6.as_user(:U7) \g /dev/null
INSERT INTO public.project_time_entries (workspace_id, project_id, task_id, user_id, entry_date, start_time, end_time)
VALUES (:A, :P1, :T1, :U7, '2026-03-02', '09:00', '10:00');
COMMIT;
SELECT set_config('app.project_time_workflow', 'on', false) \g /dev/null
INSERT INTO public.project_time_entries (workspace_id, project_id, task_id, user_id, entry_date, start_time, end_time)
VALUES (:B, :PB, :TB, :U6, '2026-03-02', '09:00', '10:00');
SELECT set_config('app.project_time_workflow', 'off', false) \g /dev/null
CREATE TABLE t_c6.hash_before AS
SELECT md5(string_agg(concat_ws('|', id, status, duration_seconds, updated_at, revision), ',' ORDER BY id)) AS h FROM public.project_time_entries;

-- ------------------------------------------------------------------ 1. portas da API: só o servidor executa
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c6.as_user(:U2) \g /dev/null
SELECT t_c6.ok('usuário logado não executa porta da API (personificação barrada)',
  t_c6.err(format('select public.project_api_list_time_entries(%L,%L,%L,null,null,null,null,null,false,50,0)', :K3, :U3, :A)) ~ 'permission denied');
SELECT t_c6.ok('usuário logado não alcança o esquema interno da API',
  t_c6.err(format('select techerp_api.enter(%L,%L,%L)', :K3, :U3, :A)) ~ 'permission denied');
SELECT t_c6.ok('usuário logado não lê sessões nem idempotência',
  t_c6.err('select count(*) from techerp_api.subject_sessions') ~ 'permission denied'
  AND t_c6.err('select count(*) from public.api_idempotency_keys') ~ 'permission denied');
SELECT t_c6.ok('marcar app.api_subject à mão não troca o workspace (sem sessão registrada)',
  (SELECT set_config('app.api_subject', 'on', true)) = 'on'
  AND (SELECT count(*) FROM public.project_time_entries WHERE workspace_id = :B) = 0);
COMMIT;
BEGIN; SET LOCAL ROLE anon;
SELECT t_c6.ok('anônimo não executa porta da API nem consulta de aprovador',
  t_c6.err(format('select public.project_api_list_projects(%L,%L,%L,null,null,50,0)', :K2, :U2, :A)) ~ 'permission denied'
  AND t_c6.err(format('select public.project_time_has_approver(%L,%L)', :P1, :U2)) ~ 'permission denied');
COMMIT;
SELECT t_c6.ok('papel do sujeito não tem login nem BYPASSRLS e só herda authenticated',
  (SELECT NOT rolcanlogin AND NOT rolbypassrls AND NOT rolsuper FROM pg_roles WHERE rolname = 'techerp_api_subject')
  AND NOT pg_has_role('authenticator', 'techerp_api_subject', 'member')
  AND NOT pg_has_role('anon', 'techerp_api_subject', 'member')
  AND NOT pg_has_role('authenticated', 'techerp_api_subject', 'member'));

-- ------------------------------------------------------------------ 2. leitura = RLS do dono da chave
BEGIN; SET LOCAL ROLE service_role; SELECT t_c6.as_service() \g /dev/null
SELECT t_c6.put('api_u2', public.project_api_list_time_entries(:K2, :U2, :A, null, null, null, null, null, false, 50, 0)::text) \g /dev/null
SELECT t_c6.put('api_u3', public.project_api_list_time_entries(:K3, :U3, :A, null, null, null, null, null, false, 50, 0)::text) \g /dev/null
SELECT t_c6.ok('claims do servidor restauradas ao fim da chamada', current_setting('request.jwt.claims', true) = '{"role":"service_role"}'
  AND current_setting('app.api_subject', true) = 'off');
COMMIT;
SELECT t_c6.ok('nenhuma sessão de sujeito sobra depois das chamadas', (SELECT count(*) FROM techerp_api.subject_sessions) = 0);
SELECT t_c6.ok('profissional (ver próprios) recebe só os 2 apontamentos dele',
  (t_c6.get('api_u2')::jsonb->>'total')::int = 2
  AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(t_c6.get('api_u2')::jsonb->'data') d WHERE d->>'user_id' <> '10000000-0000-4000-8000-000000000002'));
-- Equivalência com a sessão normal do mesmo usuário.
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c6.as_user(:U3) \g /dev/null
SELECT t_c6.put('ui_u3', (SELECT count(*) FROM public.project_time_entries WHERE workspace_id = :A)::text) \g /dev/null
COMMIT;
SELECT t_c6.ok('API do líder devolve exatamente o que a sessão dele vê', (t_c6.get('api_u3')::jsonb->>'total') = t_c6.get('ui_u3'));
SELECT t_c6.ok('saída da API não expõe tarifa, custo nem título financeiro',
  NOT (t_c6.get('api_u2')::text ~ 'hourly_rate|financial_entry_id|invoice_id|cost'));
BEGIN; SET LOCAL ROLE service_role; SELECT t_c6.as_service() \g /dev/null
SELECT t_c6.ok('chave de A não lê B (workspace trocado no pedido)',
  t_c6.err(format('select public.project_api_list_time_entries(%L,%L,%L,null,null,null,null,null,false,50,0)', :K2, :U2, :B)) ~ 'API_KEY_INVALID');
SELECT t_c6.ok('chave revogada e chave vencida são recusadas',
  t_c6.err(format('select public.project_api_list_projects(%L,%L,%L,null,null,50,0)', :K7R, :U7, :A)) ~ 'API_KEY_INVALID'
  AND t_c6.err(format('select public.project_api_list_projects(%L,%L,%L,null,null,50,0)', :K7E, :U7, :A)) ~ 'API_KEY_INVALID');
SELECT t_c6.ok('dono inativo é recusado mesmo com chave válida',
  t_c6.err(format('select public.project_api_list_projects(%L,%L,%L,null,null,50,0)', :K5, :U5, :A)) ~ 'API_SUBJECT_INACTIVE');
SELECT t_c6.ok('chave usada com outro dono é recusada',
  t_c6.err(format('select public.project_api_list_projects(%L,%L,%L,null,null,50,0)', :K2, :U3, :A)) ~ 'API_KEY_INVALID');
SELECT t_c6.put('api_u8', public.project_api_list_projects(:K8, :U8, :A, null, null, 50, 0)::text) \g /dev/null
SELECT t_c6.put('api_b', public.project_api_list_projects(:KB, :U6, :B, null, null, 50, 0)::text) \g /dev/null
COMMIT;
SELECT t_c6.ok('chave fixa o workspace A mesmo com B ativo no perfil (u8)',
  EXISTS (SELECT 1 FROM jsonb_array_elements(t_c6.get('api_u8')::jsonb->'data') d WHERE d->>'id' = 'c6000000-0000-4000-8000-000000000001')
  AND NOT (t_c6.get('api_u8')::text ~ 'SegredoB'));
SELECT t_c6.ok('admin de B pela API não vê nada de A', NOT (t_c6.get('api_b')::text ~ 'C6 Projeto API'));
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c6.as_user(:U8) \g /dev/null
SELECT t_c6.ok('sessão normal do u8 continua só em B (fixação não vaza para fora da API)',
  (SELECT count(*) FROM public.projects WHERE workspace_id = :A) = 0);
COMMIT;
SELECT t_c6.ok('can_track do projeto vinculado aparece para u8',
  EXISTS (SELECT 1 FROM jsonb_array_elements(t_c6.get('api_u8')::jsonb->'data') d WHERE d->>'id' = 'c6000000-0000-4000-8000-000000000001' AND (d->>'can_track')::boolean));
-- Negação vence: deny de "ver próprios" no cargo do u2 zera a leitura pela API.
INSERT INTO public.job_role_permission_overrides (workspace_id, role_id, permission_key, effect, created_by)
VALUES (:A, '30000000-0000-4000-8000-0000000000a1', 'techprojects.time_entries.view.own', 'deny', :U1);
BEGIN; SET LOCAL ROLE service_role; SELECT t_c6.as_service() \g /dev/null
SELECT t_c6.ok('negação explícita também vale pela API',
  (public.project_api_list_time_entries(:K2, :U2, :A, null, null, null, null, null, false, 50, 0)->>'total')::int = 0);
COMMIT;
DELETE FROM public.job_role_permission_overrides WHERE workspace_id = :A AND role_id = '30000000-0000-4000-8000-0000000000a1' AND effect = 'deny';
BEGIN; SET LOCAL ROLE service_role; SELECT t_c6.as_service() \g /dev/null
SELECT t_c6.ok('paginação: limite 1 traz 1 linha e o total real',
  (SELECT jsonb_array_length(j->'data') = 1 AND (j->>'total')::int = 2 FROM (SELECT public.project_api_list_time_entries(:K2, :U2, :A, null, null, null, null, null, true, 1, 1) j) x));
SELECT t_c6.ok('limite acima de 200 é reduzido a 200', (public.project_api_list_tasks(:K2, :U2, :A, null, null, null, 5000, 0)->>'limit')::int = 200);
COMMIT;

-- ------------------------------------------------------------------ 3. criação pela API com as regras do ciclo 3
BEGIN; SET LOCAL ROLE service_role; SELECT t_c6.as_service() \g /dev/null
SELECT t_c6.put('c1', public.project_api_create_time_entry(:K2, :U2, :A, 'iso-idem-0001', repeat('a', 64),
  json_build_object('project_id', :P1, 'task_id', :T1, 'entry_date', '2026-03-04', 'mode', 'interval', 'start_time', '09:00:00', 'end_time', '10:30:15',
                    'timezone', 'America/Sao_Paulo', 'status', 'approved', 'user_id', :U7)::jsonb)::text) \g /dev/null
COMMIT;
SELECT t_c6.ok('criado como rascunho do dono da chave, origem api, segundos exatos; status/usuário do corpo ignorados',
  (SELECT e.status = 'draft' AND e.source = 'api' AND e.user_id = :U2 AND e.duration_seconds = 5415 AND e.approved_at IS NULL
     FROM t_c6.entry((t_c6.get('c1')::jsonb->'data'->>'id')::uuid) e)
  AND (t_c6.get('c1')::jsonb->>'replay')::boolean = false);
BEGIN; SET LOCAL ROLE service_role; SELECT t_c6.as_service() \g /dev/null
SELECT t_c6.ok('mesmo pedido repetido devolve o mesmo registro (replay)',
  (SELECT (j->>'replay')::boolean AND j->'data'->>'id' = t_c6.get('c1')::jsonb->'data'->>'id'
     FROM (SELECT public.project_api_create_time_entry(:K2, :U2, :A, 'iso-idem-0001', repeat('a', 64), '{}'::jsonb) j) x));
SELECT t_c6.ok('mesma chave de idempotência com conteúdo diferente é recusada',
  t_c6.err(format('select public.project_api_create_time_entry(%L,%L,%L,%L,%L,%L)', :K2, :U2, :A, 'iso-idem-0001', repeat('b', 64), '{}')) ~ 'IDEMPOTENCY_CONFLICT');
SELECT t_c6.ok('sem chave de idempotência é recusado',
  t_c6.err(format('select public.project_api_create_time_entry(%L,%L,%L,null,%L,%L)', :K2, :U2, :A, repeat('c', 64), '{}')) ~ 'IDEMPOTENCY_KEY_REQUIRED');
SELECT t_c6.ok('sobreposição continua barrada pela API',
  t_c6.err(format('select public.project_api_create_time_entry(%L,%L,%L,%L,%L,%L)', :K2, :U2, :A, 'iso-idem-0002', repeat('d', 64),
    json_build_object('project_id', :P1, 'task_id', :T1, 'entry_date', '2026-03-04', 'start_time', '10:00', 'end_time', '11:00'))) ~ 'Já existe');
SELECT t_c6.ok('sem vínculo no projeto não aponta pela API',
  t_c6.err(format('select public.project_api_create_time_entry(%L,%L,%L,%L,%L,%L)', :K2, :U2, :A, 'iso-idem-0003', repeat('e', 64),
    json_build_object('project_id', :P2, 'task_id', :T2, 'entry_date', '2026-03-04', 'mode', 'duration', 'duration_seconds', 3600))) ~ 'vínculo|NOT_FOUND');
SELECT t_c6.ok('atividade de outro projeto não é aceita',
  t_c6.err(format('select public.project_api_create_time_entry(%L,%L,%L,%L,%L,%L)', :K2, :U2, :A, 'iso-idem-0004', repeat('f', 64),
    json_build_object('project_id', :P1, 'task_id', :T2, 'entry_date', '2026-03-05', 'mode', 'duration', 'duration_seconds', 3600))) ~ 'NOT_FOUND');
SELECT t_c6.ok('duração fora de 60..86400 s é recusada',
  t_c6.err(format('select public.project_api_create_time_entry(%L,%L,%L,%L,%L,%L)', :K2, :U2, :A, 'iso-idem-0005', repeat('g', 64),
    json_build_object('project_id', :P1, 'task_id', :T1, 'entry_date', '2026-03-05', 'mode', 'duration', 'duration_seconds', 30))) ~ 'INVALID_INPUT');
SELECT t_c6.ok('chave somente leitura de outro dono não cria em nome do u2',
  t_c6.err(format('select public.project_api_create_time_entry(%L,%L,%L,%L,%L,%L)', :K3, :U2, :A, 'iso-idem-0006', repeat('h', 64), '{}')) ~ 'API_KEY_INVALID');
SELECT t_c6.ok('dono inativo não cria', t_c6.err(format('select public.project_api_create_time_entry(%L,%L,%L,%L,%L,%L)', :K5, :U5, :A, 'iso-idem-0007', repeat('i', 64),
    json_build_object('project_id', :P1, 'task_id', :T1, 'entry_date', '2026-03-06', 'mode', 'duration', 'duration_seconds', 3600))) ~ 'API_SUBJECT_INACTIVE');
COMMIT;
SELECT t_c6.ok('falhas da API não deixam apontamento nem registro de idempotência',
  t_c6.n_entries('source = ''api''') = 1 AND (SELECT count(*) FROM public.api_idempotency_keys) = 1);
BEGIN; SET LOCAL ROLE service_role; SELECT t_c6.as_service() \g /dev/null
SELECT t_c6.ok('API não altera apontamento travado nem aprova: não há porta de alteração',
  NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
               WHERE ((n.nspname = 'public' AND p.proname LIKE 'project\_api\_%') OR n.nspname = 'techerp_api')
                 AND p.proname ~ 'update|approve|delete|decide|close|measure|reopen|lock')
  AND (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname LIKE 'project\_api\_%') = 4);
COMMIT;

-- ------------------------------------------------------------------ 4. competência fechada também na criação
SELECT set_config('app.project_time_workflow', 'on', false) \g /dev/null
INSERT INTO public.project_period_closings (id, workspace_id, scope, project_id, period_from, period_to, timezone, policy_version, status,
  entries_snapshot, entry_count, total_seconds, excluded_import_count, excluded_import_seconds, closed_by, closed_at)
VALUES ('c6300000-0000-4000-8000-000000000001', :A, 'project', :P1, '2026-02-01', '2026-02-28', 'America/Sao_Paulo', 1, 'closed', '[]', 0, 0, 0, 0, :U4, now());
SELECT set_config('app.project_time_workflow', 'off', false) \g /dev/null
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c6.as_user(:U2) \g /dev/null
SELECT t_c6.ok('apontamento novo em competência fechada é recusado na tela',
  t_c6.err(format('insert into public.project_time_entries (workspace_id, project_id, task_id, user_id, entry_date, duration_seconds, entry_kind) values (%L,%L,%L,%L,%L,3600,%L)',
    :A, :P1, :T1, :U2, '2026-02-10', 'duration')) ~ 'PERIOD_CLOSED');
SELECT t_c6.ok('fora da competência fechada continua permitido',
  t_c6.err(format('insert into public.project_time_entries (workspace_id, project_id, task_id, user_id, entry_date, duration_seconds, entry_kind) values (%L,%L,%L,%L,%L,1800,%L)',
    :A, :P1, :T1, :U2, '2026-03-10', 'duration')) = 'NO ERROR');
COMMIT;
BEGIN; SET LOCAL ROLE service_role; SELECT t_c6.as_service() \g /dev/null
SELECT t_c6.ok('competência fechada vale também pela API',
  t_c6.err(format('select public.project_api_create_time_entry(%L,%L,%L,%L,%L,%L)', :K2, :U2, :A, 'iso-idem-0008', repeat('j', 64),
    json_build_object('project_id', :P1, 'task_id', :T1, 'entry_date', '2026-02-11', 'mode', 'duration', 'duration_seconds', 3600))) ~ 'PERIOD_CLOSED');
COMMIT;
SELECT set_config('app.clockify_import', 'on', false) \g /dev/null
INSERT INTO public.project_time_entries (workspace_id, project_id, user_id, started_at, stopped_at, hours, entry_date, status, source, external_id, locked_at)
VALUES (:A, :P1, :U2, '2026-02-12 12:00+00', '2026-02-12 13:00+00', 1, '2026-02-12', 'locked', 'import', 'iso-c6-imp', now());
SELECT set_config('app.clockify_import', 'off', false) \g /dev/null
SELECT t_c6.ok('importador (flag própria) não é afetado pela guarda nova', t_c6.n_entries('external_id = ''iso-c6-imp''') = 1);

-- ------------------------------------------------------------------ 5. fila offline idempotente
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c6.as_user(:U2) \g /dev/null
SELECT t_c6.put('o1', public.project_time_entry_sync(:A, 'c6400000-0000-4000-8000-000000000001', repeat('1', 64),
  json_build_object('project_id', :P1, 'task_id', :T1, 'entry_date', '2026-03-11', 'mode', 'duration', 'duration_seconds', 2700,
                    'status', 'approved', 'description', '[ISO] offline')::jsonb, '2020-01-01T00:00:00Z')::text) \g /dev/null
SELECT t_c6.ok('envio offline grava rascunho manual com a duração exata',
  (SELECT e.status = 'draft' AND e.source = 'manual' AND e.duration_seconds = 2700 AND e.user_id = :U2
     FROM t_c6.entry((t_c6.get('o1')::jsonb->'entry'->>'id')::uuid) e));
SELECT t_c6.ok('mesmo pedido de novo (outra aba / retomada) devolve o mesmo apontamento',
  (SELECT (j->>'replay')::boolean AND j->'entry'->>'id' = t_c6.get('o1')::jsonb->'entry'->>'id'
     FROM (SELECT public.project_time_entry_sync(:A, 'c6400000-0000-4000-8000-000000000001', repeat('1', 64), '{}'::jsonb) j) x));
SELECT t_c6.ok('mesmo pedido com conteúdo diferente vira conflito',
  t_c6.err(format('select public.project_time_entry_sync(%L,%L,%L,%L)', :A, 'c6400000-0000-4000-8000-000000000001', repeat('2', 64), '{}')) ~ 'OFFLINE_REQUEST_CONFLICT');
SELECT t_c6.ok('pedido feito em outro workspace não é enviado ao ativo',
  t_c6.err(format('select public.project_time_entry_sync(%L,%L,%L,%L)', :B, 'c6400000-0000-4000-8000-000000000002', repeat('3', 64),
    json_build_object('project_id', :PB, 'task_id', :TB, 'entry_date', '2026-03-11', 'mode', 'duration', 'duration_seconds', 600))) ~ 'WORKSPACE_MISMATCH');
SELECT t_c6.ok('competência fechada não é forçada pela fila',
  t_c6.err(format('select public.project_time_entry_sync(%L,%L,%L,%L)', :A, 'c6400000-0000-4000-8000-000000000003', repeat('4', 64),
    json_build_object('project_id', :P1, 'task_id', :T1, 'entry_date', '2026-02-15', 'mode', 'duration', 'duration_seconds', 600))) ~ 'PERIOD_CLOSED');
SELECT t_c6.ok('horário do aparelho não vira horário do apontamento nem aprovação',
  (SELECT e.start_time IS NULL AND e.approved_at IS NULL AND e.created_at > '2026-01-01' FROM t_c6.entry((t_c6.get('o1')::jsonb->'entry'->>'id')::uuid) e));
COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c6.as_user(:U7) \g /dev/null
SELECT t_c6.ok('outro usuário não vê pedidos offline do u2', (SELECT count(*) FROM public.project_time_client_requests) = 0);
SELECT t_c6.ok('mesmo id de pedido em outra conta não reaproveita o apontamento do u2',
  (SELECT (j->>'replay')::boolean = false AND j->'entry'->>'user_id' = '10000000-0000-4000-8000-000000000007'
     FROM (SELECT public.project_time_entry_sync(:A, 'c6400000-0000-4000-8000-000000000001', repeat('1', 64),
       json_build_object('project_id', :P1, 'task_id', :T1, 'entry_date', '2026-03-12', 'mode', 'duration', 'duration_seconds', 900)::jsonb) j) x));
COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c6.as_user(:U5) \g /dev/null
SELECT t_c6.ok('membro inativo não envia fila antiga',
  t_c6.err(format('select public.project_time_entry_sync(%L,%L,%L,%L)', :A, 'c6400000-0000-4000-8000-000000000005', repeat('5', 64),
    json_build_object('project_id', :P1, 'task_id', :T1, 'entry_date', '2026-03-12', 'mode', 'duration', 'duration_seconds', 900))) ~ 'WORKSPACE_MISMATCH');
COMMIT;
INSERT INTO public.view_as_sessions (workspace_id, admin_id, target_user_id, mode, nonce, session_id)
VALUES (:A, :U1, :U2, 'role', 'n-iso-c6', 'b0000000-0000-4000-8000-0000000000c6');
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c6.as_user(:U2, 'b0000000-0000-4000-8000-0000000000c6') \g /dev/null
SELECT t_c6.ok('"Ver como" por papel não envia fila (somente leitura)',
  t_c6.err(format('select public.project_time_entry_sync(%L,%L,%L,%L)', :A, 'c6400000-0000-4000-8000-000000000006', repeat('6', 64),
    json_build_object('project_id', :P1, 'task_id', :T1, 'entry_date', '2026-03-13', 'mode', 'duration', 'duration_seconds', 900))) ~ 'somente leitura');
COMMIT;
BEGIN; SET LOCAL ROLE anon;
SELECT t_c6.ok('anônimo não envia fila', t_c6.err(format('select public.project_time_entry_sync(%L,%L,%L,%L)', :A, 'c6400000-0000-4000-8000-000000000007', repeat('7', 64), '{}')) ~ 'permission denied');
COMMIT;

-- ------------------------------------------------------------------ 6. painel de operação (somente admin)
INSERT INTO cron.job (jobname, schedule, command, active) VALUES ('deal-delivery-jobs', '*/2 * * * *', 'select net.http_post(''x'', headers := ''{"x-cron-secret":"SEGREDO-ISO"}'')', true);
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c6.as_user(:U1) \g /dev/null
SELECT t_c6.put('ops', public.project_ops_status(:A)::text) \g /dev/null
COMMIT;
SELECT t_c6.ok('admin vê agendamentos esperados e quais faltam',
  EXISTS (SELECT 1 FROM jsonb_array_elements(t_c6.get('ops')::jsonb->'jobs') j WHERE j->>'name' = 'deal-delivery-jobs' AND (j->>'scheduled')::boolean)
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(t_c6.get('ops')::jsonb->'jobs') j WHERE j->>'name' = 'project-alerts-tick' AND NOT (j->>'scheduled')::boolean));
SELECT t_c6.ok('operação nunca devolve comando nem segredo do agendador', NOT (t_c6.get('ops') ~ 'SEGREDO-ISO|command|http_post'));
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c6.as_user(:U4) \g /dev/null
SELECT t_c6.ok('não admin não vê operação', t_c6.err(format('select public.project_ops_status(%L)', :A)) ~ 'administradores');
COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c6.as_user(:U6) \g /dev/null
SELECT t_c6.ok('admin de outro workspace não vê operação de A', t_c6.err(format('select public.project_ops_status(%L)', :A)) ~ 'administradores');
COMMIT;

-- ------------------------------------------------------------------ 7. privilégios e search_path
SELECT t_c6.ok('toda função SECURITY DEFINER de public e techerp_api fixa search_path',
  NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
               WHERE n.nspname IN ('public', 'techerp_api') AND p.prosecdef
                 AND NOT EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig, '{}')) c WHERE c LIKE 'search_path=%')));
SELECT t_c6.ok('nenhuma função DEFINER do TechProjects (fora de gatilho) é executável por anônimo',
  NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
               WHERE n.nspname = 'public' AND p.prosecdef AND p.prorettype <> 'trigger'::regtype
                 AND (p.proname LIKE 'project\_%' OR p.proname LIKE 'deal\_delivery\_%')
                 AND has_function_privilege('anon', p.oid, 'EXECUTE')));
SELECT t_c6.ok('tabelas novas têm RLS ligada', (SELECT bool_and(relrowsecurity) FROM pg_class
  WHERE oid IN ('public.api_idempotency_keys'::regclass, 'public.api_rate_buckets'::regclass, 'public.project_time_client_requests'::regclass)));
SELECT t_c6.ok('limite por chave: 3 por janela, o 4º é negado',
  (SELECT bool_and((public.api_rate_hit(:K3, 3, 60)->>'allowed')::boolean) FROM generate_series(1, 3))
  AND NOT (public.api_rate_hit(:K3, 3, 60)->>'allowed')::boolean);
SELECT t_c6.ok('anônimo e usuário não executam o contador de limite',
  NOT has_function_privilege('anon', 'public.api_rate_hit(uuid,integer,integer)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.api_rate_hit(uuid,integer,integer)', 'EXECUTE'));

-- ------------------------------------------------------------------ 8. preservação
SELECT t_c6.ok('apontamentos de partida intactos (nenhuma mudança por leitura, recusa ou replay)',
  (SELECT md5(string_agg(concat_ws('|', id, status, duration_seconds, updated_at, revision), ',' ORDER BY id)) FROM public.project_time_entries
    WHERE id IN (SELECT id FROM public.project_time_entries WHERE source <> 'api' AND created_at < (SELECT min(created_at) FROM public.api_idempotency_keys)
                   AND external_id IS DISTINCT FROM 'iso-c6-imp' AND entry_date <> '2026-03-10'))
  = (SELECT h FROM t_c6.hash_before));
SELECT 'fim' AS marcador;
