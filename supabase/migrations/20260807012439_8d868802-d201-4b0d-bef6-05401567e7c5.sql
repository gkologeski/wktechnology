CREATE TABLE public.contracting_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  description text,
  service_catalog_id uuid REFERENCES public.service_catalog(id) ON DELETE SET NULL,
  job_profile_id uuid REFERENCES public.job_profiles(id) ON DELETE SET NULL,
  seniority text,
  competencies text[] NOT NULL DEFAULT '{}',
  unit text NOT NULL DEFAULT 'mes',
  default_unit_price numeric NOT NULL DEFAULT 0,
  default_unit_cost numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'BRL',
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX contracting_presets_workspace_idx ON public.contracting_presets (workspace_id);
CREATE INDEX contracting_presets_catalog_idx ON public.contracting_presets (service_catalog_id);
CREATE INDEX contracting_presets_job_profile_idx ON public.contracting_presets (job_profile_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contracting_presets TO authenticated;
GRANT ALL ON public.contracting_presets TO service_role;

ALTER TABLE public.contracting_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ws_select_contracting_presets"
  ON public.contracting_presets FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()));

CREATE POLICY "ws_insert_contracting_presets"
  ON public.contracting_presets FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() AND workspace_id IN (SELECT public.current_user_workspaces()));

CREATE POLICY "ws_update_contracting_presets"
  ON public.contracting_presets FOR UPDATE TO authenticated
  USING (
    workspace_id IN (SELECT public.current_user_workspaces())
    AND (owner_id = auth.uid() OR public.is_workspace_admin_v2(workspace_id, auth.uid()))
  )
  WITH CHECK (
    workspace_id IN (SELECT public.current_user_workspaces())
    AND (owner_id = auth.uid() OR public.is_workspace_admin_v2(workspace_id, auth.uid()))
  );

CREATE POLICY "ws_delete_contracting_presets"
  ON public.contracting_presets FOR DELETE TO authenticated
  USING (
    workspace_id IN (SELECT public.current_user_workspaces())
    AND (owner_id = auth.uid() OR public.is_workspace_admin_v2(workspace_id, auth.uid()))
  );

CREATE TRIGGER contracting_presets_touch_updated_at
  BEFORE UPDATE ON public.contracting_presets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();