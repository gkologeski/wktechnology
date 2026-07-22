
-- Seed system permission_set bundles for TechContracts, TechService, TechFinance, TechProjects, TechPeople.
-- Pattern mirrors existing techsales/techhire system bundles (owner_id NULL, is_system=true), then linked via job_role_sets.

-- 1) Create per-module tier bundles (idempotent).
INSERT INTO public.permission_sets (id, owner_id, module, name, description, is_system) VALUES
  -- techcontracts
  ('44444444-0000-4000-8000-000000000001', NULL, 'techcontracts', 'TechContracts Viewer',  'Leitura e exportação de contratos.', true),
  ('44444444-0000-4000-8000-000000000002', NULL, 'techcontracts', 'TechContracts Manager', 'Gestão de contratos no workspace.', true),
  ('44444444-0000-4000-8000-000000000003', NULL, 'techcontracts', 'TechContracts Admin',   'Acesso total a contratos.', true),
  ('44444444-0000-4000-8000-000000000004', NULL, 'techcontracts', 'TechContracts Own',     'Criação e leitura dos próprios contratos.', true),
  -- techservice
  ('55555555-0000-4000-8000-000000000001', NULL, 'techservice',   'TechService Viewer',    'Leitura de tickets, SLA e base de conhecimento.', true),
  ('55555555-0000-4000-8000-000000000002', NULL, 'techservice',   'TechService Manager',   'Gestão de tickets e conhecimento.', true),
  ('55555555-0000-4000-8000-000000000003', NULL, 'techservice',   'TechService Admin',     'Acesso total a atendimento.', true),
  ('55555555-0000-4000-8000-000000000004', NULL, 'techservice',   'TechService Own',       'Abertura e visualização dos próprios tickets.', true),
  -- techfinance
  ('66666666-0000-4000-8000-000000000001', NULL, 'techfinance',   'TechFinance Viewer',    'Leitura e exportação financeira.', true),
  ('66666666-0000-4000-8000-000000000002', NULL, 'techfinance',   'TechFinance Manager',   'Aprovação e gestão financeira.', true),
  ('66666666-0000-4000-8000-000000000003', NULL, 'techfinance',   'TechFinance Admin',     'Acesso total ao módulo financeiro.', true),
  -- techprojects
  ('77777777-0000-4000-8000-000000000001', NULL, 'techprojects',  'TechProjects Viewer',   'Leitura e exportação de projetos.', true),
  ('77777777-0000-4000-8000-000000000002', NULL, 'techprojects',  'TechProjects Manager',  'Gestão de projetos e tarefas.', true),
  ('77777777-0000-4000-8000-000000000003', NULL, 'techprojects',  'TechProjects Admin',    'Acesso total a projetos.', true),
  ('77777777-0000-4000-8000-000000000004', NULL, 'techprojects',  'TechProjects Own',      'Trabalho nas próprias tarefas e horas.', true),
  -- techpeople
  ('88888888-0000-4000-8000-000000000001', NULL, 'techpeople',    'TechPeople Viewer',     'Leitura e exportação de RH.', true),
  ('88888888-0000-4000-8000-000000000002', NULL, 'techpeople',    'TechPeople Manager',    'Gestão de pessoas, metas e reviews.', true),
  ('88888888-0000-4000-8000-000000000003', NULL, 'techpeople',    'TechPeople Admin',      'Acesso total a RH.', true)
ON CONFLICT (id) DO NOTHING;

-- 2) Populate permission_set_items from public.permissions using tier rules.
-- Admin  = all keys of the module.
-- Manager= excludes .delete.workspace.
-- Viewer = only .view.workspace and .export.workspace.
-- Own    = only .view.own, .create.own, .update.own.

WITH tiers(set_id, module, tier) AS (VALUES
  ('44444444-0000-4000-8000-000000000001'::uuid,'techcontracts','viewer'),
  ('44444444-0000-4000-8000-000000000002'::uuid,'techcontracts','manager'),
  ('44444444-0000-4000-8000-000000000003'::uuid,'techcontracts','admin'),
  ('44444444-0000-4000-8000-000000000004'::uuid,'techcontracts','own'),
  ('55555555-0000-4000-8000-000000000001'::uuid,'techservice','viewer'),
  ('55555555-0000-4000-8000-000000000002'::uuid,'techservice','manager'),
  ('55555555-0000-4000-8000-000000000003'::uuid,'techservice','admin'),
  ('55555555-0000-4000-8000-000000000004'::uuid,'techservice','own'),
  ('66666666-0000-4000-8000-000000000001'::uuid,'techfinance','viewer'),
  ('66666666-0000-4000-8000-000000000002'::uuid,'techfinance','manager'),
  ('66666666-0000-4000-8000-000000000003'::uuid,'techfinance','admin'),
  ('77777777-0000-4000-8000-000000000001'::uuid,'techprojects','viewer'),
  ('77777777-0000-4000-8000-000000000002'::uuid,'techprojects','manager'),
  ('77777777-0000-4000-8000-000000000003'::uuid,'techprojects','admin'),
  ('77777777-0000-4000-8000-000000000004'::uuid,'techprojects','own'),
  ('88888888-0000-4000-8000-000000000001'::uuid,'techpeople','viewer'),
  ('88888888-0000-4000-8000-000000000002'::uuid,'techpeople','manager'),
  ('88888888-0000-4000-8000-000000000003'::uuid,'techpeople','admin')
)
INSERT INTO public.permission_set_items (set_id, permission_key)
SELECT t.set_id, p.key
FROM tiers t
JOIN public.permissions p ON split_part(p.key,'.',1) = t.module
WHERE
  (t.tier = 'admin')
  OR (t.tier = 'manager' AND p.key NOT LIKE '%.delete.workspace')
  OR (t.tier = 'viewer' AND (p.key LIKE '%.view.workspace' OR p.key LIKE '%.export.workspace'))
  OR (t.tier = 'own' AND (p.key LIKE '%.view.own' OR p.key LIKE '%.create.own' OR p.key LIKE '%.update.own'))
ON CONFLICT (set_id, permission_key) DO NOTHING;

-- 3) Link bundles to system roles per plan.
INSERT INTO public.job_role_sets (role_id, set_id) VALUES
  -- Vendedor (001): own-tier on contracts, service, projects
  ('aaaaaaaa-0000-4000-8000-000000000001','44444444-0000-4000-8000-000000000004'),
  ('aaaaaaaa-0000-4000-8000-000000000001','55555555-0000-4000-8000-000000000004'),
  ('aaaaaaaa-0000-4000-8000-000000000001','77777777-0000-4000-8000-000000000004'),
  -- Gerente Comercial (002): manager on contracts/service/projects; viewer on finance/people
  ('aaaaaaaa-0000-4000-8000-000000000002','44444444-0000-4000-8000-000000000002'),
  ('aaaaaaaa-0000-4000-8000-000000000002','55555555-0000-4000-8000-000000000002'),
  ('aaaaaaaa-0000-4000-8000-000000000002','77777777-0000-4000-8000-000000000002'),
  ('aaaaaaaa-0000-4000-8000-000000000002','66666666-0000-4000-8000-000000000001'),
  ('aaaaaaaa-0000-4000-8000-000000000002','88888888-0000-4000-8000-000000000001'),
  -- Recrutador (003): viewer on people
  ('aaaaaaaa-0000-4000-8000-000000000003','88888888-0000-4000-8000-000000000001'),
  -- Head de RH (004): admin on people; viewer on contracts/finance/projects
  ('aaaaaaaa-0000-4000-8000-000000000004','88888888-0000-4000-8000-000000000003'),
  ('aaaaaaaa-0000-4000-8000-000000000004','44444444-0000-4000-8000-000000000001'),
  ('aaaaaaaa-0000-4000-8000-000000000004','66666666-0000-4000-8000-000000000001'),
  ('aaaaaaaa-0000-4000-8000-000000000004','77777777-0000-4000-8000-000000000001'),
  -- Financeiro (005): admin on finance; viewer on contracts/service/projects/people
  ('aaaaaaaa-0000-4000-8000-000000000005','66666666-0000-4000-8000-000000000003'),
  ('aaaaaaaa-0000-4000-8000-000000000005','44444444-0000-4000-8000-000000000001'),
  ('aaaaaaaa-0000-4000-8000-000000000005','55555555-0000-4000-8000-000000000001'),
  ('aaaaaaaa-0000-4000-8000-000000000005','77777777-0000-4000-8000-000000000001'),
  ('aaaaaaaa-0000-4000-8000-000000000005','88888888-0000-4000-8000-000000000001'),
  -- Diretor (006): manager on all five
  ('aaaaaaaa-0000-4000-8000-000000000006','44444444-0000-4000-8000-000000000002'),
  ('aaaaaaaa-0000-4000-8000-000000000006','55555555-0000-4000-8000-000000000002'),
  ('aaaaaaaa-0000-4000-8000-000000000006','66666666-0000-4000-8000-000000000002'),
  ('aaaaaaaa-0000-4000-8000-000000000006','77777777-0000-4000-8000-000000000002'),
  ('aaaaaaaa-0000-4000-8000-000000000006','88888888-0000-4000-8000-000000000002'),
  -- Auditor (007): viewer on all five
  ('aaaaaaaa-0000-4000-8000-000000000007','44444444-0000-4000-8000-000000000001'),
  ('aaaaaaaa-0000-4000-8000-000000000007','55555555-0000-4000-8000-000000000001'),
  ('aaaaaaaa-0000-4000-8000-000000000007','66666666-0000-4000-8000-000000000001'),
  ('aaaaaaaa-0000-4000-8000-000000000007','77777777-0000-4000-8000-000000000001'),
  ('aaaaaaaa-0000-4000-8000-000000000007','88888888-0000-4000-8000-000000000001'),
  -- Workspace Admin (008): admin on all five
  ('aaaaaaaa-0000-4000-8000-000000000008','44444444-0000-4000-8000-000000000003'),
  ('aaaaaaaa-0000-4000-8000-000000000008','55555555-0000-4000-8000-000000000003'),
  ('aaaaaaaa-0000-4000-8000-000000000008','66666666-0000-4000-8000-000000000003'),
  ('aaaaaaaa-0000-4000-8000-000000000008','77777777-0000-4000-8000-000000000003'),
  ('aaaaaaaa-0000-4000-8000-000000000008','88888888-0000-4000-8000-000000000003'),
  -- Workspace Owner (009): admin on all five
  ('aaaaaaaa-0000-4000-8000-000000000009','44444444-0000-4000-8000-000000000003'),
  ('aaaaaaaa-0000-4000-8000-000000000009','55555555-0000-4000-8000-000000000003'),
  ('aaaaaaaa-0000-4000-8000-000000000009','66666666-0000-4000-8000-000000000003'),
  ('aaaaaaaa-0000-4000-8000-000000000009','77777777-0000-4000-8000-000000000003'),
  ('aaaaaaaa-0000-4000-8000-000000000009','88888888-0000-4000-8000-000000000003'),
  -- External Collaborator (00a): own on contracts/service/projects
  ('aaaaaaaa-0000-4000-8000-00000000000a','44444444-0000-4000-8000-000000000004'),
  ('aaaaaaaa-0000-4000-8000-00000000000a','55555555-0000-4000-8000-000000000004'),
  ('aaaaaaaa-0000-4000-8000-00000000000a','77777777-0000-4000-8000-000000000004')
ON CONFLICT (role_id, set_id) DO NOTHING;
