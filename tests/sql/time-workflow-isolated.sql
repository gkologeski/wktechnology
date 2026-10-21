-- Prova isolada do ciclo 3 do TechProjects (apontamento, cronômetro, envio/aprovação, aceite,
-- fechamento, alocação, modelos e horas sem horário do Jibble).
-- Roda SOMENTE no banco descartável do harness via
--   bash tests/sql/time-workflow-isolated.sh drizzle/migrations/0173_*.sql drizzle/migrations/0174_*.sql
-- Asserções de acesso rodam como `authenticated` com claims de JWT (nunca service_role).
\set ON_ERROR_STOP 1
\set QUIET 1
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.__isolated_marker WHERE id = 1 AND label = 'techerp-isolated-harness') THEN
    RAISE EXCEPTION 'recusado: banco sem marcador do harness';
  END IF;
END $$;

DROP SCHEMA IF EXISTS t_c3 CASCADE;
CREATE SCHEMA t_c3;
GRANT USAGE ON SCHEMA t_c3 TO authenticated, anon;
CREATE FUNCTION t_c3.ok(p_name text, p_cond boolean) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  IF p_cond IS DISTINCT FROM true THEN RAISE EXCEPTION 'FALHOU: %', p_name; END IF;
  RAISE NOTICE 'ok: %', p_name; RETURN 'ok';
END $$;
CREATE FUNCTION t_c3.err(p_sql text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN EXECUTE p_sql; RETURN 'NO ERROR';
EXCEPTION WHEN others THEN RETURN SQLERRM; END $$;
CREATE FUNCTION t_c3.as_user(p_uid uuid, p_session uuid DEFAULT NULL) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated', 'session_id', p_session)::text, true) $$;
CREATE TABLE t_c3.kv (k text PRIMARY KEY, v text);
GRANT ALL ON t_c3.kv TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA t_c3 TO authenticated;
CREATE FUNCTION t_c3.get(p text) RETURNS text LANGUAGE sql AS $$ SELECT v FROM t_c3.kv WHERE k = p $$;
CREATE FUNCTION t_c3.put(p text, v text) RETURNS text LANGUAGE sql AS $$
  INSERT INTO t_c3.kv VALUES (p, v) ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v RETURNING v $$;
GRANT EXECUTE ON FUNCTION t_c3.get(text), t_c3.put(text, text) TO authenticated;
-- Leitura privilegiada só para conferir resultado (nunca usada como prova de acesso).
CREATE FUNCTION t_c3.entry(p uuid) RETURNS public.project_time_entries LANGUAGE sql SECURITY DEFINER AS $$
  SELECT * FROM public.project_time_entries WHERE id = p $$;
GRANT EXECUTE ON FUNCTION t_c3.entry(uuid) TO authenticated;

\set A '''aaaaaaaa-0000-4000-8000-00000000000a'''
\set B '''aaaaaaaa-0000-4000-8000-00000000000b'''
\set U1 '''10000000-0000-4000-8000-000000000001'''
\set U2 '''10000000-0000-4000-8000-000000000002'''
\set U3 '''10000000-0000-4000-8000-000000000003'''
\set U4 '''10000000-0000-4000-8000-000000000004'''
\set U5 '''10000000-0000-4000-8000-000000000005'''
\set U6 '''10000000-0000-4000-8000-000000000006'''
\set U7 '''10000000-0000-4000-8000-000000000007'''
\set P1 '''83000000-0000-4000-8000-000000000001'''
\set P2 '''83000000-0000-4000-8000-000000000002'''
\set PB '''83000000-0000-4000-8000-0000000000b1'''
\set T1 '''84000000-0000-4000-8000-000000000001'''
\set T2 '''84000000-0000-4000-8000-000000000002'''
\set PE2 '''85000000-0000-4000-8000-000000000002'''
\set PE7 '''85000000-0000-4000-8000-000000000007'''
\set IMP '''86000000-0000-4000-8000-000000000001'''
\set SC '''87000000-0000-4000-8000-000000000001'''
\set SCB '''87000000-0000-4000-8000-0000000000b1'''
\set VA '''88000000-0000-4000-8000-000000000003'''
\set VA2 '''88000000-0000-4000-8000-000000000002'''

-- ------------------------------------------------------------------ permissões (chaves reais do catálogo)
INSERT INTO public.permission_sets (id, module, name) VALUES
 ('20000000-0000-4000-8000-0000000000c3','techprojects','[ISO] Horas próprias'),
 ('20000000-0000-4000-8000-0000000000c4','techprojects','[ISO] Fechamento de horas') ON CONFLICT DO NOTHING;
INSERT INTO public.permission_set_items (set_id, permission_key)
SELECT '20000000-0000-4000-8000-0000000000c3', p.key FROM public.permissions p
 WHERE p.key IN ('techprojects.time_entries.create.own','techprojects.time_entries.view.own','techprojects.time_entries.update.own',
                 'techprojects.projects.view.own') ON CONFLICT DO NOTHING;
INSERT INTO public.permission_set_items (set_id, permission_key)
SELECT '20000000-0000-4000-8000-0000000000c4', p.key FROM public.permissions p
 WHERE p.key IN ('techprojects.timesheet_closing.manage.workspace','techprojects.projects.view.workspace') ON CONFLICT DO NOTHING;
INSERT INTO public.job_role_sets (role_id, set_id) VALUES
 ('30000000-0000-4000-8000-0000000000a1','20000000-0000-4000-8000-0000000000c3'),
 ('30000000-0000-4000-8000-0000000000a2','20000000-0000-4000-8000-0000000000c3'),
 ('30000000-0000-4000-8000-0000000000a3','20000000-0000-4000-8000-0000000000c3'),
 ('30000000-0000-4000-8000-0000000000a3','20000000-0000-4000-8000-0000000000c4') ON CONFLICT DO NOTHING;
SELECT t_c3.ok('chaves novas de fechamento/reabertura existem no catálogo',
  (SELECT count(*) FROM public.permissions WHERE key IN ('techprojects.timesheet_closing.manage.workspace','techprojects.timesheet_reopen.manage.workspace')) = 2);
SELECT t_c3.ok('u2 aponta só o próprio; u4 fecha competência mas não reabre',
  public.user_has_permission(:U2, :A, 'techprojects.time_entries.create.own')
  AND NOT public.user_has_permission(:U2, :A, 'techprojects.time_entries.view.workspace')
  AND public.user_has_permission(:U4, :A, 'techprojects.timesheet_closing.manage.workspace')
  AND NOT public.user_has_permission(:U4, :A, 'techprojects.timesheet_reopen.manage.workspace')
  AND public.user_has_permission(:U1, :A, 'techprojects.timesheet_reopen.manage.workspace'));

-- ------------------------------------------------------------------ fixtures sintéticas
INSERT INTO public.projects (id, workspace_id, owner_id, name, status) VALUES
 (:P1, :A, :U1, '[ISO] Projeto horas', 'active'), (:P2, :A, :U1, '[ISO] Projeto sem vínculo', 'active'),
 (:PB, :B, :U6, '[ISO] Projeto SegredoB', 'active');
INSERT INTO public.project_tasks (id, workspace_id, project_id, title) VALUES
 (:T1, :A, :P1, '[ISO] Desenvolvimento'), (:T2, :A, :P1, '[ISO] Reunião');
INSERT INTO public.project_members (workspace_id, project_id, user_id, role_in_project) VALUES
 (:A, :P1, :U2, 'contributor'), (:A, :P1, :U7, 'contributor'), (:A, :P1, :U3, 'contributor');
INSERT INTO public.people (id, owner_id, workspace_id, full_name, profile_id) VALUES
 (:PE2, :U1, :A, '[ISO] Pessoa Dois', :U2);
INSERT INTO public.people (id, owner_id, workspace_id, full_name, profile_id, work_schedule) VALUES
 (:PE7, :U1, :A, '[ISO] Pessoa Sete', :U7, '{"mon":28800,"tue":28800,"wed":28800,"thu":28800,"fri":21600,"tz":"America/Sao_Paulo"}');
SELECT set_config('app.clockify_import', 'on', false) \g /dev/null
INSERT INTO public.project_time_entries (id, workspace_id, project_id, user_id, started_at, stopped_at, hours, entry_date, status, source, external_id, locked_at)
VALUES (:IMP, :A, :P1, :U2, '2026-03-03 12:00:00+00', '2026-03-03 13:30:15+00', 1.504, '2026-03-03', 'locked', 'import', 'iso-imp-1', now());
SELECT set_config('app.clockify_import', 'off', false) \g /dev/null
CREATE TABLE t_c3.hash_before AS
SELECT md5(string_agg(concat_ws('|', id, project_id, user_id, started_at, stopped_at, hours, duration_minutes, status, source, external_id, locked_at, updated_at), ',' ORDER BY id)) AS h
  FROM public.project_time_entries WHERE source = 'import';
SELECT t_c3.ok('importado não ganha tipo/segundos novos (não reescrito)',
  (SELECT entry_kind IS NULL AND duration_seconds IS NULL AND revision = 0 FROM public.project_time_entries WHERE id = :IMP));
SELECT t_c3.ok('jornada inválida é recusada',
  t_c3.err(format('update public.people set work_schedule = %L where id = %L', '{"mon":-5}', :PE2)) ~ 'people_work_schedule_valid');

-- ------------------------------------------------------------------ 1. política versionada
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c3.as_user(:U4) \g /dev/null
SELECT t_c3.ok('não-admin não altera a política',
  t_c3.err(format('select public.project_time_policy_save(%L, %L, null)', :A, '{"max_daily_seconds":36000}')) ~ 'administradores');
COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c3.as_user(:U1) \g /dev/null
SELECT t_c3.ok('admin salva versão 1 (limite diário 10 h)',
  (public.project_time_policy_save(:A, '{"max_daily_seconds":36000}', '[ISO] teste')->>'version') = '1');
SELECT t_c3.ok('padrão proíbe autoaprovação e exige vínculo',
  (public.project_time_policy_get(:A)->>'allow_self_approval') = 'false' AND (public.project_time_policy_get(:A)->>'track_requires_link') = 'true');
SELECT t_c3.ok('regra desconhecida é recusada',
  t_c3.err(format('select public.project_time_policy_save(%L, %L, null)', :A, '{"sem_regra":true}')) ~ 'desconhecida');
COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c3.as_user(:U6) \g /dev/null
SELECT t_c3.ok('outro workspace não lê a política de A', t_c3.err(format('select public.project_time_policy_get(%L)', :A)) ~ 'Sem acesso');
COMMIT;

-- ------------------------------------------------------------------ 2. apontamento manual e por duração
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c3.as_user(:U7) \g /dev/null
WITH x AS (INSERT INTO public.project_time_entries (workspace_id, project_id, task_id, user_id, entry_date, start_time, end_time)
  VALUES (:A, :P1, :T1, :U7, '2026-03-02', '14:00', '15:00') RETURNING id) SELECT t_c3.put('E7', id::text) FROM x \g /dev/null
COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c3.as_user(:U2) \g /dev/null
WITH x AS (INSERT INTO public.project_time_entries (workspace_id, project_id, task_id, user_id, entry_date, start_time, end_time, timezone)
  VALUES (:A, :P1, :T1, :U2, '2026-03-02', '09:00:00', '10:30:15', 'America/Sao_Paulo') RETURNING id) SELECT t_c3.put('E1', id::text) FROM x \g /dev/null
SELECT t_c3.ok('intervalo grava segundos exatos (5415 s) e tipo interval',
  (SELECT duration_seconds = 5415 AND entry_kind = 'interval' AND revision = 0 AND status = 'draft' FROM t_c3.entry(t_c3.get('E1')::uuid)));
SELECT t_c3.ok('sem vínculo no projeto não aponta',
  t_c3.err(format('insert into public.project_time_entries (workspace_id, project_id, user_id, entry_date, duration_seconds, entry_kind) values (%L,%L,%L,%L,3600,%L)',
    :A, :P2, :U2, '2026-03-02', 'duration')) ~ 'vínculo');
SELECT t_c3.ok('não cria apontamento já aprovado',
  t_c3.err(format('insert into public.project_time_entries (workspace_id, project_id, user_id, entry_date, duration_seconds, entry_kind, status, approved_at) values (%L,%L,%L,%L,3600,%L,%L,now())',
    :A, :P1, :U2, '2026-03-02', 'duration', 'approved')) ~ 'rascunho');
WITH x AS (INSERT INTO public.project_time_entries (workspace_id, project_id, task_id, user_id, entry_date, duration_seconds, entry_kind)
  VALUES (:A, :P1, :T1, :U2, '2026-03-03', 7200, 'duration') RETURNING id) SELECT t_c3.put('E2', id::text) FROM x \g /dev/null
SELECT t_c3.ok('duração sem horário: sem 00:00 inventado, 7200 s, marcada sem posição',
  (SELECT start_time IS NULL AND end_time IS NULL AND duration_seconds = 7200 AND duration_minutes = 120
      AND review_flags = ARRAY['unpositioned'] FROM t_c3.entry(t_c3.get('E2')::uuid)));
SELECT t_c3.ok('duração com horário é recusada',
  t_c3.err(format('insert into public.project_time_entries (workspace_id, project_id, user_id, entry_date, duration_seconds, entry_kind, start_time) values (%L,%L,%L,%L,3600,%L,%L)',
    :A, :P1, :U2, '2026-03-05', 'duration', '08:00')) ~ 'duração');
SELECT t_c3.ok('sobreposição de intervalo continua barrada',
  t_c3.err(format('insert into public.project_time_entries (workspace_id, project_id, user_id, entry_date, start_time, end_time) values (%L,%L,%L,%L,%L,%L)',
    :A, :P1, :U2, '2026-03-02', '10:00', '11:00')) ~ 'Já existe');
WITH x AS (INSERT INTO public.project_time_entries (workspace_id, project_id, task_id, user_id, entry_date, duration_seconds, entry_kind)
  VALUES (:A, :P1, :T2, :U2, '2026-03-04', 37000, 'duration') RETURNING id) SELECT t_c3.put('E3', id::text) FROM x \g /dev/null
SELECT t_c3.ok('acima do limite diário da política fica marcado para revisão',
  (SELECT 'daily_excess' = ANY (review_flags) FROM t_c3.entry(t_c3.get('E3')::uuid)));
SELECT t_c3.ok('profissional não aprova direto pela API/SQL',
  t_c3.err(format('update public.project_time_entries set status = %L, approved_at = now() where id = %L', 'approved', t_c3.get('E1'))) ~ 'fluxo');
SELECT t_c3.ok('não aponta em projeto de outro workspace',
  t_c3.err(format('insert into public.project_time_entries (workspace_id, project_id, user_id, entry_date, duration_seconds, entry_kind) values (%L,%L,%L,%L,3600,%L)',
    :B, :PB, :U2, '2026-03-02', 'duration')) <> 'NO ERROR');
SELECT t_c3.ok('profissional (só "ver próprios") não vê horas de outra pessoa',
  (SELECT count(*) FROM public.project_time_entries WHERE user_id = :U7) = 0
  AND (SELECT count(*) FROM public.project_time_entries WHERE user_id = :U2) = 4);
SELECT t_c3.ok('importado travado não é editável pelo profissional',
  t_c3.err(format('update public.project_time_entries set description = %L where id = %L', 'x', :IMP)) ~ 'aprovado ou travado');
COMMIT;

-- ------------------------------------------------------------------ 3. cronômetro
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c3.as_user(:U2) \g /dev/null
SELECT t_c3.put('S1', public.project_timer_start(:A, :P1, :T1, '[ISO] cronômetro', true, 'America/New_York', 'req-1')->>'id') \g /dev/null
SELECT t_c3.ok('repetir o mesmo pedido devolve a mesma sessão',
  (public.project_timer_start(:A, :P1, :T1, '[ISO] cronômetro', true, 'America/New_York', 'req-1')->>'id') = t_c3.get('S1'));
SELECT t_c3.ok('segunda aba com outro pedido recebe conflito e a sessão ativa',
  (SELECT (j->>'conflict') = 'true' AND j->>'id' = t_c3.get('S1') FROM (SELECT public.project_timer_start(:A, :P1, :T1, null, true, 'America/New_York', 'req-2') j) x));
SELECT t_c3.ok('versão antiga (outra aba) não pausa', t_c3.err(format('select public.project_timer_pause(%L, true, 99)', t_c3.get('S1'))) ~ 'TIMER_STALE');
SELECT t_c3.ok('pausa paga', (public.project_timer_pause(t_c3.get('S1')::uuid, true, 1)->>'state') = 'paused');
SELECT t_c3.ok('clique duplo na pausa é idempotente', (public.project_timer_pause(t_c3.get('S1')::uuid, true, 1)->>'idempotent') = 'true');
SELECT t_c3.ok('retoma', (public.project_timer_resume(t_c3.get('S1')::uuid, 2)->>'state') = 'running');
SELECT t_c3.ok('troca de atividade sem parar', (public.project_timer_switch(t_c3.get('S1')::uuid, :T2, 3)->>'task_id') = :T2);
COMMIT;
-- Trechos determinísticos (virada de dia + início do horário de verão em Nova York em 08/03/2026).
DELETE FROM public.project_timer_segments WHERE session_id = t_c3.get('S1')::uuid;
INSERT INTO public.project_timer_segments (workspace_id, session_id, kind, task_id, started_at, ended_at) VALUES
 (:A, t_c3.get('S1')::uuid, 'work', :T1, '2026-03-08 04:00:00+00', '2026-03-08 06:00:00+00'),
 (:A, t_c3.get('S1')::uuid, 'break_paid', :T1, '2026-03-08 06:00:00+00', '2026-03-08 06:30:00+00'),
 (:A, t_c3.get('S1')::uuid, 'work', :T2, '2026-03-08 06:30:00+00', '2026-03-08 08:00:00+00');
UPDATE public.project_timer_sessions SET started_at = '2026-03-08 04:00:00+00', state = 'running' WHERE id = t_c3.get('S1')::uuid;
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c3.as_user(:U2) \g /dev/null
SELECT t_c3.put('stop1', public.project_timer_stop(t_c3.get('S1')::uuid, null, false)::text) \g /dev/null
SELECT t_c3.ok('cronômetro vira 3 apontamentos (meia-noite local divide) e pausa paga não é hora produtiva',
  (SELECT count(*) = 3 AND sum(duration_seconds) = 12600 FROM public.project_time_entries WHERE timer_session_id = t_c3.get('S1')::uuid));
SELECT t_c3.ok('trecho antes da meia-noite fica no dia 07 (23:00–24:00) com 3600 s',
  EXISTS (SELECT 1 FROM public.project_time_entries WHERE timer_session_id = t_c3.get('S1')::uuid AND entry_date = '2026-03-07'
           AND start_time = '23:00' AND end_time = '24:00:00' AND duration_seconds = 3600));
SELECT t_c3.ok('na troca de horário vale o UTC real: 01:30→04:00 local = 5400 s, não 9000',
  EXISTS (SELECT 1 FROM public.project_time_entries WHERE timer_session_id = t_c3.get('S1')::uuid AND task_id = :T2
           AND entry_date = '2026-03-08' AND duration_seconds = 5400 AND duration_minutes = 90 AND timezone = 'America/New_York'));
SELECT t_c3.ok('pausa paga fica registrada como presença (1800 s)', (t_c3.get('stop1')::jsonb->>'paid_break_seconds')::int = 1800);
SELECT t_c3.ok('parar de novo é idempotente e não duplica',
  (public.project_timer_stop(t_c3.get('S1')::uuid, null, false)->>'idempotent') = 'true'
  AND (SELECT count(*) FROM public.project_time_entries WHERE timer_session_id = t_c3.get('S1')::uuid) = 3);
SELECT t_c3.ok('cronômetro sem vínculo no projeto é recusado',
  t_c3.err(format('select public.project_timer_start(%L, %L, null, null, true, %L, %L)', :A, :P2, 'America/Sao_Paulo', 'req-x')) ~ 'vínculo');
SELECT t_c3.put('S2', public.project_timer_start(:A, :P1, :T1, null, true, 'America/New_York', 'req-3')->>'id') \g /dev/null
COMMIT;
DELETE FROM public.project_timer_segments WHERE session_id = t_c3.get('S2')::uuid;
INSERT INTO public.project_timer_segments (workspace_id, session_id, kind, task_id, started_at, ended_at) VALUES
 (:A, t_c3.get('S2')::uuid, 'work', :T1, '2026-11-01 05:30:00+00', '2026-11-01 06:10:00+00');
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c3.as_user(:U2) \g /dev/null
SELECT public.project_timer_stop(t_c3.get('S2')::uuid, null, false) \g /dev/null
SELECT t_c3.ok('fim do horário de verão (01:30 EDT→01:10 EST): sem horário local inventado, UTC e 2400 s preservados',
  EXISTS (SELECT 1 FROM public.project_time_entries WHERE timer_session_id = t_c3.get('S2')::uuid AND start_time IS NULL AND end_time IS NULL
           AND duration_seconds = 2400 AND 'dst_ambiguous' = ANY (review_flags) AND started_at = '2026-11-01 05:30:00+00'));
COMMIT;
INSERT INTO public.view_as_sessions (id, workspace_id, admin_id, target_user_id, mode, read_only, nonce, session_id, expires_at)
VALUES (gen_random_uuid(), :A, :U1, :U2, 'role', true, 'iso-c3-2', :VA2, now() + interval '1 hour'),
       (gen_random_uuid(), :A, :U1, :U3, 'role', true, 'iso-c3-3', :VA, now() + interval '1 hour');
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c3.as_user(:U2, :VA2) \g /dev/null
SELECT t_c3.ok('Ver como não liga cronômetro',
  t_c3.err(format('select public.project_timer_start(%L, %L, null, null, true, %L, %L)', :A, :P1, 'America/Sao_Paulo', 'req-va')) ~ 'somente leitura');
SELECT t_c3.ok('Ver como não grava apontamento',
  t_c3.err(format('insert into public.project_time_entries (workspace_id, project_id, user_id, entry_date, duration_seconds, entry_kind) values (%L,%L,%L,%L,3600,%L)',
    :A, :P1, :U2, '2026-03-06', 'duration')) <> 'NO ERROR');
COMMIT;

-- ------------------------------------------------------------------ 4. envio e aprovação
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c3.as_user(:U2) \g /dev/null
SELECT t_c3.ok('sem líder aprovador o envio fica bloqueado com pendência acionável',
  EXISTS (SELECT 1 FROM jsonb_array_elements(public.project_timesheet_preview(:A, '2026-03-02', '2026-03-08')->'blockers') b WHERE b->>'code' = 'no_approver'));
COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c3.as_user(:U3) \g /dev/null
SELECT t_c3.ok('quem não é gestor não nomeia aprovador',
  t_c3.err(format('select public.project_time_approver_set(%L,%L,%L,null,null,null,null,null)', :P1, :U3, 'approver')) ~ 'gestores');
COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c3.as_user(:U1) \g /dev/null
SELECT t_c3.put('R3', public.project_time_approver_set(:P1, :U3, 'approver', null, '2026-01-01', null, null, null)::text) \g /dev/null
SELECT t_c3.ok('ninguém é aprovador das próprias horas',
  t_c3.err(format('select public.project_time_approver_set(%L,%L,%L,%L,null,null,null,null)', :P1, :U2, 'approver', :U2)) ~ 'próprias');
SELECT t_c3.ok('admin não aprova automaticamente sem ser aprovador nomeado', NOT public.project_time_can_approve(:U1, :P1, :U2));
COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c3.as_user(:U2) \g /dev/null
SELECT t_c3.put('pv', public.project_timesheet_preview(:A, '2026-03-02', '2026-03-08')::text) \g /dev/null
SELECT t_c3.ok('prévia: 6 rascunhos, sem bloqueio, alerta de excesso e de duração sem posição',
  (t_c3.get('pv')::jsonb->>'entry_count')::int = 6 AND jsonb_array_length(t_c3.get('pv')::jsonb->'blockers') = 0
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(t_c3.get('pv')::jsonb->'warnings') w WHERE w->>'code' = 'daily_excess')
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(t_c3.get('pv')::jsonb->'warnings') w WHERE w->>'code' = 'unpositioned'));
SELECT t_c3.ok('envio com prévia desatualizada é recusado',
  t_c3.err(format('select public.project_timesheet_submit(%L,%L,%L,%L,null)', :A, '2026-03-02', '2026-03-08', 'hash-velho')) ~ 'SUBMIT_STALE');
SELECT t_c3.ok('envio atômico versão 1 com 6 itens',
  (SELECT (j->>'version')::int = 1 AND (j->>'entries')::int = 6
     FROM (SELECT public.project_timesheet_submit(:A, '2026-03-02', '2026-03-08', t_c3.get('pv')::jsonb->>'hash', 'America/Sao_Paulo') j) x));
SELECT t_c3.ok('itens enviados ficam enviados', (SELECT status FROM t_c3.entry(t_c3.get('E1')::uuid)) = 'submitted');
UPDATE public.project_time_entries SET description = '[ISO] editado após envio' WHERE id = t_c3.get('E2')::uuid;
SELECT t_c3.ok('editar após o envio volta a rascunho, sobe a revisão e invalida o item',
  (SELECT status = 'draft' AND revision = 1 AND submission_id IS NULL FROM t_c3.entry(t_c3.get('E2')::uuid))
  AND (SELECT decision FROM public.project_timesheet_submission_items WHERE time_entry_id = t_c3.get('E2')::uuid ORDER BY decided_at DESC NULLS LAST LIMIT 1) = 'invalidated');
SELECT t_c3.ok('reenvio do mesmo período gera versão 2',
  (public.project_timesheet_submit(:A, '2026-03-02', '2026-03-08', null, null)->>'version')::int = 2);
COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c3.as_user(:U7) \g /dev/null
SELECT public.project_timesheet_submit(:A, '2026-03-02', '2026-03-08', null, null) \g /dev/null
SELECT t_c3.ok('par sem papel de aprovador não decide',
  t_c3.err(format('select public.project_timesheet_decide(%L, %L, %L, null)', :A,
    json_build_array(json_build_object('item_id', (SELECT id FROM public.project_timesheet_submission_items WHERE time_entry_id = t_c3.get('E7')::uuid AND decision = 'pending'))), 'approve')) ~ 'autoriza');
SELECT t_c3.ok('fila do par vem vazia', (public.project_time_pending_for_me(:A, null, null, 100, 0)->>'total')::int = 0);
COMMIT;
CREATE FUNCTION t_c3.item(p_entry uuid) RETURNS uuid LANGUAGE sql SECURITY DEFINER AS $$
  SELECT id FROM public.project_timesheet_submission_items WHERE time_entry_id = p_entry ORDER BY (decision = 'pending') DESC, decided_at DESC NULLS LAST LIMIT 1 $$;
GRANT EXECUTE ON FUNCTION t_c3.item(uuid) TO authenticated;
CREATE FUNCTION t_c3.old_item(p_entry uuid) RETURNS uuid LANGUAGE sql SECURITY DEFINER AS $$
  SELECT id FROM public.project_timesheet_submission_items WHERE time_entry_id = p_entry AND decision = 'invalidated' LIMIT 1 $$;
GRANT EXECUTE ON FUNCTION t_c3.old_item(uuid) TO authenticated;
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c3.as_user(:U3) \g /dev/null
SELECT t_c3.ok('fila do líder: 7 itens pendentes (6 de u2 + 1 de u7)', (public.project_time_pending_for_me(:A, :P1, null, 100, 0)->>'total')::int = 7);
SELECT t_c3.ok('fila não expõe custo/tarifa', NOT (public.project_time_pending_for_me(:A, :P1, null, 1, 0)::text ~ 'hourly_rate|cost_rate|bill_rate'));
SELECT t_c3.ok('revisão divergente da lida não aprova (conflito de versão)',
  t_c3.err(format('select public.project_timesheet_decide(%L, %L, %L, null)', :A,
    json_build_array(json_build_object('item_id', t_c3.item(t_c3.get('E1')::uuid), 'revision', 99)), 'approve')) ~ 'DECIDE_STALE');
SELECT t_c3.ok('item invalidado por edição não aprova',
  t_c3.err(format('select public.project_timesheet_decide(%L, %L, %L, null)', :A,
    json_build_array(json_build_object('item_id', t_c3.old_item(t_c3.get('E2')::uuid))), 'approve')) ~ 'DECIDE_STALE');
SELECT t_c3.ok('líder aprova E1 (revisão lida 0)',
  (public.project_timesheet_decide(:A, json_build_array(json_build_object('item_id', t_c3.item(t_c3.get('E1')::uuid), 'revision', 0))::jsonb, 'approve', null)->>'decided')::int = 1);
SELECT t_c3.ok('devolução exige motivo',
  t_c3.err(format('select public.project_timesheet_decide(%L, %L, %L, null)', :A,
    json_build_array(json_build_object('item_id', t_c3.item(t_c3.get('E3')::uuid))), 'reject')) ~ 'motivo');
SELECT public.project_timesheet_decide(:A, json_build_array(json_build_object('item_id', t_c3.item(t_c3.get('E3')::uuid)))::jsonb, 'reject', '[ISO] dia acima do limite') \g /dev/null
SELECT t_c3.ok('devolvido com motivo', (SELECT status = 'rejected' AND reject_reason = '[ISO] dia acima do limite' FROM t_c3.entry(t_c3.get('E3')::uuid)));
SELECT t_c3.ok('líder vê horas da equipe do projeto que aprova', (SELECT count(*) FROM public.project_time_entries WHERE user_id = :U7) >= 1);
COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c3.as_user(:U2) \g /dev/null
SELECT t_c3.ok('aprovado não é editável sem reabrir',
  t_c3.err(format('update public.project_time_entries set description = %L where id = %L', 'x', t_c3.get('E1'))) ~ 'reabra a aprovação');
UPDATE public.project_time_entries SET duration_seconds = 30000 WHERE id = t_c3.get('E3')::uuid;
SELECT t_c3.ok('corrigido após devolução: rascunho, sem alerta de excesso',
  (SELECT status = 'draft' AND revision = 1 AND NOT ('daily_excess' = ANY (coalesce(review_flags, '{}'))) FROM t_c3.entry(t_c3.get('E3')::uuid)));
SELECT t_c3.ok('reenvio após devolução gera versão 3', (public.project_timesheet_submit(:A, '2026-03-02', '2026-03-08', null, null)->>'version')::int = 3);
COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c3.as_user(:U1) \g /dev/null
SELECT t_c3.ok('admin não exclui apontamento aprovado',
  t_c3.err(format('delete from public.project_time_entries where id = %L', t_c3.get('E1'))) ~ 'não pode ser excluído');
SELECT t_c3.put('R2', public.project_time_approver_set(:P1, :U2, 'approver', null, '2026-01-01', null, null, null)::text) \g /dev/null
COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c3.as_user(:U2) \g /dev/null
SELECT t_c3.ok('aprovador nomeado não aprova as próprias horas (autoaprovação proibida)',
  t_c3.err(format('select public.project_timesheet_decide(%L, %L, %L, null)', :A,
    json_build_array(json_build_object('item_id', t_c3.item(t_c3.get('E3')::uuid))), 'approve')) ~ 'autoriza');
SELECT t_c3.ok('mas aprova o par', public.project_time_can_approve(:U2, :P1, :U7));
COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c3.as_user(:U1) \g /dev/null
SELECT public.project_time_approver_revoke(t_c3.get('R2')::uuid, '[ISO] fim do teste') \g /dev/null
SELECT t_c3.put('D4', public.project_time_approver_set(:P1, :U4, 'approver', null, current_date, current_date + 7, '[ISO] férias do líder', t_c3.get('R3')::uuid)::text) \g /dev/null
SELECT t_c3.ok('delegação exige fim e motivo',
  t_c3.err(format('select public.project_time_approver_set(%L,%L,%L,null,null,null,null,%L)', :P1, :U7, 'approver', t_c3.get('R3'))) ~ 'data final');
COMMIT;
SELECT t_c3.ok('delegado vigente aprova', public.project_time_can_approve(:U4, :P1, :U2));
INSERT INTO public.job_role_permission_overrides (role_id, workspace_id, permission_key, effect, created_by)
VALUES ('30000000-0000-4000-8000-0000000000a3', :A, 'techprojects.time_entries.approve.workspace', 'deny', :U1);
SELECT t_c3.ok('negação no cargo vence a delegação', NOT public.project_time_can_approve(:U4, :P1, :U2));
DELETE FROM public.job_role_permission_overrides WHERE role_id = '30000000-0000-4000-8000-0000000000a3' AND permission_key = 'techprojects.time_entries.approve.workspace';
INSERT INTO public.project_time_approvers (workspace_id, project_id, role, user_id) VALUES (:A, :P1, 'approver', :U5);
SELECT t_c3.ok('aprovador com membro inativo não aprova', NOT public.project_time_can_approve(:U5, :P1, :U2));
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c3.as_user(:U1) \g /dev/null
SELECT public.project_time_approver_revoke(t_c3.get('R3')::uuid, '[ISO] troca de líder') \g /dev/null
COMMIT;
SELECT t_c3.ok('revogar o líder encerra a delegação', NOT public.project_time_can_approve(:U4, :P1, :U2) AND NOT public.project_time_can_approve(:U3, :P1, :U2));
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c3.as_user(:U1) \g /dev/null
SELECT t_c3.put('R3b', public.project_time_approver_set(:P1, :U3, 'approver', null, '2026-01-01', null, null, null)::text) \g /dev/null
COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c3.as_user(:U6) \g /dev/null
SELECT t_c3.ok('outro workspace não decide itens de A',
  t_c3.err(format('select public.project_timesheet_decide(%L, %L, %L, null)', :A,
    json_build_array(json_build_object('item_id', t_c3.item(t_c3.get('E3')::uuid))), 'approve')) ~ 'membros ativos');
SELECT t_c3.ok('outro workspace não vê apontamentos de A', (SELECT count(*) FROM public.project_time_entries WHERE workspace_id = :A) = 0);
COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c3.as_user(:U3, :VA) \g /dev/null
SELECT t_c3.ok('Ver como não aprova',
  t_c3.err(format('select public.project_timesheet_decide(%L, %L, %L, null)', :A,
    json_build_array(json_build_object('item_id', t_c3.item(t_c3.get('E3')::uuid))), 'approve')) ~ 'somente leitura');
COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c3.as_user(:U3) \g /dev/null
SELECT t_c3.put('pend', public.project_time_pending_for_me(:A, :P1, null, 500, 0)::text) \g /dev/null
SELECT t_c3.ok('líder aprova em lote o restante (6 itens)',
  (public.project_timesheet_decide(:A, (SELECT jsonb_agg(jsonb_build_object('item_id', x->>'item_id', 'revision', (x->>'revision')::int))
     FROM jsonb_array_elements(t_c3.get('pend')::jsonb->'items') x), 'approve', null)->>'decided')::int = 6);
SELECT t_c3.ok('envio final ficou aprovado', (SELECT status FROM public.project_timesheet_submissions WHERE user_id = :U2 ORDER BY version DESC LIMIT 1) = 'approved');
COMMIT;

-- ------------------------------------------------------------------ 5. aceite manual do cliente
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c3.as_user(:U3) \g /dev/null
SELECT t_c3.ok('aceite só quando habilitado no projeto',
  t_c3.err(format('select public.project_client_acceptance_record(%L,%L,%L,%L,%L,null,null,%L,null)', :P1, '2026-03-02', '2026-03-08', 'accepted', 'Cliente ISO', 'e-mail de aceite recebido')) ~ 'não está habilitado');
COMMIT;
UPDATE public.projects SET client_acceptance_required = true WHERE id = :P1;
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c3.as_user(:U2) \g /dev/null
SELECT t_c3.ok('profissional não registra aceite do cliente',
  t_c3.err(format('select public.project_client_acceptance_record(%L,%L,%L,%L,%L,null,null,%L,null)', :P1, '2026-03-02', '2026-03-08', 'accepted', 'Cliente ISO', 'e-mail de aceite recebido')) ~ 'aprovadores');
COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c3.as_user(:U3) \g /dev/null
SELECT t_c3.ok('evidência curta é recusada',
  t_c3.err(format('select public.project_client_acceptance_record(%L,%L,%L,%L,%L,null,null,%L,null)', :P1, '2026-03-02', '2026-03-08', 'accepted', 'Cliente ISO', 'ok')) ~ 'evidência');
SELECT t_c3.put('ACC', public.project_client_acceptance_record(:P1, '2026-03-02', '2026-03-08', 'accepted', '[ISO] Cliente', 'cliente@techerp-test.invalid', null,
  '[ISO] Aceite por e-mail de 09/03 anexado ao chamado', 'chamado-iso-1')->>'acceptance_id') \g /dev/null
SELECT t_c3.ok('aceite manual cobre só horas aprovadas (7), não o importado',
  (SELECT entry_count = 7 AND method = 'manual_evidence' FROM public.project_client_acceptances WHERE id = t_c3.get('ACC')::uuid)
  AND (SELECT client_acceptance_id FROM t_c3.entry(:IMP)) IS NULL);
COMMIT;

-- ------------------------------------------------------------------ 6. fechamento e reabertura
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c3.as_user(:U2) \g /dev/null
SELECT t_c3.ok('sem permissão não fecha', t_c3.err(format('select public.project_period_close_preview(%L,%L,%L,null,%L,%L)', :A, 'project', :P1, '2026-03-02', '2026-03-08')) ~ 'fechar');
WITH x AS (INSERT INTO public.project_time_entries (workspace_id, project_id, task_id, user_id, entry_date, duration_seconds, entry_kind)
  VALUES (:A, :P1, :T1, :U2, '2026-03-06', 1800, 'duration') RETURNING id) SELECT t_c3.put('E8', id::text) FROM x \g /dev/null
COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c3.as_user(:U4) \g /dev/null
SELECT t_c3.ok('pendência em rascunho bloqueia o fechamento',
  t_c3.err(format('select public.project_period_close(%L,%L,%L,null,%L,%L,%L)', :A, 'project', :P1, '2026-03-02', '2026-03-08', 'America/Sao_Paulo')) ~ 'CLOSE_BLOCKED');
COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c3.as_user(:U1) \g /dev/null
DELETE FROM public.project_time_entries WHERE id = t_c3.get('E8')::uuid;
COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c3.as_user(:U4) \g /dev/null
SELECT t_c3.ok('prévia do fechamento: 7 elegíveis, 1 importado fora',
  (SELECT (j->>'eligible')::int = 7 AND (j->>'imported_locked')::int = 1 AND (j->>'pending')::int = 0
     FROM (SELECT public.project_period_close_preview(:A, 'project', :P1, null, '2026-03-02', '2026-03-08') j) x));
SELECT t_c3.put('CL', public.project_period_close(:A, 'project', :P1, null, '2026-03-02', '2026-03-08', 'America/Sao_Paulo')->>'closing_id') \g /dev/null
SELECT t_c3.ok('competência fechada com snapshot de 7 apontamentos; importado excluído e intocado',
  (SELECT entry_count = 7 AND excluded_import_count = 1 AND jsonb_array_length(entries_snapshot) = 7 FROM public.project_period_closings WHERE id = t_c3.get('CL')::uuid)
  AND (SELECT period_closing_id IS NULL AND status = 'locked' FROM t_c3.entry(:IMP)));
SELECT t_c3.ok('fechamento sobreposto é recusado',
  t_c3.err(format('select public.project_period_close(%L,%L,%L,null,%L,%L,%L)', :A, 'project', :P1, '2026-03-05', '2026-03-10', 'America/Sao_Paulo')) ~ 'CLOSE_BLOCKED');
SELECT t_c3.ok('reabrir exige permissão explícita', t_c3.err(format('select public.project_period_reopen(%L,%L)', t_c3.get('CL'), '[ISO] motivo longo o suficiente')) ~ 'permissão explícita');
COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c3.as_user(:U3) \g /dev/null
SELECT t_c3.ok('fechado não reabre aprovação', t_c3.err(format('select public.project_time_reopen_approval(%L,%L,%L)', :A, ARRAY[t_c3.get('E1')], '[ISO] corrigir')) ~ 'competência fechada');
SELECT t_c3.ok('fechado não anula aceite', t_c3.err(format('select public.project_client_acceptance_void(%L,%L)', t_c3.get('ACC'), '[ISO] erro')) ~ 'competência fechada');
COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c3.as_user(:U1) \g /dev/null
SELECT t_c3.ok('fechado não muda nem pelo admin via SQL comum',
  t_c3.err(format('update public.project_time_entries set billable = false where id = %L', t_c3.get('E1'))) ~ 'competência fechada');
SELECT t_c3.ok('reabrir exige motivo', t_c3.err(format('select public.project_period_reopen(%L,%L)', t_c3.get('CL'), 'curto')) ~ 'motivo');
SELECT t_c3.ok('admin reabre com motivo', (public.project_period_reopen(t_c3.get('CL')::uuid, '[ISO] correção pedida pelo cliente')->>'reopened_entries')::int = 7);
SELECT t_c3.ok('reabertura fica na trilha', EXISTS (SELECT 1 FROM public.project_time_workflow_events WHERE entity_id = t_c3.get('CL')::uuid AND action = 'reopened'));
COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c3.as_user(:U3) \g /dev/null
SELECT t_c3.ok('com aceite registrado, reabrir aprovação pede anular o aceite',
  t_c3.err(format('select public.project_time_reopen_approval(%L,%L,%L)', :A, ARRAY[t_c3.get('E1')], '[ISO] corrigir')) ~ 'anule o aceite');
SELECT public.project_client_acceptance_void(t_c3.get('ACC')::uuid, '[ISO] cliente pediu ajuste') \g /dev/null
SELECT t_c3.ok('reabrir aprovação volta a rascunho', (public.project_time_reopen_approval(:A, ARRAY[t_c3.get('E1')::uuid], '[ISO] corrigir')->>'reopened')::int = 1
  AND (SELECT status = 'draft' AND approved_at IS NULL FROM t_c3.entry(t_c3.get('E1')::uuid)));
COMMIT;

-- ------------------------------------------------------------------ 7. alocação com vigência e capacidade
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001"}', false) \g /dev/null
INSERT INTO public.people_allocations (workspace_id, person_id, project_id, allocation_pct, starts_at, ends_at, status)
VALUES (:A, :PE7, :P1, 80, '2026-03-01', '2026-03-31', 'active');
SELECT t_c3.ok('sobrealocação sem justificativa é recusada',
  t_c3.err(format('insert into public.people_allocations (workspace_id, person_id, project_id, allocation_pct, starts_at, ends_at, status) values (%L,%L,%L,40,%L,%L,%L)',
    :A, :PE7, :P2, '2026-03-15', '2026-04-15', 'active')) ~ 'justificativa');
INSERT INTO public.people_allocations (workspace_id, person_id, project_id, allocation_pct, starts_at, ends_at, status, overbook_justification)
VALUES (:A, :PE7, :P2, 40, '2026-03-15', '2026-04-15', 'active', '[ISO] cobertura de férias aprovada');
SELECT t_c3.ok('alocação em projeto de outro workspace é recusada',
  t_c3.err(format('insert into public.people_allocations (workspace_id, person_id, project_id, allocation_pct, status) values (%L,%L,%L,10,%L)', :A, :PE7, :PB, 'active')) ~ 'fora do workspace');
SELECT t_c3.ok('encerrar alocação sobrealocada nunca é bloqueado',
  t_c3.err(format('update public.people_allocations set status = %L where person_id = %L and project_id = %L', 'ended', :PE7, :P2)) = 'NO ERROR');
INSERT INTO public.people_allocations (workspace_id, person_id, project_id, allocation_pct, starts_at, ends_at, status)
VALUES (:A, :PE2, :P2, 50, '2026-03-05', '2026-03-06', 'active');
SELECT t_c3.ok('alocação vigente libera apontar só dentro da vigência',
  public.project_time_can_track(:U2, :P2, '2026-03-05') AND NOT public.project_time_can_track(:U2, :P2, '2026-03-07'));
SELECT set_config('request.jwt.claims', '', false) \g /dev/null
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c3.as_user(:U1) \g /dev/null
SELECT t_c3.ok('consulta de capacidade mostra 80% e jornada configurada',
  (SELECT (j->>'max_pct')::numeric = 80 AND (j->>'schedule_configured')::boolean FROM (SELECT public.people_allocation_capacity(:PE7, '2026-03-01', '2026-03-31', null) j) x));
COMMIT;

-- ------------------------------------------------------------------ 8. modelos de entrega por serviço
INSERT INTO public.service_catalog (id, owner_id, workspace_id, name, category, active) VALUES
 (:SC, :U1, :A, '[ISO] Fábrica', 'Fábrica de Software', true), (:SCB, :U6, :B, '[ISO] Serviço B', 'X', true);
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c3.as_user(:U2) \g /dev/null
SELECT t_c3.ok('profissional não configura modelos',
  t_c3.err(format('select public.project_delivery_template_save(%L,null,%L,%L,null,true,%L,%L)', :A, 'X', 'scope', ARRAY[:SC]::text, '{}')) ~ 'Sem permissão');
COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c3.as_user(:U1) \g /dev/null
SELECT t_c3.put('TPL', public.project_delivery_template_save(:A, null, '[ISO] Fábrica', 'scope', null, true, ARRAY[:SC::uuid],
  '{"client_acceptance":true,"milestones":[{"key":"kickoff","name":"Kickoff"}],"tasks":[{"key":"setup","title":"Setup","milestone_key":"kickoff","estimated_hours":4}]}')->>'template_id') \g /dev/null
SELECT t_c3.ok('salvar sem mudança não cria versão',
  (public.project_delivery_template_save(:A, t_c3.get('TPL')::uuid, '[ISO] Fábrica', 'scope', null, true, ARRAY[:SC::uuid],
  '{"client_acceptance":true,"milestones":[{"key":"kickoff","name":"Kickoff"}],"tasks":[{"key":"setup","title":"Setup","milestone_key":"kickoff","estimated_hours":4}]}')->>'version')::int = 1);
SELECT t_c3.ok('mudar a definição cria versão 2',
  (public.project_delivery_template_save(:A, t_c3.get('TPL')::uuid, '[ISO] Fábrica', 'scope', null, true, ARRAY[:SC::uuid],
  '{"client_acceptance":true,"milestones":[{"key":"kickoff","name":"Kickoff"},{"key":"aceite","name":"Aceite"}],"tasks":[{"key":"setup","title":"Setup","milestone_key":"kickoff"}]}')->>'version')::int = 2);
SELECT t_c3.ok('serviço de outro workspace é recusado',
  t_c3.err(format('select public.project_delivery_template_save(%L,null,%L,%L,null,true,%L,%L)', :A, '[ISO] X', 'scope', ARRAY[:SCB]::text, '{}')) ~ 'serviços ativos');
SELECT t_c3.ok('chave repetida na definição é recusada',
  t_c3.err(format('select public.project_delivery_template_save(%L,null,%L,%L,null,true,null,%L)', :A, '[ISO] Y', 'scope', '{"tasks":[{"key":"a","title":"Alfa"},{"key":"a","title":"Beta"}]}')) ~ 'repetida');
SELECT t_c3.put('V2', (SELECT id::text FROM public.project_delivery_template_versions WHERE template_id = t_c3.get('TPL')::uuid AND version = 2)) \g /dev/null
SELECT t_c3.put('V1', (SELECT id::text FROM public.project_delivery_template_versions WHERE template_id = t_c3.get('TPL')::uuid AND version = 1)) \g /dev/null
SELECT t_c3.ok('aplicar cria 2 marcos e 1 tarefa e liga o aceite do cliente',
  (SELECT (j->>'milestones')::int = 2 AND (j->>'tasks')::int = 1 FROM (SELECT public.project_delivery_template_apply(:P2, t_c3.get('V2')::uuid, false) j) x));
SELECT t_c3.ok('modelo com aceite liga o aceite do cliente no projeto', (SELECT client_acceptance_required FROM public.projects WHERE id = :P2));
SELECT t_c3.ok('aplicar de novo não duplica', (public.project_delivery_template_apply(:P2, t_c3.get('V2')::uuid, false)->>'already_applied') = 'true'
  AND (SELECT count(*) FROM public.project_tasks WHERE project_id = :P2) = 1);
SELECT t_c3.ok('troca de modelo não é automática', t_c3.err(format('select public.project_delivery_template_apply(%L,%L,false)', :P2, t_c3.get('V1'))) ~ 'outro modelo');
SELECT t_c3.ok('projeto com horas importadas exige confirmação explícita',
  t_c3.err(format('select public.project_delivery_template_apply(%L,%L,false)', :P1, t_c3.get('V1'))) ~ 'confirme');
COMMIT;

-- ------------------------------------------------------------------ 9. Jibble: horas sem horário
INSERT INTO public.time_import_mappings (workspace_id, provider, source_org_id, entity_type, external_id, label, target_id, method, decision) VALUES
 (:A, 'jibble', 'iso-org', 'person', 'jp-2', '[ISO] Pessoa Dois', :U2, 'email', 'auto'),
 (:A, 'jibble', 'iso-org', 'project', 'jprj-1', '[ISO] Projeto', :P2, 'manual', 'confirmed');
INSERT INTO public.time_import_staging (workspace_id, provider, source_org_id, entity_type, external_id, person_external_id, payload, payload_hash, status) VALUES
 (:A, 'jibble', 'iso-org', 'hour_entry', 'h1', 'jp-2', '{"personId":"jp-2","projectId":"jprj-1","date":"2026-02-10","duration":"PT2H30M","status":"Active","note":"[ISO] h1"}', 'h1', 'staged'),
 (:A, 'jibble', 'iso-org', 'hour_entry', 'h2', 'jp-2', '{"personId":"jp-2","projectId":"jprj-1","date":"2026-03-02","duration":"PT1H","status":"Active"}', 'h2', 'staged'),
 (:A, 'jibble', 'iso-org', 'hour_entry', 'h3', 'jp-2', '{"personId":"jp-2","projectId":null,"date":"2026-02-11","duration":"PT1H","status":"Active"}', 'h3', 'staged'),
 (:A, 'jibble', 'iso-org', 'hour_entry', 'h4', 'jp-2', '{"personId":"jp-2","projectId":"jprj-1","date":"2026-02-12","duration":"PT2H","status":"Active"}', 'h4', 'staged'),
 (:A, 'jibble', 'iso-org', 'interval', 'i4', 'jp-2', '{"personId":"jp-2","segments":[{"localDate":"2026-02-12","seconds":7200}]}', 'i4', 'imported');
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c3.as_user(:U2) \g /dev/null
SELECT t_c3.ok('prévia Jibble é só de admin', t_c3.err(format('select public.project_jibble_hour_preview(%L,null,50,0)', :A)) ~ 'administradores');
COMMIT;
BEGIN; SET LOCAL ROLE authenticated; SELECT t_c3.as_user(:U1) \g /dev/null
SELECT t_c3.put('jp', public.project_jibble_hour_preview(:A, null, 50, 0)::text) \g /dev/null
SELECT t_c3.ok('classificação: 1 candidato, 1 coberto, 1 sem projeto, 1 com outros apontamentos no dia',
  (t_c3.get('jp')::jsonb->'summary'->'candidate'->>'count')::int = 1 AND (t_c3.get('jp')::jsonb->'summary'->'covered'->>'count')::int = 1
  AND (t_c3.get('jp')::jsonb->'summary'->'no_project'->>'count')::int = 1
  AND (t_c3.get('jp')::jsonb->'summary'->'other_entries_same_day'->>'count')::int = 1);
SELECT t_c3.ok('materializar exige justificativa',
  t_c3.err(format('select public.project_jibble_hour_materialize(%L,%L,%L)', :A, (SELECT array_agg(id)::text FROM public.time_import_staging WHERE entity_type = 'hour_entry'), 'x')) ~ 'justificativa');
SELECT t_c3.ok('materializa só o candidato (1 criado, 3 ignorados)',
  (SELECT (j->>'created')::int = 1 AND (j->>'skipped')::int = 3 FROM (SELECT public.project_jibble_hour_materialize(:A,
     (SELECT array_agg(id) FROM public.time_import_staging WHERE entity_type = 'hour_entry'), '[ISO] conferido na prévia') j) x));
SELECT t_c3.ok('repetir não duplica', (public.project_jibble_hour_materialize(:A,
     (SELECT array_agg(id) FROM public.time_import_staging WHERE entity_type = 'hour_entry'), '[ISO] conferido na prévia')->>'created')::int = 0);
COMMIT;
SELECT t_c3.ok('lançamento Jibble: duração 9000 s, sem horário, importado travado (não aprovado), com vínculo de origem',
  (SELECT count(*) = 1 AND bool_and(duration_seconds = 9000 AND start_time IS NULL AND status = 'locked' AND source = 'import'
          AND entry_kind = 'duration' AND approved_at IS NULL AND user_id = :U2 AND project_id = :P2)
     FROM public.project_time_entries WHERE external_id = 'jibble:hour_entry:h1')
  AND EXISTS (SELECT 1 FROM public.time_import_links WHERE entity_type = 'hour_entry' AND external_id = 'h1' AND target_table = 'project_time_entries'));

-- ------------------------------------------------------------------ 10. preservação
SELECT t_c3.ok('importados pré-existentes intactos (hash)',
  (SELECT md5(string_agg(concat_ws('|', id, project_id, user_id, started_at, stopped_at, hours, duration_minutes, status, source, external_id, locked_at, updated_at), ',' ORDER BY id))
     FROM public.project_time_entries WHERE source = 'import' AND id = :IMP) = (SELECT h FROM t_c3.hash_before));
SELECT t_c3.ok('trilha do fluxo registrada', (SELECT count(*) FROM public.project_time_workflow_events WHERE workspace_id = :A) >= 15);
SELECT t_c3.ok('nenhum item pendente duplicado por apontamento',
  NOT EXISTS (SELECT time_entry_id FROM public.project_timesheet_submission_items WHERE decision = 'pending' GROUP BY 1 HAVING count(*) > 1));
\echo concurrency-point
