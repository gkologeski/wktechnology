-- Stored WhatsApp media references are signed URLs. Match their literal object
-- path, without wildcard patterns or disclosing their signature/token.
CREATE OR REPLACE FUNCTION public.shared_whatsapp_storage_path(u text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path=public,pg_temp AS $$
 SELECT CASE WHEN u ~ '^https?://' THEN substring(u FROM '^https?://[^/]+/storage/v1/object/(?:sign|authenticated|public)/whatsapp-media/([^?]+)') ELSE u END
$$;
REVOKE ALL ON FUNCTION public.shared_whatsapp_storage_path(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.shared_whatsapp_storage_path(text) TO authenticated,service_role;
DO $patch$DECLARE body text;old_branch text:=$old$ ELSIF b='whatsapp-media' THEN
  IF EXISTS(SELECT 1 FROM whatsapp_messages WHERE media_url=p) THEN
   RETURN a='view' AND EXISTS(SELECT 1 FROM whatsapp_messages x WHERE x.media_url=p AND sales_record_access('whatsapp_messages',x.id,'view'));
  END IF;
  RETURN split_part(p,'/',1)=u::text AND sales_context_access(c,w,'techsales.inbox.whatsapp','view',ARRAY[u]) AND sales_context_access(c,w,'techsales.inbox.whatsapp','create',ARRAY[u]);$old$;
BEGIN
 SELECT pg_get_functiondef('public.shared_storage_access(text,text,text)'::regprocedure) INTO body;
 IF position(old_branch IN body)=0 THEN RAISE EXCEPTION 'Unexpected media permission contract';END IF;
 body:=replace(body,old_branch,$new$ ELSIF b='whatsapp-media' THEN
  IF EXISTS(SELECT 1 FROM whatsapp_messages x WHERE public.shared_whatsapp_storage_path(x.media_url)=p) THEN
   RETURN a='view' AND EXISTS(SELECT 1 FROM whatsapp_messages x WHERE public.shared_whatsapp_storage_path(x.media_url)=p AND sales_record_access('whatsapp_messages',x.id,'view'));
  END IF;
  IF split_part(p,'/',1)<>u::text OR NOT sales_context_access(c,w,'techsales.inbox.whatsapp','view',ARRAY[u]) OR NOT sales_context_access(c,w,'techsales.inbox.whatsapp','create',ARRAY[u]) THEN RETURN false;END IF;
  IF a='create' THEN RETURN true;END IF;
  RETURN a IN('view','delete') AND EXISTS(SELECT 1 FROM storage.objects x WHERE x.bucket_id=b AND x.name=p AND (x.owner=u OR x.owner_id=u::text) AND x.created_at>now()-interval '1 hour');$new$);
 EXECUTE body;
END $patch$;
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_storage_reference ON public.whatsapp_messages(public.shared_whatsapp_storage_path(media_url)) WHERE media_url IS NOT NULL;
