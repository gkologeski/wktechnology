
-- 1) hubspot_owners: remove the copy-paste flaw (workspace_id = auth.uid())
DROP POLICY IF EXISTS hubspot_owners_modify ON public.hubspot_owners;
CREATE POLICY hubspot_owners_modify ON public.hubspot_owners
  AS PERMISSIVE FOR ALL
  TO authenticated
  USING (public.is_workspace_admin_v2(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_admin_v2(workspace_id, auth.uid()));

-- 2) storage: tighten whatsapp media workspace-read to strict path match
DROP POLICY IF EXISTS whatsapp_media_workspace_read ON storage.objects;
CREATE POLICY whatsapp_media_workspace_read ON storage.objects
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'whatsapp-media'
    AND EXISTS (
      SELECT 1
        FROM public.whatsapp_messages wm
       WHERE public.is_workspace_member(wm.owner_id, auth.uid())
         AND wm.media_url = objects.name
    )
  );
