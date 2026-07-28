
ALTER TABLE public.workspace_invites
  ADD COLUMN IF NOT EXISTS permission_set_id uuid
    REFERENCES public.permission_sets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_workspace_invites_permission_set
  ON public.workspace_invites(permission_set_id);
