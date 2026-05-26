
-- 1) api_keys
DROP POLICY IF EXISTS "api_keys owner/admin all" ON public.api_keys;
CREATE POLICY "api_keys select admin/owner" ON public.api_keys
  FOR SELECT TO authenticated
  USING (public.is_workspace_admin(owner_id, auth.uid()));
CREATE POLICY "api_keys insert self" ON public.api_keys
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "api_keys update admin/owner" ON public.api_keys
  FOR UPDATE TO authenticated
  USING (public.is_workspace_admin(owner_id, auth.uid()))
  WITH CHECK (public.is_workspace_admin(owner_id, auth.uid()));
CREATE POLICY "api_keys delete admin/owner" ON public.api_keys
  FOR DELETE TO authenticated
  USING (public.is_workspace_admin(owner_id, auth.uid()));

-- 2) hubspot_owners
DROP POLICY IF EXISTS "hubspot_owners read auth" ON public.hubspot_owners;
DROP POLICY IF EXISTS "hubspot_owners write auth" ON public.hubspot_owners;

-- 3) Fix argument order
DROP POLICY IF EXISTS dashboards_select ON public.dashboards;
CREATE POLICY dashboards_select ON public.dashboards
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.is_workspace_admin(owner_id, auth.uid()));

DROP POLICY IF EXISTS dw_select ON public.dashboard_widgets;
CREATE POLICY dw_select ON public.dashboard_widgets
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.is_workspace_admin(owner_id, auth.uid()));

DROP POLICY IF EXISTS eb_select ON public.email_broadcasts;
CREATE POLICY eb_select ON public.email_broadcasts
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.is_workspace_admin(owner_id, auth.uid()));

DROP POLICY IF EXISTS ebr_select ON public.email_broadcast_recipients;
CREATE POLICY ebr_select ON public.email_broadcast_recipients
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.is_workspace_admin(owner_id, auth.uid()));

DROP POLICY IF EXISTS "dli owner select" ON public.deal_line_items;
CREATE POLICY "dli owner select" ON public.deal_line_items
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.is_workspace_admin(owner_id, auth.uid()));

-- 4) notes-attachments UPDATE
DROP POLICY IF EXISTS notes_attachments_owner_update ON storage.objects;
CREATE POLICY notes_attachments_owner_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'notes-attachments' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'notes-attachments' AND owner = auth.uid());

-- 5) whatsapp-media path prefix
DROP POLICY IF EXISTS "wa media auth insert" ON storage.objects;
DROP POLICY IF EXISTS "wa media auth update" ON storage.objects;
CREATE POLICY "wa media auth insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'whatsapp-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "wa media auth update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'whatsapp-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'whatsapp-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 6) saved_views shared scope
DROP POLICY IF EXISTS saved_views_select ON public.saved_views;
CREATE POLICY saved_views_select ON public.saved_views
  FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR (
      is_shared = true
      AND EXISTS (
        SELECT 1 FROM public.team_members tm
        WHERE tm.workspace_owner_id = saved_views.owner_id
          AND tm.member_user_id = auth.uid()
      )
    )
    OR public.is_workspace_admin(owner_id, auth.uid())
  );

-- 7) workspace_branding public view without owner_id
CREATE OR REPLACE VIEW public.workspace_branding_public
WITH (security_invoker = true) AS
  SELECT brand_name, logo_url, favicon_url, primary_color, accent_color,
         custom_domain, support_email, footer_text
  FROM public.workspace_branding;
GRANT SELECT ON public.workspace_branding_public TO anon, authenticated;
