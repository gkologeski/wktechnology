
-- =====================================================================
-- Fase 3 — Chaves de permissão faltantes (TechService.services + TechPeople.performance/wellbeing)
-- Não altera RLS; apenas popula catálogo de permissões e concede aos cargos.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) TechService.services
-- ---------------------------------------------------------------------
INSERT INTO public.permissions (key, module, resource, action, scope, label_pt, description, is_system) VALUES
  ('techservice.services.view.own',        'techservice', 'services', 'view',   'own',       'Ver próprios serviços',          NULL, true),
  ('techservice.services.view.workspace',  'techservice', 'services', 'view',   'workspace', 'Ver serviços do workspace',       NULL, true),
  ('techservice.services.create.own',      'techservice', 'services', 'create', 'own',       'Criar serviço',                   NULL, true),
  ('techservice.services.update.own',      'techservice', 'services', 'update', 'own',       'Editar próprios serviços',        NULL, true),
  ('techservice.services.update.workspace','techservice', 'services', 'update', 'workspace', 'Editar serviços do workspace',    NULL, true),
  ('techservice.services.delete.workspace','techservice', 'services', 'delete', 'workspace', 'Deletar serviços',                NULL, true),
  ('techservice.services.export.workspace','techservice', 'services', 'export', 'workspace', 'Exportar serviços',               NULL, true)
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------
-- 2) TechPeople.performance.{goals,reviews,one_on_ones}
-- ---------------------------------------------------------------------
INSERT INTO public.permissions (key, module, resource, action, scope, label_pt, description, is_system) VALUES
  ('techpeople.performance.goals.view.own',            'techpeople', 'performance.goals', 'view',   'own',       'Ver próprias metas',           NULL, true),
  ('techpeople.performance.goals.view.workspace',      'techpeople', 'performance.goals', 'view',   'workspace', 'Ver metas do workspace',       NULL, true),
  ('techpeople.performance.goals.create.own',          'techpeople', 'performance.goals', 'create', 'own',       'Criar meta',                    NULL, true),
  ('techpeople.performance.goals.update.own',          'techpeople', 'performance.goals', 'update', 'own',       'Editar próprias metas',         NULL, true),
  ('techpeople.performance.goals.update.workspace',    'techpeople', 'performance.goals', 'update', 'workspace', 'Editar metas do workspace',     NULL, true),
  ('techpeople.performance.goals.delete.workspace',    'techpeople', 'performance.goals', 'delete', 'workspace', 'Deletar metas',                 NULL, true),

  ('techpeople.performance.reviews.view.own',          'techpeople', 'performance.reviews', 'view',   'own',       'Ver próprias avaliações',      NULL, true),
  ('techpeople.performance.reviews.view.workspace',    'techpeople', 'performance.reviews', 'view',   'workspace', 'Ver avaliações do workspace',  NULL, true),
  ('techpeople.performance.reviews.create.own',        'techpeople', 'performance.reviews', 'create', 'own',       'Criar avaliação',               NULL, true),
  ('techpeople.performance.reviews.update.own',        'techpeople', 'performance.reviews', 'update', 'own',       'Editar avaliação',              NULL, true),
  ('techpeople.performance.reviews.update.workspace',  'techpeople', 'performance.reviews', 'update', 'workspace', 'Editar avaliações do workspace',NULL, true),
  ('techpeople.performance.reviews.delete.workspace',  'techpeople', 'performance.reviews', 'delete', 'workspace', 'Deletar avaliações',            NULL, true),
  ('techpeople.performance.reviews.approve.workspace', 'techpeople', 'performance.reviews', 'approve','workspace', 'Aprovar avaliações',            NULL, true),

  ('techpeople.performance.one_on_ones.view.own',         'techpeople', 'performance.one_on_ones', 'view',   'own',       'Ver próprios 1:1s',        NULL, true),
  ('techpeople.performance.one_on_ones.view.workspace',   'techpeople', 'performance.one_on_ones', 'view',   'workspace', 'Ver 1:1s do workspace',    NULL, true),
  ('techpeople.performance.one_on_ones.create.own',       'techpeople', 'performance.one_on_ones', 'create', 'own',       'Agendar 1:1',              NULL, true),
  ('techpeople.performance.one_on_ones.update.own',       'techpeople', 'performance.one_on_ones', 'update', 'own',       'Editar próprios 1:1s',     NULL, true),
  ('techpeople.performance.one_on_ones.update.workspace', 'techpeople', 'performance.one_on_ones', 'update', 'workspace', 'Editar 1:1s do workspace', NULL, true),
  ('techpeople.performance.one_on_ones.delete.workspace', 'techpeople', 'performance.one_on_ones', 'delete', 'workspace', 'Deletar 1:1s',             NULL, true)
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------
-- 3) TechPeople.wellbeing.{incidents,assessments}
-- ---------------------------------------------------------------------
INSERT INTO public.permissions (key, module, resource, action, scope, label_pt, description, is_system) VALUES
  ('techpeople.wellbeing.incidents.view.own',          'techpeople', 'wellbeing.incidents', 'view',   'own',       'Ver próprios incidentes',      NULL, true),
  ('techpeople.wellbeing.incidents.view.workspace',    'techpeople', 'wellbeing.incidents', 'view',   'workspace', 'Ver incidentes do workspace',  NULL, true),
  ('techpeople.wellbeing.incidents.create.own',        'techpeople', 'wellbeing.incidents', 'create', 'own',       'Registrar incidente',           NULL, true),
  ('techpeople.wellbeing.incidents.update.workspace',  'techpeople', 'wellbeing.incidents', 'update', 'workspace', 'Editar incidentes',             NULL, true),
  ('techpeople.wellbeing.incidents.delete.workspace',  'techpeople', 'wellbeing.incidents', 'delete', 'workspace', 'Deletar incidentes',            NULL, true),

  ('techpeople.wellbeing.assessments.view.own',          'techpeople', 'wellbeing.assessments', 'view',   'own',       'Ver próprias avaliações psicossociais', NULL, true),
  ('techpeople.wellbeing.assessments.view.workspace',    'techpeople', 'wellbeing.assessments', 'view',   'workspace', 'Ver avaliações psicossociais',           NULL, true),
  ('techpeople.wellbeing.assessments.create.own',        'techpeople', 'wellbeing.assessments', 'create', 'own',       'Aplicar avaliação psicossocial',         NULL, true),
  ('techpeople.wellbeing.assessments.update.workspace',  'techpeople', 'wellbeing.assessments', 'update', 'workspace', 'Editar avaliações psicossociais',        NULL, true),
  ('techpeople.wellbeing.assessments.delete.workspace',  'techpeople', 'wellbeing.assessments', 'delete', 'workspace', 'Deletar avaliações psicossociais',       NULL, true)
ON CONFLICT (key) DO NOTHING;

-- =====================================================================
-- 4) Conceder chaves aos permission_sets (cargos de sistema)
-- =====================================================================

DO $$
DECLARE
  -- IDs de system permission_sets
  ps_super_admin       uuid := '00000000-0000-0000-0000-0000000000a1';
  ps_admin             uuid := '00000000-0000-0000-0000-0000000000a2';
  ps_ws_admin          uuid := '33333333-0000-4000-8000-000000000001';
  ps_ws_owner          uuid := '33333333-0000-4000-8000-000000000002';

  ps_service_viewer    uuid := '55555555-0000-4000-8000-000000000001';
  ps_service_manager   uuid := '55555555-0000-4000-8000-000000000002';
  ps_service_admin     uuid := '55555555-0000-4000-8000-000000000003';
  ps_service_own       uuid := '55555555-0000-4000-8000-000000000004';

  ps_people_viewer     uuid := '88888888-0000-4000-8000-000000000001';
  ps_people_manager    uuid := '88888888-0000-4000-8000-000000000002';
  ps_people_admin      uuid := '88888888-0000-4000-8000-000000000003';

  full_key text;
BEGIN
  -- 4.1 TechService.services
  FOREACH full_key IN ARRAY ARRAY[
    'techservice.services.view.workspace',
    'techservice.services.create.own',
    'techservice.services.update.workspace',
    'techservice.services.delete.workspace',
    'techservice.services.export.workspace'
  ] LOOP
    INSERT INTO permission_set_items (set_id, permission_key) VALUES
      (ps_service_admin, full_key),
      (ps_ws_admin,      full_key),
      (ps_ws_owner,      full_key),
      (ps_admin,         full_key),
      (ps_super_admin,   full_key)
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- Manager: sem delete
  FOREACH full_key IN ARRAY ARRAY[
    'techservice.services.view.workspace',
    'techservice.services.create.own',
    'techservice.services.update.workspace',
    'techservice.services.export.workspace'
  ] LOOP
    INSERT INTO permission_set_items (set_id, permission_key) VALUES (ps_service_manager, full_key)
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- Viewer
  INSERT INTO permission_set_items (set_id, permission_key) VALUES
    (ps_service_viewer, 'techservice.services.view.workspace')
  ON CONFLICT DO NOTHING;

  -- Own: cria + edita/vê próprios
  FOREACH full_key IN ARRAY ARRAY[
    'techservice.services.view.own',
    'techservice.services.create.own',
    'techservice.services.update.own'
  ] LOOP
    INSERT INTO permission_set_items (set_id, permission_key) VALUES (ps_service_own, full_key)
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- 4.2 TechPeople.performance.* + wellbeing.*
  -- Admin do TechPeople + Workspace Admin/Owner + Admin/Super Admin: acesso total
  FOREACH full_key IN ARRAY ARRAY[
    -- goals
    'techpeople.performance.goals.view.workspace',
    'techpeople.performance.goals.create.own',
    'techpeople.performance.goals.update.workspace',
    'techpeople.performance.goals.delete.workspace',
    -- reviews
    'techpeople.performance.reviews.view.workspace',
    'techpeople.performance.reviews.create.own',
    'techpeople.performance.reviews.update.workspace',
    'techpeople.performance.reviews.delete.workspace',
    'techpeople.performance.reviews.approve.workspace',
    -- one_on_ones
    'techpeople.performance.one_on_ones.view.workspace',
    'techpeople.performance.one_on_ones.create.own',
    'techpeople.performance.one_on_ones.update.workspace',
    'techpeople.performance.one_on_ones.delete.workspace',
    -- wellbeing.incidents
    'techpeople.wellbeing.incidents.view.workspace',
    'techpeople.wellbeing.incidents.create.own',
    'techpeople.wellbeing.incidents.update.workspace',
    'techpeople.wellbeing.incidents.delete.workspace',
    -- wellbeing.assessments
    'techpeople.wellbeing.assessments.view.workspace',
    'techpeople.wellbeing.assessments.create.own',
    'techpeople.wellbeing.assessments.update.workspace',
    'techpeople.wellbeing.assessments.delete.workspace'
  ] LOOP
    INSERT INTO permission_set_items (set_id, permission_key) VALUES
      (ps_people_admin, full_key),
      (ps_ws_admin,     full_key),
      (ps_ws_owner,     full_key),
      (ps_admin,        full_key),
      (ps_super_admin,  full_key)
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- Manager do TechPeople: tudo exceto delete
  FOREACH full_key IN ARRAY ARRAY[
    'techpeople.performance.goals.view.workspace',
    'techpeople.performance.goals.create.own',
    'techpeople.performance.goals.update.workspace',
    'techpeople.performance.reviews.view.workspace',
    'techpeople.performance.reviews.create.own',
    'techpeople.performance.reviews.update.workspace',
    'techpeople.performance.reviews.approve.workspace',
    'techpeople.performance.one_on_ones.view.workspace',
    'techpeople.performance.one_on_ones.create.own',
    'techpeople.performance.one_on_ones.update.workspace',
    'techpeople.wellbeing.incidents.view.workspace',
    'techpeople.wellbeing.incidents.create.own',
    'techpeople.wellbeing.incidents.update.workspace',
    'techpeople.wellbeing.assessments.view.workspace',
    'techpeople.wellbeing.assessments.create.own',
    'techpeople.wellbeing.assessments.update.workspace'
  ] LOOP
    INSERT INTO permission_set_items (set_id, permission_key) VALUES (ps_people_manager, full_key)
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- Viewer do TechPeople: só leitura
  FOREACH full_key IN ARRAY ARRAY[
    'techpeople.performance.goals.view.own',
    'techpeople.performance.reviews.view.own',
    'techpeople.performance.one_on_ones.view.own',
    'techpeople.wellbeing.incidents.view.own',
    'techpeople.wellbeing.assessments.view.own'
  ] LOOP
    INSERT INTO permission_set_items (set_id, permission_key) VALUES (ps_people_viewer, full_key)
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;
