
-- ============================================================
-- FASE 1: Fundação multi-tenant
-- ============================================================

-- 1) workspaces
CREATE TABLE public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  primary_color TEXT,
  custom_domain TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspaces TO authenticated;
GRANT ALL ON public.workspaces TO service_role;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_workspaces_updated_at
  BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) platform_admins
CREATE TABLE public.platform_admins (
  user_id UUID PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);
GRANT SELECT ON public.platform_admins TO authenticated;
GRANT ALL ON public.platform_admins TO service_role;
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

-- 3) workspace_members
CREATE TABLE public.workspace_members (
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin','manager','member')),
  invited_by UUID,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_members TO authenticated;
GRANT ALL ON public.workspace_members TO service_role;
CREATE INDEX idx_workspace_members_user ON public.workspace_members(user_id);
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- 4) workspace_invites
CREATE TABLE public.workspace_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin','manager','member')),
  token TEXT NOT NULL UNIQUE,
  invited_by UUID NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_invites TO authenticated;
GRANT ALL ON public.workspace_invites TO service_role;
CREATE INDEX idx_workspace_invites_email ON public.workspace_invites(email);
CREATE INDEX idx_workspace_invites_workspace ON public.workspace_invites(workspace_id);
ALTER TABLE public.workspace_invites ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Funções helper (SECURITY DEFINER, evitam recursão em RLS)
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_platform_admin(_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = _user);
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_member(_workspace uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_platform_admin(_user)
      OR EXISTS (
        SELECT 1 FROM public.workspace_members
         WHERE workspace_id = _workspace AND user_id = _user
      );
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_admin_v2(_workspace uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_platform_admin(_user)
      OR EXISTS (
        SELECT 1 FROM public.workspace_members
         WHERE workspace_id = _workspace AND user_id = _user AND role = 'admin'
      );
$$;

CREATE OR REPLACE FUNCTION public.current_user_workspaces()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN public.is_platform_admin(auth.uid())
      THEN (SELECT id FROM public.workspaces)
    ELSE (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
  END;
$$;

-- ============================================================
-- RLS policies
-- ============================================================

-- workspaces: membros veem; só platform_admin cria; admin do workspace edita
CREATE POLICY "ws_select_members" ON public.workspaces
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(id, auth.uid()));

CREATE POLICY "ws_insert_platform" ON public.workspaces
  FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE POLICY "ws_update_admin" ON public.workspaces
  FOR UPDATE TO authenticated
  USING (public.is_workspace_admin_v2(id, auth.uid()));

CREATE POLICY "ws_delete_platform" ON public.workspaces
  FOR DELETE TO authenticated
  USING (public.is_platform_admin(auth.uid()));

-- platform_admins: só platform_admin manipula; cada um vê o próprio registro
CREATE POLICY "pa_select_self_or_admin" ON public.platform_admins
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_platform_admin(auth.uid()));

CREATE POLICY "pa_insert_admin" ON public.platform_admins
  FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE POLICY "pa_delete_admin" ON public.platform_admins
  FOR DELETE TO authenticated
  USING (public.is_platform_admin(auth.uid()));

-- workspace_members: membros do mesmo workspace veem; admin gerencia
CREATE POLICY "wm_select_members" ON public.workspace_members
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "wm_insert_admin" ON public.workspace_members
  FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_admin_v2(workspace_id, auth.uid()));

CREATE POLICY "wm_update_admin" ON public.workspace_members
  FOR UPDATE TO authenticated
  USING (public.is_workspace_admin_v2(workspace_id, auth.uid()));

CREATE POLICY "wm_delete_admin" ON public.workspace_members
  FOR DELETE TO authenticated
  USING (public.is_workspace_admin_v2(workspace_id, auth.uid()));

-- workspace_invites: admin do workspace gerencia
CREATE POLICY "wi_select_admin" ON public.workspace_invites
  FOR SELECT TO authenticated
  USING (public.is_workspace_admin_v2(workspace_id, auth.uid()));

CREATE POLICY "wi_insert_admin" ON public.workspace_invites
  FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_admin_v2(workspace_id, auth.uid()));

CREATE POLICY "wi_update_admin" ON public.workspace_invites
  FOR UPDATE TO authenticated
  USING (public.is_workspace_admin_v2(workspace_id, auth.uid()));

CREATE POLICY "wi_delete_admin" ON public.workspace_invites
  FOR DELETE TO authenticated
  USING (public.is_workspace_admin_v2(workspace_id, auth.uid()));

-- ============================================================
-- Seed: guilherme@wktechnology.com.br como super-admin
-- ============================================================
INSERT INTO public.platform_admins (user_id)
VALUES ('1c237fbe-079e-4eb9-a3e6-c08d85e79688')
ON CONFLICT DO NOTHING;
