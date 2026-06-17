
-- Tighten esign_audit INSERT
DROP POLICY IF EXISTS ws_insert_esign_audit ON public.esign_audit;
CREATE POLICY owner_insert_esign_audit ON public.esign_audit
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    OR is_workspace_admin_v2(workspace_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.esign_documents d
      WHERE d.id = esign_audit.document_id
        AND (d.owner_id = auth.uid() OR is_workspace_admin_v2(d.workspace_id, auth.uid()))
    )
  );

-- Tighten esign_signers INSERT
DROP POLICY IF EXISTS ws_insert_esign_signers ON public.esign_signers;
CREATE POLICY owner_insert_esign_signers ON public.esign_signers
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    OR is_workspace_admin_v2(workspace_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.esign_documents d
      WHERE d.id = esign_signers.document_id
        AND (d.owner_id = auth.uid() OR is_workspace_admin_v2(d.workspace_id, auth.uid()))
    )
  );
