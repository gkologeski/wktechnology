-- Papel de sistema: apenas lançamento/visualização de horas e tarefas no TechProjects.
INSERT INTO public.job_roles (id, name, description, color, icon, is_system, data_scope, owner_id, workspace_id)
VALUES (
  'aaaaaaaa-0000-4000-8000-00000000000b',
  'Apontador de Horas',
  'Acesso restrito ao TechProjects: lançar e visualizar apenas as próprias horas e tarefas.',
  '#0ea5e9',
  'timer',
  true,
  'own',
  NULL,
  NULL
)
ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description,
      data_scope = EXCLUDED.data_scope,
      is_system = true;

INSERT INTO public.job_role_default_permissions (role_id, permission_key)
SELECT 'aaaaaaaa-0000-4000-8000-00000000000b', k
FROM (VALUES
  ('techprojects.time_entries.view.own'),
  ('techprojects.time_entries.create.own'),
  ('techprojects.time_entries.update.own'),
  ('techprojects.timesheet.view.own'),
  ('techprojects.timesheet.create.own'),
  ('techprojects.timesheet.update.own'),
  ('techprojects.tasks.view.own'),
  ('techprojects.tasks.create.own'),
  ('techprojects.tasks.update.own'),
  ('techprojects.my_work.view.own'),
  ('techprojects.my_work.create.own'),
  ('techprojects.my_work.update.own')
) AS t(k)
WHERE EXISTS (SELECT 1 FROM public.permissions p WHERE p.key = t.k)
ON CONFLICT DO NOTHING;