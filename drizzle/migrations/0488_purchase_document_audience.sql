-- Purchase and sale documents have independent audiences. No file or frozen
-- signature package is rewritten, removed or automatically re-sent here.
ALTER TABLE public.contract_attachments
 ADD COLUMN audience text NOT NULL DEFAULT 'internal' CHECK(audience IN('internal','client','supplier','technical_shared')),
 ADD COLUMN audience_reviewed_by uuid,
 ADD COLUMN audience_reviewed_at timestamptz,
 ADD COLUMN commercial_sensitive boolean NOT NULL DEFAULT false;
UPDATE public.contract_attachments SET audience='client' WHERE kind IN('quote','proposal');
UPDATE public.contract_attachments a SET commercial_sensitive=true
 FROM public.contracts c WHERE c.id=a.contract_id AND c.workspace_id=a.workspace_id AND c.role::text='client' AND c.hiring_request_origin IS NULL AND a.kind='file';

CREATE OR REPLACE FUNCTION public.purchase_contract_document_origin_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.role::text='client' AND NEW.hiring_request_origin IS NULL
 AND (NEW.quote_id IS NOT NULL OR NEW.proposal_id IS NOT NULL OR NEW.deal_id IS NOT NULL)
 AND (TG_OP='INSERT' OR OLD.role::text IS DISTINCT FROM NEW.role::text OR ROW(NEW.quote_id,NEW.proposal_id,NEW.deal_id) IS DISTINCT FROM ROW(OLD.quote_id,OLD.proposal_id,OLD.deal_id)) THEN
  RAISE EXCEPTION 'Compra independente: preserve a venda somente pelo vínculo interno, sem herdar cotação, proposta ou negócio do cliente.' USING ERRCODE='23514';END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.purchase_contract_document_origin_guard() FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
CREATE TRIGGER purchase_contract_document_origin_guard BEFORE INSERT OR UPDATE ON public.contracts
 FOR EACH ROW EXECUTE FUNCTION public.purchase_contract_document_origin_guard();

CREATE TABLE public.contract_attachment_audience_reviews(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
 contract_id uuid NOT NULL REFERENCES public.contracts(id),attachment_id uuid NOT NULL,
 previous_audience text NOT NULL,audience text NOT NULL,commercial_sensitive boolean NOT NULL,
 reviewed_by uuid NOT NULL,reviewed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.contract_attachment_audience_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.contract_attachment_audience_reviews FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
GRANT SELECT ON public.contract_attachment_audience_reviews TO authenticated;
CREATE POLICY contract_attachment_audience_review_read ON public.contract_attachment_audience_reviews FOR SELECT TO authenticated
 USING(workspace_id=(public.work_access_context()->>'workspace')::uuid
 AND public.work_record_access('techcontracts.contracts',contract_id,'view')
 AND public.user_has_permission(auth.uid(),workspace_id,'techcontracts.esign_share.manage.workspace')
 AND (NOT commercial_sensitive OR public.user_has_permission(auth.uid(),workspace_id,'techcontracts.purchase_proposals.view.workspace')));

CREATE OR REPLACE FUNCTION public.contract_attachment_audience_default()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.kind IN('quote','proposal') THEN
  NEW.audience:='client';NEW.commercial_sensitive:=false;
 ELSIF EXISTS(SELECT 1 FROM public.contracts c WHERE c.id=NEW.contract_id AND c.workspace_id=NEW.workspace_id AND c.role::text='client' AND c.hiring_request_origin IS NULL) THEN
  NEW.audience:='internal';NEW.commercial_sensitive:=true;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.contract_attachment_audience_default() FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
CREATE TRIGGER contract_attachment_audience_default BEFORE INSERT ON public.contract_attachments
 FOR EACH ROW EXECUTE FUNCTION public.contract_attachment_audience_default();

-- Public-selection changes are versions too. The old hash is retained exactly
-- until an explicit new review occurs, preserving unmodified historical seals.
CREATE OR REPLACE FUNCTION public.contract_attachment_audience_stamp(p_contract uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT jsonb_agg(jsonb_build_object('id',a.id,'audience',a.audience,'sensitive',a.commercial_sensitive,'reviewed_by',a.audience_reviewed_by,'reviewed_at',a.audience_reviewed_at) ORDER BY a.id)::text
 FROM public.contract_attachments a WHERE a.contract_id=p_contract AND a.ready AND a.audience_reviewed_by IS NOT NULL AND a.audience_reviewed_at IS NOT NULL
$$;
REVOKE ALL ON FUNCTION public.contract_attachment_audience_stamp(uuid) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
ALTER FUNCTION public.hiring_contract_fingerprint(uuid) RENAME TO hiring_contract_fingerprint_before_audience;
REVOKE ALL ON FUNCTION public.hiring_contract_fingerprint_before_audience(uuid) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
CREATE OR REPLACE FUNCTION public.hiring_contract_fingerprint(p_contract uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE base text;selection text;
BEGIN
 base:=public.hiring_contract_fingerprint_before_audience(p_contract);selection:=public.contract_attachment_audience_stamp(p_contract);
 IF selection IS NULL THEN RETURN base;END IF;
 RETURN encode(extensions.digest(convert_to(base||':audience-v1:'||selection,'UTF8'),'sha256'),'hex');
END $$;
REVOKE ALL ON FUNCTION public.hiring_contract_fingerprint(uuid) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
ALTER FUNCTION public.contract_commercial_content_hash(uuid) RENAME TO contract_commercial_content_hash_before_audience;
REVOKE ALL ON FUNCTION public.contract_commercial_content_hash_before_audience(uuid) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
CREATE OR REPLACE FUNCTION public.contract_commercial_content_hash(p_contract uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE base text;selection text;
BEGIN
 base:=public.contract_commercial_content_hash_before_audience(p_contract);selection:=public.contract_attachment_audience_stamp(p_contract);
 IF selection IS NULL THEN RETURN base;END IF;
 RETURN encode(extensions.digest(convert_to(base||':audience-v1:'||selection,'UTF8'),'sha256'),'hex');
END $$;
REVOKE ALL ON FUNCTION public.contract_commercial_content_hash(uuid) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;

-- Private, usable only inside the reviewed RPCs. Unknown uploaded files require
-- explicit classification before a new external share. Legacy capabilities may
-- keep reading their original unclassified files, never the opposite audience.
CREATE OR REPLACE FUNCTION public.contract_attachment_audience_allowed(a public.contract_attachments,target text,legacy boolean DEFAULT false)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path=public,pg_temp AS $$
DECLARE reviewed boolean:=a.audience_reviewed_by IS NOT NULL AND a.audience_reviewed_at IS NOT NULL;
BEGIN
 IF target IS NULL OR target NOT IN('client','supplier') THEN RETURN false;END IF;
 IF a.kind IN('quote','proposal') THEN RETURN target='client' AND a.audience='client';END IF;
 IF a.kind<>'file' OR (target='client' AND a.commercial_sensitive AND a.audience<>'internal') THEN RETURN false;END IF;
 RETURN (a.audience=target AND reviewed)
  OR (a.audience='technical_shared' AND NOT a.commercial_sensitive AND reviewed)
  OR (a.audience='internal' AND reviewed)
  OR (legacy AND a.audience='internal' AND a.audience_reviewed_at IS NULL);
END $$;
REVOKE ALL ON FUNCTION public.contract_attachment_audience_allowed(public.contract_attachments,text,boolean) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
CREATE OR REPLACE FUNCTION public.contract_document_audience_valid(p_ws uuid,p_contract uuid,p_legacy boolean DEFAULT false)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE target text;
BEGIN
 SELECT CASE WHEN c.role::text='client' THEN 'supplier' ELSE 'client' END INTO target FROM public.contracts c WHERE c.id=p_contract AND c.workspace_id=p_ws;
 IF target IS NULL THEN RETURN false;END IF;
 RETURN NOT EXISTS(SELECT 1 FROM public.contract_attachments a WHERE a.workspace_id=p_ws AND a.contract_id=p_contract AND a.ready
  AND NOT public.contract_attachment_audience_allowed(a,target,p_legacy));
END $$;
REVOKE ALL ON FUNCTION public.contract_document_audience_valid(uuid,uuid,boolean) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;

CREATE OR REPLACE FUNCTION public.contract_document_audience_assert(p_ws uuid,p_contract uuid,p_actor uuid,p_hash text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE ctx jsonb;
BEGIN
 ctx:=public.work_subject_context(p_ws,p_actor);
 IF p_actor IS NULL OR NOT public.is_workspace_member(p_ws,p_actor)
 OR NOT public.work_record_context_access(ctx,'techcontracts.contracts',p_contract,'view')
 OR NOT EXISTS(SELECT 1 FROM public.workspace_members WHERE workspace_id=p_ws AND user_id=p_actor AND status='active') THEN
  RAISE EXCEPTION 'Contrato indisponível.' USING ERRCODE='42501';END IF;
 IF p_hash IS NOT NULL AND p_hash IS DISTINCT FROM public.hiring_contract_fingerprint(p_contract) THEN
  RAISE EXCEPTION 'Contrato ou anexos alterados. Recarregue.' USING ERRCODE='23514';END IF;
 IF EXISTS(SELECT 1 FROM public.contract_attachments WHERE contract_id=p_contract AND workspace_id=p_ws AND ready AND commercial_sensitive AND audience<>'internal')
 AND NOT public.user_has_permission(p_actor,p_ws,'techcontracts.purchase_proposals.view.workspace') THEN
  RAISE EXCEPTION 'Sem permissão para o conteúdo comercial de compra.' USING ERRCODE='42501';END IF;
 IF NOT public.contract_document_audience_valid(p_ws,p_contract,false) THEN
  RAISE EXCEPTION 'Revise o público dos anexos antes de compartilhar. Documentos do cliente e da fornecedora devem permanecer separados.' USING ERRCODE='23514';END IF;
END $$;
REVOKE ALL ON FUNCTION public.contract_document_audience_assert(uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;

CREATE OR REPLACE FUNCTION public.contract_attachment_audience_check(p_contract uuid,p_hash text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE w uuid;c public.contracts;
BEGIN
 w:=public.work_area_authorize('techcontracts.contracts','view',p_contract);
 SELECT * INTO c FROM public.contracts WHERE id=p_contract AND workspace_id=w FOR UPDATE;
 IF auth.uid() IS NULL OR c.id IS NULL OR NOT public.work_record_access('techcontracts.contracts',c.id,'view') THEN
  RAISE EXCEPTION 'Contrato indisponível.' USING ERRCODE='42501';END IF;
 PERFORM public.contract_document_audience_assert(w,c.id,auth.uid(),p_hash);
 IF EXISTS(SELECT 1 FROM public.contract_attachments WHERE contract_id=c.id AND workspace_id=w AND ready AND commercial_sensitive AND audience<>'internal')
 AND NOT coalesce((public.work_access_context()->'keys') ? 'techcontracts.purchase_proposals.view.workspace',false) THEN
  RAISE EXCEPTION 'Sem permissão para o conteúdo comercial de compra.' USING ERRCODE='42501';END IF;
 RETURN jsonb_build_object('audience',CASE WHEN c.role::text='client' THEN 'supplier' ELSE 'client' END,
  'content_hash',public.hiring_contract_fingerprint(c.id),
  'attachments',coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.id,'audience',a.audience,'commercial_sensitive',a.commercial_sensitive) ORDER BY a.created_at,a.id)
   FROM public.contract_attachments a WHERE a.contract_id=c.id AND a.workspace_id=w AND a.ready AND a.audience<>'internal'),'[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.contract_attachment_audience_check(uuid,text) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
GRANT EXECUTE ON FUNCTION public.contract_attachment_audience_check(uuid,text) TO authenticated;

-- Internal download validation does not turn an upload into an external annex.
CREATE OR REPLACE FUNCTION public.contract_attachment_access_check(p_contract uuid,p_attachment uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE w uuid:=(public.work_access_context()->>'workspace')::uuid;a public.contract_attachments;
BEGIN
 IF auth.uid() IS NULL OR NOT public.work_record_access('techcontracts.contracts',p_contract,'view') THEN RAISE EXCEPTION 'Anexo indisponível.' USING ERRCODE='42501';END IF;
 SELECT * INTO a FROM public.contract_attachments WHERE id=p_attachment AND contract_id=p_contract AND workspace_id=w AND ready;
 IF a.id IS NULL OR (a.commercial_sensitive AND (NOT public.user_has_permission(auth.uid(),w,'techcontracts.purchase_proposals.view.workspace') OR NOT coalesce((public.work_access_context()->'keys') ? 'techcontracts.purchase_proposals.view.workspace',false)))
 OR (a.kind IN('quote','proposal') AND NOT public.sales_record_access(CASE a.kind WHEN 'quote' THEN 'quotes' ELSE 'proposals' END,a.source_id,'view')) THEN RAISE EXCEPTION 'Anexo indisponível.' USING ERRCODE='42501';END IF;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.contract_attachment_access_check(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
GRANT EXECUTE ON FUNCTION public.contract_attachment_access_check(uuid,uuid) TO authenticated;

ALTER FUNCTION public.contract_attachment_manage(uuid,text,jsonb) RENAME TO contract_attachment_manage_before_audience;
REVOKE ALL ON FUNCTION public.contract_attachment_manage_before_audience(uuid,text,jsonb) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
CREATE OR REPLACE FUNCTION public.contract_attachment_manage(p_contract uuid,p_action text,p_data jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE w uuid;c public.contracts;annex public.contract_attachments;r jsonb;target text;is_sensitive boolean;
BEGIN
 w:=public.work_area_authorize('techcontracts.contracts',CASE WHEN p_action IN('list','sources') THEN 'view' ELSE 'update' END,p_contract);
 SELECT * INTO c FROM public.contracts WHERE id=p_contract AND workspace_id=w FOR UPDATE;
 IF auth.uid() IS NULL OR c.id IS NULL OR NOT public.work_record_access('techcontracts.contracts',c.id,'view') THEN RAISE EXCEPTION 'Contrato indisponível.' USING ERRCODE='42501';END IF;
 IF c.role::text='client' AND p_action='sources' THEN RETURN '[]'::jsonb;END IF;
 IF c.role::text='client' AND p_action='link' THEN RAISE EXCEPTION 'Compra WK: use a proposta técnica de compra ou um arquivo revisado para a fornecedorannex. Cotações e propostas de venda pertencem ao cliente.' USING ERRCODE='23514';END IF;
 IF c.role::text='client' AND c.hiring_request_origin IS NULL AND p_action='reserve'
 AND (NOT public.user_has_permission(auth.uid(),w,'techcontracts.purchase_proposals.view.workspace') OR NOT coalesce((public.work_access_context()->'keys') ? 'techcontracts.purchase_proposals.view.workspace',false)) THEN
  RAISE EXCEPTION 'Sem permissão para o conteúdo comercial de compra.' USING ERRCODE='42501';END IF;
 IF p_action IN('finish','remove') AND EXISTS(SELECT 1 FROM public.contract_attachments t WHERE t.id=(p_data->>'id')::uuid AND t.contract_id=c.id AND t.workspace_id=w AND t.commercial_sensitive)
 AND (NOT public.user_has_permission(auth.uid(),w,'techcontracts.purchase_proposals.view.workspace') OR NOT coalesce((public.work_access_context()->'keys') ? 'techcontracts.purchase_proposals.view.workspace',false)) THEN
  RAISE EXCEPTION 'Sem permissão para o conteúdo comercial de compra.' USING ERRCODE='42501';END IF;
 IF p_action='review' THEN
  IF public.is_read_only_view() OR NOT public.user_has_permission(auth.uid(),w,'techcontracts.esign_share.manage.workspace') OR NOT coalesce((public.work_access_context()->'keys') ? 'techcontracts.esign_share.manage.workspace',false) THEN RAISE EXCEPTION 'Sem permissão para revisar anexos externos.' USING ERRCODE='42501';END IF;
  SELECT * INTO annex FROM public.contract_attachments WHERE id=(p_data->>'id')::uuid AND contract_id=c.id AND workspace_id=w AND ready FOR UPDATE;
  IF annex.id IS NULL OR annex.kind<>'file' THEN RAISE EXCEPTION 'Revise somente arquivos próprios; documentos de venda mantêm o público cliente.' USING ERRCODE='23514';END IF;
  IF public.hiring_formalization_document_locked(w,c.id) THEN RAISE EXCEPTION 'Documento em assinatura ou assinado: preserve o pacote histórico e revise o próximo instrumento.' USING ERRCODE='23514';END IF;
  target:=p_data->>'audience';is_sensitive:=coalesce((p_data->>'commercial_sensitive')::boolean,annex.commercial_sensitive);
  IF target IS NULL OR target NOT IN('internal','client','supplier','technical_shared') OR (target='technical_shared' AND is_sensitive)
   OR (target='client' AND (c.role::text='client' OR is_sensitive)) OR (target='supplier' AND c.role::text<>'client') THEN RAISE EXCEPTION 'Público incompatível. Compartilhe somente conteúdo técnico sem dados comerciais entre as partes.' USING ERRCODE='23514';END IF;
  IF (annex.commercial_sensitive OR is_sensitive OR c.role::text='client') AND NOT public.user_has_permission(auth.uid(),w,'techcontracts.purchase_proposals.view.workspace') THEN RAISE EXCEPTION 'Sem permissão para revisar o conteúdo comercial de compra.' USING ERRCODE='42501';END IF;
  IF EXISTS(SELECT 1 FROM public.contract_purchase_proposals d WHERE d.attachment_id=annex.id AND d.workspace_id=w) THEN RAISE EXCEPTION 'A proposta gerada mantém o público fornecedora e sua classificação de conteúdo de compra.' USING ERRCODE='23514';END IF;
  INSERT INTO public.contract_attachment_audience_reviews(workspace_id,contract_id,attachment_id,previous_audience,audience,commercial_sensitive,reviewed_by) VALUES(w,c.id,annex.id,annex.audience,target,is_sensitive,auth.uid());
  UPDATE public.contract_attachments SET audience=target,commercial_sensitive=is_sensitive,audience_reviewed_by=auth.uid(),audience_reviewed_at=now() WHERE id=annex.id;
  RETURN jsonb_build_object('ok',true);
 END IF;
 -- Existing authorization, immutable storage and source-visibility behavior is
 -- retained; extra metadata is returned only for rows visible to the caller.
 r:=public.contract_attachment_manage_before_audience(c.id,p_action,p_data);
 IF p_action='list' THEN
  SELECT coalesce(jsonb_agg(e.value||jsonb_build_object('audience',a.audience,'commercial_sensitive',a.commercial_sensitive,'audience_reviewed_at',a.audience_reviewed_at,
   'reviewed_at',a.audience_reviewed_at,'reviewed_by',a.audience_reviewed_by,
   'review_required',a.kind='file' AND (a.audience_reviewed_by IS NULL OR a.audience_reviewed_at IS NULL),
   'signature_included',a.audience<>'internal' AND public.contract_attachment_audience_allowed(a,CASE WHEN c.role::text='client' THEN 'supplier' ELSE 'client' END,false),
   'sharing_blocked',NOT public.contract_attachment_audience_allowed(a,CASE WHEN c.role::text='client' THEN 'supplier' ELSE 'client' END,false),
   'can_review',a.kind='file' AND NOT public.is_read_only_view() AND public.work_record_access('techcontracts.contracts',c.id,'update')
    AND public.user_has_permission(auth.uid(),w,'techcontracts.esign_share.manage.workspace') AND coalesce((public.work_access_context()->'keys') ? 'techcontracts.esign_share.manage.workspace',false)
    AND NOT public.hiring_formalization_document_locked(w,c.id)
    AND NOT EXISTS(SELECT 1 FROM public.contract_purchase_proposals d WHERE d.attachment_id=a.id AND d.workspace_id=w)
    AND ((NOT a.commercial_sensitive AND c.role::text<>'client') OR public.user_has_permission(auth.uid(),w,'techcontracts.purchase_proposals.view.workspace'))
   ) ORDER BY e.ordinality),'[]'::jsonb) INTO r
   FROM jsonb_array_elements(r) WITH ORDINALITY e(value,ordinality) JOIN public.contract_attachments a ON a.id=(e.value->>'id')::uuid AND a.workspace_id=w AND a.contract_id=c.id
   WHERE NOT a.commercial_sensitive OR (public.user_has_permission(auth.uid(),w,'techcontracts.purchase_proposals.view.workspace') AND coalesce((public.work_access_context()->'keys') ? 'techcontracts.purchase_proposals.view.workspace',false));
 END IF;
 RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.contract_attachment_manage(uuid,text,jsonb) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
GRANT EXECUTE ON FUNCTION public.contract_attachment_manage(uuid,text,jsonb) TO authenticated;

-- Only a generated, hash-matched purchase version can acquire trusted supplier
-- provenance automatically. This is private, with no caller-controlled bypass.
CREATE OR REPLACE FUNCTION public.purchase_proposal_classify_attachment(p_document uuid,p_attachment uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE d public.contract_purchase_proposals;a public.contract_attachments;
BEGIN
 SELECT * INTO d FROM public.contract_purchase_proposals WHERE id=p_document FOR UPDATE;
 SELECT * INTO a FROM public.contract_attachments WHERE id=p_attachment AND contract_id=d.contract_id AND workspace_id=d.workspace_id FOR UPDATE;
 IF d.id IS NULL OR d.attachment_id IS DISTINCT FROM a.id OR a.id IS NULL OR a.kind<>'file' OR NOT a.ready OR d.status<>'generated' OR coalesce(d.sha256,'') !~ '^[a-f0-9]{64}$' OR d.sha256 IS DISTINCT FROM a.sha256
 OR d.reviewed_by IS NULL OR d.reviewed_at IS NULL OR NOT public.is_workspace_member(d.workspace_id,d.reviewed_by)
 OR NOT public.user_has_permission(d.reviewed_by,d.workspace_id,'techcontracts.purchase_proposals.view.workspace')
 OR NOT public.user_has_permission(d.reviewed_by,d.workspace_id,'techcontracts.purchase_proposals.manage.workspace')
 OR NOT public.work_record_context_access(public.work_subject_context(d.workspace_id,d.reviewed_by),'techcontracts.contracts',d.contract_id,'update')
 OR NOT EXISTS(SELECT 1 FROM public.contracts WHERE id=d.contract_id AND workspace_id=d.workspace_id AND role::text='client') THEN RAISE EXCEPTION 'Proveniência da proposta de compra indisponível.' USING ERRCODE='42501';END IF;
 UPDATE public.contract_attachments SET audience='supplier',commercial_sensitive=true,audience_reviewed_by=d.reviewed_by,audience_reviewed_at=d.reviewed_at WHERE id=a.id;
 INSERT INTO public.contract_attachment_audience_reviews(workspace_id,contract_id,attachment_id,previous_audience,audience,commercial_sensitive,reviewed_by)
 VALUES(d.workspace_id,d.contract_id,a.id,a.audience,'supplier',true,d.reviewed_by);
END $$;
REVOKE ALL ON FUNCTION public.purchase_proposal_classify_attachment(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;

CREATE POLICY contract_attachment_sensitive_content ON public.contract_attachments AS RESTRICTIVE FOR SELECT TO authenticated
 USING(NOT commercial_sensitive OR (public.user_has_permission(auth.uid(),workspace_id,'techcontracts.purchase_proposals.view.workspace')
 AND coalesce((public.work_access_context()->'keys') ? 'techcontracts.purchase_proposals.view.workspace',false)));
CREATE OR REPLACE FUNCTION public.contract_attachment_storage_allowed(p_path text,p_write boolean)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.contract_attachments a WHERE a.storage_path=p_path AND a.workspace_id=(public.work_access_context()->>'workspace')::uuid
 AND public.work_record_access('techcontracts.contracts',a.contract_id,'view')
 AND (NOT a.commercial_sensitive OR (public.user_has_permission(auth.uid(),a.workspace_id,'techcontracts.purchase_proposals.view.workspace') AND coalesce((public.work_access_context()->'keys') ? 'techcontracts.purchase_proposals.view.workspace',false)))
 AND (a.ready OR NOT EXISTS(SELECT 1 FROM public.contract_purchase_proposals d WHERE d.attachment_id=a.id)
  OR EXISTS(SELECT 1 FROM public.contract_purchase_proposals d WHERE d.attachment_id=a.id AND d.workspace_id=a.workspace_id AND d.contract_id=a.contract_id
   AND d.status='reserved' AND d.reserved_by=auth.uid() AND public.purchase_proposal_access(d.contract_id,'manage') AND public.purchase_proposal_mutation_problem(d.contract_id) IS NULL
   AND d.version=(SELECT max(v.version) FROM public.contract_purchase_proposals v WHERE v.contract_id=d.contract_id)))
 AND CASE WHEN p_write THEN NOT public.is_read_only_view() AND a.created_by=auth.uid() AND NOT a.ready AND public.work_record_access('techcontracts.contracts',a.contract_id,'update') ELSE a.ready OR (NOT public.is_read_only_view() AND a.created_by=auth.uid() AND public.work_record_access('techcontracts.contracts',a.contract_id,'update')) END)
$$;
REVOKE ALL ON FUNCTION public.contract_attachment_storage_allowed(text,boolean) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
GRANT EXECUTE ON FUNCTION public.contract_attachment_storage_allowed(text,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.hiring_attachment_policy(k uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c public.contracts;BEGIN
 SELECT * INTO c FROM public.contracts WHERE id=k AND workspace_id=(public.work_access_context()->>'workspace')::uuid;
 IF c.id IS NULL OR auth.uid() IS NULL OR NOT public.work_record_access('techcontracts.contracts',k,'view') THEN RAISE EXCEPTION 'Contrato indisponível.' USING ERRCODE='42501';END IF;
 RETURN jsonb_build_object('hiring_origin',c.hiring_request_origin IS NOT NULL,'can_preview',public.hiring_formalization_preview_access(c.workspace_id,k),'is_purchase',c.role::text='client',
  'can_review',NOT public.is_read_only_view() AND public.work_record_access('techcontracts.contracts',k,'update')
   AND public.user_has_permission(auth.uid(),c.workspace_id,'techcontracts.esign_share.manage.workspace') AND coalesce((public.work_access_context()->'keys') ? 'techcontracts.esign_share.manage.workspace',false)
   AND NOT public.hiring_formalization_document_locked(c.workspace_id,k)
   AND (c.role::text<>'client' OR (public.user_has_permission(auth.uid(),c.workspace_id,'techcontracts.purchase_proposals.view.workspace') AND coalesce((public.work_access_context()->'keys') ? 'techcontracts.purchase_proposals.view.workspace',false))));
END $$;
REVOKE ALL ON FUNCTION public.hiring_attachment_policy(uuid) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
GRANT EXECUTE ON FUNCTION public.hiring_attachment_policy(uuid) TO authenticated;

ALTER FUNCTION public.contract_attachment_signing_context(uuid,text) RENAME TO contract_attachment_signing_context_before_audience;
REVOKE ALL ON FUNCTION public.contract_attachment_signing_context_before_audience(uuid,text) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
CREATE OR REPLACE FUNCTION public.contract_attachment_signing_context(p_contract uuid,p_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result jsonb;
BEGIN
 PERFORM public.contract_attachment_audience_check(p_contract,p_hash);
 result:=public.contract_attachment_signing_context_before_audience(p_contract,p_hash);
 RETURN result||jsonb_build_object('attachments',coalesce((SELECT jsonb_agg(e.value ORDER BY e.ordinality)
  FROM jsonb_array_elements(result->'attachments') WITH ORDINALITY e(value,ordinality)
  JOIN public.contract_attachments a ON a.id::text=e.value->>'id' AND a.contract_id=p_contract AND a.workspace_id=(result->>'workspace_id')::uuid
  WHERE a.audience<>'internal'),'[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.contract_attachment_signing_context(uuid,text) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
GRANT EXECUTE ON FUNCTION public.contract_attachment_signing_context(uuid,text) TO authenticated;

ALTER FUNCTION public.contract_signature_package_store(uuid,uuid,uuid,text,text,text,jsonb,integer) RENAME TO contract_signature_package_store_before_audience;
REVOKE ALL ON FUNCTION public.contract_signature_package_store_before_audience(uuid,uuid,uuid,text,text,text,jsonb,integer) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
CREATE OR REPLACE FUNCTION public.contract_signature_package_store(p_ws uuid,p_contract uuid,p_actor uuid,p_hash text,p_path text,p_sha text,p_manifest jsonb,p_pages integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 PERFORM 1 FROM public.contracts WHERE id=p_contract AND workspace_id=p_ws FOR UPDATE;
 PERFORM public.contract_document_audience_assert(p_ws,p_contract,p_actor,p_hash);
 IF jsonb_typeof(p_manifest) IS DISTINCT FROM 'array'
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_manifest) e WHERE NOT EXISTS(SELECT 1 FROM public.contract_attachments a WHERE a.id::text=e.value->>'id' AND a.contract_id=p_contract AND a.workspace_id=p_ws AND a.ready AND a.audience<>'internal'))
 OR jsonb_array_length(p_manifest)<>(SELECT count(DISTINCT e.value->>'id') FROM jsonb_array_elements(p_manifest) e)
 OR jsonb_array_length(p_manifest)<>(SELECT count(*) FROM public.contract_attachments WHERE contract_id=p_contract AND workspace_id=p_ws AND ready AND audience<>'internal') THEN
  RAISE EXCEPTION 'Pacote não corresponde aos anexos compartilháveis da versão atual.' USING ERRCODE='23514';END IF;
 RETURN public.contract_signature_package_store_before_audience(p_ws,p_contract,p_actor,p_hash,p_path,p_sha,p_manifest,p_pages);
END $$;
REVOKE ALL ON FUNCTION public.contract_signature_package_store(uuid,uuid,uuid,text,text,text,jsonb,integer) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
GRANT EXECUTE ON FUNCTION public.contract_signature_package_store(uuid,uuid,uuid,text,text,text,jsonb,integer) TO service_role;

ALTER FUNCTION public.hiring_contract_esign_body(uuid,uuid) RENAME TO hiring_contract_esign_body_before_audience;
REVOKE ALL ON FUNCTION public.hiring_contract_esign_body_before_audience(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
CREATE OR REPLACE FUNCTION public.hiring_contract_esign_body(p_ws uuid,p_contract uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NOT public.contract_document_audience_valid(p_ws,p_contract,false) THEN RAISE EXCEPTION 'Revise o público dos anexos antes de preparar um novo envio.' USING ERRCODE='23514';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.contract_attachments WHERE contract_id=p_contract AND workspace_id=p_ws AND ready AND audience<>'internal') THEN RETURN public.hiring_contract_esign_body_without_attachments(p_ws,p_contract);END IF;
 RETURN public.hiring_contract_esign_body_before_audience(p_ws,p_contract);
END $$;
REVOKE ALL ON FUNCTION public.hiring_contract_esign_body(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
GRANT EXECUTE ON FUNCTION public.hiring_contract_esign_body(uuid,uuid) TO service_role;

ALTER FUNCTION public.contract_commercial_issue_link(uuid) RENAME TO contract_commercial_issue_link_before_audience;
REVOKE ALL ON FUNCTION public.contract_commercial_issue_link_before_audience(uuid) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
CREATE OR REPLACE FUNCTION public.contract_commercial_issue_link(p_contract uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result jsonb;
BEGIN
 PERFORM public.contract_attachment_audience_check(p_contract,NULL);
 result:=public.contract_commercial_issue_link_before_audience(p_contract);
 UPDATE public.contract_commercial_acceptance_links l SET snapshot=jsonb_set(l.snapshot,'{attachments}',coalesce((
  SELECT jsonb_agg(e.value ORDER BY e.ordinality) FROM jsonb_array_elements(l.snapshot->'attachments') WITH ORDINALITY e(value,ordinality)
  JOIN public.contract_attachments a ON a.id::text=e.value->>'id' AND a.contract_id=l.contract_id AND a.workspace_id=l.workspace_id AND a.ready AND a.audience<>'internal'
 ),'[]'::jsonb)) WHERE l.contract_id=p_contract AND l.token_hash=encode(extensions.digest(convert_to(result->>'token','UTF8'),'sha256'),'hex');
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.contract_commercial_issue_link(uuid) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
GRANT EXECUTE ON FUNCTION public.contract_commercial_issue_link(uuid) TO authenticated;

ALTER FUNCTION public.contract_commercial_public_get(text) RENAME TO contract_commercial_public_get_before_audience;
REVOKE ALL ON FUNCTION public.contract_commercial_public_get_before_audience(text) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
CREATE OR REPLACE FUNCTION public.contract_commercial_public_get(p_token text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE l public.contract_commercial_acceptance_links;result jsonb;
BEGIN
 IF p_token IS NULL OR p_token !~ '^[0-9a-f]{64}$' THEN RETURN NULL;END IF;
 SELECT * INTO l FROM public.contract_commercial_acceptance_links WHERE token_hash=encode(extensions.digest(convert_to(p_token,'UTF8'),'sha256'),'hex');
 IF l.id IS NULL OR NOT public.contract_document_audience_valid(l.workspace_id,l.contract_id,true) THEN RETURN NULL;END IF;
 result:=public.contract_commercial_public_get_before_audience(p_token);
 IF result IS NULL THEN RETURN NULL;END IF;
 RETURN result||jsonb_build_object('attachments',coalesce((SELECT jsonb_agg(e.value ORDER BY e.ordinality)
  FROM jsonb_array_elements(result->'attachments') WITH ORDINALITY e(value,ordinality)
  JOIN public.contract_attachments a ON a.id::text=e.value->>'id' AND a.contract_id=l.contract_id AND a.workspace_id=l.workspace_id AND a.ready
  WHERE a.audience<>'internal' OR a.audience_reviewed_at IS NULL),'[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.contract_commercial_public_get(text) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
GRANT EXECUTE ON FUNCTION public.contract_commercial_public_get(text) TO service_role;

ALTER FUNCTION public.contract_commercial_public_attachment(text,uuid) RENAME TO contract_commercial_public_attachment_before_audience;
REVOKE ALL ON FUNCTION public.contract_commercial_public_attachment_before_audience(text,uuid) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
CREATE OR REPLACE FUNCTION public.contract_commercial_public_attachment(p_token text,p_attachment uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF public.contract_commercial_public_get(p_token) IS NULL THEN RETURN NULL;END IF;
 IF EXISTS(SELECT 1 FROM public.contract_attachments WHERE id=p_attachment AND audience='internal' AND audience_reviewed_at IS NOT NULL) THEN RETURN NULL;END IF;
 RETURN public.contract_commercial_public_attachment_before_audience(p_token,p_attachment);
END $$;
REVOKE ALL ON FUNCTION public.contract_commercial_public_attachment(text,uuid) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
GRANT EXECUTE ON FUNCTION public.contract_commercial_public_attachment(text,uuid) TO service_role;

ALTER FUNCTION public.contract_esign_public(text,text,text,text,text,text,text) RENAME TO contract_esign_public_before_audience;
REVOKE ALL ON FUNCTION public.contract_esign_public_before_audience(text,text,text,text,text,text,text) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
CREATE OR REPLACE FUNCTION public.contract_esign_public(p_token text,p_action text,p_name text DEFAULT NULL,p_signature text DEFAULT NULL,p_reason text DEFAULT NULL,p_ip text DEFAULT NULL,p_ua text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE e public.hiring_contract_evidence;
BEGIN
 IF p_token IS NULL OR length(p_token) NOT BETWEEN 10 AND 100 THEN RAISE EXCEPTION 'Link inválido.' USING ERRCODE='42501';END IF;
 SELECT ev.* INTO e FROM public.esign_signers s JOIN public.hiring_contract_evidence ev ON ev.document_id=s.document_id AND ev.workspace_id=s.workspace_id AND ev.kind='native' AND ev.revoked_at IS NULL WHERE s.public_token=p_token LIMIT 1;
 IF e.contract_id IS NOT NULL AND NOT public.contract_document_audience_valid(e.workspace_id,e.contract_id,true) THEN RAISE EXCEPTION 'Documento indisponível: revisão do público dos anexos necessária.' USING ERRCODE='42501';END IF;
 RETURN public.contract_esign_public_before_audience(p_token,p_action,p_name,p_signature,p_reason,p_ip,p_ua);
END $$;
REVOKE ALL ON FUNCTION public.contract_esign_public(text,text,text,text,text,text,text) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
GRANT EXECUTE ON FUNCTION public.contract_esign_public(text,text,text,text,text,text,text) TO service_role;

-- A direct REST/RPC caller cannot bypass the renderer gate by registering an
-- old package for a new native/ForSign dispatch. Existing operations remain intact.
CREATE OR REPLACE FUNCTION public.contract_external_audience_gate()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE k uuid;w uuid;actor uuid:=auth.uid();
BEGIN
 -- Archiving a verified PDF returned by a provider is not a new external
 -- dispatch. The existing service-only ForSign evidence RPC still validates it.
 IF TG_TABLE_NAME='hiring_contract_evidence' THEN IF NEW.kind='external' THEN RETURN NEW;END IF;END IF;
 IF TG_TABLE_NAME='esign_documents' THEN
  SELECT e.contract_id,e.workspace_id INTO k,w FROM public.hiring_contract_evidence e WHERE e.document_id=NEW.id AND e.kind='native' AND e.revoked_at IS NULL LIMIT 1;
 ELSE k:=NEW.contract_id;w:=NEW.workspace_id;END IF;
 IF k IS NOT NULL THEN
  PERFORM 1 FROM public.contracts WHERE id=k AND workspace_id=w FOR UPDATE;
  IF NOT public.contract_document_audience_valid(w,k,false) THEN RAISE EXCEPTION 'Revise o público dos anexos antes de compartilhar o contrato.' USING ERRCODE='23514';END IF;
  IF EXISTS(SELECT 1 FROM public.contract_attachments WHERE contract_id=k AND workspace_id=w AND ready AND commercial_sensitive AND audience<>'internal') THEN
   IF actor IS NULL THEN
    IF TG_TABLE_NAME='hiring_contract_evidence' THEN actor:=NEW.recorded_by;
    ELSIF TG_TABLE_NAME='contract_forsign_operations' THEN actor:=NEW.created_by;
    ELSIF TG_TABLE_NAME='contract_esign_deliveries' THEN actor:=NEW.actor_id;
    ELSE actor:=NEW.owner_id;END IF;
   END IF;
   IF actor IS NULL OR NOT public.is_workspace_member(w,actor)
    OR NOT public.work_record_context_access(public.work_subject_context(w,actor),'techcontracts.contracts',k,'view')
    OR NOT public.user_has_permission(actor,w,'techcontracts.purchase_proposals.view.workspace')
    OR (auth.uid() IS NOT NULL AND (NOT public.work_record_access('techcontracts.contracts',k,'view') OR NOT coalesce((public.work_access_context()->'keys') ? 'techcontracts.purchase_proposals.view.workspace',false))) THEN
    RAISE EXCEPTION 'Sem permissão para compartilhar o conteúdo comercial de compra.' USING ERRCODE='42501';END IF;
  END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.contract_external_audience_gate() FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
CREATE TRIGGER contract_external_audience_gate BEFORE INSERT ON public.hiring_contract_evidence FOR EACH ROW EXECUTE FUNCTION public.contract_external_audience_gate();
CREATE TRIGGER contract_external_audience_gate BEFORE INSERT ON public.contract_forsign_operations FOR EACH ROW EXECUTE FUNCTION public.contract_external_audience_gate();
CREATE TRIGGER contract_external_audience_gate BEFORE INSERT ON public.contract_esign_deliveries FOR EACH ROW EXECUTE FUNCTION public.contract_external_audience_gate();
CREATE TRIGGER contract_external_audience_gate BEFORE UPDATE OF status ON public.esign_documents FOR EACH ROW WHEN(NEW.status::text IN('sent','partially_signed') AND OLD.status::text NOT IN('sent','partially_signed','completed')) EXECUTE FUNCTION public.contract_external_audience_gate();

-- Supplier drafts never gain the capability to fetch a customer's sales
-- proposal. This finite projection preserves the draft token and actual body.
CREATE OR REPLACE FUNCTION public.contract_draft_public_get(p_token uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT jsonb_build_object('title',d.title,'body_html',d.body_html,'status',d.status,'workspace_name',w.name,
  'client_decided_at',d.client_decided_at,'client_name',d.client_name,
  'document_audience',CASE WHEN d.hiring_request_origin IS NOT NULL OR t.role::text='client' OR d.prepared_terms->>'role'='client' THEN 'supplier' ELSE 'client' END,
  'proposal_public_token',p.public_token)
 FROM public.contract_drafts d JOIN public.workspaces w ON w.id=d.workspace_id
 LEFT JOIN public.contract_templates t ON t.id=d.template_id AND t.workspace_id=d.workspace_id
 LEFT JOIN public.proposals p ON p.id=d.proposal_id AND p.workspace_id=d.workspace_id
  AND d.hiring_request_origin IS NULL AND coalesce(t.role::text,'provider')<>'client' AND coalesce(d.prepared_terms->>'role','provider')<>'client'
  AND p.status IN('sent','accepted','rejected') AND p.locked=true AND p.sent_at IS NOT NULL AND p.public_token IS NOT NULL
 WHERE d.public_token=p_token AND d.status IN('sent','accepted','changes_requested')
$$;
REVOKE ALL ON FUNCTION public.contract_draft_public_get(uuid) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
GRANT EXECUTE ON FUNCTION public.contract_draft_public_get(uuid) TO service_role;

-- Remove inherited/default grants too: renamed private implementations must not
-- remain callable by a sandbox/custom role with BYPASSRLS or request-writer ACLs.
DO $audience_acl$
DECLARE f record;g record;allowed_role text;
BEGIN
 FOR f IN SELECT p.oid,p.proname,p.proowner,p.proacl FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname=ANY(ARRAY['contract_attachment_access_check','contract_attachment_audience_allowed','contract_attachment_audience_check','contract_attachment_audience_default','contract_attachment_audience_stamp','contract_attachment_manage','contract_attachment_manage_before_audience','contract_attachment_signing_context','contract_attachment_signing_context_before_audience','contract_attachment_storage_allowed','contract_commercial_content_hash','contract_commercial_content_hash_before_audience','contract_commercial_issue_link','contract_commercial_issue_link_before_audience','contract_commercial_public_attachment','contract_commercial_public_attachment_before_audience','contract_commercial_public_get','contract_commercial_public_get_before_audience','contract_document_audience_assert','contract_document_audience_valid','contract_draft_public_get','contract_esign_public','contract_esign_public_before_audience','contract_external_audience_gate','contract_signature_package_store','contract_signature_package_store_before_audience','hiring_attachment_policy','hiring_contract_esign_body','hiring_contract_esign_body_before_audience','hiring_contract_fingerprint','hiring_contract_fingerprint_before_audience','purchase_contract_document_origin_guard','purchase_proposal_classify_attachment']) LOOP
  allowed_role:=CASE WHEN f.proname=ANY(ARRAY['contract_attachment_audience_check','contract_attachment_access_check','contract_attachment_manage','contract_attachment_storage_allowed','hiring_attachment_policy','contract_attachment_signing_context','contract_commercial_issue_link']) THEN 'authenticated'
   WHEN f.proname=ANY(ARRAY['contract_signature_package_store','hiring_contract_esign_body','contract_commercial_public_get','contract_commercial_public_attachment','contract_esign_public','contract_draft_public_get']) THEN 'service_role' ELSE NULL END;
  FOR g IN SELECT DISTINCT x.grantee FROM aclexplode(coalesce(f.proacl,acldefault('f',f.proowner))) x WHERE x.grantee<>0 AND x.grantee<>f.proowner LOOP
   IF pg_get_userbyid(g.grantee) IS DISTINCT FROM allowed_role THEN EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %I',f.oid::regprocedure,pg_get_userbyid(g.grantee));END IF;
  END LOOP;
 END LOOP;
 FOR g IN SELECT DISTINCT x.grantee FROM pg_class t CROSS JOIN LATERAL aclexplode(coalesce(t.relacl,acldefault('r',t.relowner))) x WHERE t.oid='public.contract_attachment_audience_reviews'::regclass AND x.grantee<>0 AND x.grantee<>t.relowner AND pg_get_userbyid(x.grantee)<>'authenticated' LOOP
  EXECUTE format('REVOKE ALL ON TABLE public.contract_attachment_audience_reviews FROM %I',pg_get_userbyid(g.grantee));
 END LOOP;
END $audience_acl$;
