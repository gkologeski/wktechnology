
-- Fase A: Fundação multi-módulo do ERP

-- 1) Catálogo de módulos
CREATE TABLE public.modules (
  id text PRIMARY KEY,
  name text NOT NULL,
  host_suffix text,
  default_color text NOT NULL DEFAULT '#2563eb',
  default_product_name text NOT NULL,
  icon text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.modules TO authenticated, anon;
GRANT ALL ON public.modules TO service_role;

ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Modules are readable by anyone"
  ON public.modules FOR SELECT USING (true);

INSERT INTO public.modules (id, name, default_product_name, default_color, icon, sort_order) VALUES
  ('crm', 'CRM', 'TechSales', '#2563eb', 'briefcase', 10),
  ('ats', 'ATS', 'TechHire',  '#7c3aed', 'users',     20);

-- 2) Ativação de módulos por workspace
CREATE TABLE public.workspace_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  module_id text NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  plan_code text REFERENCES public.plans(code),
  activated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, module_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_modules TO authenticated;
GRANT ALL ON public.workspace_modules TO service_role;

ALTER TABLE public.workspace_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read workspace_modules"
  ON public.workspace_modules FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = workspace_modules.workspace_id
              AND wm.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.workspaces w
               WHERE w.id = workspace_modules.workspace_id
                 AND w.created_by = auth.uid())
  );

CREATE POLICY "Owners manage workspace_modules"
  ON public.workspace_modules FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workspaces w
                 WHERE w.id = workspace_modules.workspace_id
                   AND w.created_by = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces w
                      WHERE w.id = workspace_modules.workspace_id
                        AND w.created_by = auth.uid()));

INSERT INTO public.workspace_modules (workspace_id, module_id, enabled)
SELECT w.id, 'crm', true FROM public.workspaces w
ON CONFLICT (workspace_id, module_id) DO NOTHING;

-- 3) Branding por módulo
CREATE TABLE public.module_branding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  module_id text NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  product_name text,
  logo_url text,
  favicon_url text,
  primary_color text,
  secondary_color text,
  custom_domain text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, module_id)
);

GRANT SELECT ON public.module_branding TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.module_branding TO authenticated;
GRANT ALL ON public.module_branding TO service_role;

ALTER TABLE public.module_branding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read module branding"
  ON public.module_branding FOR SELECT USING (true);

CREATE POLICY "Owners manage module branding"
  ON public.module_branding FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workspaces w
                 WHERE w.id = module_branding.workspace_id
                   AND w.created_by = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces w
                      WHERE w.id = module_branding.workspace_id
                        AND w.created_by = auth.uid()));

-- 4) Eixo "module_id" em tabelas multi-módulo
ALTER TABLE public.plan_entitlements
  ADD COLUMN IF NOT EXISTS module_id text REFERENCES public.modules(id);

UPDATE public.plan_entitlements
  SET module_id = CASE
    WHEN key LIKE 'feature_ats%' OR key LIKE 'ats_%' THEN 'ats'
    ELSE 'crm'
  END
  WHERE module_id IS NULL;

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS module_id text;
UPDATE public.audit_logs SET module_id = 'crm' WHERE module_id IS NULL;
CREATE INDEX IF NOT EXISTS audit_logs_module_idx ON public.audit_logs(module_id);

ALTER TABLE public.access_profile_permissions
  ADD COLUMN IF NOT EXISTS module_id text REFERENCES public.modules(id);
UPDATE public.access_profile_permissions SET module_id = 'crm' WHERE module_id IS NULL;

-- 5) Triggers de updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at_modules()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_modules_updated BEFORE UPDATE ON public.modules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_modules();
CREATE TRIGGER trg_workspace_modules_updated BEFORE UPDATE ON public.workspace_modules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_modules();
CREATE TRIGGER trg_module_branding_updated BEFORE UPDATE ON public.module_branding
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_modules();
