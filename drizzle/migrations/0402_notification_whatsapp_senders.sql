-- Read-only notification sender catalogue. The Cloud connection table remains
-- private: selecting harmless columns must not grant access to credentials.
CREATE FUNCTION public.notification_whatsapp_senders(p_workspace uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE u uuid:=techerp_api.notification_center_actor(p_workspace);c jsonb:=public.work_access_context();
BEGIN
 IF c->>'actor' IS DISTINCT FROM u::text OR c->>'workspace' IS DISTINCT FROM p_workspace::text
 OR NOT coalesce(c->'keys' ?& ARRAY['system.notification_settings.view.workspace',
   'system.channels.view.workspace','system.whatsapp.view.workspace'],false) THEN
  RAISE EXCEPTION 'Sem permissão para consultar os remetentes de notificações.' USING ERRCODE='42501';
 END IF;
 RETURN jsonb_build_object('items',coalesce((
  SELECT jsonb_agg(jsonb_build_object(
   'id',n.phone_number_id,'phone',coalesce(n.display_phone_number,''),
   'label',coalesce(nullif(n.verified_name,''),nullif(n.display_phone_number,''),'Número conectado'),
   'available',n.sender_available,'quality',n.quality_rating,'status',n.status,'syncedAt',n.synced_at,
   'eligible',n.reason IS NULL,'reason',n.reason
  ) ORDER BY n.display_phone_number,n.phone_number_id)
  FROM (
   SELECT n.phone_number_id,n.display_phone_number,n.verified_name,n.quality_rating,n.status,n.synced_at,
    coalesce(n.available AND n.status='CONNECTED',false) AS sender_available,
    CASE WHEN NOT coalesce(n.available AND n.status='CONNECTED',false) THEN 'sender_unavailable'
     WHEN NOT coalesce(c.enabled,false) THEN 'connection_unavailable'
     WHEN c.webhook_verified_at IS NULL THEN 'webhook_unverified'
     WHEN NOT coalesce(n.quality_rating IN('GREEN','HIGH'),false) THEN 'quality_not_high'
     ELSE NULL END AS reason
   FROM public.wa_cloud_numbers n
   LEFT JOIN public.wa_cloud_connections c ON c.id=n.connection_id AND c.workspace_id=n.workspace_id
   WHERE n.workspace_id=p_workspace
   ORDER BY n.display_phone_number,n.phone_number_id LIMIT 100
  ) n
 ),'[]'::jsonb));
END $$;
ALTER FUNCTION public.notification_whatsapp_senders(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.notification_whatsapp_senders(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.notification_whatsapp_senders(uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
