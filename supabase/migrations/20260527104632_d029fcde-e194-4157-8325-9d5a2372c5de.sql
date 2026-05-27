
-- Make workspace_id the unique key for branding
ALTER TABLE public.workspace_branding
  ADD CONSTRAINT workspace_branding_workspace_id_unique UNIQUE (workspace_id);

-- Update RLS: any member can read; only workspace admins (or platform admin) can write
DROP POLICY IF EXISTS "branding owner/admin all" ON public.workspace_branding;

CREATE POLICY "branding workspace read"
  ON public.workspace_branding
  FOR SELECT
  TO authenticated
  USING (
    public.is_workspace_member(workspace_id, auth.uid())
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY "branding workspace admin write"
  ON public.workspace_branding
  FOR ALL
  TO authenticated
  USING (
    public.is_workspace_admin(workspace_id, auth.uid())
    OR public.is_platform_admin(auth.uid())
  )
  WITH CHECK (
    public.is_workspace_admin(workspace_id, auth.uid())
    OR public.is_platform_admin(auth.uid())
  );
