ALTER TABLE public.contract_forsign_operations ADD COLUMN requested_members jsonb;

-- Document participants are contact snapshots. Optional witnesses become required once included.
CREATE TABLE public.contract_signature_participants (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
 evidence_id uuid NOT NULL REFERENCES public.hiring_contract_evidence(id) ON DELETE CASCADE,
 document_id uuid NOT NULL REFERENCES public.esign_documents(id) ON DELETE CASCADE,
 signer_id uuid NOT NULL REFERENCES public.esign_signers(id) ON DELETE RESTRICT,
 contact_id uuid NOT NULL,role text NOT NULL CHECK(length(role) BETWEEN 2 AND 80),
 UNIQUE(document_id,role),UNIQUE(document_id,signer_id),UNIQUE(document_id,contact_id)
);
ALTER TABLE public.contract_signature_participants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.contract_signature_participants FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.contract_signature_participants TO authenticated;
GRANT ALL ON public.contract_signature_participants TO service_role;
CREATE POLICY contract_signature_participants_read ON public.contract_signature_participants FOR SELECT TO authenticated
USING(workspace_id=(SELECT (public.work_access_context()->>'workspace')::uuid) AND public.work_record_access('techcontracts.esign',document_id,'view'));

CREATE OR REPLACE FUNCTION public.hiring_contract_signers_prepare(p_ws uuid,p_contract uuid,p_hash text,p_signers jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c public.contracts; x jsonb; item public.contacts; contacts jsonb:='[]'; d uuid; e uuid; s uuid; r text; n text; mail text; body text; old_manifest jsonb; wanted jsonb;
BEGIN
 IF auth.uid() IS NULL OR is_read_only_view() OR NOT public.hiring_signature_access(p_ws,p_contract,'manage') OR NOT public.hiring_signature_access(p_ws,p_contract,'view') THEN RAISE EXCEPTION 'Sem permissão para preparar assinatura.' USING ERRCODE='42501';END IF;
 SELECT * INTO c FROM public.contracts WHERE id=p_contract AND workspace_id=p_ws FOR UPDATE;
 IF c.id IS NULL OR p_hash IS DISTINCT FROM public.hiring_contract_fingerprint(c.id) THEN RAISE EXCEPTION 'Contrato alterado. Recarregue.';END IF;
 IF jsonb_typeof(p_signers) IS DISTINCT FROM 'array' OR jsonb_array_length(p_signers) NOT BETWEEN 2 AND 20 THEN RAISE EXCEPTION 'Informe as partes e os demais signatários incluídos.';END IF;
 FOR x IN SELECT value FROM jsonb_array_elements(p_signers) LOOP
  r:=upper(trim(x->>'role'));
  IF r IS NULL OR length(r) NOT BETWEEN 2 AND 80 OR r !~ '^[A-Z0-9_ -]+$' OR EXISTS(SELECT 1 FROM jsonb_array_elements(contacts) v WHERE v->>'role'=r OR v->>'contact_id'=x->>'contactId') THEN RAISE EXCEPTION 'Papéis e contatos devem ser distintos.';END IF;
  SELECT * INTO item FROM public.contacts WHERE id=(x->>'contactId')::uuid AND workspace_id=p_ws AND deleted_at IS NULL;
  IF item.id IS NULL OR NOT public.sales_record_access('contacts',item.id,'view') THEN RAISE EXCEPTION 'Contato indisponível para este usuário e workspace.' USING ERRCODE='42501';END IF;
  n:=trim(concat_ws(' ',item.first_name,item.last_name));mail:=trim(item.email);
  IF length(n) NOT BETWEEN 2 AND 255 OR coalesce(length(mail),0) NOT BETWEEN 3 AND 255 OR mail !~ '^[^[:space:]@]+@[^[:space:]@]+$' OR EXISTS(SELECT 1 FROM jsonb_array_elements(contacts) v WHERE lower(v->>'email')=lower(mail)) THEN RAISE EXCEPTION 'Cada signatário deve ter nome e e-mail válidos e distintos. Atualize o contato.';END IF;
  contacts:=contacts||jsonb_build_array(jsonb_build_object('role',r,'contact_id',item.id,'name',n,'email',mail));
 END LOOP;
 IF (SELECT count(*) FROM jsonb_array_elements(contacts) v WHERE v->>'role' IN('CONTRATANTE','CONTRATADO'))<>2 THEN RAISE EXCEPTION 'Contratante e contratado são obrigatórios.';END IF;
 SELECT ev.document_id,ev.id INTO d,e FROM public.hiring_contract_evidence ev JOIN public.esign_documents doc ON doc.id=ev.document_id WHERE ev.workspace_id=p_ws AND ev.contract_id=p_contract AND ev.contract_hash=p_hash AND ev.kind='native' AND ev.revoked_at IS NULL AND doc.status::text NOT IN('canceled','declined') ORDER BY ev.recorded_at DESC LIMIT 1;
 IF d IS NOT NULL THEN
  SELECT jsonb_agg(jsonb_build_object('role',p.role,'contact_id',p.contact_id,'name',z.name,'email',z.email) ORDER BY p.role) INTO old_manifest FROM public.contract_signature_participants p JOIN public.esign_signers z ON z.id=p.signer_id WHERE p.document_id=d;
  SELECT jsonb_agg(v ORDER BY v->>'role') INTO wanted FROM jsonb_array_elements(contacts) v;
  IF old_manifest IS NOT DISTINCT FROM wanted THEN RETURN d;END IF;
  RAISE EXCEPTION 'Já existe uma preparação desta versão. Revogue a evidência anterior antes de alterar signatários.';
 END IF;
 d:=public.hiring_contract_native_prepare(p_ws,p_contract,p_hash,
  (SELECT v->>'name' FROM jsonb_array_elements(contacts) v WHERE v->>'role'='CONTRATANTE'),(SELECT v->>'email' FROM jsonb_array_elements(contacts) v WHERE v->>'role'='CONTRATANTE'),
  (SELECT v->>'name' FROM jsonb_array_elements(contacts) v WHERE v->>'role'='CONTRATADO'),(SELECT v->>'email' FROM jsonb_array_elements(contacts) v WHERE v->>'role'='CONTRATADO'));
 SELECT id INTO e FROM public.hiring_contract_evidence WHERE document_id=d AND workspace_id=p_ws AND contract_id=p_contract;
 FOR x IN SELECT value FROM jsonb_array_elements(contacts) LOOP
  r:=x->>'role';
  IF r NOT IN('CONTRATANTE','CONTRATADO') THEN
   PERFORM public.contract_esign_manage('add_signer',d,jsonb_build_object('name',x->>'name','email',x->>'email','sign_order',(SELECT count(*)+1 FROM public.esign_signers WHERE document_id=d)));
  END IF;
  SELECT id INTO s FROM public.esign_signers WHERE workspace_id=p_ws AND document_id=d AND email=x->>'email';
  INSERT INTO public.contract_signature_participants(workspace_id,evidence_id,document_id,signer_id,contact_id,role) VALUES(p_ws,e,d,s,(x->>'contact_id')::uuid,r);
 END LOOP;
 INSERT INTO public.hiring_signature_events(workspace_id,contract_id,actor_id,kind,details) VALUES(p_ws,p_contract,auth.uid(),'participants_prepared',jsonb_build_object('document_id',d,'roles',(SELECT jsonb_agg(v->>'role') FROM jsonb_array_elements(contacts) v)));
 RETURN d;
END $$;
REVOKE ALL ON FUNCTION public.hiring_contract_signers_prepare(uuid,uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.hiring_contract_signers_prepare(uuid,uuid,text,jsonb) TO authenticated;
-- Legacy free-text preparation is now internal. Existing sealed documents remain unchanged.
REVOKE EXECUTE ON FUNCTION public.hiring_contract_native_prepare(uuid,uuid,text,text,text,text,text) FROM authenticated;

-- A participant cannot be silently changed through another draft editor.
CREATE OR REPLACE FUNCTION public.contract_participant_identity_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF ROW(NEW.name,NEW.email,NEW.document_id,NEW.workspace_id,NEW.sign_order) IS DISTINCT FROM ROW(OLD.name,OLD.email,OLD.document_id,OLD.workspace_id,OLD.sign_order)
 AND EXISTS(SELECT 1 FROM public.contract_signature_participants p WHERE p.signer_id=OLD.id) THEN RAISE EXCEPTION 'Signatário vinculado ao contrato. Revogue a preparação para alterar sua identidade.';END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.contract_participant_identity_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER contract_participant_identity BEFORE UPDATE ON public.esign_signers FOR EACH ROW EXECUTE FUNCTION public.contract_participant_identity_guard();

CREATE OR REPLACE FUNCTION public.hiring_contract_signature_context(p_ws uuid,p_contract uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c public.contracts;
BEGIN
 IF NOT public.hiring_signature_access(p_ws,p_contract,'view') THEN RAISE EXCEPTION 'Sem acesso à evidência do contrato.' USING ERRCODE='42501';END IF;
 SELECT * INTO c FROM public.contracts WHERE id=p_contract AND workspace_id=p_ws;
 RETURN jsonb_build_object('witnesses_detected',upper(regexp_replace(c.body_html,'<[^>]*>',' ','g')) ~ 'TESTEMUNHA', 'hash',public.hiring_contract_fingerprint(c.id),'reason',public.hiring_contract_signature_reason(c.id,p_ws,c.deal_id),'deal_id',c.deal_id,
 'entity_id',c.contracting_legal_entity_id,'entities',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'name',name,'cnpj',cnpj) ORDER BY name) FROM public.legal_entities WHERE workspace_id=p_ws AND active),'[]'),'can_manage',public.hiring_signature_access(p_ws,c.id,'manage'),'commercial_source',EXISTS(SELECT 1 FROM public.hiring_commercial_contracts WHERE contract_id=c.id AND workspace_id=p_ws),
 'evidence',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'kind',kind,'document_id',document_id,'current_version',contract_hash=public.hiring_contract_fingerprint(c.id),'recorded_at',recorded_at,'signed_on',signed_on,'reference',reference,'note',note,'revoked_at',revoked_at,'revocation_reason',revocation_reason) ORDER BY recorded_at DESC) FROM public.hiring_contract_evidence WHERE contract_id=c.id AND workspace_id=p_ws),'[]'));
END $$;
NOTIFY pgrst, 'reload schema';
