
-- Priority enum (idempotent)
DO $$ BEGIN
  CREATE TYPE public.project_task_priority AS ENUM ('low','normal','high','urgent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ project_spaces ============
CREATE TABLE public.project_spaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT,
  icon TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  archived_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_spaces TO authenticated;
GRANT ALL ON public.project_spaces TO service_role;
ALTER TABLE public.project_spaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY ws_project_spaces_select ON public.project_spaces FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE POLICY ws_project_spaces_insert ON public.project_spaces FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE POLICY ws_project_spaces_update ON public.project_spaces FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()))
  WITH CHECK (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE POLICY ws_project_spaces_delete ON public.project_spaces FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE INDEX project_spaces_workspace_idx ON public.project_spaces(workspace_id);
CREATE TRIGGER project_spaces_updated BEFORE UPDATE ON public.project_spaces
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ project_folders ============
CREATE TABLE public.project_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  space_id UUID NOT NULL REFERENCES public.project_spaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  archived_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_folders TO authenticated;
GRANT ALL ON public.project_folders TO service_role;
ALTER TABLE public.project_folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY ws_project_folders_select ON public.project_folders FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE POLICY ws_project_folders_insert ON public.project_folders FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE POLICY ws_project_folders_update ON public.project_folders FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()))
  WITH CHECK (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE POLICY ws_project_folders_delete ON public.project_folders FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE INDEX project_folders_space_idx ON public.project_folders(space_id);
CREATE TRIGGER project_folders_updated BEFORE UPDATE ON public.project_folders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ project_lists ============
CREATE TABLE public.project_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  space_id UUID NOT NULL REFERENCES public.project_spaces(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES public.project_folders(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  color TEXT,
  icon TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  archived_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_lists TO authenticated;
GRANT ALL ON public.project_lists TO service_role;
ALTER TABLE public.project_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY ws_project_lists_select ON public.project_lists FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE POLICY ws_project_lists_insert ON public.project_lists FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE POLICY ws_project_lists_update ON public.project_lists FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()))
  WITH CHECK (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE POLICY ws_project_lists_delete ON public.project_lists FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE INDEX project_lists_space_idx ON public.project_lists(space_id);
CREATE INDEX project_lists_folder_idx ON public.project_lists(folder_id);
CREATE INDEX project_lists_project_idx ON public.project_lists(project_id);
CREATE TRIGGER project_lists_updated BEFORE UPDATE ON public.project_lists
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ project_task_statuses (custom por lista) ============
CREATE TABLE public.project_task_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  list_id UUID NOT NULL REFERENCES public.project_lists(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  category TEXT NOT NULL DEFAULT 'todo' CHECK (category IN ('todo','doing','done')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_task_statuses TO authenticated;
GRANT ALL ON public.project_task_statuses TO service_role;
ALTER TABLE public.project_task_statuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY ws_project_task_statuses_select ON public.project_task_statuses FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE POLICY ws_project_task_statuses_insert ON public.project_task_statuses FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE POLICY ws_project_task_statuses_update ON public.project_task_statuses FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()))
  WITH CHECK (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE POLICY ws_project_task_statuses_delete ON public.project_task_statuses FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE INDEX project_task_statuses_list_idx ON public.project_task_statuses(list_id);
CREATE TRIGGER project_task_statuses_updated BEFORE UPDATE ON public.project_task_statuses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ Extend project_tasks ============
ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS list_id UUID REFERENCES public.project_lists(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS parent_task_id UUID REFERENCES public.project_tasks(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS custom_status_id UUID REFERENCES public.project_task_statuses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS priority public.project_task_priority NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS start_at DATE;

CREATE INDEX IF NOT EXISTS project_tasks_list_idx ON public.project_tasks(list_id);
CREATE INDEX IF NOT EXISTS project_tasks_parent_idx ON public.project_tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS project_tasks_custom_status_idx ON public.project_tasks(custom_status_id);
