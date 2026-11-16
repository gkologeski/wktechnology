-- Supporting documents; never changes the contract body or signature evidence.
CREATE TABLE public.contract_attachments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
 contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN('quote','proposal','file')),
 source_id uuid,
 file_name text,
 storage_path text UNIQUE,
 ready boolean NOT NULL DEFAULT false,
 created_by uuid NOT NULL REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK((kind='file' AND source_id IS NULL AND storage_path IS NOT NULL AND length(file_name) BETWEEN 1 AND 255)
    OR (kind IN('quote','proposal') AND source_id IS NOT NULL AND storage_path IS NULL AND file_name IS NULL AND ready))
);
CREATE INDEX contract_attachments_contract ON public.contract_attachments(contract_id,created_at);
CREATE UNIQUE INDEX contract_attachments_source ON public.contract_attachments(contract_id,kind,source_id) WHERE source_id IS NOT NULL;
ALTER TABLE public.contract_attachments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.contract_attachments FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.contract_attachments TO authenticated;
GRANT ALL ON public.contract_attachments TO service_role;
CREATE POLICY contract_attachments_read ON public.contract_attachments FOR SELECT TO authenticated USING(
 workspace_id=(SELECT (public.work_access_context()->>'workspace')::uuid)
 AND public.work_record_access('techcontracts.contracts',contract_id,'view')
 AND (kind='file' OR public.sales_record_access(CASE kind WHEN 'quote' THEN 'quotes' ELSE 'proposals' END,source_id,'view')));

CREATE OR REPLACE FUNCTION public.contract_attachment_manage(p_contract uuid,p_action text,p_data jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE w uuid; c public.contracts; a public.contract_attachments; s uuid; label text; k text; ref uuid; result jsonb; n text;
BEGIN
 w:=public.work_area_authorize('techcontracts.contracts',CASE WHEN p_action IN('list','sources') THEN 'view' ELSE 'update' END,p_contract);
 IF auth.uid() IS NULL OR NOT public.work_record_access('techcontracts.contracts',p_contract,'view') THEN RAISE EXCEPTION 'Contrato indisponível.' USING ERRCODE='42501';END IF;
 SELECT * INTO c FROM public.contracts WHERE id=p_contract AND workspace_id=w FOR UPDATE;
 IF c.id IS NULL THEN RAISE EXCEPTION 'Contrato indisponível.' USING ERRCODE='42501';END IF;
 IF p_action='sources' THEN
  SELECT coalesce(jsonb_agg(x ORDER BY x->>'title'),'[]') INTO result FROM (
   SELECT jsonb_build_object('kind','quote','id',q.id,'title',q.title) x FROM public.quotes q
    WHERE q.workspace_id=w AND (q.id=c.quote_id OR (c.deal_id IS NOT NULL AND q.deal_id=c.deal_id)) AND public.sales_record_access('quotes',q.id,'view')
   UNION ALL SELECT jsonb_build_object('kind','proposal','id',p.id,'title',p.title||' · versão '||p.version) FROM public.proposals p
    WHERE p.workspace_id=w AND (p.id=c.proposal_id OR (c.deal_id IS NOT NULL AND p.deal_id=c.deal_id)) AND public.sales_record_access('proposals',p.id,'view')
  ) t; RETURN result;
 ELSIF p_action='list' THEN
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',t.id,'kind',t.kind,'source_id',t.source_id,'name',CASE t.kind WHEN 'file' THEN t.file_name WHEN 'quote' THEN q.title ELSE p.title||' · versão '||p.version END,'created_at',t.created_at) ORDER BY t.created_at DESC),'[]') INTO result
  FROM public.contract_attachments t LEFT JOIN public.quotes q ON t.kind='quote' AND q.id=t.source_id LEFT JOIN public.proposals p ON t.kind='proposal' AND p.id=t.source_id
  WHERE t.contract_id=c.id AND t.workspace_id=w AND t.ready AND (t.kind='file' OR public.sales_record_access(CASE t.kind WHEN 'quote' THEN 'quotes' ELSE 'proposals' END,t.source_id,'view'));
  RETURN result;
 ELSIF p_action='link' THEN
  k:=p_data->>'kind'; s:=(p_data->>'source_id')::uuid;
  IF k='quote' THEN
   SELECT q.id INTO ref FROM public.quotes q WHERE q.id=s AND q.workspace_id=w AND (q.id=c.quote_id OR (c.deal_id IS NOT NULL AND q.deal_id=c.deal_id)) AND public.sales_record_access('quotes',q.id,'view');
  ELSIF k='proposal' THEN
   SELECT p.id INTO ref FROM public.proposals p WHERE p.id=s AND p.workspace_id=w AND (p.id=c.proposal_id OR (c.deal_id IS NOT NULL AND p.deal_id=c.deal_id)) AND public.sales_record_access('proposals',p.id,'view');
  END IF;
  IF ref IS NULL THEN RAISE EXCEPTION 'Documento comercial indisponível para este contrato.' USING ERRCODE='42501';END IF;
  INSERT INTO public.contract_attachments(workspace_id,contract_id,kind,source_id,ready,created_by) VALUES(w,c.id,k,s,true,auth.uid()) ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('ok',true);
 ELSIF p_action='reserve' THEN
  n:=btrim(p_data->>'name');
  IF n IS NULL OR length(n) NOT BETWEEN 1 AND 255 OR n ~ '[[:cntrl:]/\\]' THEN RAISE EXCEPTION 'Nome de arquivo inválido.';END IF;
  a.id:=gen_random_uuid();
  INSERT INTO public.contract_attachments(id,workspace_id,contract_id,kind,file_name,storage_path,created_by)
  VALUES(a.id,w,c.id,'file',n,w::text||'/'||c.id::text||'/'||a.id::text,auth.uid()) RETURNING * INTO a;
  RETURN jsonb_build_object('id',a.id,'path',a.storage_path);
 END IF;
 SELECT * INTO a FROM public.contract_attachments WHERE id=(p_data->>'id')::uuid AND contract_id=c.id AND workspace_id=w FOR UPDATE;
 IF a.id IS NULL THEN RAISE EXCEPTION 'Anexo indisponível.' USING ERRCODE='42501';END IF;
 IF p_action='finish' THEN
  IF a.kind<>'file' OR a.created_by<>auth.uid() OR NOT EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='contract-attachments' AND o.name=a.storage_path AND (o.metadata->>'size')::bigint BETWEEN 1 AND 20971520) THEN RAISE EXCEPTION 'Upload não concluído.';END IF;
  UPDATE public.contract_attachments SET ready=true WHERE id=a.id;
 ELSIF p_action='remove' THEN
  DELETE FROM public.contract_attachments WHERE id=a.id;
 ELSE RAISE EXCEPTION 'Ação inválida.';END IF;
 RETURN jsonb_build_object('ok',true);
END $$;
REVOKE ALL ON FUNCTION public.contract_attachment_manage(uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.contract_attachment_manage(uuid,text,jsonb) TO authenticated;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES('contract-attachments','contract-attachments',false,20971520,ARRAY['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','image/jpeg','image/png','text/plain']) ON CONFLICT(id) DO NOTHING;
CREATE OR REPLACE FUNCTION public.contract_attachment_storage_allowed(p_path text,p_write boolean)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.contract_attachments a WHERE a.storage_path=p_path AND a.workspace_id=(public.work_access_context()->>'workspace')::uuid
 AND public.work_record_access('techcontracts.contracts',a.contract_id,'view')
 AND CASE WHEN p_write THEN NOT a.ready AND a.created_by=auth.uid() AND NOT public.is_read_only_view() AND public.work_record_access('techcontracts.contracts',a.contract_id,'update') ELSE a.ready END)
$$;
REVOKE ALL ON FUNCTION public.contract_attachment_storage_allowed(text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.contract_attachment_storage_allowed(text,boolean) TO authenticated;
CREATE POLICY contract_attachments_storage_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='contract-attachments' AND public.contract_attachment_storage_allowed(name,false));
CREATE POLICY contract_attachments_storage_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='contract-attachments' AND public.contract_attachment_storage_allowed(name,true));
CREATE POLICY contract_attachments_storage_boundary ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated USING(bucket_id<>'contract-attachments' OR public.contract_attachment_storage_allowed(name,false)) WITH CHECK(bucket_id<>'contract-attachments' OR public.contract_attachment_storage_allowed(name,true));
-- Uploaded objects are immutable: even a permissive legacy storage policy cannot overwrite/delete them.
CREATE POLICY contract_attachments_storage_no_update ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated USING(bucket_id<>'contract-attachments') WITH CHECK(bucket_id<>'contract-attachments');
CREATE POLICY contract_attachments_storage_no_delete ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated USING(bucket_id<>'contract-attachments');
