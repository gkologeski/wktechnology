
-- Sprint 6: Onboarding & Offboarding para TechPeople

-- 1. Templates de onboarding/offboarding (checklists reutilizáveis)
CREATE TABLE public.people_onboarding_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('onboarding','offboarding')),
  role_title TEXT,
  employment_type TEXT,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_onb_tpl_workspace ON public.people_onboarding_templates(workspace_id, kind, is_active);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.people_onboarding_templates TO authenticated;
GRANT ALL ON public.people_onboarding_templates TO service_role;

ALTER TABLE public.people_onboarding_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "onb_tpl_ws_read" ON public.people_onboarding_templates
  FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()));
CREATE POLICY "onb_tpl_ws_admin_write" ON public.people_onboarding_templates
  FOR ALL TO authenticated
  USING (public.is_workspace_admin(auth.uid(), workspace_id))
  WITH CHECK (public.is_workspace_admin(auth.uid(), workspace_id));

-- 2. Planos (instância aplicada a uma pessoa)
CREATE TABLE public.people_onboarding_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  template_id UUID REFERENCES public.people_onboarding_templates(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('onboarding','offboarding')),
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('not_started','in_progress','completed','canceled')),
  started_at DATE,
  target_completion_date DATE,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_onb_plans_person ON public.people_onboarding_plans(person_id);
CREATE INDEX idx_onb_plans_workspace ON public.people_onboarding_plans(workspace_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.people_onboarding_plans TO authenticated;
GRANT ALL ON public.people_onboarding_plans TO service_role;

ALTER TABLE public.people_onboarding_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "onb_plans_ws_read" ON public.people_onboarding_plans
  FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()));
CREATE POLICY "onb_plans_ws_admin_write" ON public.people_onboarding_plans
  FOR ALL TO authenticated
  USING (public.is_workspace_admin(auth.uid(), workspace_id))
  WITH CHECK (public.is_workspace_admin(auth.uid(), workspace_id));

-- 3. Tarefas do plano
CREATE TABLE public.people_onboarding_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL,
  plan_id UUID NOT NULL REFERENCES public.people_onboarding_plans(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','done','blocked','skipped')),
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_onb_tasks_plan ON public.people_onboarding_tasks(plan_id, order_index);
CREATE INDEX idx_onb_tasks_assignee ON public.people_onboarding_tasks(assignee_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.people_onboarding_tasks TO authenticated;
GRANT ALL ON public.people_onboarding_tasks TO service_role;

ALTER TABLE public.people_onboarding_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "onb_tasks_ws_read" ON public.people_onboarding_tasks
  FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()));
CREATE POLICY "onb_tasks_ws_admin_write" ON public.people_onboarding_tasks
  FOR ALL TO authenticated
  USING (public.is_workspace_admin(auth.uid(), workspace_id))
  WITH CHECK (public.is_workspace_admin(auth.uid(), workspace_id));
CREATE POLICY "onb_tasks_assignee_update" ON public.people_onboarding_tasks
  FOR UPDATE TO authenticated
  USING (assignee_id = auth.uid())
  WITH CHECK (assignee_id = auth.uid());

-- Trigger updated_at
CREATE TRIGGER trg_onb_tpl_updated BEFORE UPDATE ON public.people_onboarding_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_onb_plans_updated BEFORE UPDATE ON public.people_onboarding_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_onb_tasks_updated BEFORE UPDATE ON public.people_onboarding_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
