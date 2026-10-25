-- Shared areas, final audit: literal references and current parent authorization.
-- Existing grants, role presets and permissive Storage policies remain unchanged.
CREATE OR REPLACE FUNCTION public.shared_storage_reference_path(u text,b text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path=public,pg_temp AS $$
 SELECT CASE WHEN b NOT IN('ats-cvs','email-attachments','notes-attachments') THEN NULL
 WHEN u ~ '^https?://' THEN CASE WHEN split_part(substring(u FROM '^https?://[^/]+/storage/v1/object/(?:sign|authenticated|public)/([^?]+)'), '/',1)=b THEN substring(substring(u FROM '^https?://[^/]+/storage/v1/object/(?:sign|authenticated|public)/([^?]+)') FROM position('/' IN substring(u FROM '^https?://[^/]+/storage/v1/object/(?:sign|authenticated|public)/([^?]+)'))+1) ELSE NULL END
 ELSE u END
$$;
REVOKE ALL ON FUNCTION public.shared_storage_reference_path(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.shared_storage_reference_path(text,text) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.shared_storage_object_access(b text,p text,a text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb:=work_access_context();w uuid:=(c->>'workspace')::uuid;u uuid:=(c->>'actor')::uuid;resource text;allowed boolean:=false;
BEGIN
 IF NOT shared_storage_session_access(a) OR p IS NULL OR p='' OR p ~ '(^|/)\.\.(/|$)' OR a NOT IN('view','create','update','delete') THEN RETURN false;END IF;
 IF b IN('user-files','media','chat-attachments','whatsapp-media') THEN RETURN shared_storage_access(b,p,a);END IF;
 -- Reports of the caller's own product issues are personal, not a module grant.
 IF b='bug-reports' THEN RETURN split_part(p,'/',1)=u::text AND a IN('view','create','delete');END IF;
 -- Prior Order 3 restrictive policies keep the document/contract predicates.
 IF b='contract-imports' THEN RETURN work_contract_storage_allowed(a<>'view');END IF;
 -- These buckets are only used through entity-authorized server capabilities.
 -- 'exports' has no active application writer/reader; raw legacy access is retired.
 IF b IN('contact-photos','role-profile-files','sdr-materials','exports') THEN RETURN false;END IF;
 IF b='people-documents' THEN
  RETURN a='view' AND EXISTS(SELECT 1 FROM people_documents d WHERE d.workspace_id=w AND d.file_url=p AND hr_record_access('documents','view',d.id));
 END IF;
 IF b='ats-async-videos' THEN
  RETURN a IN('view','delete') AND EXISTS(SELECT 1 FROM ats_async_video_responses v WHERE v.workspace_id=w AND v.storage_path=p AND hr_record_access('interviews','view',v.interview_id) AND (a='view' OR hr_record_access('interviews','update',v.interview_id)));
 END IF;
 IF a='update' THEN RETURN false;END IF;
 IF b='ats-cvs' THEN
  IF EXISTS(SELECT 1 FROM ats_candidates x WHERE shared_storage_reference_path(x.cv_url,b)=p) THEN
   RETURN a='view' AND EXISTS(SELECT 1 FROM ats_candidates x WHERE x.workspace_id=w AND shared_storage_reference_path(x.cv_url,b)=p AND hr_record_access('candidates','view',x.id));
  END IF;
  allowed:=hr_scope_permission(w,'techhire.candidates','view',true,true) AND hr_scope_permission(w,'techhire.candidates','create',true,true);
 ELSIF b='notes-attachments' THEN
  IF EXISTS(SELECT 1 FROM activities x WHERE x.attachments @> jsonb_build_array(jsonb_build_object('path',p))) THEN
   RETURN a='view' AND EXISTS(SELECT 1 FROM activities x WHERE x.workspace_id=w AND x.deleted_at IS NULL AND x.attachments @> jsonb_build_array(jsonb_build_object('path',p)) AND sales_record_access('activities',x.id,'view'));
  END IF;
  allowed:=EXISTS(SELECT 1 FROM unnest(ARRAY['techsales.notes','techsales.tasks','techsales.activities']) r WHERE sales_context_access(c,w,r,'view',ARRAY[u]) AND sales_context_access(c,w,r,'create',ARRAY[u]));
 ELSIF b='email-attachments' THEN
  IF EXISTS(SELECT 1 FROM email_messages x WHERE x.attachments @> jsonb_build_array(jsonb_build_object('path',p))) THEN
   RETURN a='view' AND EXISTS(SELECT 1 FROM email_messages x WHERE x.workspace_id=w AND x.attachments @> jsonb_build_array(jsonb_build_object('path',p)) AND sales_record_access('email_messages',x.id,'view'));
  END IF;
  resource:='techsales.inbox.email';
 ELSE RETURN false;
 END IF;
 IF resource IS NOT NULL THEN allowed:=sales_context_access(c,w,resource,'view',ARRAY[u]) AND sales_context_access(c,w,resource,'create',ARRAY[u]);END IF;
 -- Pending uploads use an immutable actor/workspace path. Old unbound paths
 -- cannot fall back after parent revocation or be reused across workspaces.
 IF NOT allowed OR split_part(p,'/',1)<>u::text OR split_part(p,'/',2)<>w::text THEN RETURN false;END IF;
 IF a='create' THEN RETURN true;END IF;
 RETURN a IN('view','delete') AND EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id=b AND o.name=p AND (o.owner=u OR o.owner_id=u::text) AND o.created_at>now()-interval '1 hour');
END $$;
REVOKE ALL ON FUNCTION public.shared_storage_object_access(text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.shared_storage_object_access(text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.shared_storage_upload_path(b text,file_name text)
RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb:=work_access_context();p text;
BEGIN
 IF b NOT IN('ats-cvs','notes-attachments','email-attachments') OR file_name IS NULL OR length(file_name)>255 OR length(trim(file_name))=0 THEN RAISE EXCEPTION 'Upload inválido.' USING ERRCODE='22023';END IF;
 p:=(c->>'actor')||'/'||(c->>'workspace')||'/'||gen_random_uuid()::text||'-'||right(regexp_replace(file_name,'[^a-zA-Z0-9._-]+','_','g'),120);
 IF NOT coalesce(shared_storage_object_access(b,p,'create'),false) THEN RAISE EXCEPTION 'Sem permissão para enviar este anexo.' USING ERRCODE='42501';END IF;
 RETURN p;
END $$;
REVOKE ALL ON FUNCTION public.shared_storage_upload_path(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.shared_storage_upload_path(text,text) TO authenticated;
CREATE INDEX IF NOT EXISTS idx_order5_candidate_cv_reference ON public.ats_candidates(public.shared_storage_reference_path(cv_url,'ats-cvs')) WHERE cv_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_order5_activity_attachment_reference ON public.activities USING gin(attachments jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_order5_email_attachment_reference ON public.email_messages USING gin(attachments jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_order5_people_document_file ON public.people_documents(file_url) WHERE file_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_order5_async_video_file ON public.ats_async_video_responses(storage_path);
