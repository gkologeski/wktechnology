
-- Sprint E refino: Custom Fields por lista + List Templates

-- ============ CUSTOM FIELDS POR LISTA ============
CREATE TABLE IF NOT EXISTS public.project_list_custom_fields (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  list_id UUID NOT NULL REFERENCES public.project_lists(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('text','number','date','select','checkbox','url')),
  options JSONB,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (list_id, key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_list_custom_fields TO authenticated;
GRANT ALL ON public.project_list_custom_fields TO service_role;
ALTER TABLE public.project_list_custom_fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY plcf_ws ON public.project_list_custom_fields
  FOR ALL TO authenticated
  USING (workspace_id IN (SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()))
  WITH CHECK (workspace_id IN (SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()));

CREATE TRIGGER trg_plcf_upd BEFORE UPDATE ON public.project_list_custom_fields
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Valores dos custom fields (JSON simples anexado à tarefa).
-- Armazenados em coluna custom_field_values na tabela project_tasks para simplicidade.
ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS custom_field_values JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ============ LIST TEMPLATES ============
CREATE TABLE IF NOT EXISTS public.project_list_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  statuses JSONB NOT NULL DEFAULT '[]'::jsonb,
  custom_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_list_templates TO authenticated;
GRANT ALL ON public.project_list_templates TO service_role;
ALTER TABLE public.project_list_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY plt_ws ON public.project_list_templates
  FOR ALL TO authenticated
  USING (workspace_id IN (SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()))
  WITH CHECK (workspace_id IN (SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()));

CREATE TRIGGER trg_plt_upd BEFORE UPDATE ON public.project_list_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
