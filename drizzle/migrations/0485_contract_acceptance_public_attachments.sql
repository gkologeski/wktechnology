-- A commercial acceptance capability includes only its attached documents.
-- Storage locations/source ids are returned to the server, never to the client.
CREATE OR REPLACE FUNCTION public.contract_commercial_public_attachment(p_token text,p_attachment uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE l public.contract_commercial_acceptance_links; a public.contract_attachments;
 bucket text; path text; checksum text;
BEGIN
 IF p_token IS NULL OR p_token !~ '^[0-9a-f]{64}$'
  OR public.contract_commercial_public_get(p_token) IS NULL THEN RETURN NULL; END IF;
 SELECT * INTO l FROM public.contract_commercial_acceptance_links
  WHERE token_hash=encode(extensions.digest(convert_to(p_token,'UTF8'),'sha256'),'hex');
 SELECT * INTO a FROM public.contract_attachments
  WHERE id=p_attachment AND contract_id=l.contract_id AND workspace_id=l.workspace_id AND ready;
 IF a.id IS NULL THEN RETURN NULL; END IF;
 IF a.kind='file' THEN
  bucket:='contract-attachments';path:=a.storage_path;checksum:=a.sha256;
 ELSIF a.source_snapshot_path IS NOT NULL THEN
  bucket:='contract-signature-packages';path:=a.source_snapshot_path;checksum:=a.source_snapshot_sha256;
 ELSIF a.kind='quote' THEN
  IF NOT EXISTS(SELECT 1 FROM public.quotes WHERE id=a.source_id AND workspace_id=l.workspace_id)
   THEN RETURN NULL; END IF;
 ELSIF a.kind='proposal' THEN
  IF NOT EXISTS(SELECT 1 FROM public.proposals WHERE id=a.source_id AND workspace_id=l.workspace_id)
   THEN RETURN NULL; END IF;
 ELSE RETURN NULL; END IF;
 IF bucket IS NOT NULL AND (path IS NULL OR checksum IS NULL OR checksum !~ '^[0-9a-f]{64}$'
  OR path NOT LIKE l.workspace_id::text||'/'||l.contract_id::text||'/%') THEN RETURN NULL; END IF;
 RETURN jsonb_build_object('attachmentId',a.id,'kind',a.kind,'fileName',coalesce(a.source_name,a.file_name,'Anexo'),
  'bucket',bucket,'storagePath',path,'sha256',checksum,'sourceId',CASE WHEN bucket IS NULL THEN a.source_id END,
  'workspaceId',l.workspace_id,'contentHash',l.content_hash);
END $$;
REVOKE ALL ON FUNCTION public.contract_commercial_public_attachment(text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.contract_commercial_public_attachment(text,uuid) TO service_role;
