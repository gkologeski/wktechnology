
CREATE TABLE public.activity_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL,
  author_id uuid NOT NULL DEFAULT auth.uid(),
  body text NOT NULL,
  mentions uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX idx_activity_comments_activity ON public.activity_comments(activity_id, created_at);
CREATE INDEX idx_activity_comments_workspace ON public.activity_comments(workspace_id);
CREATE INDEX idx_activity_comments_author ON public.activity_comments(author_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_comments TO authenticated;
GRANT ALL ON public.activity_comments TO service_role;

ALTER TABLE public.activity_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ws_select_activity_comments" ON public.activity_comments
  FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()) AND deleted_at IS NULL);

CREATE POLICY "ws_insert_activity_comments" ON public.activity_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND workspace_id IN (SELECT public.current_user_workspaces())
    AND EXISTS (
      SELECT 1 FROM public.activities a
      WHERE a.id = activity_id
        AND a.workspace_id = activity_comments.workspace_id
        AND a.deleted_at IS NULL
    )
  );

CREATE POLICY "author_update_activity_comments" ON public.activity_comments
  FOR UPDATE TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

CREATE POLICY "author_delete_activity_comments" ON public.activity_comments
  FOR DELETE TO authenticated
  USING (author_id = auth.uid());

CREATE TRIGGER trg_activity_comments_updated_at
  BEFORE UPDATE ON public.activity_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_comments;
