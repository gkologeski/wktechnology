
-- 1) Owner-only write policies for api_keys / integrations / outbound_webhooks
DROP POLICY IF EXISTS ws_insert_api_keys ON public.api_keys;
DROP POLICY IF EXISTS ws_update_api_keys ON public.api_keys;
DROP POLICY IF EXISTS ws_delete_api_keys ON public.api_keys;
CREATE POLICY ws_insert_api_keys ON public.api_keys FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() AND workspace_id IN (SELECT current_user_workspaces()));
CREATE POLICY ws_update_api_keys ON public.api_keys FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY ws_delete_api_keys ON public.api_keys FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

DROP POLICY IF EXISTS ws_insert_integrations ON public.integrations;
DROP POLICY IF EXISTS ws_update_integrations ON public.integrations;
DROP POLICY IF EXISTS ws_delete_integrations ON public.integrations;
CREATE POLICY ws_insert_integrations ON public.integrations FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() AND workspace_id IN (SELECT current_user_workspaces()));
CREATE POLICY ws_update_integrations ON public.integrations FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY ws_delete_integrations ON public.integrations FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

DROP POLICY IF EXISTS ws_insert_outbound_webhooks ON public.outbound_webhooks;
DROP POLICY IF EXISTS ws_update_outbound_webhooks ON public.outbound_webhooks;
DROP POLICY IF EXISTS ws_delete_outbound_webhooks ON public.outbound_webhooks;
CREATE POLICY ws_insert_outbound_webhooks ON public.outbound_webhooks FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() AND workspace_id IN (SELECT current_user_workspaces()));
CREATE POLICY ws_update_outbound_webhooks ON public.outbound_webhooks FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY ws_delete_outbound_webhooks ON public.outbound_webhooks FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- 2) current_user_workspaces: platform admin must also be a member of active workspace.
-- Cross-workspace admin browsing should go through admin tooling using the service role.
CREATE OR REPLACE FUNCTION public.current_user_workspaces()
RETURNS SETOF uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_active uuid;
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;

  SELECT active_workspace_id INTO v_active FROM public.profiles WHERE id = v_uid;

  IF v_active IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = v_active AND user_id = v_uid
  ) THEN
    RETURN QUERY SELECT v_active;
    RETURN;
  END IF;

  RETURN QUERY SELECT workspace_id FROM public.workspace_members WHERE user_id = v_uid;
END;
$function$;

-- 3) WhatsApp media: allow workspace members of the uploader to read media files.
CREATE POLICY whatsapp_media_workspace_read ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'whatsapp-media'
  AND EXISTS (
    SELECT 1
    FROM public.workspace_members wm_me
    JOIN public.workspace_members wm_owner
      ON wm_owner.workspace_id = wm_me.workspace_id
    WHERE wm_me.user_id = auth.uid()
      AND wm_owner.user_id::text = (storage.foldername(name))[1]
  )
);
