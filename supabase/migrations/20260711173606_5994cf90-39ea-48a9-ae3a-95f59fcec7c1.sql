
-- =============================================================================
-- Phase 1+2 RBAC: seed 9 preset Cargos + backfill assignments + sync trigger
-- =============================================================================

-- 1. Presets: fixed UUIDs so seed é idempotente
--    (owner_id NULL = preset de sistema, visível em todo workspace)

DO $$
DECLARE
  v_super  uuid := '00000000-0000-0000-0000-0000000000a1';
  v_admin  uuid := '00000000-0000-0000-0000-0000000000a2';
  v_smgr   uuid := '00000000-0000-0000-0000-0000000000a3';
  v_srep   uuid := '00000000-0000-0000-0000-0000000000a4';
  v_mkt    uuid := '00000000-0000-0000-0000-0000000000a5';
  v_svc    uuid := '00000000-0000-0000-0000-0000000000a6';
  v_recr   uuid := '00000000-0000-0000-0000-0000000000a7';
  v_hmgr   uuid := '00000000-0000-0000-0000-0000000000a8';
  v_ro     uuid := '00000000-0000-0000-0000-0000000000a9';
BEGIN
  -- Upsert 9 permission_sets (system presets)
  INSERT INTO public.permission_sets (id, owner_id, module, name, description, is_system)
  VALUES
    (v_super, NULL, 'system', 'Super Admin',    'Acesso total a todos os módulos e configurações.', true),
    (v_admin, NULL, 'system', 'Admin',          'Administra o workspace, exceto assinatura e cargos.', true),
    (v_smgr,  NULL, 'techsales', 'Sales Manager','Gestor comercial: vê e edita todo o time, aprova e exporta.', true),
    (v_srep,  NULL, 'techsales', 'Sales Rep',    'Vendedor: vê o time, cria e edita apenas os próprios registros.', true),
    (v_mkt,   NULL, 'techsales', 'Marketing',    'Marketing: vê contatos/empresas/leads e gerencia integrações.', true),
    (v_svc,   NULL, 'techsales', 'Service Rep',  'Atendimento: gerencia tickets e vê contatos.', true),
    (v_recr,  NULL, 'techhire',  'Recruiter',    'Recrutador: trabalha vagas próprias e todo o funil de candidatos.', true),
    (v_hmgr,  NULL, 'techhire',  'Hiring Manager','Gestor de contratação: vê vagas, publica e aprova ofertas.', true),
    (v_ro,    NULL, 'system', 'Read-Only',      'Apenas visualização em todos os módulos.', true)
  ON CONFLICT (id) DO UPDATE
    SET name = EXCLUDED.name,
        module = EXCLUDED.module,
        description = EXCLUDED.description,
        is_system = true,
        updated_at = now();

  -- Ressincroniza itens: apaga tudo do preset e reinsere.
  DELETE FROM public.permission_set_items
   WHERE set_id IN (v_super, v_admin, v_smgr, v_srep, v_mkt, v_svc, v_recr, v_hmgr, v_ro);

  -- Super Admin: todas
  INSERT INTO public.permission_set_items (set_id, permission_key)
  SELECT v_super, key FROM public.permissions;

  -- Admin: todas exceto billing e roles
  INSERT INTO public.permission_set_items (set_id, permission_key)
  SELECT v_admin, key FROM public.permissions
   WHERE key NOT IN ('system.billing.manage.workspace', 'system.roles.manage.workspace');

  -- Sales Manager
  INSERT INTO public.permission_set_items (set_id, permission_key) VALUES
    (v_smgr, 'techsales.contacts.view.workspace'),
    (v_smgr, 'techsales.contacts.create.own'),
    (v_smgr, 'techsales.contacts.update.workspace'),
    (v_smgr, 'techsales.contacts.delete.workspace'),
    (v_smgr, 'techsales.companies.view.workspace'),
    (v_smgr, 'techsales.companies.manage.workspace'),
    (v_smgr, 'techsales.leads.view.workspace'),
    (v_smgr, 'techsales.leads.create.own'),
    (v_smgr, 'techsales.leads.update.team'),
    (v_smgr, 'techsales.leads.delete.workspace'),
    (v_smgr, 'techsales.leads.export.workspace'),
    (v_smgr, 'techsales.leads.assign.workspace'),
    (v_smgr, 'techsales.deals.view.workspace'),
    (v_smgr, 'techsales.deals.create.own'),
    (v_smgr, 'techsales.deals.update.team'),
    (v_smgr, 'techsales.deals.delete.workspace'),
    (v_smgr, 'techsales.deals.export.workspace'),
    (v_smgr, 'techsales.deals.approve.team'),
    (v_smgr, 'techsales.tickets.view.workspace'),
    (v_smgr, 'techsales.tickets.manage.workspace'),
    (v_smgr, 'system.members.view.workspace'),
    (v_smgr, 'system.audit.view.workspace');

  -- Sales Rep
  INSERT INTO public.permission_set_items (set_id, permission_key) VALUES
    (v_srep, 'techsales.contacts.view.workspace'),
    (v_srep, 'techsales.contacts.create.own'),
    (v_srep, 'techsales.companies.view.workspace'),
    (v_srep, 'techsales.leads.view.team'),
    (v_srep, 'techsales.leads.create.own'),
    (v_srep, 'techsales.leads.update.own'),
    (v_srep, 'techsales.leads.delete.own'),
    (v_srep, 'techsales.deals.view.team'),
    (v_srep, 'techsales.deals.create.own'),
    (v_srep, 'techsales.deals.update.own'),
    (v_srep, 'techsales.tickets.view.workspace');

  -- Marketing
  INSERT INTO public.permission_set_items (set_id, permission_key) VALUES
    (v_mkt, 'techsales.contacts.view.workspace'),
    (v_mkt, 'techsales.contacts.create.own'),
    (v_mkt, 'techsales.contacts.update.workspace'),
    (v_mkt, 'techsales.companies.view.workspace'),
    (v_mkt, 'techsales.companies.manage.workspace'),
    (v_mkt, 'techsales.leads.view.workspace'),
    (v_mkt, 'techsales.leads.create.own'),
    (v_mkt, 'techsales.leads.update.own'),
    (v_mkt, 'techsales.leads.export.workspace'),
    (v_mkt, 'system.integrations.manage.workspace');

  -- Service Rep
  INSERT INTO public.permission_set_items (set_id, permission_key) VALUES
    (v_svc, 'techsales.contacts.view.workspace'),
    (v_svc, 'techsales.companies.view.workspace'),
    (v_svc, 'techsales.tickets.view.workspace'),
    (v_svc, 'techsales.tickets.manage.workspace');

  -- Recruiter
  INSERT INTO public.permission_set_items (set_id, permission_key) VALUES
    (v_recr, 'techhire.jobs.view.own'),
    (v_recr, 'techhire.jobs.create.own'),
    (v_recr, 'techhire.jobs.update.own'),
    (v_recr, 'techhire.candidates.view.workspace'),
    (v_recr, 'techhire.candidates.create.own'),
    (v_recr, 'techhire.candidates.update.workspace'),
    (v_recr, 'techhire.candidates.assign.workspace'),
    (v_recr, 'techhire.interviews.view.workspace'),
    (v_recr, 'techhire.interviews.schedule.workspace'),
    (v_recr, 'techhire.interviews.score.workspace'),
    (v_recr, 'techhire.sourcing.manage.workspace');

  -- Hiring Manager
  INSERT INTO public.permission_set_items (set_id, permission_key) VALUES
    (v_hmgr, 'techhire.jobs.view.workspace'),
    (v_hmgr, 'techhire.jobs.update.workspace'),
    (v_hmgr, 'techhire.jobs.publish.workspace'),
    (v_hmgr, 'techhire.candidates.view.workspace'),
    (v_hmgr, 'techhire.candidates.assign.workspace'),
    (v_hmgr, 'techhire.interviews.view.workspace'),
    (v_hmgr, 'techhire.offers.view.workspace'),
    (v_hmgr, 'techhire.offers.create.workspace'),
    (v_hmgr, 'techhire.offers.approve.workspace');

  -- Read-Only: só *.view.*
  INSERT INTO public.permission_set_items (set_id, permission_key)
  SELECT v_ro, key FROM public.permissions WHERE action = 'view';
END $$;

-- 2. Backfill: workspace members sem cargo atribuído → Read-Only
--    (Owner do workspace tem passe livre via assertPermission; não precisa de linha.)
INSERT INTO public.user_permission_sets (user_id, owner_id, set_id)
SELECT
  wm.user_id,
  ws.created_by                                       AS owner_id,
  '00000000-0000-0000-0000-0000000000a9'::uuid        AS set_id  -- Read-Only
FROM public.workspace_members wm
JOIN public.workspaces ws ON ws.id = wm.workspace_id
WHERE wm.user_id <> ws.created_by
  AND NOT EXISTS (
    SELECT 1 FROM public.user_permission_sets ups
     WHERE ups.user_id = wm.user_id
       AND ups.owner_id = ws.created_by
  )
ON CONFLICT (user_id, owner_id, set_id) DO NOTHING;

-- Se houver team_members com access_profile_id (modelo legado) e sem cargo novo,
-- mapeia pelo base_role.
INSERT INTO public.user_permission_sets (user_id, owner_id, set_id)
SELECT
  tm.member_user_id,
  tm.workspace_owner_id,
  CASE ap.base_role::text
    WHEN 'admin'        THEN '00000000-0000-0000-0000-0000000000a2'::uuid  -- Admin
    WHEN 'sales_leader' THEN '00000000-0000-0000-0000-0000000000a3'::uuid  -- Sales Manager
    WHEN 'sales'        THEN '00000000-0000-0000-0000-0000000000a4'::uuid  -- Sales Rep
    WHEN 'marketing'    THEN '00000000-0000-0000-0000-0000000000a5'::uuid
    WHEN 'service'      THEN '00000000-0000-0000-0000-0000000000a6'::uuid
    WHEN 'recruiter'    THEN '00000000-0000-0000-0000-0000000000a7'::uuid
    WHEN 'hiring_mgr'   THEN '00000000-0000-0000-0000-0000000000a8'::uuid
    ELSE                     '00000000-0000-0000-0000-0000000000a9'::uuid  -- Read-Only
  END
FROM public.team_members tm
JOIN public.access_profiles ap ON ap.id = tm.access_profile_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_permission_sets ups
   WHERE ups.user_id = tm.member_user_id
     AND ups.owner_id = tm.workspace_owner_id
)
ON CONFLICT (user_id, owner_id, set_id) DO NOTHING;

-- 3. Proteção: presets de sistema não podem ser deletados nem ter is_system=false.
CREATE OR REPLACE FUNCTION public.guard_system_permission_set()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_system THEN
      RAISE EXCEPTION 'Cargo padrão do sistema não pode ser removido: %', OLD.name;
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.is_system AND NEW.is_system = false THEN
      RAISE EXCEPTION 'Cargo padrão do sistema não pode ser convertido para custom: %', OLD.name;
    END IF;
    -- Bloqueia renomear presets do sistema para evitar quebrar lookups por nome.
    IF OLD.is_system AND OLD.owner_id IS NULL AND OLD.name <> NEW.name THEN
      RAISE EXCEPTION 'Cargo padrão do sistema não pode ser renomeado: %', OLD.name;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_system_permission_set ON public.permission_sets;
CREATE TRIGGER trg_guard_system_permission_set
BEFORE UPDATE OR DELETE ON public.permission_sets
FOR EACH ROW EXECUTE FUNCTION public.guard_system_permission_set();
