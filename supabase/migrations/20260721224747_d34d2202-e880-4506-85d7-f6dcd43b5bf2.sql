
-- 1) quote_line_items INSERT: exigir owner_id = auth.uid() quando o direito for "own"
DROP POLICY IF EXISTS ws_insert_quote_line_items ON public.quote_line_items;
CREATE POLICY ws_insert_quote_line_items ON public.quote_line_items
FOR INSERT TO authenticated
WITH CHECK (
  workspace_id IN (SELECT current_user_workspaces())
  AND (
    public.user_has_permission(auth.uid(), workspace_id, 'techsales.quotes.update.workspace')
    OR (
      (
        public.user_has_permission(auth.uid(), workspace_id, 'techsales.quotes.create.own')
        OR public.user_has_permission(auth.uid(), workspace_id, 'techsales.quotes.update.own')
      )
      AND owner_id = auth.uid()
    )
  )
);

-- 2) email_messages SELECT: restringir ao dono da conta ou admin do workspace
DROP POLICY IF EXISTS ws_select_email_messages ON public.email_messages;
CREATE POLICY ws_select_email_messages ON public.email_messages
FOR SELECT TO authenticated
USING (
  owner_id = auth.uid()
  OR public.is_workspace_admin_of(owner_id, auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.email_threads t
    JOIN public.email_accounts a ON a.id = t.account_id
    WHERE t.id = email_messages.thread_id
      AND a.owner_id = auth.uid()
  )
);
