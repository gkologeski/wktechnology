
-- Enum for data scope
DO $$ BEGIN
  CREATE TYPE public.data_scope AS ENUM ('own','team','workspace','custom');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add column to job_roles
ALTER TABLE public.job_roles
  ADD COLUMN IF NOT EXISTS data_scope public.data_scope NOT NULL DEFAULT 'workspace';

-- Effective scope for user in a workspace (most permissive across roles).
-- Owner/admin => 'workspace'.
CREATE OR REPLACE FUNCTION public.user_data_scope(_user_id uuid, _workspace_id uuid)
RETURNS public.data_scope
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_role text;
  v_created_by uuid;
  v_scope public.data_scope;
BEGIN
  SELECT created_by INTO v_created_by FROM public.workspaces WHERE id = _workspace_id;
  IF v_created_by = _user_id THEN RETURN 'workspace'; END IF;

  SELECT role INTO v_role FROM public.workspace_members
   WHERE workspace_id = _workspace_id AND user_id = _user_id LIMIT 1;
  IF v_role IN ('owner','admin') THEN RETURN 'workspace'; END IF;

  -- Order: workspace > team > custom > own
  SELECT jr.data_scope INTO v_scope
    FROM public.user_job_roles ujr
    JOIN public.job_roles jr ON jr.id = ujr.role_id
   WHERE ujr.user_id = _user_id AND ujr.workspace_id = _workspace_id
   ORDER BY CASE jr.data_scope
     WHEN 'workspace' THEN 1
     WHEN 'team' THEN 2
     WHEN 'custom' THEN 3
     WHEN 'own' THEN 4
   END
   LIMIT 1;

  RETURN COALESCE(v_scope, 'own');
END $$;

GRANT EXECUTE ON FUNCTION public.user_data_scope(uuid, uuid) TO authenticated, service_role;

-- Can a user see records owned by _owner_id inside _workspace_id?
-- team => share at least one user_group; custom => treated as workspace (until Fase 6).
CREATE OR REPLACE FUNCTION public.user_can_view_owner(_user_id uuid, _workspace_id uuid, _owner_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_scope public.data_scope;
BEGIN
  IF _user_id = _owner_id THEN RETURN true; END IF;
  v_scope := public.user_data_scope(_user_id, _workspace_id);
  IF v_scope IN ('workspace','custom') THEN RETURN true; END IF;
  IF v_scope = 'own' THEN RETURN false; END IF;
  -- team: shares a group
  RETURN EXISTS (
    SELECT 1
      FROM public.user_group_members a
      JOIN public.user_group_members b ON a.group_id = b.group_id
     WHERE a.user_id = _user_id AND b.user_id = _owner_id
  );
END $$;

GRANT EXECUTE ON FUNCTION public.user_can_view_owner(uuid, uuid, uuid) TO authenticated, service_role;
