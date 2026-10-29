CREATE INDEX IF NOT EXISTS project_tasks_project_status_sort_idx ON public.project_tasks (project_id, status, sort_order, created_at, id);
-- Superfície protegida: leitura de project_tasks segue a política RLS work_view existente; só índices.
COMMENT ON TABLE public.project_tasks IS 'Tarefas do TechProjects (RLS por workspace e escopo).';
