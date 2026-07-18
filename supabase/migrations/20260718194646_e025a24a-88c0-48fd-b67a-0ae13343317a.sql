
CREATE TABLE public.project_task_dependencies (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL,
  task_id uuid NOT NULL REFERENCES public.project_tasks(id) ON DELETE CASCADE,
  depends_on_task_id uuid NOT NULL REFERENCES public.project_tasks(id) ON DELETE CASCADE,
  dep_type text NOT NULL DEFAULT 'finish_to_start' CHECK (dep_type IN ('finish_to_start','start_to_start','finish_to_finish','start_to_finish')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_task_dep_no_self CHECK (task_id <> depends_on_task_id),
  CONSTRAINT project_task_dep_unique UNIQUE (task_id, depends_on_task_id)
);
CREATE INDEX idx_ptd_task ON public.project_task_dependencies(task_id);
CREATE INDEX idx_ptd_depends ON public.project_task_dependencies(depends_on_task_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_task_dependencies TO authenticated;
GRANT ALL ON public.project_task_dependencies TO service_role;
ALTER TABLE public.project_task_dependencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ws members read task deps" ON public.project_task_dependencies
  FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "ws members write task deps" ON public.project_task_dependencies
  FOR ALL TO authenticated USING (public.is_workspace_member(workspace_id, auth.uid())) WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));

CREATE TABLE public.project_task_checklists (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL,
  task_id uuid NOT NULL REFERENCES public.project_tasks(id) ON DELETE CASCADE,
  title text NOT NULL,
  is_done boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  done_at timestamptz,
  done_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ptc_task ON public.project_task_checklists(task_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_task_checklists TO authenticated;
GRANT ALL ON public.project_task_checklists TO service_role;
ALTER TABLE public.project_task_checklists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ws members read checklist" ON public.project_task_checklists
  FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "ws members write checklist" ON public.project_task_checklists
  FOR ALL TO authenticated USING (public.is_workspace_member(workspace_id, auth.uid())) WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));
CREATE TRIGGER trg_ptc_updated BEFORE UPDATE ON public.project_task_checklists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS assignee_ids uuid[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_project_tasks_tags ON public.project_tasks USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_project_tasks_assignee_ids ON public.project_tasks USING GIN (assignee_ids);

ALTER TABLE public.project_time_entries
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS stopped_at timestamptz,
  ADD COLUMN IF NOT EXISTS hourly_rate numeric(12,2),
  ADD COLUMN IF NOT EXISTS financial_entry_id uuid,
  ALTER COLUMN entry_date DROP NOT NULL,
  ALTER COLUMN hours DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_running_timer_per_user
  ON public.project_time_entries(user_id)
  WHERE stopped_at IS NULL AND started_at IS NOT NULL;
