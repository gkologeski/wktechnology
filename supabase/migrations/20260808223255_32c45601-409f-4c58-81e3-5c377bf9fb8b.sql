-- 1) kb_articles: remove dead/overbroad anon read policy (public KB is served via service-role server functions)
DROP POLICY IF EXISTS kb_anon_read_published ON public.kb_articles;
REVOKE SELECT ON public.kb_articles FROM anon;

-- 2) storage media bucket: restrict UPDATE to uploader or workspace admin
DROP POLICY IF EXISTS media_storage_update ON storage.objects;
CREATE POLICY media_storage_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'media'
    AND (
      owner = auth.uid()
      OR ((storage.foldername(name))[1] = (auth.uid())::text)
      OR ((storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          AND public.is_workspace_admin(((storage.foldername(name))[1])::uuid, auth.uid()))
    )
  )
  WITH CHECK (
    bucket_id = 'media'
    AND (
      owner = auth.uid()
      OR ((storage.foldername(name))[1] = (auth.uid())::text)
      OR ((storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          AND public.is_workspace_admin(((storage.foldername(name))[1])::uuid, auth.uid()))
    )
  );

-- 3) people_incidents: person-level confidentiality checks are authoritative.
-- Remove the broader workspace-wide permissive policies for select/insert/update.
DROP POLICY IF EXISTS people_incidents_perm_select ON public.people_incidents;
DROP POLICY IF EXISTS people_incidents_perm_insert ON public.people_incidents;
DROP POLICY IF EXISTS people_incidents_perm_update ON public.people_incidents;