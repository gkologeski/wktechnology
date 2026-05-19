-- Item 11 — Roles & Permissions
-- Enum de roles + tabela user_roles + função has_role (security definer)

DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'member');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_owner_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role public.app_role NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_owner_id, user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_workspace ON public.user_roles(workspace_owner_id);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_workspace uuid, _user uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE workspace_owner_id = _workspace
      AND user_id = _user
      AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_admin(_workspace uuid, _user uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT _workspace = _user
      OR public.has_role(_workspace, _user, 'admin');
$$;

DROP POLICY IF EXISTS user_roles_select ON public.user_roles;
CREATE POLICY user_roles_select ON public.user_roles
  FOR SELECT TO authenticated
  USING (
    workspace_owner_id = auth.uid()
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS user_roles_admin_modify ON public.user_roles;
CREATE POLICY user_roles_admin_modify ON public.user_roles
  FOR ALL TO authenticated
  USING (workspace_owner_id = auth.uid())
  WITH CHECK (workspace_owner_id = auth.uid());
