
-- 1) onboarding_templates
CREATE TABLE public.onboarding_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('lead','company','contact')),
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  segment_field TEXT,
  segment_value TEXT,
  workflow_id UUID,
  step_order JSONB NOT NULL DEFAULT '[]'::jsonb,
  field_config JSONB NOT NULL DEFAULT '[]'::jsonb,
  tasks_template JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_templates TO authenticated;
GRANT ALL ON public.onboarding_templates TO service_role;

ALTER TABLE public.onboarding_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "onb_templates_owner_manage"
  ON public.onboarding_templates
  FOR ALL
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "onb_templates_workspace_admin_manage"
  ON public.onboarding_templates
  FOR ALL
  TO authenticated
  USING (
    workspace_id IS NOT NULL
    AND public.is_workspace_admin_v2(auth.uid(), workspace_id)
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND public.is_workspace_admin_v2(auth.uid(), workspace_id)
  );

CREATE INDEX idx_onboarding_templates_owner ON public.onboarding_templates(owner_id);
CREATE INDEX idx_onboarding_templates_entity ON public.onboarding_templates(entity_type, is_active);
CREATE INDEX idx_onboarding_templates_workspace ON public.onboarding_templates(workspace_id) WHERE workspace_id IS NOT NULL;

CREATE TRIGGER update_onboarding_templates_updated_at
  BEFORE UPDATE ON public.onboarding_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) onboarding_runs
CREATE TABLE public.onboarding_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id UUID REFERENCES public.onboarding_templates(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('lead','company','contact')),
  entity_id UUID,
  current_step INTEGER NOT NULL DEFAULT 0,
  form_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','completed','cancelled')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_runs TO authenticated;
GRANT ALL ON public.onboarding_runs TO service_role;

ALTER TABLE public.onboarding_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "onb_runs_owner_manage"
  ON public.onboarding_runs
  FOR ALL
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE INDEX idx_onboarding_runs_owner ON public.onboarding_runs(owner_id, status);
CREATE INDEX idx_onboarding_runs_entity ON public.onboarding_runs(entity_type, entity_id);

CREATE TRIGGER update_onboarding_runs_updated_at
  BEFORE UPDATE ON public.onboarding_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
