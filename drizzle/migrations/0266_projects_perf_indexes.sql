CREATE INDEX IF NOT EXISTS idx_project_tasks_project_sort ON public.project_tasks (project_id, sort_order, created_at);
CREATE INDEX IF NOT EXISTS idx_projects_ws_created ON public.projects (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_time_entries_project_billable ON public.project_time_entries (project_id) INCLUDE (user_id, hours, billable);
-- Superfície protegida: leitura de project_tasks/projects/project_time_entries segue as políticas RLS existentes; só índices.
COMMENT ON TABLE public.project_tasks IS 'Tarefas do TechProjects (RLS por workspace e escopo).';
