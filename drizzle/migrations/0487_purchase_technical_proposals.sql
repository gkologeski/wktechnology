-- Native purchase documents: separate catalogue and immutable revisions, never a sales proposal.
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,description,is_system) VALUES
('techcontracts.purchase_proposals.view.workspace','techcontracts','purchase_proposals','view','workspace','Ver propostas técnicas de compra e valores','Lê documentos de compra e seus valores apenas em contratos visíveis; não autoriza acesso da cliente à economia da prestadora.',true),
('techcontracts.purchase_proposals.manage.workspace','techcontracts','purchase_proposals','manage','workspace','Preparar proposta técnica de compra','Exige leitura econômica e edição do contrato. Preserva assinatura, versões, legado e governança.',true),
('techcontracts.purchase_proposal_templates.manage.workspace','techcontracts','purchase_proposal_templates','manage','workspace','Gerenciar modelos técnicos de compra','Mantém modelos visuais locais sem conceder permissão sobre propostas de venda.',true)
ON CONFLICT(key) DO NOTHING;

CREATE TABLE public.purchase_proposal_templates(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
 name text NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 200),revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 design jsonb NOT NULL CHECK(jsonb_typeof(design)='object' AND octet_length(design::text)<=500000),
 created_by uuid NOT NULL,updated_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,id)
);
CREATE TABLE public.contract_purchase_proposals(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid NOT NULL REFERENCES public.workspaces(id),contract_id uuid NOT NULL REFERENCES public.contracts(id),
 version integer NOT NULL CHECK(version>0),template_id uuid NOT NULL,template_revision integer NOT NULL CHECK(template_revision>0),
 data jsonb NOT NULL,design jsonb NOT NULL,parties jsonb NOT NULL,contract_hash text NOT NULL CHECK(contract_hash ~ '^[a-f0-9]{64}$'),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN('draft','reserved','generated')),
 attachment_id uuid UNIQUE REFERENCES public.contract_attachments(id) ON DELETE SET NULL,
 sha256 text CHECK(sha256 ~ '^[a-f0-9]{64}$'),created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 reserved_by uuid,reviewed_by uuid,reviewed_at timestamptz,
 UNIQUE(contract_id,version),FOREIGN KEY(workspace_id,template_id) REFERENCES public.purchase_proposal_templates(workspace_id,id),
 CHECK(jsonb_typeof(data)='object' AND octet_length(data::text)<=200000),
 CHECK(jsonb_typeof(design)='object' AND octet_length(design::text)<=500000),
 CHECK(status<>'generated' OR (sha256 IS NOT NULL AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL))
);
CREATE INDEX contract_purchase_proposals_contract ON public.contract_purchase_proposals(workspace_id,contract_id,version DESC);
ALTER TABLE public.purchase_proposal_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_purchase_proposals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.purchase_proposal_templates,public.contract_purchase_proposals FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.purchase_proposal_access(p_contract uuid,p_action text) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE x jsonb:=public.work_access_context();c public.contracts;w uuid;
BEGIN
 w:=nullif(x->>'workspace','')::uuid;
 IF auth.uid() IS NULL OR w IS NULL OR p_action NOT IN('view','manage','templates') THEN RETURN false;END IF;
 SELECT * INTO c FROM public.contracts WHERE id=p_contract AND workspace_id=w;
 IF c.id IS NULL OR c.role::text<>'client' OR NOT public.work_record_access('techcontracts.contracts',c.id,'view')
 OR NOT public.user_has_permission(auth.uid(),w,'techcontracts.purchase_proposals.view.workspace') THEN RETURN false;END IF;
 IF c.hiring_request_origin IS NOT NULL AND NOT public.hiring_formalization_private_access(w,c.hiring_request_origin) THEN RETURN false;END IF;
 IF p_action='view' THEN RETURN true;END IF;
 IF public.is_read_only_view() OR NOT public.work_record_access('techcontracts.contracts',c.id,'update') THEN RETURN false;END IF;
 IF p_action='templates' THEN RETURN public.user_has_permission(auth.uid(),w,'techcontracts.purchase_proposal_templates.manage.workspace');END IF;
 IF NOT public.user_has_permission(auth.uid(),w,'techcontracts.purchase_proposals.manage.workspace') THEN RETURN false;END IF;
 IF c.hiring_request_origin IS NOT NULL AND NOT public.hiring_formalization_access(w,c.hiring_request_origin,'manage') THEN RETURN false;END IF;
 RETURN true;
END $$;

CREATE FUNCTION public.purchase_proposal_mutation_problem(p_contract uuid) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c public.contracts;
BEGIN
 SELECT * INTO c FROM public.contracts WHERE id=p_contract;
 IF c.id IS NULL OR NOT public.purchase_proposal_access(c.id,'manage') THEN RETURN 'Sem permissão para preparar proposta técnica de compra.';END IF;
 IF EXISTS(SELECT 1 FROM public.contract_legacy_records l WHERE l.contract_id=c.id AND l.workspace_id=c.workspace_id) THEN RETURN 'Contrato legado: preserve o documento original; use o fluxo de aditivo para novas condições.';END IF;
 IF c.status::text IN('active','renewing','ended','terminated') OR c.signed_at IS NOT NULL OR public.hiring_formalization_document_locked(c.workspace_id,c.id)
 THEN RETURN 'Contrato em assinatura ou assinado: preserve os documentos enviados e use o fluxo de revisão ou aditivo.';END IF;
 BEGIN PERFORM public.purchase_proposal_parties(c.id);EXCEPTION WHEN SQLSTATE '23514' THEN RETURN SQLERRM;END;
 RETURN NULL;
END $$;

CREATE FUNCTION public.purchase_proposal_parties(p_contract uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c public.contracts;wk jsonb;supplier jsonb;
BEGIN
 SELECT * INTO c FROM public.contracts WHERE id=p_contract;
 SELECT jsonb_build_object('name',l.name,'cnpj',l.cnpj) INTO wk FROM public.legal_entities l
 WHERE l.id=coalesce(c.contracting_legal_entity_id,c.legal_entity_id) AND l.workspace_id=c.workspace_id;
 IF c.counterparty_kind::text='person' THEN
  SELECT jsonb_build_object('name',concat_ws(' ',p.first_name,p.last_name),'cnpj',NULL) INTO supplier FROM public.contacts p WHERE p.id=c.counterparty_contact_id AND p.workspace_id=c.workspace_id AND p.deleted_at IS NULL;
 ELSE
  SELECT jsonb_build_object('name',coalesce(nullif(p.legal_name,''),p.name),'cnpj',p.cnpj) INTO supplier FROM public.companies p WHERE p.id=c.counterparty_company_id AND p.workspace_id=c.workspace_id AND p.deleted_at IS NULL;
 END IF;
 IF nullif(btrim(wk->>'name'),'') IS NULL OR nullif(btrim(supplier->>'name'),'') IS NULL THEN RAISE EXCEPTION 'Selecione a entidade WK e a prestadora no próprio contrato de compra.' USING ERRCODE='23514';END IF;
 RETURN jsonb_build_object('wk',wk,'supplier',supplier);
END $$;

CREATE FUNCTION public.purchase_proposal_document_json(d public.contract_purchase_proposals) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
 SELECT jsonb_build_object('id',d.id,'version',d.version,'templateId',d.template_id,'templateRevision',d.template_revision,'data',d.data,'design',d.design,'parties',d.parties,'createdAt',d.created_at,'attachmentId',d.attachment_id,'status',d.status,'sha256',d.sha256)
$$;

CREATE FUNCTION public.purchase_proposal_context(p_contract uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c public.contracts;v boolean;problem text;t jsonb;d jsonb;parties jsonb;
BEGIN
 v:=public.purchase_proposal_access(p_contract,'view');
 IF NOT v THEN RETURN jsonb_build_object('canView',false,'canManage',false,'canGenerate',false,'canManageTemplates',false,'isPurchase',false,'contractHash',NULL,'blockedReason','Sem acesso à proposta técnica de compra e seus valores.','templates','[]'::jsonb,'documents','[]'::jsonb);END IF;
 SELECT * INTO c FROM public.contracts WHERE id=p_contract;
 problem:=public.purchase_proposal_mutation_problem(c.id);
 BEGIN parties:=public.purchase_proposal_parties(c.id);EXCEPTION WHEN SQLSTATE '23514' THEN parties:=NULL;END;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',x.id,'name',x.name,'revision',x.revision,'design',x.design) ORDER BY x.name),'[]') INTO t FROM public.purchase_proposal_templates x WHERE x.workspace_id=c.workspace_id;
 SELECT coalesce(jsonb_agg(public.purchase_proposal_document_json(x) ORDER BY x.version DESC),'[]') INTO d FROM public.contract_purchase_proposals x WHERE x.contract_id=c.id AND x.workspace_id=c.workspace_id;
 RETURN jsonb_build_object('canView',true,'canManage',problem IS NULL,'canGenerate',problem IS NULL,'canManageTemplates',public.purchase_proposal_access(c.id,'templates'),'isPurchase',true,'contractHash',public.hiring_contract_fingerprint(c.id),'blockedReason',problem,'contract',jsonb_build_object('id',c.id,'totalValue',c.total_value,'currency',c.currency,'startsOn',c.starts_at,'endsOn',c.ends_at),'parties',parties,'branding',jsonb_build_object('logoUrl',(SELECT b.logo_url FROM public.workspace_branding b WHERE b.workspace_id=c.workspace_id)),'templates',t,'documents',d);
END $$;

CREATE FUNCTION public.purchase_proposal_template_save(p_contract uuid,p_id uuid,p_name text,p_design jsonb,p_expected_revision integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE w uuid;t public.purchase_proposal_templates;
BEGIN
 IF NOT public.purchase_proposal_access(p_contract,'templates') THEN RAISE EXCEPTION 'Sem permissão para gerenciar modelos técnicos de compra.' USING ERRCODE='42501';END IF;
 SELECT workspace_id INTO w FROM public.contracts WHERE id=p_contract;
 IF length(btrim(coalesce(p_name,''))) NOT BETWEEN 1 AND 200 OR jsonb_typeof(p_design) IS DISTINCT FROM 'object' OR octet_length(p_design::text)>500000 OR jsonb_typeof(p_design->'pages') IS DISTINCT FROM 'array' OR jsonb_array_length(p_design->'pages') NOT BETWEEN 1 AND 40 THEN RAISE EXCEPTION 'Modelo visual inválido.' USING ERRCODE='23514';END IF;
 IF p_id IS NULL THEN
  IF p_expected_revision IS DISTINCT FROM 0 THEN RAISE EXCEPTION 'Modelo alterado; atualize antes de salvar.' USING ERRCODE='40001';END IF;
  INSERT INTO public.purchase_proposal_templates(workspace_id,name,design,created_by,updated_by) VALUES(w,btrim(p_name),p_design,auth.uid(),auth.uid()) RETURNING * INTO t;
 ELSE
  SELECT * INTO t FROM public.purchase_proposal_templates WHERE id=p_id AND workspace_id=w FOR UPDATE;
  IF t.id IS NULL THEN RAISE EXCEPTION 'Modelo indisponível.' USING ERRCODE='42501';END IF;
  IF t.revision IS DISTINCT FROM p_expected_revision THEN RAISE EXCEPTION 'Modelo alterado; atualize antes de salvar.' USING ERRCODE='40001';END IF;
  UPDATE public.purchase_proposal_templates SET name=btrim(p_name),design=p_design,revision=revision+1,updated_by=auth.uid(),updated_at=now() WHERE id=t.id RETURNING * INTO t;
 END IF;
 RETURN jsonb_build_object('id',t.id,'name',t.name,'revision',t.revision,'design',t.design);
END $$;

CREATE FUNCTION public.purchase_proposal_validate_data(p_data jsonb,p_total numeric) RETURNS void
LANGUAGE plpgsql IMMUTABLE SET search_path=public,pg_temp AS $$
DECLARE m jsonb;h numeric;r numeric;sum_hours numeric:=0;k text;n numeric;seen text[]:='{}';
BEGIN
 IF jsonb_typeof(p_data) IS DISTINCT FROM 'object' OR octet_length(p_data::text)>200000 OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_data) x WHERE x<>ALL(ARRAY['title','scope','exclusions','acceptanceCriteria','hours','hourlyRate','businessDays','startsOn','endsOn','paymentTerms','responsibilities','warrantyDays','milestones'])) THEN RAISE EXCEPTION 'Campos da proposta técnica inválidos.' USING ERRCODE='23514';END IF;
 FOREACH k IN ARRAY ARRAY['title','scope','acceptanceCriteria','paymentTerms','responsibilities'] LOOP
  IF jsonb_typeof(p_data->k) IS DISTINCT FROM 'string' OR length(btrim(p_data->>k)) NOT BETWEEN 1 AND (CASE WHEN k='title' THEN 200 WHEN k='scope' THEN 30000 ELSE 12000 END) THEN RAISE EXCEPTION 'Preencha % na proposta técnica.',k USING ERRCODE='23514';END IF;
 END LOOP;
 IF jsonb_typeof(p_data->'exclusions') IS DISTINCT FROM 'string' OR length(p_data->>'exclusions')>12000 THEN RAISE EXCEPTION 'Exclusões inválidas.' USING ERRCODE='23514';END IF;
 FOREACH k IN ARRAY ARRAY['hours','hourlyRate','businessDays','warrantyDays'] LOOP
  IF jsonb_typeof(p_data->k) IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Número inválido: %.',k USING ERRCODE='23514';END IF;
  n:=(p_data->>k)::numeric;
  IF n<(CASE WHEN k='warrantyDays' THEN 0 ELSE 0.000001 END) OR n>(CASE WHEN k='hours' THEN 1000000 WHEN k='hourlyRate' THEN 100000000 WHEN k='businessDays' THEN 10000 ELSE 3650 END) OR (k IN('businessDays','warrantyDays') AND trunc(n)<>n) THEN RAISE EXCEPTION 'Número fora do intervalo: %.',k USING ERRCODE='23514';END IF;
 END LOOP;
 h:=(p_data->>'hours')::numeric;r:=(p_data->>'hourlyRate')::numeric;
 IF round(h*r*100,0)>9007199254740991 THEN RAISE EXCEPTION 'O valor da compra excede o limite de precisão monetária.' USING ERRCODE='23514';END IF;
 IF p_total>0 AND abs(round(h*r,2)-p_total)>0.01 THEN RAISE EXCEPTION 'O total da proposta de compra difere do valor do contrato. Atualize os valores do próprio contrato antes de gerar.' USING ERRCODE='23514';END IF;
 FOREACH k IN ARRAY ARRAY['startsOn','endsOn'] LOOP
  IF NOT p_data ? k OR jsonb_typeof(p_data->k) NOT IN('string','null') THEN RAISE EXCEPTION 'Data inválida.' USING ERRCODE='23514';END IF;
  IF jsonb_typeof(p_data->k)='string' THEN
   IF (p_data->>k)!~ '^\d{4}-\d{2}-\d{2}$' THEN RAISE EXCEPTION 'Data inválida.' USING ERRCODE='23514';END IF;
   PERFORM (p_data->>k)::date;
  END IF;
 END LOOP;
 IF p_data->>'startsOn' IS NOT NULL AND p_data->>'endsOn' IS NOT NULL AND (p_data->>'endsOn')::date<(p_data->>'startsOn')::date THEN RAISE EXCEPTION 'Término anterior ao início.' USING ERRCODE='23514';END IF;
 IF jsonb_typeof(p_data->'milestones') IS DISTINCT FROM 'array' OR jsonb_array_length(p_data->'milestones') NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'Defina entre 1 e 50 marcos.' USING ERRCODE='23514';END IF;
 FOR m IN SELECT value FROM jsonb_array_elements(p_data->'milestones') LOOP
  IF jsonb_typeof(m) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(m) x WHERE x<>ALL(ARRAY['id','title','description','acceptanceCriteria','hours','businessDays'])) THEN RAISE EXCEPTION 'Marco inválido.' USING ERRCODE='23514';END IF;
  FOREACH k IN ARRAY ARRAY['id','title','description','acceptanceCriteria'] LOOP
   IF jsonb_typeof(m->k) IS DISTINCT FROM 'string' OR length(btrim(m->>k)) NOT BETWEEN 1 AND (CASE WHEN k='id' THEN 100 WHEN k='title' THEN 200 ELSE 12000 END) THEN RAISE EXCEPTION 'Preencha os dados de cada marco.' USING ERRCODE='23514';END IF;
  END LOOP;
  IF (m->>'id')=ANY(seen) THEN RAISE EXCEPTION 'Marco duplicado.' USING ERRCODE='23514';END IF;seen:=array_append(seen,m->>'id');
  IF jsonb_typeof(m->'hours') IS DISTINCT FROM 'number' OR jsonb_typeof(m->'businessDays') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Horas e prazo do marco inválidos.' USING ERRCODE='23514';END IF;
  IF (m->>'hours')::numeric<=0 OR (m->>'hours')::numeric>1000000 OR (m->>'businessDays')::numeric NOT BETWEEN 1 AND 10000 OR trunc((m->>'businessDays')::numeric)<>(m->>'businessDays')::numeric THEN RAISE EXCEPTION 'Horas e prazo do marco inválidos.' USING ERRCODE='23514';END IF;
  sum_hours:=sum_hours+(m->>'hours')::numeric;
 END LOOP;
 IF abs(sum_hours-h)>0.000001 THEN RAISE EXCEPTION 'A soma das horas dos marcos deve corresponder às horas da compra.' USING ERRCODE='23514';END IF;
END $$;

CREATE FUNCTION public.purchase_proposal_save(p_contract uuid,p_template uuid,p_data jsonb,p_design jsonb,p_expected_version integer,p_expected_contract_hash text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c public.contracts;t public.purchase_proposal_templates;d public.contract_purchase_proposals;problem text;current_version integer;
BEGIN
 IF NOT public.purchase_proposal_access(p_contract,'manage') THEN RAISE EXCEPTION 'Sem permissão para preparar proposta técnica de compra.' USING ERRCODE='42501';END IF;
 SELECT * INTO c FROM public.contracts WHERE id=p_contract FOR UPDATE;
 problem:=public.purchase_proposal_mutation_problem(c.id);IF problem IS NOT NULL THEN RAISE EXCEPTION '%',problem USING ERRCODE='23514';END IF;
 IF public.hiring_contract_fingerprint(c.id) IS DISTINCT FROM p_expected_contract_hash THEN RAISE EXCEPTION 'Contrato alterado; atualize antes de salvar.' USING ERRCODE='40001';END IF;
 SELECT coalesce(max(version),0) INTO current_version FROM public.contract_purchase_proposals WHERE contract_id=c.id;
 IF current_version IS DISTINCT FROM p_expected_version THEN RAISE EXCEPTION 'Proposta alterada; atualize antes de salvar.' USING ERRCODE='40001';END IF;
 SELECT * INTO t FROM public.purchase_proposal_templates WHERE id=p_template AND workspace_id=c.workspace_id FOR SHARE;
 IF t.id IS NULL THEN RAISE EXCEPTION 'Modelo indisponível.' USING ERRCODE='42501';END IF;
 PERFORM public.purchase_proposal_validate_data(p_data,c.total_value);
 IF jsonb_typeof(p_design) IS DISTINCT FROM 'object' OR octet_length(p_design::text)>500000 OR jsonb_typeof(p_design->'pages') IS DISTINCT FROM 'array' OR jsonb_array_length(p_design->'pages') NOT BETWEEN 1 AND 40 THEN RAISE EXCEPTION 'Documento visual inválido.' USING ERRCODE='23514';END IF;
 INSERT INTO public.contract_purchase_proposals(workspace_id,contract_id,version,template_id,template_revision,data,design,parties,contract_hash,created_by)
 VALUES(c.workspace_id,c.id,current_version+1,t.id,t.revision,p_data,p_design,public.purchase_proposal_parties(c.id),p_expected_contract_hash,auth.uid()) RETURNING * INTO d;
 RETURN public.purchase_proposal_document_json(d);
END $$;

CREATE FUNCTION public.purchase_proposal_prepare(p_contract uuid,p_document uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c public.contracts;d public.contract_purchase_proposals;a public.contract_attachments;problem text;
BEGIN
 IF NOT public.purchase_proposal_access(p_contract,'manage') THEN RAISE EXCEPTION 'Sem permissão para gerar anexo de compra.' USING ERRCODE='42501';END IF;
 SELECT * INTO c FROM public.contracts WHERE id=p_contract FOR UPDATE;
 problem:=public.purchase_proposal_mutation_problem(c.id);IF problem IS NOT NULL THEN RAISE EXCEPTION '%',problem USING ERRCODE='23514';END IF;
 SELECT * INTO d FROM public.contract_purchase_proposals WHERE id=p_document AND contract_id=c.id AND workspace_id=c.workspace_id FOR UPDATE;
 IF d.id IS NULL THEN RAISE EXCEPTION 'Proposta indisponível.' USING ERRCODE='42501';END IF;
 IF d.status='generated' THEN RETURN jsonb_build_object('document',public.purchase_proposal_document_json(d),'generated',true);END IF;
 IF d.version<>(SELECT max(version) FROM public.contract_purchase_proposals WHERE contract_id=c.id) OR d.contract_hash IS DISTINCT FROM public.hiring_contract_fingerprint(c.id) THEN RAISE EXCEPTION 'Documento ou contrato alterado; salve nova versão antes de gerar.' USING ERRCODE='40001';END IF;
 IF d.attachment_id IS NULL THEN
  a.id:=gen_random_uuid();
  INSERT INTO public.contract_attachments(id,workspace_id,contract_id,kind,file_name,storage_path,created_by)
  VALUES(a.id,c.workspace_id,c.id,'file','Proposta técnica de compra — versão '||d.version||'.pdf',c.workspace_id::text||'/'||c.id::text||'/'||a.id::text,auth.uid()) RETURNING * INTO a;
  UPDATE public.contract_purchase_proposals SET attachment_id=a.id,status='reserved',reserved_by=auth.uid() WHERE id=d.id RETURNING * INTO d;
 ELSE
  SELECT * INTO a FROM public.contract_attachments WHERE id=d.attachment_id AND workspace_id=c.workspace_id AND contract_id=c.id;
  IF a.id IS NULL OR a.created_by<>auth.uid() THEN RAISE EXCEPTION 'Reserva pertence a outro responsável; preserve o envio e salve uma nova versão.' USING ERRCODE='42501';END IF;
 END IF;
 RETURN jsonb_build_object('document',public.purchase_proposal_document_json(d),'generated',false,'id',a.id,'path',a.storage_path);
END $$;

CREATE FUNCTION public.purchase_proposal_finish(p_contract uuid,p_document uuid,p_sha text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c public.contracts;d public.contract_purchase_proposals;a public.contract_attachments;problem text;
BEGIN
 IF NOT public.purchase_proposal_access(p_contract,'manage') THEN RAISE EXCEPTION 'Sem permissão para concluir anexo de compra.' USING ERRCODE='42501';END IF;
 SELECT * INTO c FROM public.contracts WHERE id=p_contract FOR UPDATE;
 problem:=public.purchase_proposal_mutation_problem(c.id);IF problem IS NOT NULL THEN RAISE EXCEPTION '%',problem USING ERRCODE='23514';END IF;
 SELECT * INTO d FROM public.contract_purchase_proposals WHERE id=p_document AND contract_id=c.id AND workspace_id=c.workspace_id FOR UPDATE;
 IF d.id IS NULL THEN RAISE EXCEPTION 'Proposta indisponível.' USING ERRCODE='42501';END IF;
 IF d.status='generated' THEN
  IF d.sha256 IS DISTINCT FROM p_sha THEN RAISE EXCEPTION 'Versão gerada é imutável.' USING ERRCODE='23514';END IF;
  RETURN public.purchase_proposal_document_json(d);
 END IF;
 IF d.version<>(SELECT max(version) FROM public.contract_purchase_proposals WHERE contract_id=c.id) OR d.contract_hash IS DISTINCT FROM public.hiring_contract_fingerprint(c.id) THEN RAISE EXCEPTION 'Documento ou contrato alterado; salve nova versão antes de gerar.' USING ERRCODE='40001';END IF;
 SELECT * INTO a FROM public.contract_attachments WHERE id=d.attachment_id AND workspace_id=c.workspace_id AND contract_id=c.id FOR UPDATE;
 IF a.id IS NULL OR a.ready OR d.status<>'reserved' OR d.reserved_by<>auth.uid() OR a.created_by<>auth.uid() OR a.kind<>'file' OR coalesce(p_sha,'')!~'^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Reserva de anexo inválida.' USING ERRCODE='42501';END IF;
 IF NOT EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='contract-attachments' AND o.name=a.storage_path AND (o.metadata->>'size')::bigint BETWEEN 1 AND 20971520 AND o.metadata->>'mimetype'='application/pdf' AND o.user_metadata->>'sha256'=p_sha) THEN RAISE EXCEPTION 'PDF não enviado ou hash divergente.' USING ERRCODE='23514';END IF;
 UPDATE public.contract_purchase_proposals SET status='generated',sha256=p_sha,reviewed_by=auth.uid(),reviewed_at=now() WHERE id=d.id RETURNING * INTO d;
 UPDATE public.contract_attachments SET ready=true,sha256=p_sha WHERE id=a.id;
 -- Installed by companion migration 0488 in the same release; fails closed if absent.
 PERFORM public.purchase_proposal_classify_attachment(d.id,a.id);
 RETURN public.purchase_proposal_document_json(d);
END $$;

CREATE FUNCTION public.purchase_proposal_revision_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF TG_OP='DELETE' OR ROW(NEW.id,NEW.workspace_id,NEW.contract_id,NEW.version,NEW.template_id,NEW.template_revision,NEW.data,NEW.design,NEW.parties,NEW.contract_hash,NEW.created_by,NEW.created_at) IS DISTINCT FROM ROW(OLD.id,OLD.workspace_id,OLD.contract_id,OLD.version,OLD.template_id,OLD.template_revision,OLD.data,OLD.design,OLD.parties,OLD.contract_hash,OLD.created_by,OLD.created_at) THEN RAISE EXCEPTION 'Versão técnica imutável; salve uma nova revisão.' USING ERRCODE='23514';END IF;
 IF OLD.status='generated' AND ROW(NEW.status,NEW.sha256,NEW.reviewed_by,NEW.reviewed_at,NEW.reserved_by) IS DISTINCT FROM ROW(OLD.status,OLD.sha256,OLD.reviewed_by,OLD.reviewed_at,OLD.reserved_by) THEN RAISE EXCEPTION 'Proposta gerada é imutável.' USING ERRCODE='23514';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER purchase_proposal_revision_immutable BEFORE UPDATE OR DELETE ON public.contract_purchase_proposals FOR EACH ROW EXECUTE FUNCTION public.purchase_proposal_revision_guard();

-- Revoke inherited object defaults, including bypass roles; only the five user RPCs are exposed.
DO $$ DECLARE f record;r text;
BEGIN
 FOR f IN SELECT oid::regprocedure AS signature FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname LIKE 'purchase_proposal_%' LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',f.signature);
  FOREACH r IN ARRAY ARRAY['sandbox_exec','techerp_request_writer'] LOOP
   IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %I',f.signature,r);END IF;
  END LOOP;
 END LOOP;
 FOREACH r IN ARRAY ARRAY['sandbox_exec','techerp_request_writer'] LOOP
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN EXECUTE format('REVOKE ALL ON public.purchase_proposal_templates,public.contract_purchase_proposals FROM %I',r);END IF;
 END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION public.purchase_proposal_context(uuid),public.purchase_proposal_template_save(uuid,uuid,text,jsonb,integer),public.purchase_proposal_save(uuid,uuid,jsonb,jsonb,integer,text),public.purchase_proposal_prepare(uuid,uuid),public.purchase_proposal_finish(uuid,uuid,text) TO authenticated;
NOTIFY pgrst,'reload schema';
