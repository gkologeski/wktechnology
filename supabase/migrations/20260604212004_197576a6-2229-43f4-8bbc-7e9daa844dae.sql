-- Hybrid visibility for email inbox:
-- - Threads/messages linked to a registered contact (contact_id NOT NULL) are visible to the workspace.
-- - Otherwise they are private to the Gmail account owner.

DROP POLICY IF EXISTS ws_select_email_threads ON public.email_threads;
CREATE POLICY ws_select_email_threads ON public.email_threads
FOR SELECT TO authenticated
USING (
  (
    contact_id IS NOT NULL
    AND workspace_id IN (SELECT public.current_user_workspaces())
  )
  OR EXISTS (
    SELECT 1 FROM public.email_accounts a
    WHERE a.id = email_threads.account_id
      AND a.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS ws_select_email_messages ON public.email_messages;
CREATE POLICY ws_select_email_messages ON public.email_messages
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.email_threads t
    WHERE t.id = email_messages.thread_id
      AND (
        (
          t.contact_id IS NOT NULL
          AND t.workspace_id IN (SELECT public.current_user_workspaces())
        )
        OR EXISTS (
          SELECT 1 FROM public.email_accounts a
          WHERE a.id = t.account_id
            AND a.owner_id = auth.uid()
        )
      )
  )
);

CREATE INDEX IF NOT EXISTS email_threads_account_idx ON public.email_threads(account_id);
CREATE INDEX IF NOT EXISTS email_threads_contact_ws_idx ON public.email_threads(contact_id, workspace_id);
CREATE INDEX IF NOT EXISTS email_messages_thread_idx ON public.email_messages(thread_id);