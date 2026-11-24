CREATE OR REPLACE FUNCTION public.contract_attachment_manage(p_contract uuid, p_action text, p_data jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE w uuid; c public.contracts; a public.contract_attachments; s uuid; label text; k text; ref uuid; result jsonb; n text; dl uuid[]; ql uuid[]; pl uuid[];
BEGIN
 w:=public.work_area_authorize('techcontracts.contracts',CASE WHEN p_action IN('list','sources') THEN 'view' ELSE 'update' END,p_contract);
 IF auth.uid() IS NULL OR NOT public.work_record_access('techcontracts.contracts',p_contract,'view') THEN RAISE EXCEPTION 'Contrato indisponível.' USING ERRCODE='42501';END IF;
 SELECT * INTO c FROM public.contracts WHERE id=p_contract AND workspace_id=w FOR UPDATE;
 IF c.id IS NULL THEN RAISE EXCEPTION 'Contrato indisponível.' USING ERRCODE='42501';END IF;
 IF c.hiring_request_origin IS NOT NULL AND p_action='sources' THEN RETURN '[]'::jsonb;END IF;
 IF c.hiring_request_origin IS NOT NULL AND p_action='link' THEN RAISE EXCEPTION 'Compra WK: envie proposta do fornecedor ou condições WK como arquivo PDF, não cotação/proposta de venda.';END IF;
 SELECT array_remove(array_agg(DISTINCT x.deal_id),NULL),array_remove(array_agg(DISTINCT x.quote_id),NULL),array_remove(array_agg(DISTINCT x.proposal_id),NULL) INTO dl,ql,pl
  FROM (SELECT c.deal_id,c.quote_id,c.proposal_id
        UNION ALL SELECT sc.deal_id,sc.quote_id,sc.proposal_id FROM public.contract_purchase_sales l JOIN public.contracts sc ON sc.id=l.sale_contract_id AND sc.workspace_id=w WHERE l.purchase_contract_id=c.id AND l.workspace_id=w
        UNION ALL SELECT pc.deal_id,pc.quote_id,pc.proposal_id FROM public.contracts pc WHERE pc.id=c.parent_contract_id AND pc.workspace_id=w) x;
 dl:=coalesce(dl,'{}');ql:=coalesce(ql,'{}');pl:=coalesce(pl,'{}');
 IF p_action='sources' THEN
  SELECT coalesce(jsonb_agg(x ORDER BY x->>'title'),'[]') INTO result FROM (
   SELECT jsonb_build_object('kind','quote','id',q.id,'title',q.title) x FROM public.quotes q
    WHERE q.workspace_id=w AND (q.id=ANY(ql) OR q.deal_id=ANY(dl)) AND public.sales_record_access('quotes',q.id,'view')
   UNION ALL SELECT jsonb_build_object('kind','proposal','id',p.id,'title',p.title||' · versão '||p.version) FROM public.proposals p
    WHERE p.workspace_id=w AND (p.id=ANY(pl) OR p.deal_id=ANY(dl)) AND public.sales_record_access('proposals',p.id,'view')
  ) t; RETURN result;
 ELSIF p_action='list' THEN
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',t.id,'kind',t.kind,'source_id',t.source_id,'name',CASE t.kind WHEN 'file' THEN t.file_name WHEN 'quote' THEN coalesce(t.source_name,q.title) ELSE coalesce(t.source_name,p.title||' · versão '||p.version) END,'created_at',t.created_at,'frozen',t.source_stamp IS NOT NULL) ORDER BY t.created_at DESC),'[]') INTO result
  FROM public.contract_attachments t LEFT JOIN public.quotes q ON t.kind='quote' AND q.id=t.source_id LEFT JOIN public.proposals p ON t.kind='proposal' AND p.id=t.source_id
  WHERE t.contract_id=c.id AND t.workspace_id=w AND t.ready AND (t.kind='file' OR public.sales_record_access(CASE t.kind WHEN 'quote' THEN 'quotes' ELSE 'proposals' END,t.source_id,'view'));
  RETURN result;
 ELSIF p_action='link' THEN
  k:=p_data->>'kind'; s:=(p_data->>'source_id')::uuid;
  IF k='quote' THEN
   SELECT q.id INTO ref FROM public.quotes q WHERE q.id=s AND q.workspace_id=w AND (q.id=ANY(ql) OR q.deal_id=ANY(dl)) AND public.sales_record_access('quotes',q.id,'view');
  ELSIF k='proposal' THEN
   SELECT p.id INTO ref FROM public.proposals p WHERE p.id=s AND p.workspace_id=w AND (p.id=ANY(pl) OR p.deal_id=ANY(dl)) AND public.sales_record_access('proposals',p.id,'view');
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
  IF a.ready THEN RETURN jsonb_build_object('ok',true);END IF;
  IF a.kind<>'file' OR a.created_by<>auth.uid() OR NOT EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='contract-attachments' AND o.name=a.storage_path AND (o.metadata->>'size')::bigint BETWEEN 1 AND 20971520) THEN RAISE EXCEPTION 'Upload não concluído.';END IF;
  IF coalesce(p_data->>'sha256','') !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Hash do arquivo inválido.';END IF;
  UPDATE public.contract_attachments SET ready=true,sha256=p_data->>'sha256' WHERE id=a.id;
 ELSIF p_action='remove' THEN
  DELETE FROM public.contract_attachments WHERE id=a.id;
 ELSE RAISE EXCEPTION 'Ação inválida.';END IF;
 RETURN jsonb_build_object('ok',true);
END $function$;