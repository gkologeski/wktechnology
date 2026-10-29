-- A regra de acesso das tarefas roda antes do filtro de situação (comparação de enum não é
-- "leakproof"), então o banco não usa (project_id, status, ...) e confere a permissão de
-- todas as tarefas do projeto. Índices parciais por situação já entregam só as linhas certas.
CREATE INDEX IF NOT EXISTS project_tasks_proj_todo_idx ON public.project_tasks (project_id, sort_order, created_at, id) WHERE status = 'todo';
CREATE INDEX IF NOT EXISTS project_tasks_proj_doing_idx ON public.project_tasks (project_id, sort_order, created_at, id) WHERE status = 'doing';
CREATE INDEX IF NOT EXISTS project_tasks_proj_review_idx ON public.project_tasks (project_id, sort_order, created_at, id) WHERE status = 'review';
CREATE INDEX IF NOT EXISTS project_tasks_proj_done_idx ON public.project_tasks (project_id, sort_order, created_at, id) WHERE status = 'done';
DROP INDEX IF EXISTS public.project_tasks_project_status_sort_idx;
-- Superfície protegida: leitura de project_tasks segue a política RLS work_view existente; só índices.
COMMENT ON TABLE public.project_tasks IS 'Tarefas do TechProjects (RLS por workspace e escopo).';
