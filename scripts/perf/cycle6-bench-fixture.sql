-- Fixture SINTÉTICA de volume do ciclo 6 (banco descartável do harness; nunca o projeto).
-- 400 profissionais, 40 projetos, 2.000 tarefas e :n_entries apontamentos em 2 anos.
-- Carga em lote com gatilhos desligados (session_replication_role) e colunas canônicas já
-- preenchidas; a medição usa o caminho real (RLS + gatilhos) nas gravações do benchmark.
\set ON_ERROR_STOP 1
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.__isolated_marker WHERE id = 1 AND label = 'techerp-isolated-harness') THEN
    RAISE EXCEPTION 'recusado: banco sem marcador do harness';
  END IF;
END $$;
\if :{?n_entries}
\else
  \set n_entries 1000000
\endif

INSERT INTO public.permission_sets (id, module, name) VALUES ('20000000-0000-4000-8000-0000000000f1','techprojects','[ISO] bench horas') ON CONFLICT DO NOTHING;
INSERT INTO public.permission_set_items (set_id, permission_key)
SELECT '20000000-0000-4000-8000-0000000000f1', p.key FROM public.permissions p
 WHERE p.key IN ('techprojects.time_entries.create.own','techprojects.time_entries.view.own','techprojects.time_entries.update.own','techprojects.projects.view.own')
ON CONFLICT DO NOTHING;
INSERT INTO public.job_role_sets (role_id, set_id) VALUES ('30000000-0000-4000-8000-0000000000a1','20000000-0000-4000-8000-0000000000f1') ON CONFLICT DO NOTHING;

INSERT INTO auth.users (id, email, aud, role, email_confirmed_at, raw_user_meta_data)
SELECT ('b0000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid, 'bench-' || i || '@techerp-test.invalid', 'authenticated', 'authenticated', now(),
       json_build_object('full_name', '[ISO] Bench ' || i)::jsonb
  FROM generate_series(1, 400) i ON CONFLICT DO NOTHING;
INSERT INTO public.workspace_members (workspace_id, user_id, role, status)
SELECT 'aaaaaaaa-0000-4000-8000-00000000000a', ('b0000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid, 'member', 'active'
  FROM generate_series(1, 400) i ON CONFLICT DO NOTHING;
UPDATE public.profiles SET active_workspace_id = 'aaaaaaaa-0000-4000-8000-00000000000a' WHERE id::text LIKE 'b0000000-0000-4000-8000-%';
INSERT INTO public.user_job_roles (user_id, owner_id, workspace_id, role_id)
SELECT ('b0000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid, 'aaaaaaaa-0000-4000-8000-00000000000a', 'aaaaaaaa-0000-4000-8000-00000000000a', '30000000-0000-4000-8000-0000000000a1'
  FROM generate_series(1, 400) i;

INSERT INTO public.projects (id, workspace_id, owner_id, name, status)
SELECT ('b1000000-0000-4000-8000-' || lpad(p::text, 12, '0'))::uuid, 'aaaaaaaa-0000-4000-8000-00000000000a', '10000000-0000-4000-8000-000000000001',
       '[ISO] Bench projeto ' || p, 'active' FROM generate_series(1, 40) p;
INSERT INTO public.project_tasks (id, workspace_id, project_id, title)
SELECT ('b2000000-0000-4000-8000-' || lpad(((p - 1) * 50 + t)::text, 12, '0'))::uuid, 'aaaaaaaa-0000-4000-8000-00000000000a',
       ('b1000000-0000-4000-8000-' || lpad(p::text, 12, '0'))::uuid, '[ISO] tarefa ' || t
  FROM generate_series(1, 40) p, generate_series(1, 50) t;
-- Cada profissional é membro de 4 projetos (distribuição fixa).
INSERT INTO public.project_members (workspace_id, project_id, user_id, role_in_project)
SELECT 'aaaaaaaa-0000-4000-8000-00000000000a', ('b1000000-0000-4000-8000-' || lpad((((u + k * 10) % 40) + 1)::text, 12, '0'))::uuid,
       ('b0000000-0000-4000-8000-' || lpad(u::text, 12, '0'))::uuid, 'contributor'
  FROM generate_series(1, 400) u, generate_series(0, 3) k ON CONFLICT DO NOTHING;

SET session_replication_role = replica;
INSERT INTO public.project_time_entries (workspace_id, project_id, task_id, user_id, entry_date, start_time, end_time, duration_seconds,
                                         duration_minutes, hours, entry_kind, timezone, status, source, billable, revision, created_at, updated_at)
SELECT 'aaaaaaaa-0000-4000-8000-00000000000a', proj, ('b2000000-0000-4000-8000-' || lpad((((pnum - 1) * 50) + (g % 50) + 1)::text, 12, '0'))::uuid,
       usr, d, make_time(8 + slot * 2, 0, 0), make_time(9 + slot * 2, 30, 0), 5400, 90, 1.5, 'interval', 'America/Sao_Paulo',
       (ARRAY['draft','submitted','approved','approved','approved','locked'])[1 + (g % 6)], CASE WHEN g % 6 = 5 THEN 'import' ELSE 'manual' END,
       g % 5 <> 0, 0, now(), now()
  FROM (
    -- 400 pessoas; cada uma com até 4 apontamentos por dia em faixas que não se sobrepõem.
    SELECT g, u, (k % 4) AS slot, date '2024-11-01' + (k / 4) AS d,
           ('b0000000-0000-4000-8000-' || lpad(u::text, 12, '0'))::uuid AS usr,
           (((u + (k % 4) * 10) % 40) + 1) AS pnum
      FROM (SELECT g, (g % 400) + 1 AS u, g / 400 AS k FROM generate_series(0, :n_entries - 1) g) z
  ) x, LATERAL (SELECT ('b1000000-0000-4000-8000-' || lpad(x.pnum::text, 12, '0'))::uuid AS proj) y;
SET session_replication_role = origin;
ANALYZE public.project_time_entries;
ANALYZE public.projects; ANALYZE public.project_tasks; ANALYZE public.project_members; ANALYZE public.workspace_members;
SELECT count(*) AS entries_total, count(DISTINCT user_id) AS users, min(entry_date), max(entry_date) FROM public.project_time_entries;
