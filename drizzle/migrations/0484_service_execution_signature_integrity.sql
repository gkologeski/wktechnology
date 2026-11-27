-- Execution progress is not a revision of the document submitted for signature.
-- Keep the existing hash for the exact same commercial document, without
-- rewriting a signature, sealed package, evidence row, or any business record.
CREATE TABLE public.contract_service_signature_anchors (
 -- Private cache, not a business FK: an FK check would acquire a parent row
 -- lock after the service lock and deadlock with parent-first billing release.
 contract_id uuid PRIMARY KEY,
 workspace_id uuid NOT NULL,
 commercial_hash text NOT NULL CHECK (commercial_hash ~ '^[a-f0-9]{64}$'),
 signature_base_hash text NOT NULL CHECK (signature_base_hash ~ '^[a-f0-9]{64}$'),
 captured_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.contract_service_signature_anchors ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.contract_service_signature_anchors FROM PUBLIC,anon,authenticated,service_role;

ALTER FUNCTION public.hiring_contract_fingerprint_without_attachments(uuid)
 RENAME TO hiring_contract_fingerprint_with_service_state_v1;
REVOKE ALL ON FUNCTION public.hiring_contract_fingerprint_with_service_state_v1(uuid)
 FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;

CREATE OR REPLACE FUNCTION public.contract_service_commercial_signature_hash(p_contract uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT encode(extensions.digest(convert_to(jsonb_build_object(
 'contract',to_jsonb(c)-ARRAY['hiring_request_origin','hiring_person_id','status','updated_at','created_at','owner_id','assigned_to','public_token','signed_at','signed_pdf_path','signature_provider','signature_document_id','signature_operation_id','import_confidence','imported_from'],
 'issuer',(SELECT jsonb_build_object('id',l.id,'name',l.name,'cnpj',l.cnpj) FROM public.legal_entities l WHERE l.id=c.contracting_legal_entity_id AND l.workspace_id=c.workspace_id),
 'counterparty',(SELECT jsonb_build_object('id',x.id,'name',x.name,'cnpj',to_jsonb(x)->>'cnpj') FROM public.companies x WHERE x.id=c.counterparty_company_id AND x.workspace_id=c.workspace_id),
 'services',coalesce((SELECT jsonb_agg(to_jsonb(s)-ARRAY['updated_at','created_at','owner_id','assigned_to','delivery_owner_id','next_billing_at','metadata','status','starts_at','ends_at','billing_hold','billing_hold_schedule'] ORDER BY s.id) FROM public.services s WHERE s.contract_id=c.id AND s.workspace_id=c.workspace_id),'[]'))::text,'UTF8'),'sha256'),'hex') FROM public.contracts c WHERE c.id=p_contract
$$;
REVOKE ALL ON FUNCTION public.contract_service_commercial_signature_hash(uuid)
 FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;

CREATE OR REPLACE FUNCTION public.hiring_contract_fingerprint_without_attachments(p_contract uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c public.contracts; a public.contract_service_signature_anchors;
BEGIN
 SELECT * INTO c FROM public.contracts WHERE id=p_contract;
 IF c.id IS NULL THEN RETURN NULL; END IF;
 IF c.role::text='provider' THEN
  SELECT * INTO a FROM public.contract_service_signature_anchors
   WHERE contract_id=c.id AND workspace_id=c.workspace_id;
  IF a.contract_id IS NOT NULL AND a.commercial_hash=public.contract_service_commercial_signature_hash(c.id)
   THEN RETURN a.signature_base_hash; END IF;
 END IF;
 RETURN public.hiring_contract_fingerprint_with_service_state_v1(c.id);
END $$;
REVOKE ALL ON FUNCTION public.hiring_contract_fingerprint_without_attachments(uuid)
 FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;

CREATE OR REPLACE FUNCTION public.service_execution_preserve_signature_hash()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c public.contracts; material text; previous text;
BEGIN
 IF OLD.contract_id IS NULL OR OLD.contract_id IS DISTINCT FROM NEW.contract_id
  OR OLD.workspace_id IS DISTINCT FROM NEW.workspace_id THEN RETURN NEW; END IF;
 IF (OLD.status,OLD.starts_at,OLD.ends_at,OLD.billing_hold,OLD.billing_hold_schedule)
  IS NOT DISTINCT FROM (NEW.status,NEW.starts_at,NEW.ends_at,NEW.billing_hold,NEW.billing_hold_schedule)
  THEN RETURN NEW; END IF;
 SELECT * INTO c FROM public.contracts WHERE id=OLD.contract_id AND workspace_id=OLD.workspace_id;
 IF c.id IS NULL OR c.role::text<>'provider' THEN RETURN NEW; END IF;
 -- The cache primary-key upsert serializes captures from different services.
 -- Read the old canonical value before changing the operational service fields.
 material:=public.contract_service_commercial_signature_hash(c.id);
 previous:=public.hiring_contract_fingerprint_without_attachments(c.id);
 INSERT INTO public.contract_service_signature_anchors(contract_id,workspace_id,commercial_hash,signature_base_hash)
 VALUES(c.id,c.workspace_id,material,previous)
 ON CONFLICT(contract_id) DO UPDATE SET workspace_id=EXCLUDED.workspace_id,
  commercial_hash=EXCLUDED.commercial_hash,signature_base_hash=EXCLUDED.signature_base_hash,captured_at=now()
 WHERE contract_service_signature_anchors.commercial_hash IS DISTINCT FROM EXCLUDED.commercial_hash;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.service_execution_preserve_signature_hash()
 FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
CREATE TRIGGER service_execution_signature_anchor
 BEFORE UPDATE OF status,starts_at,ends_at,billing_hold,billing_hold_schedule ON public.services
 FOR EACH ROW EXECUTE FUNCTION public.service_execution_preserve_signature_hash();
CREATE OR REPLACE FUNCTION public.contract_service_signature_anchor_cleanup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 DELETE FROM public.contract_service_signature_anchors WHERE contract_id=OLD.id AND workspace_id=OLD.workspace_id;
 RETURN OLD;
END $$;
REVOKE ALL ON FUNCTION public.contract_service_signature_anchor_cleanup()
 FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
CREATE TRIGGER contract_service_signature_anchor_cleanup
 AFTER DELETE ON public.contracts FOR EACH ROW
 EXECUTE FUNCTION public.contract_service_signature_anchor_cleanup();
COMMENT ON TABLE public.contract_service_signature_anchors IS
 'Private compatibility anchors: only service operational changes preserve the previous signature hash. Commercial content and attachments continue invalidating old signatures. No signature or invoice is created.';
