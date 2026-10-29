CREATE INDEX IF NOT EXISTS project_tasks_list_order_idx ON public.project_tasks (due_at ASC NULLS LAST, created_at DESC, id);
CREATE INDEX IF NOT EXISTS project_tasks_ws_due_created_idx ON public.project_tasks (workspace_id, due_at ASC NULLS LAST, created_at DESC, id);
-- Superfície protegida: leitura de project_tasks segue a política RLS work_view existente; só índices.
COMMENT ON TABLE public.project_tasks IS 'Tarefas do TechProjects (RLS por workspace e escopo).';
