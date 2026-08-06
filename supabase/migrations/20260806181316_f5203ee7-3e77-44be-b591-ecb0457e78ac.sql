
ALTER TABLE public.deal_line_items
  ADD COLUMN IF NOT EXISTS service_catalog_id uuid REFERENCES public.service_catalog(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS deal_line_items_service_catalog_id_idx
  ON public.deal_line_items (service_catalog_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.deal_line_items TO authenticated;
GRANT ALL ON public.deal_line_items TO service_role;

DROP POLICY IF EXISTS ws_delete_companies ON public.companies;
CREATE POLICY ws_delete_companies ON public.companies
FOR DELETE TO authenticated
USING (
  (workspace_id IN (SELECT current_user_workspaces()))
  AND (
    user_has_permission(auth.uid(), workspace_id, 'techsales.companies.manage.workspace')
    OR user_has_permission(auth.uid(), workspace_id, 'techsales.companies.delete.workspace')
    OR (
      user_has_permission(auth.uid(), workspace_id, 'techsales.companies.delete.own')
      AND owner_id = auth.uid()
    )
  )
);
