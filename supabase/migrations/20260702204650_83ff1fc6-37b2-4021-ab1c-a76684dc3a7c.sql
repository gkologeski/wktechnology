
CREATE TABLE IF NOT EXISTS public.access_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid,
  actor_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  target_user_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS access_audit_log_ws_idx
  ON public.access_audit_log (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS access_audit_log_actor_idx
  ON public.access_audit_log (actor_id, created_at DESC);

GRANT SELECT, INSERT ON public.access_audit_log TO authenticated;
GRANT ALL ON public.access_audit_log TO service_role;

ALTER TABLE public.access_audit_log ENABLE ROW LEVEL SECURITY;

-- Only workspace owner/admin can read audit
CREATE POLICY "audit read owner/admin"
  ON public.access_audit_log FOR SELECT
  TO authenticated
  USING (
    workspace_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.workspaces w
       WHERE w.id = workspace_id AND w.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.workspace_members m
       WHERE m.workspace_id = access_audit_log.workspace_id
         AND m.user_id = auth.uid()
         AND m.role IN ('owner','admin')
    )
  );

-- Any authenticated user can write their own audit rows (server fns guard the action).
CREATE POLICY "audit insert self"
  ON public.access_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (actor_id = auth.uid());
