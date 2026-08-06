CREATE TABLE public.job_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL DEFAULT '184b9435-0a9b-4334-9e89-8854dc883f5d'::uuid,
  owner_id uuid NOT NULL,
  created_by uuid,
  name text NOT NULL,
  code text,
  description text,
  service_catalog_id uuid REFERENCES public.service_catalog(id) ON DELETE SET NULL,
  seniority text,
  default_unit_price numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'BRL',
  competencies text[] NOT NULL DEFAULT '{}',
  tags text[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_profiles TO authenticated;
GRANT ALL ON public.job_profiles TO service_role;

ALTER TABLE public.job_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY ws_select_job_profiles ON public.job_profiles FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT current_user_workspaces()));
CREATE POLICY ws_insert_job_profiles ON public.job_profiles FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() AND workspace_id IN (SELECT current_user_workspaces()));
CREATE POLICY ws_update_job_profiles ON public.job_profiles FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT current_user_workspaces()))
  WITH CHECK (workspace_id IN (SELECT current_user_workspaces()));
CREATE POLICY ws_delete_job_profiles ON public.job_profiles FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT current_user_workspaces()));

CREATE INDEX idx_job_profiles_workspace ON public.job_profiles(workspace_id);
CREATE INDEX idx_job_profiles_catalog ON public.job_profiles(service_catalog_id);

CREATE TRIGGER trg_job_profiles_updated_at
  BEFORE UPDATE ON public.job_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS job_profile_id uuid REFERENCES public.job_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS seniority text,
  ADD COLUMN IF NOT EXISTS competencies text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_services_job_profile ON public.services(job_profile_id);

INSERT INTO public.service_catalog (workspace_id, owner_id, created_by, name, code, category, service_type, unit, base_price, cost, currency, tax_rate, active)
SELECT '184b9435-0a9b-4334-9e89-8854dc883f5d'::uuid, '1c237fbe-079e-4eb9-a3e6-c08d85e79688'::uuid, '1c237fbe-079e-4eb9-a3e6-c08d85e79688'::uuid,
       v.name, v.code, v.category, 'recurring', 'month', 0, 0, 'BRL', 0, true
FROM (VALUES
  ('BPO Administrativo/Financeiro', 'BPO001', 'BPO'),
  ('Recursos Humanos (BPO)', 'BPO002', 'BPO')
) AS v(name, code, category)
WHERE NOT EXISTS (
  SELECT 1 FROM public.service_catalog sc WHERE sc.name = v.name
);