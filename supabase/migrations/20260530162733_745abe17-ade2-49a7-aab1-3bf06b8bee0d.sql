-- 1. Estende hubspot_owners
ALTER TABLE public.hubspot_owners
  ADD COLUMN IF NOT EXISTS workspace_id uuid,
  ADD COLUMN IF NOT EXISTS mapped_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- Backfill workspace e status
UPDATE public.hubspot_owners
   SET workspace_id = '184b9435-0a9b-4334-9e89-8854dc883f5d'::uuid
 WHERE workspace_id IS NULL;

UPDATE public.hubspot_owners
   SET status = CASE WHEN archived THEN 'archived' ELSE 'active' END;

-- Mapeia owners cujo email bate com profiles existentes
UPDATE public.hubspot_owners ho
   SET mapped_user_id = p.id
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
 WHERE lower(u.email) = lower(ho.email)
   AND ho.mapped_user_id IS NULL;

ALTER TABLE public.hubspot_owners ALTER COLUMN workspace_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_hubspot_owners_workspace ON public.hubspot_owners(workspace_id);
CREATE INDEX IF NOT EXISTS idx_hubspot_owners_mapped_user ON public.hubspot_owners(mapped_user_id);

-- GRANTs + RLS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hubspot_owners TO authenticated;
GRANT ALL ON public.hubspot_owners TO service_role;

ALTER TABLE public.hubspot_owners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hubspot_owners_select ON public.hubspot_owners;
CREATE POLICY hubspot_owners_select ON public.hubspot_owners
  FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()));

DROP POLICY IF EXISTS hubspot_owners_modify ON public.hubspot_owners;
CREATE POLICY hubspot_owners_modify ON public.hubspot_owners
  FOR ALL TO authenticated
  USING (public.is_workspace_admin_v2(workspace_id, auth.uid()) OR workspace_id = auth.uid())
  WITH CHECK (public.is_workspace_admin_v2(workspace_id, auth.uid()) OR workspace_id = auth.uid());

-- 2. Backfill: registros com hubspot_owner_id de Guilherme → assigned_user_id dele
-- (todos já estão atribuídos a ele via owner_id; setamos assigned_user_id explicitamente
--  quando hubspot_owner_id está preenchido para refletir o mapeamento)
UPDATE public.leads
   SET assigned_user_id = ho.mapped_user_id
  FROM public.hubspot_owners ho
 WHERE public.leads.hubspot_owner_id = ho.id
   AND ho.mapped_user_id IS NOT NULL
   AND public.leads.assigned_user_id IS DISTINCT FROM ho.mapped_user_id;

UPDATE public.contacts
   SET assigned_user_id = ho.mapped_user_id
  FROM public.hubspot_owners ho
 WHERE public.contacts.hubspot_owner_id = ho.id
   AND ho.mapped_user_id IS NOT NULL
   AND public.contacts.assigned_user_id IS DISTINCT FROM ho.mapped_user_id;

UPDATE public.companies
   SET assigned_user_id = ho.mapped_user_id
  FROM public.hubspot_owners ho
 WHERE public.companies.hubspot_owner_id = ho.id
   AND ho.mapped_user_id IS NOT NULL
   AND public.companies.assigned_user_id IS DISTINCT FROM ho.mapped_user_id;

UPDATE public.deals
   SET assigned_user_id = ho.mapped_user_id
  FROM public.hubspot_owners ho
 WHERE public.deals.hubspot_owner_id = ho.id
   AND ho.mapped_user_id IS NOT NULL
   AND public.deals.assigned_user_id IS DISTINCT FROM ho.mapped_user_id;