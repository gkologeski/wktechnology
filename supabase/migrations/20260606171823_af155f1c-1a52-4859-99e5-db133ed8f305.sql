
-- 1) Column-level grants: hide sensitive tokens/secret from authenticated role
REVOKE SELECT ON public.calendar_accounts FROM authenticated;
GRANT SELECT (id, owner_id, provider, email, primary_calendar_id, expires_at, scopes, sync_enabled, sync_token, last_synced_at, last_status, last_error, created_at, updated_at, workspace_id, auto_create_meet_link) ON public.calendar_accounts TO authenticated;

REVOKE SELECT ON public.email_accounts FROM authenticated;
GRANT SELECT (id, owner_id, provider, email, expires_at, scopes, history_id, status, last_sync_at, last_error, created_at, updated_at, workspace_id) ON public.email_accounts TO authenticated;

REVOKE SELECT ON public.outbound_webhooks FROM authenticated;
GRANT SELECT (id, owner_id, name, url, events, active, created_at, updated_at, workspace_id) ON public.outbound_webhooks TO authenticated;

-- 2) Tighten whatsapp-media storage policy: anchored match instead of unsafe substring
DROP POLICY IF EXISTS "whatsapp_media_workspace_read" ON storage.objects;
CREATE POLICY "whatsapp_media_workspace_read" ON storage.objects
FOR SELECT
USING (
  bucket_id = 'whatsapp-media'
  AND EXISTS (
    SELECT 1 FROM public.whatsapp_messages wm
    WHERE public.is_workspace_member(wm.owner_id, auth.uid())
      AND (
        wm.media_url = storage.objects.name
        OR wm.media_url LIKE '%/' || storage.objects.name
      )
  )
);
