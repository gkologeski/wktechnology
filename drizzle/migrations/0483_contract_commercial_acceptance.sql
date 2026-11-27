-- Separate commercial acceptance, legal signatures, execution and billing.
-- No existing role receives these new capabilities automatically.
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,description,is_system) VALUES
 ('techcontracts.contract_acceptance.approve.workspace','techcontracts','contract_acceptance','approve','workspace','Registrar aceite comercial do contrato','Registrar evidência do aceite do cliente na versão atual. Não registra assinatura.',true),
 ('techcontracts.contract_acceptance.manage.workspace','techcontracts','contract_acceptance','manage','workspace','Gerenciar links de aceite do contrato','Gerar e revogar links temporários de aceite comercial.',true),
 ('techcontracts.contract_acceptance_billing.manage.workspace','techcontracts','contract_acceptance_billing','manage','workspace','Liberar faturamento pelo aceite do contrato','Liberar contas a receber após aceite comercial vigente e aprovações internas, sem declarar assinatura.',true),
 ('techservice.service_execution.manage.workspace','techservice','service_execution','manage','workspace','Concluir execução de serviços','Registrar conclusão operacional, preservando assinatura pendente e retenção da cobrança.',true)
ON CONFLICT(key) DO NOTHING;

CREATE TABLE public.contract_commercial_acceptances (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
 contract_id uuid NOT NULL REFERENCES public.contracts(id),
 content_hash text NOT NULL CHECK(content_hash ~ '^[0-9a-f]{64}$'),
 source text NOT NULL CHECK(source IN('internal','public')),
 client_name text NOT NULL CHECK(length(btrim(client_name)) BETWEEN 3 AND 200),
 accepted_at date NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT now(),
 recorded_by uuid,
 evidence text NOT NULL CHECK(length(btrim(evidence)) BETWEEN 10 AND 4000),
 reason text,
 revoked_at timestamptz,
 revoked_by uuid,
 revoke_reason text
);
CREATE INDEX contract_commercial_acceptances_current ON public.contract_commercial_acceptances(contract_id,recorded_at DESC) WHERE revoked_at IS NULL;
CREATE TABLE public.contract_commercial_acceptance_links (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
 contract_id uuid NOT NULL REFERENCES public.contracts(id),
 content_hash text NOT NULL,
 token_hash text UNIQUE NOT NULL CHECK(token_hash ~ '^[0-9a-f]{64}$'),
 snapshot jsonb NOT NULL,
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 revoked_at timestamptz,
 accepted_id uuid REFERENCES public.contract_commercial_acceptances(id)
);
CREATE INDEX contract_commercial_acceptance_links_contract ON public.contract_commercial_acceptance_links(contract_id);
CREATE TABLE public.contract_acceptance_billing_releases (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
 contract_id uuid NOT NULL REFERENCES public.contracts(id),
 acceptance_id uuid NOT NULL REFERENCES public.contract_commercial_acceptances(id),
 content_hash text NOT NULL,
 due_date date,
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 10 AND 4000),
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(contract_id,content_hash,acceptance_id)
);
CREATE TABLE public.service_execution_completions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
 service_id uuid UNIQUE NOT NULL REFERENCES public.services(id),
 completed_on date NOT NULL,
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 10 AND 4000),
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.contract_commercial_acceptances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_commercial_acceptance_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_acceptance_billing_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_execution_completions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.contract_commercial_acceptances,public.contract_commercial_acceptance_links,public.contract_acceptance_billing_releases,public.service_execution_completions FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON public.contract_commercial_acceptances,public.contract_commercial_acceptance_links,public.contract_acceptance_billing_releases,public.service_execution_completions FROM service_role;
-- Reads and writes are finite DTOs through the authorized RPCs below. No raw public tokens/snapshots.

CREATE OR REPLACE FUNCTION public.contract_commercial_content_hash(p_contract uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT encode(extensions.digest(convert_to(jsonb_build_object(
  'contract',to_jsonb(c)-ARRAY['status','signed_at','signed_pdf_path','signature_provider','signature_document_id','signature_operation_id','owner_id','assigned_to','updated_at','created_at','public_token','metadata','import_confidence','imported_from'],
  'issuer',(SELECT jsonb_build_object('id',l.id,'name',l.name,'cnpj',l.cnpj) FROM public.legal_entities l WHERE l.id=coalesce(c.contracting_legal_entity_id,c.legal_entity_id) AND l.workspace_id=c.workspace_id),
  'counterparty',(SELECT jsonb_build_object('id',x.id,'name',x.name,'cnpj',to_jsonb(x)->>'cnpj') FROM public.companies x WHERE x.id=c.counterparty_company_id AND x.workspace_id=c.workspace_id),
  'services',coalesce((SELECT jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'description',s.description,'type',s.type,'cadence',s.cadence,'quantity',s.quantity,'unit_price',s.unit_price,'currency',s.currency) ORDER BY s.id) FROM public.services s WHERE s.contract_id=c.id AND s.workspace_id=c.workspace_id),'[]'::jsonb),
  'attachments',coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.id,'kind',a.kind,'name',a.file_name,'source_id',a.source_id,'stamp',coalesce(a.source_stamp,public.contract_attachment_source_stamp(a.id))) ORDER BY a.created_at,a.id) FROM public.contract_attachments a WHERE a.contract_id=c.id AND a.workspace_id=c.workspace_id AND a.ready),'[]'::jsonb)
 )::text,'UTF8'),'sha256'),'hex') FROM public.contracts c WHERE c.id=p_contract
$$;
REVOKE ALL ON FUNCTION public.contract_commercial_content_hash(uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.contract_commercial_authorize(p_contract uuid,p_permission text DEFAULT NULL,p_write boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE w uuid;ctx jsonb:=public.work_access_context();u uuid:=auth.uid();BEGIN
 SELECT workspace_id INTO w FROM public.contracts WHERE id=p_contract;
 IF u IS NULL OR w IS NULL OR w IS DISTINCT FROM (ctx->>'workspace')::uuid OR NOT public.is_workspace_member(w,u)
  OR NOT public.work_record_access('techcontracts.contracts',p_contract,'view')
  OR (p_write AND (public.is_read_only_view() OR NOT public.work_record_access('techcontracts.contracts',p_contract,'update')))
  OR (p_permission IS NOT NULL AND NOT public.user_has_permission(u,w,p_permission)) THEN
  RAISE EXCEPTION 'Contrato indisponível ou ação não autorizada.' USING ERRCODE='42501';END IF;
 RETURN w;
END $$;
REVOKE ALL ON FUNCTION public.contract_commercial_authorize(uuid,text,boolean) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.contract_commercial_current(p_contract uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT a.id FROM public.contract_commercial_acceptances a WHERE a.contract_id=p_contract AND a.revoked_at IS NULL
 AND a.content_hash=public.contract_commercial_content_hash(p_contract) ORDER BY a.recorded_at DESC,a.id LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.contract_commercial_current(uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.contract_commercial_internal_approved(c public.contracts)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM public.contract_approvals l JOIN public.contract_approvals f
  ON f.contract_id=l.contract_id AND f.workspace_id=l.workspace_id AND f.generation IS NOT DISTINCT FROM l.generation
  WHERE l.contract_id=c.id AND l.workspace_id=c.workspace_id AND l.superseded_at IS NULL AND f.superseded_at IS NULL
  AND l.stage::text='legal' AND f.stage::text='finance' AND l.status::text='approved' AND f.status::text='approved')
 AND NOT EXISTS(SELECT 1 FROM public.contract_approvals WHERE contract_id=c.id AND workspace_id=c.workspace_id AND superseded_at IS NULL AND status::text<>'approved')
$$;
REVOKE ALL ON FUNCTION public.contract_commercial_internal_approved(public.contracts) FROM PUBLIC,anon,authenticated,service_role;

-- Same canonical record resolver used by sales_capabilities, with the real
-- issuing user's current effective context. No forged JWT or public source IDs.
CREATE OR REPLACE FUNCTION public.contract_commercial_annexes_visible(p_ws uuid,p_contract uuid,p_actor uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE ctx jsonb:=public.work_subject_context(p_ws,p_actor);BEGIN
 IF ctx->>'actor' IS DISTINCT FROM p_actor::text OR ctx->>'workspace' IS DISTINCT FROM p_ws::text OR p_actor IS NULL THEN RETURN false;END IF;
 RETURN NOT EXISTS(SELECT 1 FROM public.contract_attachments a
  WHERE a.workspace_id=p_ws AND a.contract_id=p_contract AND a.ready AND a.kind IN('quote','proposal')
  AND NOT sales_private.record_access_ctx(ctx,CASE a.kind WHEN 'quote' THEN 'quotes' ELSE 'proposals' END,a.source_id,'view'));
END $$;
REVOKE ALL ON FUNCTION public.contract_commercial_annexes_visible(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.contract_commercial_state(p_contract uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE w uuid;h text;a uuid;c contracts;hist jsonb;current_row jsonb;blocked text;BEGIN
 w:=public.contract_commercial_authorize(p_contract);SELECT * INTO c FROM contracts WHERE id=p_contract;h:=public.contract_commercial_content_hash(p_contract);a:=public.contract_commercial_current(p_contract);
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',x.id,'source',x.source,'clientName',x.client_name,'acceptedAt',x.accepted_at,'recordedAt',x.recorded_at,'recordedByName',(SELECT p.full_name FROM public.profiles p WHERE p.id=x.recorded_by),'evidence',x.evidence,'contentHash',x.content_hash,'revokedAt',x.revoked_at,'revokeReason',x.revoke_reason) ORDER BY x.recorded_at DESC),'[]') INTO hist FROM (SELECT * FROM contract_commercial_acceptances WHERE contract_id=c.id AND workspace_id=w ORDER BY recorded_at DESC LIMIT 30) x;
 SELECT x INTO current_row FROM jsonb_array_elements(hist) x WHERE x->>'id'=a::text;
 IF c.role::text<>'provider' THEN blocked:='Aceite comercial antecipado é exclusivo de contratos de venda; compras continuam exigindo assinatura.';
 ELSIF NOT public.contract_commercial_internal_approved(c) THEN blocked:='Conclua as aprovações internas pendentes (Jurídico/Financeiro) antes de liberar o faturamento.';
 ELSIF a IS NULL THEN blocked:='Registre o aceite do cliente na versão atual do contrato.';END IF;
 RETURN jsonb_build_object('contractId',c.id,'currentHash',h,'accepted',a IS NOT NULL,'acceptance',current_row,'history',hist,
  'signaturePending',c.signed_at IS NULL,'billingReleased',EXISTS(SELECT 1 FROM contract_acceptance_billing_releases r JOIN contract_commercial_acceptances a ON a.id=r.acceptance_id WHERE r.contract_id=c.id AND r.content_hash=h AND a.revoked_at IS NULL AND a.content_hash=h),
  'releaseBlocked',blocked,
  'canRecord',NOT is_read_only_view() AND c.role::text='provider' AND work_record_access('techcontracts.contracts',c.id,'update') AND user_has_permission(auth.uid(),w,'techcontracts.contract_acceptance.approve.workspace'),
  'canManageLinks',NOT is_read_only_view() AND c.role::text='provider' AND work_record_access('techcontracts.contracts',c.id,'update') AND user_has_permission(auth.uid(),w,'techcontracts.contract_acceptance.manage.workspace') AND user_has_permission(auth.uid(),w,'techcontracts.esign_share.manage.workspace') AND public.contract_commercial_annexes_visible(w,c.id,auth.uid()),
  'canReleaseBilling',NOT is_read_only_view() AND c.role::text='provider' AND work_record_access('techcontracts.contracts',c.id,'update') AND user_has_permission(auth.uid(),w,'techcontracts.contract_acceptance_billing.manage.workspace') AND user_has_permission(auth.uid(),w,'techservice.billing.manage.workspace'));
END $$;
REVOKE ALL ON FUNCTION public.contract_commercial_state(uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.contract_commercial_state(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.contract_commercial_record(p_contract uuid,p_accepted_at date,p_client_name text,p_evidence text,p_reason text DEFAULT NULL,p_expected_hash text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE w uuid;c contracts;h text;a uuid;BEGIN
 w:=public.contract_commercial_authorize(p_contract,'techcontracts.contract_acceptance.approve.workspace',true);
 SELECT * INTO c FROM contracts WHERE id=p_contract FOR UPDATE;
 w:=public.contract_commercial_authorize(p_contract,'techcontracts.contract_acceptance.approve.workspace',true);
 IF c.role::text<>'provider' OR c.status::text IN('canceled','terminated','ended') THEN RAISE EXCEPTION 'Contrato indisponível para aceite comercial.' USING ERRCODE='23514';END IF;
 IF p_accepted_at IS NULL OR p_accepted_at>current_date OR length(btrim(coalesce(p_client_name,''))) NOT BETWEEN 3 AND 200 OR length(btrim(coalesce(p_evidence,''))) NOT BETWEEN 10 AND 4000 THEN RAISE EXCEPTION 'Informe data real, nome do cliente e evidência do aceite (mínimo 10 caracteres).' USING ERRCODE='22023';END IF;
 IF length(regexp_replace(coalesce(c.body_html,''),'<[^>]*>','','g'))<20 OR (c.body_html ~ '\{\{[^}]+\}\}' OR c.body_html ~ '\[\[[^]]+\]\]') THEN RAISE EXCEPTION 'Revise o texto completo do contrato antes do aceite.' USING ERRCODE='23514';END IF;
 h:=public.contract_commercial_content_hash(c.id);IF p_expected_hash IS DISTINCT FROM h THEN RAISE EXCEPTION 'O contrato mudou. Recarregue e confirme a versão atual antes de registrar o aceite.' USING ERRCODE='23514';END IF;a:=public.contract_commercial_current(c.id);
 IF a IS NULL THEN
  INSERT INTO contract_commercial_acceptances(workspace_id,contract_id,content_hash,source,client_name,accepted_at,recorded_by,evidence,reason) VALUES(w,c.id,h,'internal',btrim(p_client_name),p_accepted_at,auth.uid(),btrim(p_evidence),left(p_reason,4000)) RETURNING id INTO a;
  INSERT INTO contract_events(workspace_id,contract_id,actor_id,event_type,payload) VALUES(w,c.id,auth.uid(),'commercial_accepted',jsonb_build_object('acceptance_id',a,'source','internal','content_hash',h,'accepted_at',p_accepted_at,'signature_unchanged',true));
 END IF;
 RETURN public.contract_commercial_state(c.id);
END $$;
REVOKE ALL ON FUNCTION public.contract_commercial_record(uuid,date,text,text,text,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.contract_commercial_record(uuid,date,text,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.contract_commercial_issue_link(p_contract uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE w uuid;c contracts;t text;h text;expiry timestamptz:=now()+interval '30 days';snap jsonb;BEGIN
 w:=public.contract_commercial_authorize(p_contract,'techcontracts.contract_acceptance.manage.workspace',true);SELECT * INTO c FROM contracts WHERE id=p_contract FOR UPDATE;
 w:=public.contract_commercial_authorize(p_contract,'techcontracts.contract_acceptance.manage.workspace',true);
 IF NOT public.user_has_permission(auth.uid(),w,'techcontracts.esign_share.manage.workspace') THEN RAISE EXCEPTION 'Sem permissão para compartilhar documentos de contrato externamente.' USING ERRCODE='42501';END IF;
 IF NOT public.contract_commercial_annexes_visible(w,c.id,auth.uid()) THEN RAISE EXCEPTION 'Um anexo comercial não está disponível no seu acesso. Revise as permissões antes de compartilhar o contrato.' USING ERRCODE='42501';END IF;
 IF c.role::text<>'provider' OR c.status::text IN('canceled','terminated','ended') OR public.contract_commercial_current(c.id) IS NOT NULL THEN RAISE EXCEPTION 'Contrato indisponível para novo link de aceite.' USING ERRCODE='23514';END IF;
 IF length(regexp_replace(coalesce(c.body_html,''),'<[^>]*>','','g'))<20 OR (c.body_html ~ '\{\{[^}]+\}\}' OR c.body_html ~ '\[\[[^]]+\]\]') THEN RAISE EXCEPTION 'Revise o texto completo do contrato antes do aceite.' USING ERRCODE='23514';END IF;
 h:=public.contract_commercial_content_hash(c.id);t:=encode(extensions.gen_random_bytes(32),'hex');
 snap:=jsonb_build_object('title',c.title,'number',c.number,'bodyHtml',replace(public.hiring_contract_esign_body_without_attachments(w,c.id),'<strong>Contrato:</strong> '||c.id::text,'<strong>Contrato:</strong> Não numerado'),'workspaceName',(SELECT name FROM workspaces WHERE id=w),'counterpartyName',(SELECT name FROM companies WHERE id=c.counterparty_company_id AND workspace_id=w),'totalValue',c.total_value,'currency',c.currency,
  'paymentTerms',c.payment_terms,'startsAt',c.starts_at,'endsAt',c.ends_at,
  'services',coalesce((SELECT jsonb_agg(jsonb_build_object('name',s.name,'description',s.description,'type',s.type,'quantity',s.quantity,'unitPrice',s.unit_price,'currency',s.currency) ORDER BY s.id) FROM services s WHERE s.contract_id=c.id AND s.workspace_id=w),'[]'::jsonb),
  'attachments',coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.id,'name',coalesce(a.source_name,a.file_name),'kind',a.kind) ORDER BY a.created_at,a.id) FROM contract_attachments a WHERE a.contract_id=c.id AND a.workspace_id=w AND a.ready),'[]'::jsonb));
 UPDATE contract_commercial_acceptance_links SET revoked_at=now() WHERE contract_id=c.id AND revoked_at IS NULL AND accepted_id IS NULL;
 INSERT INTO contract_commercial_acceptance_links(workspace_id,contract_id,content_hash,token_hash,snapshot,created_by,expires_at) VALUES(w,c.id,h,encode(extensions.digest(convert_to(t,'UTF8'),'sha256'),'hex'),snap,auth.uid(),expiry);
 INSERT INTO contract_events(workspace_id,contract_id,actor_id,event_type,payload) VALUES(w,c.id,auth.uid(),'commercial_acceptance_link_created',jsonb_build_object('content_hash',h,'expires_at',expiry));
 RETURN jsonb_build_object('token',t,'expiresAt',expiry,'path','/contract-acceptance/'||t);
END $$;
REVOKE ALL ON FUNCTION public.contract_commercial_issue_link(uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.contract_commercial_issue_link(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.contract_commercial_revoke(p_contract uuid,p_reason text,p_links_only boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE w uuid;BEGIN
 w:=public.contract_commercial_authorize(p_contract,CASE WHEN p_links_only THEN 'techcontracts.contract_acceptance.manage.workspace' ELSE 'techcontracts.contract_acceptance.approve.workspace' END,true);
 IF length(btrim(coalesce(p_reason,'')))<10 THEN RAISE EXCEPTION 'Informe o motivo da revogação (mínimo 10 caracteres).' USING ERRCODE='22023';END IF;
 PERFORM 1 FROM contracts WHERE id=p_contract FOR UPDATE;
 w:=public.contract_commercial_authorize(p_contract,CASE WHEN p_links_only THEN 'techcontracts.contract_acceptance.manage.workspace' ELSE 'techcontracts.contract_acceptance.approve.workspace' END,true);
 UPDATE contract_commercial_acceptance_links SET revoked_at=now() WHERE contract_id=p_contract AND revoked_at IS NULL;
 IF NOT p_links_only THEN UPDATE contract_commercial_acceptances SET revoked_at=now(),revoked_by=auth.uid(),revoke_reason=left(btrim(p_reason),4000) WHERE contract_id=p_contract AND revoked_at IS NULL;END IF;
 INSERT INTO contract_events(workspace_id,contract_id,actor_id,event_type,payload) VALUES(w,p_contract,auth.uid(),CASE WHEN p_links_only THEN 'commercial_acceptance_link_revoked' ELSE 'commercial_acceptance_revoked' END,jsonb_build_object('reason',left(p_reason,4000),'existing_financial_entries_preserved',true));
 RETURN public.contract_commercial_state(p_contract);
END $$;
REVOKE ALL ON FUNCTION public.contract_commercial_revoke(uuid,text,boolean) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.contract_commercial_revoke(uuid,text,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.contract_commercial_public_get(p_token text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE l contract_commercial_acceptance_links;a contract_commercial_acceptances;BEGIN
 IF p_token !~ '^[0-9a-f]{64}$' THEN RETURN NULL;END IF;
 SELECT * INTO l FROM contract_commercial_acceptance_links WHERE token_hash=encode(extensions.digest(convert_to(p_token,'UTF8'),'sha256'),'hex');
 IF l.id IS NULL OR NOT public.is_workspace_member(l.workspace_id,l.created_by) OR NOT public.user_has_permission(l.created_by,l.workspace_id,'techcontracts.contract_acceptance.manage.workspace') OR NOT public.work_record_context_access(public.work_subject_context(l.workspace_id,l.created_by),'techcontracts.contracts',l.contract_id,'view') OR NOT public.work_record_context_access(public.work_subject_context(l.workspace_id,l.created_by),'techcontracts.contracts',l.contract_id,'update') OR NOT public.user_has_permission(l.created_by,l.workspace_id,'techcontracts.esign_share.manage.workspace') OR NOT public.contract_commercial_annexes_visible(l.workspace_id,l.contract_id,l.created_by) OR l.revoked_at IS NOT NULL OR l.expires_at<now() OR l.content_hash IS DISTINCT FROM contract_commercial_content_hash(l.contract_id)
 OR NOT EXISTS(SELECT 1 FROM contracts WHERE id=l.contract_id AND workspace_id=l.workspace_id AND role::text='provider' AND status::text NOT IN('canceled','terminated','ended')) THEN RETURN NULL;END IF;
 IF l.accepted_id IS NOT NULL THEN SELECT * INTO a FROM contract_commercial_acceptances WHERE id=l.accepted_id AND revoked_at IS NULL;IF a.id IS NULL THEN RETURN NULL;END IF;END IF;
 RETURN l.snapshot||jsonb_build_object('status',CASE WHEN a.id IS NULL THEN 'pending' ELSE 'accepted' END,'clientName',a.client_name,'acceptedAt',a.accepted_at,'expiresAt',l.expires_at);
END $$;
REVOKE ALL ON FUNCTION public.contract_commercial_public_get(text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.contract_commercial_public_get(text) TO service_role;

CREATE OR REPLACE FUNCTION public.contract_commercial_public_accept(p_token text,p_client_name text,p_client_email text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE l contract_commercial_acceptance_links;a uuid;at_time date;BEGIN
 IF p_token !~ '^[0-9a-f]{64}$' OR length(btrim(coalesce(p_client_name,''))) NOT BETWEEN 3 AND 200 THEN RAISE EXCEPTION 'Link indisponível ou nome inválido.' USING ERRCODE='22023';END IF;
 -- Lock the parent before the link, matching the internal issue/revoke/record order.
 SELECT * INTO l FROM contract_commercial_acceptance_links WHERE token_hash=encode(extensions.digest(convert_to(p_token,'UTF8'),'sha256'),'hex');
 IF l.id IS NULL THEN RAISE EXCEPTION 'Link indisponível.' USING ERRCODE='22023';END IF;
 PERFORM 1 FROM contracts WHERE id=l.contract_id FOR UPDATE;
 SELECT * INTO l FROM contract_commercial_acceptance_links WHERE id=l.id FOR UPDATE;
 IF public.contract_commercial_public_get(p_token) IS NULL THEN RAISE EXCEPTION 'Link expirado, revogado ou de versão anterior.' USING ERRCODE='22023';END IF;
 IF l.accepted_id IS NOT NULL THEN SELECT accepted_at INTO at_time FROM contract_commercial_acceptances WHERE id=l.accepted_id;RETURN jsonb_build_object('accepted',true,'acceptedAt',at_time,'duplicate',true);END IF;
 a:=public.contract_commercial_current(l.contract_id);
 IF a IS NULL THEN
  INSERT INTO contract_commercial_acceptances(workspace_id,contract_id,content_hash,source,client_name,accepted_at,evidence) VALUES(l.workspace_id,l.contract_id,l.content_hash,'public',btrim(p_client_name),current_date,'Aceite comercial confirmado pelo cliente no link da versão apresentada.'||CASE WHEN nullif(btrim(p_client_email),'') IS NOT NULL THEN ' E-mail informado: '||left(btrim(p_client_email),254) ELSE '' END) RETURNING id INTO a;
  INSERT INTO contract_events(workspace_id,contract_id,actor_id,event_type,payload) VALUES(l.workspace_id,l.contract_id,NULL,'commercial_accepted',jsonb_build_object('acceptance_id',a,'source','public','content_hash',l.content_hash,'signature_unchanged',true));
 END IF;
 UPDATE contract_commercial_acceptance_links SET accepted_id=a WHERE id=l.id;
 SELECT accepted_at INTO at_time FROM contract_commercial_acceptances WHERE id=a;
 RETURN jsonb_build_object('accepted',true,'acceptedAt',at_time,'duplicate',false);
END $$;
REVOKE ALL ON FUNCTION public.contract_commercial_public_accept(text,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.contract_commercial_public_accept(text,text,text) TO service_role;

-- This predicate is ONLY for service receivables. The signature predicate and
-- purchase/payable authorization are deliberately unchanged.
CREATE OR REPLACE FUNCTION public.contract_service_billing_eligible(c public.contracts)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT public.contract_is_signed_for_billing(c) OR (
 c.role::text='provider' AND c.status::text NOT IN('canceled','terminated','ended')
 AND public.contract_commercial_internal_approved(c)
 AND EXISTS(SELECT 1 FROM contract_acceptance_billing_releases r JOIN contract_commercial_acceptances a ON a.id=r.acceptance_id AND a.contract_id=r.contract_id AND a.workspace_id=r.workspace_id
 WHERE r.contract_id=c.id AND r.workspace_id=c.workspace_id AND r.content_hash=public.contract_commercial_content_hash(c.id) AND a.content_hash=r.content_hash AND a.revoked_at IS NULL))
$$;
REVOKE ALL ON FUNCTION public.contract_service_billing_eligible(public.contracts) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.service_execution_complete(p_service uuid,p_completed_on date,p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE s services;w uuid;u uuid:=auth.uid();existing service_execution_completions;parent_contract uuid;BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Sessão obrigatória.' USING ERRCODE='42501';END IF;
 w:=public.work_area_authorize('techservice.services','update',p_service);
 IF NOT public.is_workspace_member(w,u) OR public.is_read_only_view() OR NOT public.user_has_permission(u,w,'techservice.service_execution.manage.workspace') THEN RAISE EXCEPTION 'Sem permissão para concluir a execução.' USING ERRCODE='42501';END IF;
 -- Match the signature/billing lock order: parent contract, then service.
 -- Inserting the audit event references the parent and must not lock it last.
 SELECT contract_id INTO parent_contract FROM services WHERE id=p_service AND workspace_id=w;
 IF parent_contract IS NOT NULL THEN
  PERFORM 1 FROM contracts WHERE id=parent_contract AND workspace_id=w FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contrato indisponível.' USING ERRCODE='42501';END IF;
 END IF;
 SELECT * INTO s FROM services WHERE id=p_service AND workspace_id=w FOR UPDATE;
 PERFORM public.work_area_authorize('techservice.services','update',p_service);
 IF s.id IS NULL THEN RAISE EXCEPTION 'Serviço indisponível.' USING ERRCODE='42501';END IF;
 IF s.contract_id IS DISTINCT FROM parent_contract THEN RAISE EXCEPTION 'O vínculo do serviço mudou. Recarregue antes de concluir a execução.' USING ERRCODE='23514';END IF;
 SELECT * INTO existing FROM service_execution_completions WHERE service_id=s.id;
 IF existing.id IS NOT NULL THEN RETURN jsonb_build_object('service',jsonb_build_object('id',s.id,'status',s.status,'ends_at',s.ends_at,'billing_hold',s.billing_hold),'completion',to_jsonb(existing),'duplicate',true);END IF;
 IF s.status NOT IN('active','paused') THEN RAISE EXCEPTION 'Ative o serviço antes de concluir a execução. Serviços encerrados não podem ser concluídos novamente.' USING ERRCODE='23514';END IF;
 IF p_completed_on IS NULL OR p_completed_on>current_date OR (s.starts_at IS NOT NULL AND p_completed_on<s.starts_at) OR length(btrim(coalesce(p_reason,''))) NOT BETWEEN 10 AND 4000 THEN RAISE EXCEPTION 'Informe data real de conclusão, posterior ou igual ao início e não futura, e motivo com ao menos 10 caracteres.' USING ERRCODE='22023';END IF;
 INSERT INTO service_execution_completions(workspace_id,service_id,completed_on,reason,created_by) VALUES(w,s.id,p_completed_on,btrim(p_reason),u) RETURNING * INTO existing;
 -- Preserve billing_hold and its canonical payment schedule exactly as activated.
 UPDATE services SET status='completed',ends_at=p_completed_on,next_billing_at=NULL WHERE id=s.id RETURNING * INTO s;
 IF s.contract_id IS NOT NULL THEN INSERT INTO contract_events(workspace_id,contract_id,actor_id,event_type,payload) VALUES(w,s.contract_id,u,'service_execution_completed',jsonb_build_object('service_id',s.id,'completed_on',p_completed_on,'reason',p_reason,'billing_hold',s.billing_hold));END IF;
 RETURN jsonb_build_object('service',jsonb_build_object('id',s.id,'status',s.status,'ends_at',s.ends_at,'billing_hold',s.billing_hold),'completion',to_jsonb(existing),'duplicate',false);
END $$;
REVOKE ALL ON FUNCTION public.service_execution_complete(uuid,date,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.service_execution_complete(uuid,date,text) TO authenticated;

-- Billing RPCs retain their existing grants, checks and once-per-contract references.
CREATE OR REPLACE FUNCTION public.service_activate_with_terms(p_service uuid, p_starts date, p_schedule jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $function$
DECLARE s services;c contracts;actor uuid:=auth.uid();w uuid;start_date date;item jsonb;n int:=0;total numeric:=0;cnt int;inserted uuid;next_status service_status;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'Sessão obrigatória.' USING ERRCODE='42501';END IF;
 SELECT * INTO s FROM services WHERE id=p_service FOR UPDATE;
 IF s.id IS NULL THEN RAISE EXCEPTION 'Serviço indisponível.' USING ERRCODE='42501';END IF;
 w:=work_area_authorize('techservice.services','update',s.id);
 PERFORM work_area_authorize('techservice.billing','manage');
 IF NOT finance_scope_access(w,'entries','view',actor) THEN RAISE EXCEPTION 'Sem acesso aos lançamentos financeiros.' USING ERRCODE='42501';END IF;
 IF NOT(user_has_permission(actor,w,'techfinance.entries.create.own') OR user_has_permission(actor,w,'techfinance.entries.create.workspace')) THEN RAISE EXCEPTION 'Sem permissão para gerar lançamentos financeiros.' USING ERRCODE='42501';END IF;
 IF s.status IN('active','completed') THEN RETURN jsonb_build_object('generated',0,'duplicate',true,'service',to_jsonb(s));END IF;
 IF s.status<>'pending' THEN RAISE EXCEPTION 'Serviço indisponível para ativação.' USING ERRCODE='23514';END IF;
 IF s.contract_id IS NULL THEN RAISE EXCEPTION 'Serviço sem contrato.' USING ERRCODE='23514';END IF;
 SELECT * INTO c FROM contracts WHERE id=s.contract_id AND workspace_id=w;
 IF c.id IS NULL THEN RAISE EXCEPTION 'Contrato indisponível.' USING ERRCODE='42501';END IF;
 IF NOT (c.payment_terms ? 'plan') THEN RAISE EXCEPTION 'Contrato sem condições de pagamento.' USING ERRCODE='23514';END IF;
 IF jsonb_typeof(p_schedule)<>'array' OR jsonb_array_length(p_schedule)=0 OR jsonb_array_length(p_schedule)>240 THEN RAISE EXCEPTION 'Cronograma inválido.' USING ERRCODE='22023';END IF;
 SELECT coalesce(sum((x->>'amount')::numeric),0) INTO total FROM jsonb_array_elements(p_schedule) x;
 IF c.total_value IS NOT NULL AND abs(total-c.total_value)>0.01 THEN RAISE EXCEPTION 'As parcelas não fecham com o valor do contrato.' USING ERRCODE='23514';END IF;
 start_date:=coalesce(p_starts,s.starts_at,current_date);
 IF NOT contract_service_billing_eligible(c) THEN
  UPDATE services SET status='active',starts_at=start_date,next_billing_at=NULL,billing_hold='awaiting_signature',billing_hold_schedule=p_schedule WHERE id=s.id RETURNING * INTO s;
  RETURN jsonb_build_object('generated',0,'duplicate',false,'awaitingSignature',true,'service',to_jsonb(s));
 END IF;
 SELECT count(*) INTO cnt FROM financial_entries WHERE workspace_id=w AND external_ref LIKE 'payment-terms:'||c.id::text||':%';
 IF cnt=0 THEN
  FOR item IN SELECT * FROM jsonb_array_elements(p_schedule) LOOP
   n:=n+1;
   IF (item->>'amount')::numeric<=0 THEN CONTINUE;END IF;
   INSERT INTO financial_entries(workspace_id,owner_id,direction,origin_type,origin_id,contract_id,service_id,counterparty_company_id,description,amount,currency,competence_date,due_date,status,external_ref,installment_number,installment_total,notes,metadata)
   VALUES(w,actor,CASE WHEN c.role='client' THEN 'payable'::financial_direction ELSE 'receivable'::financial_direction END,'contract',c.id,c.id,s.id,c.counterparty_company_id,
     left(coalesce(c.title,'Contrato')||' — '||coalesce(item->>'label','Parcela'),300),(item->>'amount')::numeric,coalesce(c.currency,s.currency,'BRL'),
     coalesce((SELECT min(due_date) FROM contract_acceptance_billing_releases WHERE contract_id=c.id AND content_hash=contract_commercial_content_hash(c.id)),(item->>'dueDate')::date,start_date),coalesce((SELECT min(due_date) FROM contract_acceptance_billing_releases WHERE contract_id=c.id AND content_hash=contract_commercial_content_hash(c.id)),(item->>'dueDate')::date,start_date),'open',
     'payment-terms:'||c.id::text||':'||n::text,n,jsonb_array_length(p_schedule),
     CASE WHEN NOT contract_is_signed_for_billing(c) THEN 'Liberado por aceite comercial; vencimento conforme acordo registrado.' ELSE CASE item->>'dueEvent' WHEN 'milestone' THEN 'Vence na entrega do marco: ajuste a data quando o marco for entregue.' WHEN 'signature' THEN 'Vence na assinatura do contrato.' END END,
     jsonb_build_object('payment_terms',true,'due_event',item->>'dueEvent'))
   ON CONFLICT DO NOTHING RETURNING id INTO inserted;
  END LOOP;
 END IF;
 next_status:='active'::service_status;
 UPDATE services SET status=next_status,starts_at=start_date,next_billing_at=NULL,billing_hold=NULL,billing_hold_schedule=NULL WHERE id=s.id RETURNING * INTO s;
 RETURN jsonb_build_object('generated',CASE WHEN cnt=0 THEN n ELSE 0 END,'duplicate',cnt>0,'service',to_jsonb(s));
END $function$;

CREATE OR REPLACE FUNCTION public.service_bill_checked(p_service uuid, p_mode text, p_starts date DEFAULT NULL::date)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $function$
DECLARE s services;c contracts;actor uuid:=auth.uid();w uuid;billing_date date;upcoming date;next_status service_status;inserted uuid;generated boolean:=false;BEGIN
 IF p_mode NOT IN('activate','tick') THEN RAISE EXCEPTION 'Ação inválida.';END IF;
 SELECT * INTO s FROM services WHERE id=p_service FOR UPDATE;
 IF s.id IS NULL THEN RAISE EXCEPTION 'Serviço indisponível.' USING ERRCODE='42501';END IF;
 IF actor IS NOT NULL THEN
 w:=work_area_authorize('techservice.services','update',s.id);PERFORM work_area_authorize('techservice.billing','manage');
 IF NOT finance_scope_access(w,'entries','view',actor) THEN RAISE EXCEPTION 'Sem acesso aos lançamentos financeiros.' USING ERRCODE='42501';END IF;
 IF NOT(user_has_permission(actor,w,'techfinance.entries.create.own') OR user_has_permission(actor,w,'techfinance.entries.create.workspace')) THEN RAISE EXCEPTION 'Sem permissão para gerar lançamentos financeiros.' USING ERRCODE='42501';END IF;
 ELSIF coalesce(auth.role(),'')='service_role' THEN
 actor:=s.owner_id;w:=s.workspace_id;
 IF NOT work_delegated_authorize(w,actor,'service_billing',s.id) THEN RETURN jsonb_build_object('authorized',false,'generated',false,'skippedOwned',false,'duplicate',false);END IF;
 ELSE RAISE EXCEPTION 'Sessão obrigatória.' USING ERRCODE='42501';END IF;
 IF p_mode='activate' THEN
 IF s.status IN('active','completed') THEN RETURN jsonb_build_object('authorized',true,'generated',false,'duplicate',true,'skippedOwned',false,'service',to_jsonb(s));END IF;
 IF s.status<>'pending' THEN RAISE EXCEPTION 'Serviço indisponível para ativação.' USING ERRCODE='23514';END IF;
 billing_date:=coalesce(p_starts,s.starts_at,current_date);
 IF s.contract_id IS NOT NULL THEN
  SELECT * INTO c FROM contracts WHERE id=s.contract_id;
  IF c.id IS NOT NULL AND NOT contract_service_billing_eligible(c) THEN
   UPDATE services SET status='active',starts_at=billing_date,next_billing_at=NULL,billing_hold='awaiting_signature',billing_hold_schedule=NULL WHERE id=s.id RETURNING * INTO s;
   RETURN jsonb_build_object('authorized',true,'generated',false,'duplicate',false,'skippedOwned',false,'awaitingSignature',true,'service',to_jsonb(s));
  END IF;
 END IF;
 ELSE
 IF s.billing_hold IS NOT NULL OR s.status<>'active' OR s.type<>'recurring' OR s.next_billing_at IS NULL OR s.next_billing_at>current_date THEN RETURN jsonb_build_object('authorized',true,'generated',false,'duplicate',false,'skippedOwned',false,'service',to_jsonb(s));END IF;
 billing_date:=s.next_billing_at;
 END IF;
 IF s.type='one_time' OR p_mode='tick' THEN
 IF project_billing_service_owned(s.id,billing_date) THEN
 IF p_mode='activate' THEN RAISE EXCEPTION 'Cobrança deste serviço pertence às medições.' USING ERRCODE='23514';END IF;
 RETURN jsonb_build_object('authorized',true,'generated',false,'skippedOwned',true,'duplicate',false);
 END IF;
 INSERT INTO financial_entries(workspace_id,owner_id,direction,origin_type,origin_id,service_id,contract_id,description,amount,currency,competence_date,due_date,status)
 VALUES(w,actor,CASE WHEN s.role='provider' THEN 'receivable'::financial_direction ELSE 'payable'::financial_direction END,'service',s.id,s.id,s.contract_id,s.name,s.quantity*s.unit_price,s.currency,billing_date,CASE WHEN p_mode='activate' AND c.id IS NOT NULL AND NOT contract_is_signed_for_billing(c) THEN coalesce((SELECT min(due_date) FROM contract_acceptance_billing_releases WHERE contract_id=c.id AND content_hash=contract_commercial_content_hash(c.id)),billing_date) ELSE billing_date END,'open')
 ON CONFLICT(service_id,competence_date) WHERE origin_type='service' AND service_id IS NOT NULL DO NOTHING RETURNING id INTO inserted;
 generated:=inserted IS NOT NULL;
 END IF;
 IF p_mode='activate' THEN
 next_status:='active'::service_status;
 upcoming:=CASE WHEN s.type='recurring' THEN billing_date END;
 ELSE
 upcoming:=services_next_billing(billing_date,s.cadence);
 next_status:=CASE WHEN s.ends_at IS NOT NULL AND upcoming>s.ends_at THEN 'completed'::service_status ELSE 'active'::service_status END;
 IF next_status='completed' THEN upcoming:=NULL;END IF;
 END IF;
 UPDATE services SET status=next_status,starts_at=CASE WHEN p_mode='activate' THEN billing_date ELSE starts_at END,next_billing_at=upcoming WHERE id=s.id RETURNING * INTO s;
 RETURN jsonb_build_object('authorized',true,'generated',generated,'skippedOwned',false,'duplicate',NOT generated AND (p_mode='tick' OR s.type='one_time'),'service',to_jsonb(s));
END $function$;


CREATE OR REPLACE FUNCTION public.service_release_signature_billing(p_contract uuid)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $function$
DECLARE c contracts;s services;item jsonb;n int;total int:=0;cnt int;sig date;d date;bd date;
BEGIN
 SELECT * INTO c FROM contracts WHERE id=p_contract;
 IF c.id IS NULL OR NOT contract_service_billing_eligible(c) THEN RETURN 0;END IF;
 sig:=CASE WHEN contract_is_signed_for_billing(c) THEN coalesce(c.signed_at::date,current_date) ELSE coalesce((SELECT min(due_date) FROM contract_acceptance_billing_releases WHERE contract_id=c.id AND content_hash=contract_commercial_content_hash(c.id)),current_date) END;
 FOR s IN SELECT * FROM services WHERE contract_id=c.id AND workspace_id=c.workspace_id AND billing_hold='awaiting_signature' FOR UPDATE LOOP
  IF s.billing_hold_schedule IS NOT NULL THEN
   SELECT count(*) INTO cnt FROM financial_entries WHERE workspace_id=c.workspace_id AND external_ref LIKE 'payment-terms:'||c.id::text||':%';
   IF cnt=0 THEN
    n:=0;
    FOR item IN SELECT * FROM jsonb_array_elements(s.billing_hold_schedule) LOOP
     n:=n+1;
     IF (item->>'amount')::numeric<=0 THEN CONTINUE;END IF;
     d:=CASE WHEN NOT contract_is_signed_for_billing(c) AND EXISTS(SELECT 1 FROM contract_acceptance_billing_releases WHERE contract_id=c.id AND content_hash=contract_commercial_content_hash(c.id) AND due_date IS NOT NULL) THEN sig WHEN item->>'dueEvent'='signature' THEN sig ELSE coalesce((item->>'dueDate')::date,s.starts_at,sig) END;
     INSERT INTO financial_entries(workspace_id,owner_id,direction,origin_type,origin_id,contract_id,service_id,counterparty_company_id,description,amount,currency,competence_date,due_date,status,external_ref,installment_number,installment_total,notes,metadata)
     VALUES(c.workspace_id,s.owner_id,CASE WHEN c.role='client' THEN 'payable'::financial_direction ELSE 'receivable'::financial_direction END,'contract',c.id,c.id,s.id,c.counterparty_company_id,
       left(coalesce(c.title,'Contrato')||' — '||coalesce(item->>'label','Parcela'),300),(item->>'amount')::numeric,coalesce(c.currency,s.currency,'BRL'),d,d,'open',
       'payment-terms:'||c.id::text||':'||n::text,n,jsonb_array_length(s.billing_hold_schedule),
       CASE WHEN NOT contract_is_signed_for_billing(c) THEN 'Liberado por aceite comercial; vencimento conforme acordo registrado.' ELSE CASE item->>'dueEvent' WHEN 'milestone' THEN 'Vence na entrega do marco: ajuste a data quando o marco for entregue.' WHEN 'signature' THEN 'Vence na assinatura do contrato.' END END,
       jsonb_build_object('payment_terms',true,'due_event',item->>'dueEvent','released_on_signature',contract_is_signed_for_billing(c),'released_on_acceptance',NOT contract_is_signed_for_billing(c)))
     ON CONFLICT DO NOTHING;
     total:=total+1;
    END LOOP;
   END IF;
   UPDATE services SET status=status,billing_hold=NULL,billing_hold_schedule=NULL WHERE id=s.id;
  ELSE
   bd:=greatest(coalesce(s.starts_at,sig),sig);
   IF s.type='one_time' THEN
    IF NOT project_billing_service_owned(s.id,bd) THEN
     INSERT INTO financial_entries(workspace_id,owner_id,direction,origin_type,origin_id,service_id,contract_id,description,amount,currency,competence_date,due_date,status)
     VALUES(s.workspace_id,s.owner_id,CASE WHEN s.role='provider' THEN 'receivable'::financial_direction ELSE 'payable'::financial_direction END,'service',s.id,s.id,s.contract_id,s.name,s.quantity*s.unit_price,s.currency,bd,bd,'open')
     ON CONFLICT(service_id,competence_date) WHERE origin_type='service' AND service_id IS NOT NULL DO NOTHING;
     total:=total+1;
    END IF;
    UPDATE services SET billing_hold=NULL WHERE id=s.id;
   ELSE
    UPDATE services SET billing_hold=NULL,next_billing_at=CASE WHEN type='recurring' THEN bd END WHERE id=s.id;
   END IF;
  END IF;
 END LOOP;
 RETURN total;
END $function$;
REVOKE ALL ON FUNCTION public.service_release_signature_billing(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.service_release_signature_billing(uuid) TO service_role;


CREATE OR REPLACE FUNCTION public.contract_commercial_release_billing(p_contract uuid,p_due_date date DEFAULT NULL,p_reason text DEFAULT NULL,p_expected_hash text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE w uuid;c contracts;a uuid;r uuid;s services;generated int:=0;single_count int;total numeric;BEGIN
 w:=public.contract_commercial_authorize(p_contract,'techcontracts.contract_acceptance_billing.manage.workspace',true);
 PERFORM public.work_area_authorize('techservice.billing','manage');
 IF NOT public.finance_scope_access(w,'entries','view',auth.uid()) OR NOT (public.user_has_permission(auth.uid(),w,'techfinance.entries.create.own') OR public.user_has_permission(auth.uid(),w,'techfinance.entries.create.workspace')) THEN RAISE EXCEPTION 'Sem permissão para gerar e consultar lançamentos financeiros.' USING ERRCODE='42501';END IF;
 SELECT * INTO c FROM contracts WHERE id=p_contract FOR UPDATE;
 w:=public.contract_commercial_authorize(p_contract,'techcontracts.contract_acceptance_billing.manage.workspace',true);
 IF c.role::text<>'provider' OR c.status::text IN('canceled','terminated','ended') THEN RAISE EXCEPTION 'Somente contratos de venda permitem faturamento pelo aceite comercial.' USING ERRCODE='23514';END IF;
 IF c.signed_at IS NOT NULL THEN RAISE EXCEPTION 'Contrato já assinado: utilize o faturamento regular.' USING ERRCODE='23514';END IF;
 IF NOT public.contract_commercial_internal_approved(c) THEN RAISE EXCEPTION 'Conclua as aprovações internas pendentes (Jurídico/Financeiro) antes de liberar o faturamento.' USING ERRCODE='23514';END IF;
 IF p_expected_hash IS DISTINCT FROM public.contract_commercial_content_hash(c.id) THEN RAISE EXCEPTION 'O contrato mudou. Recarregue antes de liberar o faturamento.' USING ERRCODE='23514';END IF;
 a:=public.contract_commercial_current(c.id);
 IF a IS NULL THEN RAISE EXCEPTION 'O cliente precisa aceitar a versão atual do contrato.' USING ERRCODE='23514';END IF;
 IF length(btrim(coalesce(p_reason,''))) NOT BETWEEN 10 AND 4000 THEN RAISE EXCEPTION 'Descreva a autorização do faturamento e o vencimento combinado (mínimo 10 caracteres).' USING ERRCODE='22023';END IF;
 SELECT id INTO r FROM contract_acceptance_billing_releases WHERE contract_id=c.id AND content_hash=public.contract_commercial_content_hash(c.id) AND acceptance_id=a;
 IF r IS NOT NULL THEN RETURN jsonb_build_object('generated',0,'duplicate',true,'state',public.contract_commercial_state(c.id));END IF;
 IF EXISTS(SELECT 1 FROM contract_acceptance_billing_releases WHERE contract_id=c.id AND content_hash IS DISTINCT FROM public.contract_commercial_content_hash(c.id)) THEN RAISE EXCEPTION 'Existe faturamento liberado em uma versão anterior. O Financeiro deve conciliar os lançamentos antes de uma nova liberação.' USING ERRCODE='23514';END IF;
 IF EXISTS(SELECT 1 FROM financial_entries WHERE contract_id=c.id AND workspace_id=w AND direction::text='receivable' AND coalesce(external_ref,'') NOT LIKE 'payment-terms:'||c.id::text||':%') THEN RAISE EXCEPTION 'Existem contas a receber fora do cronograma canônico deste contrato. Concilie os lançamentos existentes antes de liberar para evitar duplicidade.' USING ERRCODE='23514';END IF;
 IF NOT EXISTS(SELECT 1 FROM services WHERE contract_id=c.id AND workspace_id=w AND status IN('active','completed') AND billing_hold='awaiting_signature') AND NOT EXISTS(SELECT 1 FROM contract_acceptance_billing_releases WHERE contract_id=c.id AND content_hash=public.contract_commercial_content_hash(c.id)) THEN RAISE EXCEPTION 'Ative o serviço antes de liberar o faturamento pelo aceite.' USING ERRCODE='23514';END IF;
 IF EXISTS(SELECT 1 FROM contract_acceptance_billing_releases WHERE contract_id=c.id AND content_hash=public.contract_commercial_content_hash(c.id) AND due_date IS DISTINCT FROM p_due_date) THEN RAISE EXCEPTION 'O vencimento já foi faturado. Concilie as contas a receber para alterar a data, sem gerar nova cobrança.' USING ERRCODE='23514';END IF;
 FOR s IN SELECT * FROM services WHERE contract_id=c.id AND workspace_id=w AND billing_hold='awaiting_signature' FOR UPDATE LOOP
  IF s.billing_hold_schedule IS NOT NULL THEN
   IF jsonb_typeof(s.billing_hold_schedule)<>'array' OR jsonb_array_length(s.billing_hold_schedule)=0 THEN RAISE EXCEPTION 'Cronograma retido inválido; revise as condições de pagamento.' USING ERRCODE='23514';END IF;
   SELECT sum((x->>'amount')::numeric),count(*) FILTER(WHERE (x->>'amount')::numeric>0) INTO total,single_count FROM jsonb_array_elements(s.billing_hold_schedule) x;
   IF abs(total-c.total_value)>0.01 THEN RAISE EXCEPTION 'As parcelas não fecham com o valor atual do contrato.' USING ERRCODE='23514';END IF;
   IF p_due_date IS NOT NULL AND single_count<>1 THEN RAISE EXCEPTION 'Vencimento combinado só pode substituir uma parcela única; revise o cronograma parcelado no contrato.' USING ERRCODE='23514';END IF;
   IF EXISTS(SELECT 1 FROM jsonb_array_elements(s.billing_hold_schedule) x WHERE x->>'dueEvent'='milestone') THEN RAISE EXCEPTION 'Parcelas por marco exigem o fluxo de aceite e medição da entrega.' USING ERRCODE='23514';END IF;
   IF p_due_date IS NULL AND EXISTS(SELECT 1 FROM jsonb_array_elements(s.billing_hold_schedule) x WHERE x->>'dueEvent'='signature' OR nullif(x->>'dueDate','') IS NULL) THEN RAISE EXCEPTION 'Informe o vencimento combinado: o aceite comercial não define a data de assinatura.' USING ERRCODE='23514';END IF;
  ELSE
   IF s.type<>'one_time' THEN RAISE EXCEPTION 'Sem condições de pagamento, apenas serviço único permite faturamento pelo aceite; configure o cronograma contratual.' USING ERRCODE='23514';END IF;
   IF p_due_date IS NULL THEN RAISE EXCEPTION 'Informe o vencimento combinado com o cliente.' USING ERRCODE='22023';END IF;
  END IF;
  IF public.project_billing_service_owned(s.id,coalesce(p_due_date,current_date)) THEN RAISE EXCEPTION 'A cobrança deste serviço pertence às medições do projeto.' USING ERRCODE='23514';END IF;
 END LOOP;
 INSERT INTO contract_acceptance_billing_releases(workspace_id,contract_id,acceptance_id,content_hash,due_date,reason,created_by) VALUES(w,c.id,a,public.contract_commercial_content_hash(c.id),p_due_date,btrim(p_reason),auth.uid()) RETURNING id INTO r;
 generated:=public.service_release_signature_billing(c.id);
 INSERT INTO contract_events(workspace_id,contract_id,actor_id,event_type,payload) VALUES(w,c.id,auth.uid(),'commercial_acceptance_billing_released',jsonb_build_object('release_id',r,'acceptance_id',a,'due_date',p_due_date,'reason',p_reason,'generated',generated,'signature_unchanged',true));
 RETURN jsonb_build_object('generated',generated,'duplicate',false,'state',public.contract_commercial_state(c.id));
END $$;
REVOKE ALL ON FUNCTION public.contract_commercial_release_billing(uuid,date,text,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.contract_commercial_release_billing(uuid,date,text,text) TO authenticated;

COMMENT ON TABLE public.contract_commercial_acceptances IS 'Version-bound commercial assent, independent of legal signature; append-only evidence with explicit audited revocation.';
COMMENT ON TABLE public.contract_acceptance_billing_releases IS 'Explicit authorized receivable release only; does not set signed_at or satisfy signature evidence.';
COMMENT ON TABLE public.service_execution_completions IS 'Actual operational completion; never creates financial entries or clears an unsigned-contract hold.';

CREATE OR REPLACE FUNCTION public.service_execution_state(p_service uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE w uuid;r jsonb;BEGIN
 w:=public.work_area_authorize('techservice.services','view',p_service);
 SELECT jsonb_build_object('completed_on',completed_on,'reason',reason,'created_at',created_at) INTO r FROM public.service_execution_completions WHERE service_id=p_service AND workspace_id=w;
 RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.service_execution_state(uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.service_execution_state(uuid) TO authenticated;

-- Direct table edits cannot forge completion or remove a signature/acceptance
-- hold. Authorized RPCs run as the owning role after checking the real actor.
CREATE OR REPLACE FUNCTION public.work_service_billing_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
BEGIN
 IF current_user IN('postgres','supabase_admin','service_role') THEN RETURN NEW;END IF;
 IF (TG_OP='INSERT' AND (NEW.billing_hold IS NOT NULL OR NEW.billing_hold_schedule IS NOT NULL)) OR (TG_OP='UPDATE' AND (NEW.billing_hold IS DISTINCT FROM OLD.billing_hold OR NEW.billing_hold_schedule IS DISTINCT FROM OLD.billing_hold_schedule)) THEN RAISE EXCEPTION 'Retenção da cobrança só pode ser alterada pelo fluxo autorizado de faturamento.' USING ERRCODE='42501';END IF;
 IF NEW.status='completed' AND (TG_OP='INSERT' OR OLD.status<>'completed') THEN RAISE EXCEPTION 'Use Concluir execução para registrar a data real e a justificativa, sem alterar a cobrança.' USING ERRCODE='42501';END IF;
 IF TG_OP='UPDATE' AND OLD.status='completed' AND NEW.status<>'completed' THEN RAISE EXCEPTION 'Execução concluída com evidência: não é permitido reabri-la por edição direta.' USING ERRCODE='42501';END IF;
 IF (TG_OP='INSERT' AND (NEW.status='active' OR NEW.next_billing_at IS NOT NULL)) OR (TG_OP='UPDATE' AND ((NEW.status='active' AND OLD.status<>'active') OR NEW.next_billing_at IS DISTINCT FROM OLD.next_billing_at OR (OLD.status='active' AND (NEW.unit_price,NEW.quantity,NEW.cadence,NEW.starts_at,NEW.ends_at) IS DISTINCT FROM (OLD.unit_price,OLD.quantity,OLD.cadence,OLD.starts_at,OLD.ends_at)))) THEN PERFORM public.work_area_authorize('techservice.billing','manage');END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.work_service_billing_guard() FROM PUBLIC,anon,authenticated,service_role;
