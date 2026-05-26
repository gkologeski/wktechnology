
DO $$ BEGIN
  CREATE TYPE public.access_scope AS ENUM ('none','own','team','all');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.access_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  base_role app_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_owner_id, name)
);
CREATE INDEX IF NOT EXISTS idx_access_profiles_ws ON public.access_profiles(workspace_owner_id);

CREATE TABLE IF NOT EXISTS public.access_profile_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.access_profiles(id) ON DELETE CASCADE,
  object_key TEXT NOT NULL,
  view_scope public.access_scope NOT NULL DEFAULT 'none',
  edit_scope public.access_scope NOT NULL DEFAULT 'none',
  delete_scope public.access_scope NOT NULL DEFAULT 'none',
  create_enabled BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (profile_id, object_key)
);
CREATE INDEX IF NOT EXISTS idx_app_permissions_profile ON public.access_profile_permissions(profile_id);

CREATE TABLE IF NOT EXISTS public.access_profile_tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.access_profiles(id) ON DELETE CASCADE,
  tool_key TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (profile_id, tool_key)
);
CREATE INDEX IF NOT EXISTS idx_app_tools_profile ON public.access_profile_tools(profile_id);

ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS access_profile_id UUID REFERENCES public.access_profiles(id) ON DELETE SET NULL;

ALTER TABLE public.access_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_profile_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_profile_tools ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ap_owner_all" ON public.access_profiles;
CREATE POLICY "ap_owner_all" ON public.access_profiles
  FOR ALL TO authenticated
  USING (workspace_owner_id = auth.uid())
  WITH CHECK (workspace_owner_id = auth.uid());

DROP POLICY IF EXISTS "ap_member_select" ON public.access_profiles;
CREATE POLICY "ap_member_select" ON public.access_profiles
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.workspace_owner_id = public.access_profiles.workspace_owner_id
      AND tm.member_user_id = auth.uid()
      AND tm.access_profile_id = public.access_profiles.id
  ));

DROP POLICY IF EXISTS "app_perm_owner_all" ON public.access_profile_permissions;
CREATE POLICY "app_perm_owner_all" ON public.access_profile_permissions
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.access_profiles p WHERE p.id = profile_id AND p.workspace_owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.access_profiles p WHERE p.id = profile_id AND p.workspace_owner_id = auth.uid()));

DROP POLICY IF EXISTS "app_perm_member_select" ON public.access_profile_permissions;
CREATE POLICY "app_perm_member_select" ON public.access_profile_permissions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1
      FROM public.access_profiles p
      JOIN public.team_members tm
        ON tm.workspace_owner_id = p.workspace_owner_id
       AND tm.access_profile_id = p.id
     WHERE p.id = profile_id AND tm.member_user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "app_tool_owner_all" ON public.access_profile_tools;
CREATE POLICY "app_tool_owner_all" ON public.access_profile_tools
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.access_profiles p WHERE p.id = profile_id AND p.workspace_owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.access_profiles p WHERE p.id = profile_id AND p.workspace_owner_id = auth.uid()));

DROP POLICY IF EXISTS "app_tool_member_select" ON public.access_profile_tools;
CREATE POLICY "app_tool_member_select" ON public.access_profile_tools
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1
      FROM public.access_profiles p
      JOIN public.team_members tm
        ON tm.workspace_owner_id = p.workspace_owner_id
       AND tm.access_profile_id = p.id
     WHERE p.id = profile_id AND tm.member_user_id = auth.uid()
  ));

DROP TRIGGER IF EXISTS trg_access_profiles_updated_at ON public.access_profiles;
CREATE TRIGGER trg_access_profiles_updated_at
BEFORE UPDATE ON public.access_profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.seed_access_profiles(_workspace UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin UUID;
  v_manager UUID;
  v_member UUID;
  v_obj TEXT;
  v_tool TEXT;
  v_objects TEXT[] := ARRAY[
    'contacts','companies','leads','deals','tickets','tasks',
    'notes','calls','meetings','emails','activities','products','quotes'
  ];
  v_tools TEXT[] := ARRAY[
    'communicate','import','export','bulk_delete',
    'manage_workflows','manage_properties','manage_pipelines',
    'access_logs','manage_integrations','manage_billing','manage_users'
  ];
BEGIN
  IF EXISTS (SELECT 1 FROM public.access_profiles WHERE workspace_owner_id = _workspace AND is_system) THEN
    RETURN;
  END IF;

  INSERT INTO public.access_profiles (workspace_owner_id, name, description, is_system, base_role)
  VALUES (_workspace, 'Admin', 'Acesso completo a todos os recursos e configurações.', true, 'admin')
  RETURNING id INTO v_admin;

  INSERT INTO public.access_profiles (workspace_owner_id, name, description, is_system, base_role)
  VALUES (_workspace, 'Gestor', 'Gerencia equipe e pipelines, sem acesso a billing.', true, 'manager')
  RETURNING id INTO v_manager;

  INSERT INTO public.access_profiles (workspace_owner_id, name, description, is_system, base_role)
  VALUES (_workspace, 'Membro', 'Acesso operacional aos próprios registros.', true, 'member')
  RETURNING id INTO v_member;

  FOREACH v_obj IN ARRAY v_objects LOOP
    INSERT INTO public.access_profile_permissions (profile_id, object_key, view_scope, edit_scope, delete_scope, create_enabled)
    VALUES (v_admin,   v_obj, 'all',  'all',  'all',  true);
    INSERT INTO public.access_profile_permissions (profile_id, object_key, view_scope, edit_scope, delete_scope, create_enabled)
    VALUES (v_manager, v_obj, 'all',  'team', 'team', true);
    INSERT INTO public.access_profile_permissions (profile_id, object_key, view_scope, edit_scope, delete_scope, create_enabled)
    VALUES (v_member,  v_obj, 'team', 'own',  'own',  true);
  END LOOP;

  FOREACH v_tool IN ARRAY v_tools LOOP
    INSERT INTO public.access_profile_tools (profile_id, tool_key, enabled) VALUES (v_admin, v_tool, true);
    INSERT INTO public.access_profile_tools (profile_id, tool_key, enabled) VALUES (v_manager, v_tool,
      v_tool NOT IN ('manage_billing','manage_users','manage_integrations'));
    INSERT INTO public.access_profile_tools (profile_id, tool_key, enabled) VALUES (v_member, v_tool,
      v_tool IN ('communicate','export'));
  END LOOP;

  -- backfill from team_members.role (team_role: owner/admin/member) and user_roles
  UPDATE public.team_members tm
     SET access_profile_id = CASE
       WHEN tm.role::text = 'admin' THEN v_admin
       WHEN tm.role::text = 'owner' THEN v_admin
       ELSE v_member
     END
   WHERE tm.workspace_owner_id = _workspace AND tm.access_profile_id IS NULL;

  -- bump manager-role users (app_role) to Gestor profile
  UPDATE public.team_members tm
     SET access_profile_id = v_manager
   WHERE tm.workspace_owner_id = _workspace
     AND tm.access_profile_id = v_member
     AND EXISTS (
       SELECT 1 FROM public.user_roles ur
       WHERE ur.workspace_owner_id = _workspace
         AND ur.user_id = tm.member_user_id
         AND ur.role = 'manager'
     );
END;
$$;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT workspace_owner_id FROM public.team_members
    UNION
    SELECT DISTINCT workspace_owner_id FROM public.user_roles
  LOOP
    PERFORM public.seed_access_profiles(r.workspace_owner_id);
  END LOOP;
END $$;
