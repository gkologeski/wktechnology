
DO $$ BEGIN CREATE TYPE public.perm_scope AS ENUM ('own','team','workspace','org'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.perm_action AS ENUM ('view','create','update','delete','export','approve','assign','manage'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.field_mode AS ENUM ('hidden','masked','readonly'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.permissions (
  key text PRIMARY KEY,
  module text NOT NULL,
  resource text NOT NULL,
  action public.perm_action NOT NULL,
  scope public.perm_scope NOT NULL,
  label_pt text NOT NULL,
  description text,
  is_system boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.permissions TO authenticated;
GRANT ALL ON public.permissions TO service_role;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "permissions_read" ON public.permissions FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.permission_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NULL,
  module text NOT NULL,
  name text NOT NULL,
  description text,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, module, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.permission_sets TO authenticated;
GRANT ALL ON public.permission_sets TO service_role;
ALTER TABLE public.permission_sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "psets_read" ON public.permission_sets FOR SELECT TO authenticated
  USING (is_system OR workspace_id = auth.uid() OR public.shares_workspace_with(workspace_id));
CREATE POLICY "psets_write" ON public.permission_sets FOR ALL TO authenticated
  USING (workspace_id = auth.uid()) WITH CHECK (workspace_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.permission_set_items (
  set_id uuid NOT NULL REFERENCES public.permission_sets(id) ON DELETE CASCADE,
  permission_key text NOT NULL REFERENCES public.permissions(key) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (set_id, permission_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.permission_set_items TO authenticated;
GRANT ALL ON public.permission_set_items TO service_role;
ALTER TABLE public.permission_set_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "psi_read" ON public.permission_set_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.permission_sets s WHERE s.id = set_id
    AND (s.is_system OR s.workspace_id = auth.uid() OR public.shares_workspace_with(s.workspace_id))));
CREATE POLICY "psi_write" ON public.permission_set_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.permission_sets s WHERE s.id = set_id AND s.workspace_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.permission_sets s WHERE s.id = set_id AND s.workspace_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.job_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NULL,
  name text NOT NULL,
  description text,
  color text,
  icon text,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_roles TO authenticated;
GRANT ALL ON public.job_roles TO service_role;
ALTER TABLE public.job_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "jr_read" ON public.job_roles FOR SELECT TO authenticated
  USING (is_system OR workspace_id = auth.uid() OR public.shares_workspace_with(workspace_id));
CREATE POLICY "jr_write" ON public.job_roles FOR ALL TO authenticated
  USING (workspace_id = auth.uid()) WITH CHECK (workspace_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.job_role_sets (
  role_id uuid NOT NULL REFERENCES public.job_roles(id) ON DELETE CASCADE,
  set_id uuid NOT NULL REFERENCES public.permission_sets(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, set_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_role_sets TO authenticated;
GRANT ALL ON public.job_role_sets TO service_role;
ALTER TABLE public.job_role_sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "jrs_read" ON public.job_role_sets FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.job_roles r WHERE r.id = role_id
    AND (r.is_system OR r.workspace_id = auth.uid() OR public.shares_workspace_with(r.workspace_id))));
CREATE POLICY "jrs_write" ON public.job_role_sets FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.job_roles r WHERE r.id = role_id AND r.workspace_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.job_roles r WHERE r.id = role_id AND r.workspace_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.user_job_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  role_id uuid NOT NULL REFERENCES public.job_roles(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, workspace_id, role_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_job_roles TO authenticated;
GRANT ALL ON public.user_job_roles TO service_role;
ALTER TABLE public.user_job_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ujr_read" ON public.user_job_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR workspace_id = auth.uid() OR public.shares_workspace_with(workspace_id));
CREATE POLICY "ujr_write" ON public.user_job_roles FOR ALL TO authenticated
  USING (workspace_id = auth.uid()) WITH CHECK (workspace_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.user_permission_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  set_id uuid NOT NULL REFERENCES public.permission_sets(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, workspace_id, set_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_permission_sets TO authenticated;
GRANT ALL ON public.user_permission_sets TO service_role;
ALTER TABLE public.user_permission_sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ups_read" ON public.user_permission_sets FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR workspace_id = auth.uid() OR public.shares_workspace_with(workspace_id));
CREATE POLICY "ups_write" ON public.user_permission_sets FOR ALL TO authenticated
  USING (workspace_id = auth.uid()) WITH CHECK (workspace_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.field_permission_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NULL,
  role_id uuid NULL REFERENCES public.job_roles(id) ON DELETE CASCADE,
  set_id uuid NULL REFERENCES public.permission_sets(id) ON DELETE CASCADE,
  resource text NOT NULL,
  field text NOT NULL,
  mode public.field_mode NOT NULL,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (role_id IS NOT NULL OR set_id IS NOT NULL)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.field_permission_rules TO authenticated;
GRANT ALL ON public.field_permission_rules TO service_role;
ALTER TABLE public.field_permission_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fpr_read" ON public.field_permission_rules FOR SELECT TO authenticated
  USING (is_system OR workspace_id = auth.uid() OR public.shares_workspace_with(workspace_id));
CREATE POLICY "fpr_write" ON public.field_permission_rules FOR ALL TO authenticated
  USING (workspace_id = auth.uid()) WITH CHECK (workspace_id = auth.uid());

CREATE OR REPLACE FUNCTION public.user_has_permission(_user uuid, _perm text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_job_roles ujr
    JOIN public.job_role_sets jrs ON jrs.role_id = ujr.role_id
    JOIN public.permission_set_items psi ON psi.set_id = jrs.set_id
    WHERE ujr.user_id = _user AND psi.permission_key = _perm
  ) OR EXISTS (
    SELECT 1 FROM public.user_permission_sets ups
    JOIN public.permission_set_items psi ON psi.set_id = ups.set_id
    WHERE ups.user_id = _user AND psi.permission_key = _perm
  );
$$;
GRANT EXECUTE ON FUNCTION public.user_has_permission(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.user_field_visibility(_user uuid, _resource text, _field text)
RETURNS public.field_mode LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT fpr.mode FROM public.field_permission_rules fpr
  WHERE fpr.resource = _resource AND fpr.field = _field
    AND (
      (fpr.role_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.user_job_roles ujr WHERE ujr.user_id = _user AND ujr.role_id = fpr.role_id))
      OR (fpr.set_id IS NOT NULL AND (
        EXISTS (SELECT 1 FROM public.user_permission_sets ups WHERE ups.user_id = _user AND ups.set_id = fpr.set_id)
        OR EXISTS (SELECT 1 FROM public.user_job_roles ujr JOIN public.job_role_sets jrs ON jrs.role_id = ujr.role_id WHERE ujr.user_id = _user AND jrs.set_id = fpr.set_id)
      ))
    )
  ORDER BY CASE fpr.mode WHEN 'hidden' THEN 1 WHEN 'masked' THEN 2 WHEN 'readonly' THEN 3 END LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.user_field_visibility(uuid, text, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.set_updated_at_perm()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS trg_permission_sets_updated ON public.permission_sets;
CREATE TRIGGER trg_permission_sets_updated BEFORE UPDATE ON public.permission_sets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_perm();
DROP TRIGGER IF EXISTS trg_job_roles_updated ON public.job_roles;
CREATE TRIGGER trg_job_roles_updated BEFORE UPDATE ON public.job_roles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_perm();
