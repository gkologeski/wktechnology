GRANT CREATE ON SCHEMA techerp_api TO authenticated;
CREATE FUNCTION techerp_api.notification_center_channel_rls(p_workspace uuid,p_user uuid,p_table text,p_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF p_user IS DISTINCT FROM auth.uid() OR auth.role() IS DISTINCT FROM 'authenticated'
  OR current_setting('app.api_subject',true)='on'
  OR public.work_access_context()->>'workspace' IS DISTINCT FROM p_workspace::text
  OR NOT public.is_workspace_member(p_workspace,p_user)
  OR p_table NOT IN('inbox_channel_occurrences','whatsapp_messages') THEN RETURN false; END IF;
 RETURN public.sales_event_reference_access(p_table,p_id);
END $$;
ALTER FUNCTION techerp_api.notification_center_channel_rls(uuid,uuid,text,uuid) OWNER TO authenticated;
REVOKE CREATE ON SCHEMA techerp_api FROM authenticated;
REVOKE ALL ON FUNCTION techerp_api.notification_center_channel_rls(uuid,uuid,text,uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION techerp_api.notification_center_channel_rls(uuid,uuid,text,uuid) TO postgres,techerp_api_subject;
CREATE OR REPLACE FUNCTION techerp_api.notification_center_source_visible(p_ws uuid,p_user uuid,p_table text,p_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF p_table IN('inbox_channel_occurrences','whatsapp_messages') THEN
  RETURN techerp_api.notification_center_channel_rls(p_ws,p_user,p_table,p_id);
 END IF;
 RETURN techerp_api.notification_center_source_visible_before_whatsapp(p_ws,p_user,p_table,p_id);
END $$;
-- Do not broaden the internal subject's auth-schema access, which is not needed by the new path.
REVOKE USAGE ON SCHEMA auth FROM techerp_api_subject;
NOTIFY pgrst,'reload schema';
