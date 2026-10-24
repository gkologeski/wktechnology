-- Offer approval, transmission and hiring are separate business capabilities.
-- Apply before the compatible application; 0207 tightens legacy read ACLs.
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,description,is_system)
SELECT 'techhire.'||r.key||'.'||a.key||'.'||s,'techhire',r.key,a.key::public.perm_action,s::public.perm_scope,
 r.label||' — '||a.label||' ('||s||')','Ação independente; exige acesso ao registro e ao workspace ativo.',true
FROM (VALUES ('offer_terms','Condições de ofertas'),('hiring_terms','Condições de contratação'))r(key,label)
CROSS JOIN (VALUES('view','Consultar'),('update','Editar'))a(key,label)
CROSS JOIN unnest(ARRAY['own','team','workspace'])s
ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,description,is_system)
SELECT 'techhire.'||r.key||'.manage.workspace','techhire',r.key,'manage','workspace',r.label,
 'Ação específica sobre registro visível; não concede administração geral.',true
FROM (VALUES('offer_delivery','Disponibilizar oferta para assinatura'),('offer_cancellation','Cancelar oferta'),('hiring_reversal','Reverter contratação'))r(key,label)
ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,description,is_system)
VALUES('techhire.hiring.approve.workspace','techhire','hiring','approve','workspace','Confirmar contratação','Confirma o desfecho e permite iniciar os workflows configurados.',true)
ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,is_system)
VALUES('techhire.offers.assign.workspace','techhire','offers','assign','workspace','Reatribuir oferta',true) ON CONFLICT(key) DO NOTHING;
INSERT INTO public.job_role_permission_overrides(workspace_id,role_id,permission_key,effect,created_by)
SELECT '184b9435-0a9b-4334-9e89-8854dc883f5d','aaaaaaaa-0000-4000-8000-000000000004',p.key,'grant','1c237fbe-079e-4eb9-a3e6-c08d85e79688'
FROM public.permissions p WHERE p.module='techhire' AND (p.key='techhire.offers.assign.workspace' OR p.resource IN('offer_terms','hiring_terms','offer_delivery','offer_cancellation','hiring','hiring_reversal'))
AND EXISTS(SELECT 1 FROM public.job_roles WHERE id='aaaaaaaa-0000-4000-8000-000000000004')
AND EXISTS(SELECT 1 FROM public.workspaces WHERE id='184b9435-0a9b-4334-9e89-8854dc883f5d')
ON CONFLICT(workspace_id,role_id,permission_key) DO NOTHING;
ALTER TABLE public.ats_offers ADD COLUMN approval_status text NOT NULL DEFAULT 'not_requested' CHECK(approval_status IN('not_requested','pending','approved','rejected')),
 ADD COLUMN revision integer NOT NULL DEFAULT 1,ADD COLUMN approved_revision integer,
 ADD COLUMN approved_by uuid,ADD COLUMN approved_at timestamptz,ADD COLUMN approval_note text;
-- Existing sent/signed offers are historical, never silently re-approved.
CREATE SCHEMA IF NOT EXISTS techerp_offers;
REVOKE ALL ON SCHEMA techerp_offers FROM PUBLIC,anon,authenticated;
CREATE TABLE techerp_offers.sessions(txid bigint NOT NULL,actor uuid,offer_id uuid NOT NULL,operation text NOT NULL,PRIMARY KEY(txid,offer_id));
REVOKE ALL ON techerp_offers.sessions FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE public.ats_offer_approvals(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid NOT NULL REFERENCES public.workspaces(id),offer_id uuid NOT NULL REFERENCES public.ats_offers(id),revision integer NOT NULL,actor_id uuid NOT NULL,event text NOT NULL,note text,created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.ats_offer_approvals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ats_offer_approvals FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.ats_offer_approvals TO authenticated;
SET check_function_bodies=off;
CREATE OR REPLACE FUNCTION public.ats_offer_action_access(_row jsonb,_action text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE w uuid:=(_row->>'workspace_id')::uuid;actor uuid:=auth.uid();subject uuid:=COALESCE(_row->>'assigned_to',_row->>'owner_id')::uuid;
 base_action text:=CASE WHEN _action IN('create','view','update','delete') THEN _action ELSE 'view' END;own_scope boolean;team_scope boolean;
BEGIN
 IF actor IS NULL OR _row IS NULL OR _action NOT IN('create','view','update','delete','terms_view','terms_update','request','approve','send','cancel')
 OR w IS DISTINCT FROM (SELECT active_workspace_id FROM public.profiles WHERE id=actor)
 OR NOT public.is_workspace_member(w,actor) OR w NOT IN(SELECT public.current_user_workspaces())
 OR (_action NOT IN('view','terms_view') AND public.is_read_only_view()) THEN RETURN false;END IF;
 IF NOT public.hr_record_access('candidates','view',(_row->>'candidate_id')::uuid)
 OR (_row->>'job_id' IS NOT NULL AND NOT public.hr_record_access('jobs','view',(_row->>'job_id')::uuid))
 OR (_row->>'application_id' IS NOT NULL AND NOT public.hr_record_access('applications','view',(_row->>'application_id')::uuid)) THEN RETURN false;END IF;
 own_scope:=subject=actor;team_scope:=public.hr_team_contains(w,ARRAY[subject]);
 IF NOT (public.user_has_permission(actor,w,'techhire.offers.'||base_action||'.workspace')
 OR (own_scope AND public.user_has_permission(actor,w,'techhire.offers.'||base_action||'.own'))
 OR (team_scope AND public.user_has_permission(actor,w,'techhire.offers.'||base_action||'.team'))) THEN RETURN false;END IF;
 IF _action IN('update','delete') AND NOT public.ats_offer_action_access(_row,'view') THEN RETURN false;END IF;
 IF _action IN('terms_view','terms_update') THEN
  RETURN (_action='terms_view' OR public.ats_offer_action_access(_row,'terms_view')) AND
   (public.user_has_permission(actor,w,'techhire.offer_terms.'||CASE _action WHEN 'terms_view' THEN 'view' ELSE 'update' END||'.workspace')
    OR (own_scope AND public.user_has_permission(actor,w,'techhire.offer_terms.'||CASE _action WHEN 'terms_view' THEN 'view' ELSE 'update' END||'.own'))
    OR (team_scope AND public.user_has_permission(actor,w,'techhire.offer_terms.'||CASE _action WHEN 'terms_view' THEN 'view' ELSE 'update' END||'.team')));
 ELSIF _action='request' THEN RETURN public.ats_offer_action_access(_row,'update') AND public.ats_offer_action_access(_row,'terms_view');
 ELSIF _action IN('approve','send','cancel') THEN
  RETURN public.ats_offer_action_access(_row,'terms_view') AND public.user_has_permission(actor,w,CASE _action WHEN 'approve' THEN 'techhire.offers.approve.workspace' WHEN 'send' THEN 'techhire.offer_delivery.manage.workspace' ELSE 'techhire.offer_cancellation.manage.workspace' END);
 END IF;
 RETURN true;
END $$;
CREATE POLICY offer_approval_read ON public.ats_offer_approvals FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.ats_offers o WHERE o.id=offer_id AND o.workspace_id=ats_offer_approvals.workspace_id AND public.ats_offer_action_access(to_jsonb(o),'terms_view')));
CREATE OR REPLACE FUNCTION public.ats_offer_projection(_offer uuid DEFAULT NULL,_candidate uuid DEFAULT NULL)
RETURNS SETOF jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.ats_offers;out_row jsonb;terms boolean;BEGIN
 FOR r IN SELECT * FROM public.ats_offers WHERE (_offer IS NULL OR id=_offer) AND (_candidate IS NULL OR candidate_id=_candidate) AND workspace_id=(SELECT active_workspace_id FROM profiles WHERE id=auth.uid()) ORDER BY created_at DESC LOOP
  IF NOT public.ats_offer_action_access(to_jsonb(r),'view') THEN CONTINUE;END IF;
  terms:=public.ats_offer_action_access(to_jsonb(r),'terms_view');
  out_row:=jsonb_build_object('id',r.id,'title',r.title,'status',r.status,'candidate_id',r.candidate_id,'job_id',r.job_id,'application_id',r.application_id,'created_at',r.created_at,'sent_at',r.sent_at,'signed_at',r.signed_at,'declined_at',r.declined_at,'start_date',r.start_date,'esign_document_id',CASE WHEN terms THEN r.esign_document_id END,'salary_amount',CASE WHEN terms THEN r.salary_amount END,'salary_currency',CASE WHEN terms THEN r.salary_currency END,'body',CASE WHEN terms THEN r.body END,'approval_status',r.approval_status,'revision',r.revision,'approved_revision',r.approved_revision,'approved_by',r.approved_by,'approved_at',r.approved_at,'approval_note',CASE WHEN terms THEN r.approval_note END,'can_view_terms',terms,'can_edit_terms',public.ats_offer_action_access(to_jsonb(r),'update') AND public.ats_offer_action_access(to_jsonb(r),'terms_update') AND r.status='draft' AND r.approval_status<>'pending','can_request',public.ats_offer_action_access(to_jsonb(r),'request'),'can_approve',public.ats_offer_action_access(to_jsonb(r),'approve'),'can_send',public.ats_offer_action_access(to_jsonb(r),'send'),'can_cancel',public.ats_offer_action_access(to_jsonb(r),'cancel'),'can_delete',public.ats_offer_action_access(to_jsonb(r),'delete'));
  out_row:=out_row||jsonb_build_object('ats_candidates',(SELECT jsonb_build_object('full_name',c.full_name,'email',c.email) FROM ats_candidates c WHERE c.id=r.candidate_id AND c.workspace_id=r.workspace_id),'ats_jobs',(SELECT jsonb_build_object('title',j.title) FROM ats_jobs j WHERE j.id=r.job_id AND j.workspace_id=r.workspace_id));
  RETURN NEXT out_row;
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION public.ats_offer_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE actor uuid:=auth.uid();r public.ats_offers;trusted boolean;op text;changed boolean;BEGIN
 IF TG_OP='INSERT' THEN r:=NEW;ELSE r:=OLD;END IF;
 SELECT ss.operation INTO op FROM techerp_offers.sessions ss WHERE ss.txid=txid_current() AND ss.offer_id=r.id AND ss.actor IS NOT DISTINCT FROM auth.uid();trusted:=FOUND;
 IF TG_OP='UPDATE' AND (NEW.id IS DISTINCT FROM OLD.id OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id OR NEW.owner_id IS DISTINCT FROM OLD.owner_id OR NEW.created_at IS DISTINCT FROM OLD.created_at OR NEW.candidate_id IS DISTINCT FROM OLD.candidate_id OR NEW.job_id IS DISTINCT FROM OLD.job_id OR NEW.application_id IS DISTINCT FROM OLD.application_id) THEN RAISE EXCEPTION 'Vínculos e autoria da oferta são imutáveis.' USING ERRCODE='42501';END IF;
 IF TG_OP='DELETE' THEN
  IF OLD.status<>'draft' OR OLD.approval_status<>'not_requested' OR EXISTS(SELECT 1 FROM ats_offer_approvals WHERE offer_id=OLD.id) THEN RAISE EXCEPTION 'Oferta com histórico deve ser cancelada, não excluída.' USING ERRCODE='23514';END IF;
  IF actor IS NOT NULL AND NOT public.ats_offer_action_access(to_jsonb(OLD),'delete') THEN RAISE EXCEPTION 'Exclusão não permitida.' USING ERRCODE='42501';END IF;RETURN OLD;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM ats_candidates c WHERE c.id=NEW.candidate_id AND c.workspace_id=NEW.workspace_id)
 OR (NEW.job_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM ats_jobs j WHERE j.id=NEW.job_id AND j.workspace_id=NEW.workspace_id))
 OR (NEW.application_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM ats_applications a WHERE a.id=NEW.application_id AND a.workspace_id=NEW.workspace_id AND a.candidate_id=NEW.candidate_id AND a.job_id IS NOT DISTINCT FROM NEW.job_id)) THEN RAISE EXCEPTION 'Vínculos da oferta inconsistentes.' USING ERRCODE='23514';END IF;
 IF NEW.salary_amount<0 OR length(NEW.title) NOT BETWEEN 1 AND 255 OR length(NEW.body)>50000 OR length(NEW.salary_currency) NOT BETWEEN 1 AND 8 THEN RAISE EXCEPTION 'Condições inválidas.' USING ERRCODE='22023';END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.status<>'draft' OR NEW.approval_status<>'not_requested' OR NEW.revision<>1 OR NEW.approved_revision IS NOT NULL OR NEW.approved_by IS NOT NULL OR NEW.approved_at IS NOT NULL OR NEW.esign_document_id IS NOT NULL OR NEW.public_token IS NOT NULL OR NEW.approval_note IS NOT NULL OR NEW.sent_at IS NOT NULL OR NEW.signed_at IS NOT NULL OR NEW.declined_at IS NOT NULL OR NEW.viewed_at IS NOT NULL OR NEW.decline_reason IS NOT NULL THEN RAISE EXCEPTION 'Nova oferta deve ser rascunho sem aprovação.' USING ERRCODE='42501';END IF;
  IF actor IS NOT NULL AND (NEW.owner_id IS DISTINCT FROM actor OR NOT public.ats_offer_action_access(to_jsonb(NEW),'create') OR NOT public.ats_offer_action_access(to_jsonb(NEW),'terms_update')) THEN RAISE EXCEPTION 'Criação de oferta não permitida.' USING ERRCODE='42501';END IF;
 ELSE
  IF NOT trusted AND (NEW.status IS DISTINCT FROM OLD.status OR NEW.approval_status IS DISTINCT FROM OLD.approval_status OR NEW.approved_revision IS DISTINCT FROM OLD.approved_revision OR NEW.approved_by IS DISTINCT FROM OLD.approved_by OR NEW.approved_at IS DISTINCT FROM OLD.approved_at OR NEW.approval_note IS DISTINCT FROM OLD.approval_note OR NEW.public_token IS DISTINCT FROM OLD.public_token OR NEW.esign_document_id IS DISTINCT FROM OLD.esign_document_id OR NEW.sent_at IS DISTINCT FROM OLD.sent_at OR NEW.signed_at IS DISTINCT FROM OLD.signed_at OR NEW.declined_at IS DISTINCT FROM OLD.declined_at OR NEW.viewed_at IS DISTINCT FROM OLD.viewed_at OR NEW.decline_reason IS DISTINCT FROM OLD.decline_reason OR NEW.revision IS DISTINCT FROM OLD.revision) THEN RAISE EXCEPTION 'Use a ação específica da oferta.' USING ERRCODE='42501';END IF;
  changed:=ROW(NEW.title,NEW.body,NEW.salary_amount,NEW.salary_currency,NEW.start_date,NEW.promote_to_stage) IS DISTINCT FROM ROW(OLD.title,OLD.body,OLD.salary_amount,OLD.salary_currency,OLD.start_date,OLD.promote_to_stage);
  IF NOT trusted AND actor IS NOT NULL AND NOT public.ats_offer_action_access(to_jsonb(OLD),'update') THEN RAISE EXCEPTION 'Edição não permitida.' USING ERRCODE='42501';END IF;
  IF changed THEN
   IF OLD.status<>'draft' OR OLD.approval_status='pending' THEN RAISE EXCEPTION 'Condições bloqueadas durante aprovação ou após envio.' USING ERRCODE='23514';END IF;
   IF actor IS NOT NULL AND NOT public.ats_offer_action_access(to_jsonb(OLD),'terms_update') THEN RAISE EXCEPTION 'Sem permissão para editar condições.' USING ERRCODE='42501';END IF;
   NEW.revision:=OLD.revision+1;NEW.approval_status:='not_requested';NEW.approved_revision:=NULL;NEW.approved_by:=NULL;NEW.approved_at:=NULL;NEW.approval_note:=NULL;
  END IF;
 END IF;
 IF actor IS NOT NULL THEN IF TG_OP='INSERT' THEN NEW.created_at:=now();END IF;NEW.updated_at:=now();END IF;
 IF NEW.assigned_to IS NOT NULL AND NOT public.is_workspace_member(NEW.workspace_id,NEW.assigned_to) THEN RAISE EXCEPTION 'Responsável deve ser membro ativo.' USING ERRCODE='23514';END IF;
 IF ((TG_OP='INSERT' AND NEW.assigned_to IS NOT NULL AND NEW.assigned_to IS DISTINCT FROM actor) OR (TG_OP='UPDATE' AND NEW.assigned_to IS DISTINCT FROM OLD.assigned_to)) AND actor IS NOT NULL AND NOT public.user_has_permission(actor,NEW.workspace_id,'techhire.offers.assign.workspace') THEN RAISE EXCEPTION 'Reatribuição não permitida.' USING ERRCODE='42501';END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.ats_offer_transition(_id uuid,_action text,_revision integer,_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.ats_offers;c public.ats_candidates;doc uuid;token text;permission_action text;BEGIN
 IF _action NOT IN('request','approve','reject','send','cancel') OR _action IS NULL OR length(COALESCE(_note,''))>2000 THEN RAISE EXCEPTION 'Ação inválida.' USING ERRCODE='22023';END IF;
 SELECT * INTO r FROM public.ats_offers WHERE id=_id FOR UPDATE;
 permission_action:=CASE WHEN _action='reject' THEN 'approve' ELSE _action END;
 IF NOT FOUND OR NOT public.ats_offer_action_access(to_jsonb(r),permission_action) THEN RAISE EXCEPTION 'Oferta indisponível ou ação não permitida.' USING ERRCODE='42501';END IF;
 IF _revision IS DISTINCT FROM r.revision THEN RAISE EXCEPTION 'A oferta mudou; atualize antes de continuar.' USING ERRCODE='40001';END IF;
 IF _action IN('request','approve','reject','send') AND r.status<>'draft' THEN RAISE EXCEPTION 'Ação disponível apenas para rascunho.' USING ERRCODE='23514';END IF;
 IF _action='request' AND r.approval_status NOT IN('not_requested','rejected') THEN RAISE EXCEPTION 'Aprovação já solicitada.' USING ERRCODE='23514';END IF;
 IF _action IN('approve','reject') AND r.approval_status<>'pending' THEN RAISE EXCEPTION 'Não há aprovação pendente.' USING ERRCODE='23514';END IF;
 IF _action='send' AND (r.approval_status<>'approved' OR r.approved_revision IS DISTINCT FROM r.revision) THEN RAISE EXCEPTION 'Aprove esta versão antes de disponibilizar a oferta.' USING ERRCODE='23514';END IF;
 IF _action='cancel' AND r.status NOT IN('draft','sent') THEN RAISE EXCEPTION 'Oferta não pode mais ser cancelada.' USING ERRCODE='23514';END IF;
 INSERT INTO techerp_offers.sessions VALUES(txid_current(),auth.uid(),r.id,_action);
 IF _action='request' THEN UPDATE ats_offers SET approval_status='pending',approval_note=NULL WHERE id=r.id;
 ELSIF _action IN('approve','reject') THEN UPDATE ats_offers SET approval_status=CASE _action WHEN 'approve' THEN 'approved' ELSE 'rejected' END,approved_revision=CASE WHEN _action='approve' THEN revision END,approved_by=CASE WHEN _action='approve' THEN auth.uid() END,approved_at=CASE WHEN _action='approve' THEN now() END,approval_note=_note WHERE id=r.id;
 ELSIF _action='send' THEN
  SELECT * INTO c FROM ats_candidates WHERE id=r.candidate_id AND workspace_id=r.workspace_id;
  IF length(trim(COALESCE(c.email,'')))=0 THEN RAISE EXCEPTION 'Candidato sem e-mail para assinatura.' USING ERRCODE='23514';END IF;
  IF r.esign_document_id IS NOT NULL THEN RAISE EXCEPTION 'Oferta já possui documento.' USING ERRCODE='23514';END IF;
  INSERT INTO esign_documents(owner_id,workspace_id,title,body,ordered) VALUES(auth.uid(),r.workspace_id,r.title,r.body||E'\n\nCondições da oferta — versão '||r.revision||E'\nRemuneração: '||CASE WHEN r.salary_amount IS NULL THEN 'Não informada' ELSE r.salary_currency||' '||r.salary_amount::text END||E'\nInício previsto: '||COALESCE(to_char(r.start_date,'DD/MM/YYYY'),'Não definido'),false) RETURNING id INTO doc;
  -- Link before creating signers so every child mutation is guarded.
  token:=encode(extensions.gen_random_bytes(32),'hex');
  UPDATE ats_offers SET esign_document_id=doc,public_token=token,status='sent',sent_at=now() WHERE id=r.id;
  INSERT INTO esign_signers(document_id,owner_id,workspace_id,name,email,sign_order) VALUES(doc,auth.uid(),r.workspace_id,c.full_name,c.email,1);
  UPDATE esign_documents SET status='sent',sent_at=now() WHERE id=doc;
  INSERT INTO esign_audit(document_id,owner_id,workspace_id,event) VALUES(doc,auth.uid(),r.workspace_id,'created'),(doc,auth.uid(),r.workspace_id,'sent');
 ELSIF _action='cancel' THEN
  IF r.esign_document_id IS NOT NULL THEN UPDATE esign_documents SET status='canceled',completed_at=now() WHERE id=r.esign_document_id;INSERT INTO esign_audit(document_id,owner_id,workspace_id,event) VALUES(r.esign_document_id,auth.uid(),r.workspace_id,'canceled');END IF;
  UPDATE ats_offers SET status='cancelled',public_token=NULL WHERE id=r.id;
 END IF;
 INSERT INTO ats_offer_approvals(workspace_id,offer_id,revision,actor_id,event,note) VALUES(r.workspace_id,r.id,r.revision,auth.uid(),_action,_note);
 DELETE FROM techerp_offers.sessions WHERE txid=txid_current() AND offer_id=r.id;
 RETURN jsonb_build_object('ok',true,'esign_document_id',doc,'public_token',token);
END $$;
-- Linked signing documents are immutable outside the dedicated offer operation.
CREATE OR REPLACE FUNCTION public.ats_offer_document_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE doc uuid;r public.ats_offers;op text;BEGIN
 doc:=((CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END)->>CASE WHEN TG_TABLE_NAME='esign_documents' THEN 'id' ELSE 'document_id' END)::uuid;
 SELECT * INTO r FROM ats_offers WHERE esign_document_id=doc;
 IF FOUND THEN
  SELECT ss.operation INTO op FROM techerp_offers.sessions ss WHERE ss.txid=txid_current() AND ss.offer_id=r.id AND ss.actor IS NOT DISTINCT FROM auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Documento de oferta exige operação autorizada.' USING ERRCODE='42501';END IF;
  IF TG_OP<>'DELETE' AND NEW.workspace_id IS DISTINCT FROM r.workspace_id THEN RAISE EXCEPTION 'Documento fora do workspace.' USING ERRCODE='23514';END IF;
 END IF;
 -- Do not allow an existing linked child to be moved to another document.
 IF TG_OP='UPDATE' AND TG_TABLE_NAME<>'esign_documents' AND to_jsonb(NEW)->>'document_id' IS DISTINCT FROM to_jsonb(OLD)->>'document_id' AND EXISTS(SELECT 1 FROM ats_offers WHERE esign_document_id=(to_jsonb(OLD)->>'document_id')::uuid) THEN RAISE EXCEPTION 'Documento da oferta é imutável.' USING ERRCODE='42501';END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.ats_offer_document_access(_doc uuid,_action text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT NOT EXISTS(SELECT 1 FROM ats_offers WHERE esign_document_id=_doc) OR
 (_action='view' AND COALESCE((SELECT public.ats_offer_action_access(to_jsonb(o),'terms_view') FROM ats_offers o WHERE esign_document_id=_doc),false))
$$;
-- New public capability: read/sign only an active matching offer, not staff CRUD.
CREATE OR REPLACE FUNCTION public.ats_offer_public(_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.ats_offers;d public.esign_documents;BEGIN
 IF length(_token) NOT BETWEEN 32 AND 128 THEN RAISE EXCEPTION 'Link inválido.' USING ERRCODE='22023';END IF;
 SELECT * INTO r FROM ats_offers WHERE public_token=_token FOR UPDATE;
 IF NOT FOUND OR r.status NOT IN('sent','signed','declined') THEN RAISE EXCEPTION 'Link inválido.' USING ERRCODE='42501';END IF;
 SELECT * INTO d FROM esign_documents WHERE id=r.esign_document_id AND workspace_id=r.workspace_id FOR SHARE;
 IF NOT FOUND OR d.status IN('draft','canceled') OR (d.expires_at IS NOT NULL AND d.expires_at<=now()) THEN RAISE EXCEPTION 'Link inválido ou expirado.' USING ERRCODE='42501';END IF;
 INSERT INTO techerp_offers.sessions VALUES(txid_current(),auth.uid(),r.id,'view');
 UPDATE ats_offers SET viewed_at=COALESCE(viewed_at,now()) WHERE id=r.id;
 DELETE FROM techerp_offers.sessions WHERE txid=txid_current() AND offer_id=r.id;
 RETURN jsonb_build_object('title',r.title,'body',r.body,'status',r.status,'salary_amount',r.salary_amount,'salary_currency',r.salary_currency,'start_date',r.start_date,'sent_at',r.sent_at,'signed_at',r.signed_at,'declined_at',r.declined_at,'signing_token',CASE WHEN r.status='sent' THEN (SELECT public_token FROM esign_signers WHERE document_id=d.id AND workspace_id=r.workspace_id AND status IN('pending','viewed') ORDER BY sign_order LIMIT 1) END);
END $$;
CREATE OR REPLACE FUNCTION public.ats_offer_sign(_token text,_action text,_name text DEFAULT NULL,_signature text DEFAULT NULL,_reason text DEFAULT NULL,_ip text DEFAULT NULL,_ua text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.esign_signers;r public.ats_offers;d public.esign_documents;BEGIN
 IF _action NOT IN('sign','decline','view') OR _action IS NULL OR length(_token) NOT BETWEEN 32 AND 100 OR length(COALESCE(_signature,''))>500000 OR length(COALESCE(_reason,''))>1000 OR (_action='sign' AND length(trim(COALESCE(_name,''))) NOT BETWEEN 2 AND 255) THEN RAISE EXCEPTION 'Solicitação inválida.' USING ERRCODE='22023';END IF;
 SELECT * INTO s FROM esign_signers WHERE public_token=_token;
 SELECT * INTO r FROM ats_offers WHERE esign_document_id=s.document_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Link inválido.' USING ERRCODE='42501';END IF;
 SELECT * INTO d FROM esign_documents WHERE id=r.esign_document_id AND workspace_id=r.workspace_id FOR UPDATE;
 SELECT * INTO s FROM esign_signers WHERE id=s.id AND workspace_id=r.workspace_id FOR UPDATE;
 IF s.id IS NULL OR d.id IS NULL OR r.status NOT IN('sent','signed','declined') OR d.status IN('draft','canceled') OR (d.expires_at IS NOT NULL AND d.expires_at<=now()) THEN RAISE EXCEPTION 'Link inválido ou expirado.' USING ERRCODE='42501';END IF;
 IF _action<>'view' AND (r.status<>'sent' OR d.status NOT IN('sent','partially_signed') OR s.status NOT IN('pending','viewed') OR (d.ordered AND EXISTS(SELECT 1 FROM esign_signers WHERE document_id=d.id AND sign_order<s.sign_order AND status<>'signed'))) THEN RAISE EXCEPTION 'Assinatura indisponível.' USING ERRCODE='23514';END IF;
 INSERT INTO techerp_offers.sessions VALUES(txid_current(),auth.uid(),r.id,_action);
 IF _action='sign' THEN UPDATE esign_signers SET status='signed',signed_name=_name,signature_data=_signature,signed_at=now(),ip_address=_ip,user_agent=_ua WHERE id=s.id;
 ELSIF _action='decline' THEN UPDATE esign_signers SET status='declined',decline_reason=_reason,declined_at=now(),ip_address=_ip,user_agent=_ua WHERE id=s.id;
 ELSIF s.viewed_at IS NULL THEN UPDATE esign_signers SET viewed_at=now(),status=CASE WHEN status='pending' THEN 'viewed'::public.esign_signer_status ELSE status END WHERE id=s.id;
 END IF;
 IF _action<>'view' OR s.viewed_at IS NULL THEN
 INSERT INTO esign_audit(document_id,signer_id,owner_id,workspace_id,event,ip_address,user_agent,metadata) VALUES(d.id,s.id,s.owner_id,r.workspace_id,CASE _action WHEN 'sign' THEN 'signed' WHEN 'decline' THEN 'declined' ELSE 'viewed' END,left(_ip,255),left(_ua,2000),jsonb_build_object('reason',_reason));
 END IF;
 DELETE FROM techerp_offers.sessions WHERE txid=txid_current() AND offer_id=r.id;
 RETURN jsonb_build_object('ok',true,'offer_id',r.id,'completed',(SELECT status='signed' FROM ats_offers WHERE id=r.id));
END $$;
CREATE OR REPLACE FUNCTION public.ats_offers_sync_on_esign()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.ats_offers;BEGIN
 SELECT * INTO r FROM ats_offers WHERE esign_document_id=NEW.document_id FOR UPDATE;
 IF NOT FOUND OR r.status<>'sent' OR NEW.workspace_id IS DISTINCT FROM r.workspace_id OR NOT EXISTS(SELECT 1 FROM techerp_offers.sessions WHERE txid=txid_current() AND offer_id=r.id AND operation IN('sign','decline')) THEN RETURN NEW;END IF;
 IF NEW.status='declined' THEN UPDATE ats_offers SET status='declined',declined_at=now(),decline_reason=NEW.decline_reason WHERE id=r.id;
 ELSIF NEW.status='signed' AND NOT EXISTS(SELECT 1 FROM esign_signers WHERE document_id=NEW.document_id AND status<>'signed') THEN UPDATE ats_offers SET status='signed',signed_at=now() WHERE id=r.id;
 END IF;
 -- A signed offer is not permission to confirm a hire or start its workflows.
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.ats_offer_action_access(jsonb,text),public.ats_offer_projection(uuid,uuid),public.ats_offer_transition(uuid,text,integer,text),public.ats_offer_document_access(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ats_offer_action_access(jsonb,text),public.ats_offer_projection(uuid,uuid),public.ats_offer_transition(uuid,text,integer,text),public.ats_offer_document_access(uuid,text) TO authenticated;
REVOKE ALL ON FUNCTION public.ats_offer_public(text),public.ats_offer_sign(text,text,text,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ats_offer_public(text),public.ats_offer_sign(text,text,text,text,text,text,text) TO service_role;
REVOKE ALL ON FUNCTION public.ats_offer_guard(),public.ats_offer_document_guard(),public.ats_offers_sync_on_esign() FROM PUBLIC,anon,authenticated;
NOTIFY pgrst,'reload schema';

CREATE OR REPLACE FUNCTION public.ats_offer_link(_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.ats_offers;BEGIN
 SELECT * INTO r FROM ats_offers WHERE id=_id;
 IF NOT FOUND OR NOT public.ats_offer_action_access(to_jsonb(r),'send') OR r.status NOT IN('sent','signed') THEN RAISE EXCEPTION 'Link indisponível.' USING ERRCODE='42501';END IF;
 RETURN r.public_token;
END $$;
REVOKE ALL ON FUNCTION public.ats_offer_link(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ats_offer_link(uuid) TO authenticated;
CREATE TABLE public.ats_hiring_decisions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid NOT NULL REFERENCES workspaces(id),application_id uuid NOT NULL,actor_id uuid NOT NULL,from_status text,to_status text,event text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.ats_hiring_decisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ats_hiring_decisions FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.ats_hiring_decisions TO authenticated;
CREATE POLICY hiring_decision_read ON public.ats_hiring_decisions FOR SELECT TO authenticated USING(public.hr_record_access('applications','view',application_id));
CREATE TABLE techerp_offers.hiring_sessions(txid bigint NOT NULL,application_id uuid NOT NULL,actor uuid NOT NULL,PRIMARY KEY(txid,application_id));
REVOKE ALL ON techerp_offers.hiring_sessions FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.ats_hiring_terms_access(_row jsonb,_action text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT COALESCE(_action IN('view','update') AND auth.uid() IS NOT NULL AND public.hr_record_access('applications',CASE WHEN _action='view' THEN 'view' ELSE 'update' END,(_row->>'id')::uuid)
 AND (_row->>'workspace_id')::uuid=(SELECT active_workspace_id FROM profiles WHERE id=auth.uid())
 AND (_action='view' OR (NOT public.is_read_only_view() AND public.ats_hiring_terms_access(_row,'view')))
 AND (public.user_has_permission(auth.uid(),(_row->>'workspace_id')::uuid,'techhire.hiring_terms.'||_action||'.workspace')
 OR (COALESCE(_row->>'assigned_to',_row->>'owner_id')::uuid=auth.uid() AND public.user_has_permission(auth.uid(),(_row->>'workspace_id')::uuid,'techhire.hiring_terms.'||_action||'.own'))
 OR (public.hr_team_contains((_row->>'workspace_id')::uuid,ARRAY[COALESCE(_row->>'assigned_to',_row->>'owner_id')::uuid]) AND public.user_has_permission(auth.uid(),(_row->>'workspace_id')::uuid,'techhire.hiring_terms.'||_action||'.team'))),false)
$$;
CREATE OR REPLACE FUNCTION public.ats_hiring_terms(_ids uuid[])
RETURNS TABLE(id uuid,can_view boolean,can_update boolean,fields jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.ats_applications;BEGIN
 IF _ids IS NULL OR cardinality(_ids)>200 THEN RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023';END IF;
 FOR id IN SELECT DISTINCT unnest(_ids) LOOP
  SELECT * INTO r FROM ats_applications a WHERE a.id=ats_hiring_terms.id;
  can_view:=COALESCE(public.ats_hiring_terms_access(to_jsonb(r),'view'),false);can_update:=can_view AND public.ats_hiring_terms_access(to_jsonb(r),'update');fields:=CASE WHEN can_view THEN COALESCE(r.hiring_details,'{}') ELSE '{}' END;RETURN NEXT;
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION public.ats_is_hiring_stage(_job uuid,_stage text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT COALESCE((SELECT EXISTS(SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p.stages)='array' THEN p.stages ELSE '[]' END) s WHERE s->>'value'=_stage AND s->>'type'='won') FROM ats_jobs j LEFT JOIN ats_pipelines p ON p.id=j.pipeline_id AND p.workspace_id=j.workspace_id WHERE j.id=_job),false)
 OR _stage IN('hired','profissional_contratado','contratado')
$$;
CREATE OR REPLACE FUNCTION public.ats_hiring_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE actor uuid:=auth.uid();delegated uuid;was_hired boolean:=false;will_hire boolean;terms_changed boolean;old_terms jsonb;item text;amount numeric;BEGIN
 IF TG_OP='DELETE' THEN
  IF OLD.status='hired' OR EXISTS(SELECT 1 FROM ats_hiring_decisions WHERE application_id=OLD.id) THEN RAISE EXCEPTION 'Candidatura com histórico de contratação deve ser preservada; use reversão ou anonimização autorizada.' USING ERRCODE='23514';END IF;
  RETURN OLD;
 END IF;
 IF TG_OP='UPDATE' THEN was_hired:=COALESCE(OLD.status='hired',false);old_terms:=OLD.hiring_details;END IF;
 will_hire:=COALESCE(NEW.status='hired',false);
 terms_changed:=COALESCE(NEW.hiring_details,'{}') IS DISTINCT FROM COALESCE(old_terms,'{}');
 SELECT s.actor INTO delegated FROM techerp_offers.hiring_sessions s WHERE s.txid=txid_current() AND s.application_id=NEW.id;
 IF (will_hire AND NOT was_hired) OR (public.ats_is_hiring_stage(NEW.job_id,NEW.stage_value) AND (TG_OP='INSERT' OR NEW.stage_value IS DISTINCT FROM OLD.stage_value)) OR (was_hired AND terms_changed) THEN
  IF actor IS NOT NULL THEN
   IF NOT public.hr_record_access('applications','update',NEW.id) OR public.is_read_only_view() OR NOT public.user_has_permission(actor,NEW.workspace_id,'techhire.hiring.approve.workspace') THEN RAISE EXCEPTION 'Confirmar contratação exige permissão específica.' USING ERRCODE='42501';END IF;
  ELSIF delegated IS NULL THEN RAISE EXCEPTION 'Contratação automática exige delegação autorizada.' USING ERRCODE='42501';END IF;
 END IF;
 IF public.ats_is_hiring_stage(NEW.job_id,NEW.stage_value) AND NOT will_hire THEN RAISE EXCEPTION 'Etapa de contratação exige desfecho contratado.' USING ERRCODE='23514';END IF;
 IF will_hire AND (NOT was_hired OR NEW.stage_value IS DISTINCT FROM OLD.stage_value) AND NOT public.ats_is_hiring_stage(NEW.job_id,NEW.stage_value) THEN RAISE EXCEPTION 'Contratação exige uma etapa de contratação válida.' USING ERRCODE='23514';END IF;
 IF was_hired AND NOT will_hire THEN
  IF actor IS NULL OR public.is_read_only_view() OR NOT public.user_has_permission(actor,NEW.workspace_id,'techhire.hiring_reversal.manage.workspace') THEN RAISE EXCEPTION 'Reverter contratação exige permissão específica; efeitos já executados precisam de revisão.' USING ERRCODE='42501';END IF;
 END IF;
 IF terms_changed THEN
  IF actor IS NULL AND delegated IS NULL THEN RAISE EXCEPTION 'Condições exigem uma ação autenticada.' USING ERRCODE='42501';END IF;
  IF actor IS NOT NULL AND NOT public.ats_hiring_terms_access(CASE WHEN TG_OP='INSERT' THEN to_jsonb(NEW) ELSE to_jsonb(OLD) END,'update') THEN RAISE EXCEPTION 'Sem permissão para alterar condições de contratação.' USING ERRCODE='42501';END IF;
  IF jsonb_typeof(NEW.hiring_details) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Condições inválidas.' USING ERRCODE='22023';END IF;
  IF EXISTS(SELECT 1 FROM jsonb_object_keys(NEW.hiring_details) k WHERE k NOT IN('model','department','modality','employment_type','role_title','start_date','monthly_amount','hourly_rate','fee_amount','client_company_id','notes','recorded_by','recorded_at')) OR COALESCE(NEW.hiring_details->>'model','') NOT IN('internal','outsourcing','hunting') THEN RAISE EXCEPTION 'Condições inválidas.' USING ERRCODE='22023';END IF;
  IF length(COALESCE(NEW.hiring_details->>'department',''))>80 OR length(COALESCE(NEW.hiring_details->>'role_title',''))>200 OR length(COALESCE(NEW.hiring_details->>'notes',''))>2000 OR (NEW.hiring_details ? 'modality' AND COALESCE(NEW.hiring_details->>'modality','') NOT IN('monthly','hourly','mixed')) OR (NEW.hiring_details ? 'employment_type' AND COALESCE(NEW.hiring_details->>'employment_type','') NOT IN('pj','clt','contractor','intern','other')) THEN RAISE EXCEPTION 'Condições inválidas.' USING ERRCODE='22023';END IF;
  IF NEW.hiring_details ? 'start_date' AND (COALESCE(NEW.hiring_details->>'start_date','') !~ '^\d{4}-\d{2}-\d{2}$' OR to_char((NEW.hiring_details->>'start_date')::date,'YYYY-MM-DD') IS DISTINCT FROM NEW.hiring_details->>'start_date') THEN RAISE EXCEPTION 'Data inválida.' USING ERRCODE='22023';END IF;
  FOREACH item IN ARRAY ARRAY['monthly_amount','hourly_rate','fee_amount'] LOOP
   IF NEW.hiring_details ? item THEN
    IF jsonb_typeof(NEW.hiring_details->item)<>'number' THEN RAISE EXCEPTION 'Valor inválido.' USING ERRCODE='22023';END IF;
    amount:=(NEW.hiring_details->>item)::numeric;IF amount<0 OR amount>(CASE item WHEN 'hourly_rate' THEN 100000 ELSE 10000000 END) THEN RAISE EXCEPTION 'Valor fora do limite.' USING ERRCODE='22023';END IF;
   END IF;
  END LOOP;
  IF NEW.hiring_details->>'client_company_id' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM companies WHERE id=(NEW.hiring_details->>'client_company_id')::uuid AND workspace_id=NEW.workspace_id) THEN RAISE EXCEPTION 'Cliente fora do workspace.' USING ERRCODE='23514';END IF;
  NEW.hiring_details:=NEW.hiring_details||jsonb_build_object('recorded_by',COALESCE(actor,delegated),'recorded_at',now());
 END IF;
 IF will_hire IS DISTINCT FROM was_hired OR (was_hired AND terms_changed) THEN
  INSERT INTO ats_hiring_decisions(workspace_id,application_id,actor_id,from_status,to_status,event) VALUES(NEW.workspace_id,NEW.id,COALESCE(actor,delegated),CASE WHEN TG_OP='UPDATE' THEN OLD.status END,NEW.status,CASE WHEN was_hired AND NOT will_hire THEN 'reversed' WHEN was_hired THEN 'terms_updated' ELSE 'confirmed' END);
 END IF;
 RETURN NEW;
END $$;

-- API-key exception: scope=write alone is insufficient. The service RPC checks
-- the actual key, tenant, active owner and explicit workspace capabilities.
CREATE OR REPLACE FUNCTION public.ats_api_confirm_hire(_id uuid,_key uuid,_stage text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.ats_applications;k public.api_keys;prior_sub text:=current_setting('request.jwt.claim.sub',true);prior_claims text:=current_setting('request.jwt.claims',true);result jsonb;BEGIN
 IF auth.uid() IS NOT NULL THEN RAISE EXCEPTION 'Somente serviço de API autenticado.' USING ERRCODE='42501';END IF;
 SELECT * INTO k FROM api_keys WHERE id=_key AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>now()) AND 'write'=ANY(scopes);
 IF NOT FOUND OR NOT public.is_workspace_member(k.workspace_id,k.owner_id) THEN RAISE EXCEPTION 'API key indisponível.' USING ERRCODE='42501';END IF;
 SELECT * INTO a FROM ats_applications WHERE id=_id AND workspace_id=k.workspace_id AND owner_id=k.owner_id FOR UPDATE;
 IF NOT FOUND OR k.workspace_id IS DISTINCT FROM (SELECT active_workspace_id FROM profiles WHERE id=k.owner_id) THEN RAISE EXCEPTION 'Candidatura fora do contexto da chave.' USING ERRCODE='42501';END IF;
 -- Delegation is exclusively from the server-authenticated API key. Restore
 -- claims before returning; no secret/session is issued or exposed to a user.
 PERFORM set_config('request.jwt.claim.sub',k.owner_id::text,true);
 PERFORM set_config('request.jwt.claims',(COALESCE(NULLIF(prior_claims,''),'{}')::jsonb||jsonb_build_object('sub',k.owner_id::text))::text,true);
 IF NOT public.hr_record_access('applications','update',a.id) OR NOT public.hr_record_access('application_hiring','update',a.id) THEN RAISE EXCEPTION 'API sem permissão para confirmar esta contratação.' USING ERRCODE='42501';END IF;
 IF NOT public.ats_is_hiring_stage(a.job_id,_stage) THEN RAISE EXCEPTION 'Etapa inválida.' USING ERRCODE='22023';END IF;
 IF a.status='hired' THEN
  PERFORM set_config('request.jwt.claim.sub',COALESCE(prior_sub,''),true);PERFORM set_config('request.jwt.claims',COALESCE(prior_claims,'{}'),true);
  RETURN jsonb_build_object('id',a.id,'status',a.status,'already_hired',true);END IF;
 INSERT INTO techerp_offers.hiring_sessions VALUES(txid_current(),a.id,k.owner_id);
 UPDATE ats_applications SET status='hired',stage_value=_stage,moved_at=now() WHERE id=a.id;
 DELETE FROM techerp_offers.hiring_sessions WHERE txid=txid_current() AND application_id=a.id;
 PERFORM set_config('request.jwt.claim.sub',COALESCE(prior_sub,''),true);PERFORM set_config('request.jwt.claims',COALESCE(prior_claims,'{}'),true);
 RETURN jsonb_build_object('id',a.id,'job_id',a.job_id,'candidate_id',a.candidate_id,'status','hired','stage_value',_stage,'already_hired',false);
END $$;

REVOKE ALL ON FUNCTION public.ats_hiring_guard(),public.ats_api_confirm_hire(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ats_api_confirm_hire(uuid,uuid,text) TO service_role;
REVOKE ALL ON FUNCTION public.ats_hiring_terms(uuid[]),public.ats_hiring_terms_access(jsonb,text),public.ats_is_hiring_stage(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ats_hiring_terms(uuid[]),public.ats_hiring_terms_access(jsonb,text),public.ats_is_hiring_stage(uuid,text) TO authenticated,service_role;
-- Metadata-only capabilities share the exact hiring predicates used by guards.
DO $$ DECLARE def text;BEGIN
 SELECT pg_get_functiondef('public.hr_record_access(text,text,uuid)'::regprocedure) INTO def;
 def:=replace(def,' CASE _resource',E' CASE _resource\n WHEN ''application_hiring'' THEN\n SELECT public.hr_record_access(''applications'',''view'',a.id) AND CASE _action WHEN ''view'' THEN true WHEN ''update'' THEN public.hr_record_access(''applications'',''update'',a.id) AND NOT public.is_read_only_view() AND public.user_has_permission(auth.uid(),a.workspace_id,''techhire.hiring.approve.workspace'') WHEN ''delete'' THEN public.hr_record_access(''applications'',''update'',a.id) AND NOT public.is_read_only_view() AND public.user_has_permission(auth.uid(),a.workspace_id,''techhire.hiring_reversal.manage.workspace'') WHEN ''create'' THEN public.ats_hiring_terms_access(to_jsonb(a),''update'') ELSE false END INTO allowed FROM public.ats_applications a WHERE a.id=_id;');
 EXECUTE def;
 SELECT pg_get_functiondef('public.hr_record_capabilities(text,uuid[])'::regprocedure) INTO def;
 def:=replace(def,E'BEGIN\n',E'BEGIN\n IF _resource=''application_hiring'' THEN\n IF _ids IS NULL OR cardinality(_ids)>200 THEN RAISE EXCEPTION ''Invalid capability request'' USING ERRCODE=''22023'';END IF;\n RETURN QUERY SELECT v,public.hr_record_access(_resource,''view'',v),public.hr_record_access(_resource,''update'',v),public.hr_record_access(_resource,''delete'',v),public.hr_record_access(_resource,''create'',v),false FROM (SELECT DISTINCT unnest(_ids) AS v) s;RETURN;\n END IF;\n');
 EXECUTE def;
END $$;
