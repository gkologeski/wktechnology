-- 0411: restore the canonical 0405 OIDs; keep 0408 OIDs as private forwarders.
DO $capture$
DECLARE ids jsonb; deps text;
BEGIN
  SELECT jsonb_object_agg(proname,oid::text) INTO ids
  FROM pg_proc WHERE pronamespace='techerp_api'::regnamespace
    AND proname IN ('notification_source_visible_before_inbox_channels',
                    'notification_center_source_visible_before_inbox_channels');
  IF (SELECT count(*) FROM jsonb_each_text(ids)) <> 2 THEN
    RAISE EXCEPTION 'Expected the two original 0405 visibility functions';
  END IF;
  SELECT coalesce(string_agg(d::text,E'\n' ORDER BY d::text),'') INTO deps
  FROM pg_depend d WHERE d.refclassid='pg_proc'::regclass
    AND d.refobjid IN (SELECT value::oid FROM jsonb_each_text(ids));
  PERFORM set_config('app.inbox_repair_oids',ids::text,true);
  PERFORM set_config('app.inbox_repair_dependencies',md5(deps),true);
END $capture$;
ALTER FUNCTION techerp_api.notification_source_visible(uuid,uuid,text,uuid)
  RENAME TO notification_source_visible_inbox_channels_wrapper;
ALTER FUNCTION techerp_api.notification_source_visible_before_inbox_channels(uuid,uuid,text,uuid)
  RENAME TO notification_source_visible;
ALTER FUNCTION techerp_api.notification_center_source_visible(uuid,uuid,text,uuid)
  RENAME TO notification_center_source_visible_inbox_channels_wrapper;
ALTER FUNCTION techerp_api.notification_center_source_visible_before_inbox_channels(uuid,uuid,text,uuid)
  RENAME TO notification_center_source_visible;

CREATE OR REPLACE FUNCTION techerp_api.notification_source_visible(
  p_ws uuid,p_user uuid,p_table text,p_id uuid
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
BEGIN
  IF p_table='inbox_channel_occurrences' THEN
    RETURN techerp_api.inbox_subject_visible(p_ws,p_user,p_id);
  END IF;
  IF p_table='whatsapp_messages' THEN
    RETURN techerp_api.notification_whatsapp_subject_visible(p_ws,p_user,p_id);
  END IF;
  RETURN techerp_api.notification_source_visible_before_whatsapp(p_ws,p_user,p_table,p_id);
END $$;
CREATE OR REPLACE FUNCTION techerp_api.notification_center_source_visible(
  p_ws uuid,p_user uuid,p_table text,p_id uuid
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
BEGIN
  IF p_table IN ('inbox_channel_occurrences','whatsapp_messages') THEN
    IF p_user IS DISTINCT FROM auth.uid()
      OR auth.role() IS DISTINCT FROM 'authenticated'
      OR current_setting('app.api_subject',true)='on'
      OR public.work_access_context()->>'workspace' IS DISTINCT FROM p_ws::text
    THEN RETURN false; END IF;
    IF p_table='inbox_channel_occurrences' THEN
      RETURN techerp_api.inbox_subject_visible(p_ws,p_user,p_id);
    END IF;
    RETURN EXISTS (
      SELECT 1 FROM public.whatsapp_messages m
      JOIN public.whatsapp_conversations c
        ON c.id=m.conversation_id AND c.workspace_id=m.workspace_id
      WHERE m.id=p_id AND m.workspace_id=p_ws
    );
  END IF;
  RETURN techerp_api.notification_center_source_visible_before_whatsapp(p_ws,p_user,p_table,p_id);
END $$;
CREATE OR REPLACE FUNCTION techerp_api.notification_source_visible_inbox_channels_wrapper(
  p_ws uuid,p_user uuid,p_table text,p_id uuid
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
BEGIN
  RETURN techerp_api.notification_source_visible(p_ws,p_user,p_table,p_id);
END $$;
CREATE OR REPLACE FUNCTION techerp_api.notification_center_source_visible_inbox_channels_wrapper(
  p_ws uuid,p_user uuid,p_table text,p_id uuid
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
BEGIN
  RETURN techerp_api.notification_center_source_visible(p_ws,p_user,p_table,p_id);
END $$;
ALTER FUNCTION techerp_api.notification_source_visible(uuid,uuid,text,uuid) OWNER TO techerp_api_subject;
ALTER FUNCTION techerp_api.notification_center_source_visible(uuid,uuid,text,uuid) OWNER TO techerp_api_subject;
ALTER FUNCTION techerp_api.notification_source_visible_inbox_channels_wrapper(uuid,uuid,text,uuid) OWNER TO techerp_api_subject;
ALTER FUNCTION techerp_api.notification_center_source_visible_inbox_channels_wrapper(uuid,uuid,text,uuid) OWNER TO techerp_api_subject;
REVOKE ALL ON FUNCTION
  techerp_api.notification_source_visible(uuid,uuid,text,uuid),
  techerp_api.notification_center_source_visible(uuid,uuid,text,uuid),
  techerp_api.notification_source_visible_inbox_channels_wrapper(uuid,uuid,text,uuid),
  techerp_api.notification_center_source_visible_inbox_channels_wrapper(uuid,uuid,text,uuid)
FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION
  techerp_api.notification_source_visible(uuid,uuid,text,uuid),
  techerp_api.notification_center_source_visible(uuid,uuid,text,uuid),
  techerp_api.notification_source_visible_inbox_channels_wrapper(uuid,uuid,text,uuid),
  techerp_api.notification_center_source_visible_inbox_channels_wrapper(uuid,uuid,text,uuid)
TO postgres;
DO $verify$
DECLARE ids jsonb:=current_setting('app.inbox_repair_oids')::jsonb; deps text;
BEGIN
  IF (ids->>'notification_source_visible_before_inbox_channels')::oid
       <> 'techerp_api.notification_source_visible(uuid,uuid,text,uuid)'::regprocedure::oid
    OR (ids->>'notification_center_source_visible_before_inbox_channels')::oid
       <> 'techerp_api.notification_center_source_visible(uuid,uuid,text,uuid)'::regprocedure::oid
  THEN RAISE EXCEPTION 'Visibility OID changed'; END IF;
  SELECT coalesce(string_agg(d::text,E'\n' ORDER BY d::text),'') INTO deps
  FROM pg_depend d WHERE d.refclassid='pg_proc'::regclass
    AND d.refobjid IN (SELECT value::oid FROM jsonb_each_text(ids));
  IF md5(deps) IS DISTINCT FROM current_setting('app.inbox_repair_dependencies') THEN
    RAISE EXCEPTION 'Visibility dependencies changed';
  END IF;
END $verify$;
NOTIFY pgrst,'reload schema';
