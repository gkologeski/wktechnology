-- Direct professional instruments reuse the canonical person without a fake ATS admission.
-- Package 3: reviewed additive migration.
CREATE OR REPLACE FUNCTION public.hiring_purchase_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE direct_origin boolean:=false;
BEGIN
 IF TG_OP='UPDATE' AND EXISTS(SELECT 1 FROM public.hiring_engagements e WHERE e.purchase_contract_id=OLD.id AND e.status='active' AND(e.legal_entity_id IS DISTINCT FROM NEW.contracting_legal_entity_id OR e.person_id IS DISTINCT FROM NEW.hiring_person_id OR NEW.role::text<>'client' OR NEW.document_kind<>'main')) THEN
  RAISE EXCEPTION 'Contrato vinculado deve preservar pessoa, papel de compra e entidade WK.';
 END IF;
 IF NEW.hiring_request_origin IS NOT NULL THEN
  direct_origin:=public.hiring_formalization_access(NEW.workspace_id,NEW.hiring_request_origin,'manage')
   AND public.hiring_formalization_current(NEW.workspace_id,NEW.hiring_request_origin)
   AND EXISTS(SELECT 1 FROM public.hiring_preparation_requests r
    WHERE r.id=NEW.hiring_request_origin AND r.workspace_id=NEW.workspace_id AND r.kind='professional'
    AND r.selection_mode='defined' AND r.person_id=NEW.hiring_person_id
    AND r.legal_entity_id=NEW.contracting_legal_entity_id AND NEW.role::text='client' AND NEW.document_kind='main');
 END IF;
 IF (TG_OP='INSERT' AND NEW.hiring_person_id IS NOT NULL OR TG_OP='UPDATE' AND NEW.hiring_person_id IS DISTINCT FROM OLD.hiring_person_id)
 AND coalesce(current_setting('app.hiring_purchase',true),'')<>'on' AND NOT coalesce(direct_origin,false) THEN
  RAISE EXCEPTION 'Vincule a pessoa pela admissão ou pela solicitação direta aprovada.';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.hiring_purchase_guard() FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
