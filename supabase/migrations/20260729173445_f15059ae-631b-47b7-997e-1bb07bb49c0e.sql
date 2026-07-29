
DROP POLICY IF EXISTS ws_update_deals ON public.deals;
CREATE POLICY ws_update_deals ON public.deals
FOR UPDATE TO authenticated
USING (
  workspace_id IN (SELECT current_user_workspaces())
  AND (
    user_has_permission(auth.uid(), workspace_id, 'techsales.deals.update.workspace')
    OR user_has_permission(auth.uid(), workspace_id, 'techsales.deals.update.team')
    OR (user_has_permission(auth.uid(), workspace_id, 'techsales.deals.update.own') AND owner_id = auth.uid())
  )
)
WITH CHECK (
  workspace_id IN (SELECT current_user_workspaces())
  AND (
    user_has_permission(auth.uid(), workspace_id, 'techsales.deals.update.workspace')
    OR user_has_permission(auth.uid(), workspace_id, 'techsales.deals.update.team')
    OR (user_has_permission(auth.uid(), workspace_id, 'techsales.deals.update.own') AND owner_id = auth.uid())
  )
);

DROP POLICY IF EXISTS ws_update_deal_line_items ON public.deal_line_items;
CREATE POLICY ws_update_deal_line_items ON public.deal_line_items
FOR UPDATE TO authenticated
USING (
  workspace_id IN (SELECT current_user_workspaces())
  AND (
    user_has_permission(auth.uid(), workspace_id, 'techsales.deals.update.workspace')
    OR user_has_permission(auth.uid(), workspace_id, 'techsales.deals.update.team')
    OR (user_has_permission(auth.uid(), workspace_id, 'techsales.deals.update.own') AND owner_id = auth.uid())
  )
)
WITH CHECK (
  workspace_id IN (SELECT current_user_workspaces())
  AND (
    user_has_permission(auth.uid(), workspace_id, 'techsales.deals.update.workspace')
    OR user_has_permission(auth.uid(), workspace_id, 'techsales.deals.update.team')
    OR (user_has_permission(auth.uid(), workspace_id, 'techsales.deals.update.own') AND owner_id = auth.uid())
  )
);

DROP POLICY IF EXISTS ws_insert_email_broadcast_recipients ON public.email_broadcast_recipients;
CREATE POLICY ws_insert_email_broadcast_recipients ON public.email_broadcast_recipients
FOR INSERT TO authenticated
WITH CHECK (
  workspace_id IN (SELECT current_user_workspaces())
  AND owner_id = auth.uid()
);
