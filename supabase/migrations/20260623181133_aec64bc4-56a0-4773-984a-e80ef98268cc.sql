
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notification_preferences jsonb NOT NULL DEFAULT jsonb_build_object(
    'mention',    jsonb_build_object('inapp', true, 'email', true,  'sound', true, 'shake', true),
    'assignment', jsonb_build_object('inapp', true, 'email', true,  'sound', true, 'shake', true),
    'deal_stage', jsonb_build_object('inapp', true, 'email', false, 'sound', false,'shake', false),
    'ticket',     jsonb_build_object('inapp', true, 'email', true,  'sound', true, 'shake', true),
    'task',       jsonb_build_object('inapp', true, 'email', false, 'sound', true, 'shake', false),
    'sla',        jsonb_build_object('inapp', true, 'email', true,  'sound', true, 'shake', true),
    'message',    jsonb_build_object('inapp', true, 'email', false, 'sound', true, 'shake', true)
  );

DROP POLICY IF EXISTS "profiles_workspace_read" ON public.profiles;
CREATE POLICY "profiles_workspace_read" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.workspace_members wm1
      JOIN public.workspace_members wm2 ON wm1.workspace_id = wm2.workspace_id
      WHERE wm1.user_id = auth.uid() AND wm2.user_id = public.profiles.id
    )
  );

DROP POLICY IF EXISTS "notif_insert_workspace" ON public.notifications;
CREATE POLICY "notif_insert_workspace" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_workspace_member(owner_id, auth.uid())
    AND public.is_workspace_member(owner_id, user_id)
  );
