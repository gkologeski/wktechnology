-- Activate only after the 0208-compatible server and UI have been published.
DO $$ DECLARE t text;p record;BEGIN
 FOREACH t IN ARRAY ARRAY['ats_dsar_requests','ats_candidate_consents'] LOOP
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t AND permissive='PERMISSIVE' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,t);END LOOP;
  EXECUTE format('CREATE POLICY compliance_select ON public.%I FOR SELECT TO authenticated USING(public.ats_compliance_access(candidate_id,''view'') AND workspace_id=(SELECT c.workspace_id FROM public.ats_candidates c WHERE c.id=candidate_id))',t);
  EXECUTE format('CREATE POLICY compliance_insert ON public.%I FOR INSERT TO authenticated WITH CHECK(owner_id=auth.uid() AND public.ats_compliance_access(candidate_id,''create'') AND workspace_id=(SELECT c.workspace_id FROM public.ats_candidates c WHERE c.id=candidate_id))',t);
  EXECUTE format('CREATE POLICY compliance_update ON public.%I FOR UPDATE TO authenticated USING(public.ats_compliance_access(candidate_id,''update'')) WITH CHECK(public.ats_compliance_access(candidate_id,''update''))',t);
  -- Keep the audit trail; use rejection/revocation or approved subject erasure.
 END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.ats_compliance_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.ats_candidates;is_revocation boolean:=false;actor uuid:=auth.uid();
BEGIN
 IF TG_OP='UPDATE' AND (NEW.id IS DISTINCT FROM OLD.id OR NEW.owner_id IS DISTINCT FROM OLD.owner_id OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id OR NEW.candidate_id IS DISTINCT FROM OLD.candidate_id OR NEW.created_at IS DISTINCT FROM OLD.created_at) THEN RAISE EXCEPTION 'Vínculos e autoria LGPD são imutáveis.' USING ERRCODE='42501';END IF;
 SELECT * INTO c FROM public.ats_candidates WHERE id=NEW.candidate_id;
 IF NOT FOUND OR NEW.workspace_id IS DISTINCT FROM c.workspace_id THEN RAISE EXCEPTION 'Candidato e workspace incompatíveis.' USING ERRCODE='23514';END IF;
 IF actor IS NOT NULL THEN
  IF public.is_read_only_view() THEN RAISE EXCEPTION 'Sessão somente leitura.' USING ERRCODE='42501';END IF;
  IF TG_OP='INSERT' AND NEW.owner_id IS DISTINCT FROM actor THEN RAISE EXCEPTION 'Autoria inválida.' USING ERRCODE='42501';END IF;
  IF TG_TABLE_NAME='ats_candidate_consents' AND TG_OP='UPDATE' THEN
   is_revocation:=NOT NEW.granted AND c.lgpd_redacted_at IS NOT NULL AND public.ats_compliance_access(c.id,'delete')
    AND (to_jsonb(NEW)-ARRAY['granted','revoked_at'])=(to_jsonb(OLD)-ARRAY['granted','revoked_at']);
  END IF;
  IF NOT is_revocation AND NOT public.ats_compliance_access(c.id,CASE TG_OP WHEN 'INSERT' THEN 'create' ELSE 'update' END) THEN RAISE EXCEPTION 'Ação LGPD não autorizada.' USING ERRCODE='42501';END IF;
 END IF;
 IF TG_TABLE_NAME='ats_dsar_requests' THEN
  IF TG_OP='INSERT' THEN
   NEW.requested_by:=actor;NEW.status:='pending';NEW.processed_by:=NULL;NEW.processed_at:=NULL;NEW.result:=NULL;
  ELSE
   IF NEW.request_type IS DISTINCT FROM OLD.request_type OR NEW.requested_by IS DISTINCT FROM OLD.requested_by OR NEW.subject_email IS DISTINCT FROM OLD.subject_email THEN RAISE EXCEPTION 'Tipo e solicitante são imutáveis.' USING ERRCODE='42501';END IF;
   IF OLD.status IN('completed','rejected') AND to_jsonb(NEW)-'updated_at' IS DISTINCT FROM to_jsonb(OLD)-'updated_at' THEN RAISE EXCEPTION 'Solicitação encerrada é imutável.' USING ERRCODE='23514';END IF;
   IF NEW.status='completed' AND actor IS NOT NULL THEN
    IF (NEW.request_type IN('export','access') AND (NOT public.ats_compliance_access(c.id,'export') OR NEW.result->>'kind' IS DISTINCT FROM 'export'))
    OR (NEW.request_type='erasure' AND (NOT public.ats_compliance_access(c.id,'delete') OR c.lgpd_redacted_at IS NULL OR NEW.result->>'kind' IS DISTINCT FROM 'erasure')) THEN RAISE EXCEPTION 'Conclusão sem ação LGPD autorizada.' USING ERRCODE='42501';END IF;
   END IF;
   IF NEW.status IN('completed','rejected') THEN NEW.processed_by:=actor;NEW.processed_at:=now();ELSE NEW.processed_by:=NULL;NEW.processed_at:=NULL;NEW.result:=NULL;END IF;
  END IF;
 ELSE
  IF TG_OP='UPDATE' AND NOT is_revocation AND (to_jsonb(NEW)-ARRAY['granted','revoked_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['granted','revoked_at']) THEN RAISE EXCEPTION 'Preserve a evidência: registre um novo consentimento.' USING ERRCODE='23514';END IF;
  IF TG_OP='UPDATE' AND NEW.granted AND NOT OLD.granted THEN RAISE EXCEPTION 'Consentimento revogado exige nova evidência.' USING ERRCODE='23514';END IF;
  IF NOT NEW.granted THEN NEW.revoked_at:=COALESCE(CASE WHEN TG_OP='UPDATE' THEN OLD.revoked_at END,now());ELSE NEW.revoked_at:=NULL;END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.ats_compliance_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER zzz_compliance_guard BEFORE INSERT OR UPDATE ON public.ats_dsar_requests FOR EACH ROW EXECUTE FUNCTION public.ats_compliance_guard();
CREATE TRIGGER zzz_compliance_guard BEFORE INSERT OR UPDATE ON public.ats_candidate_consents FOR EACH ROW EXECUTE FUNCTION public.ats_compliance_guard();

CREATE OR REPLACE FUNCTION public.ats_retention_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NOT NULL AND ((TG_OP='INSERT' AND NEW.retention_until IS NOT NULL) OR (TG_OP='UPDATE' AND NEW.retention_until IS DISTINCT FROM OLD.retention_until)) AND NOT public.ats_compliance_access(NEW.id,'retention') THEN
  -- On INSERT the row does not exist yet: explicit candidate create and
  -- compliance update workspace are needed before a retention can be supplied.
  IF TG_OP<>'INSERT' OR NOT public.hr_scope_permission(NEW.workspace_id,'techhire.candidates','create',true,false)
   OR NOT public.user_has_permission(auth.uid(),NEW.workspace_id,'techhire.compliance.update.workspace') THEN RAISE EXCEPTION 'Sem permissão para configurar retenção.' USING ERRCODE='42501';END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.ats_retention_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER zzz_retention_guard BEFORE INSERT OR UPDATE OF retention_until ON public.ats_candidates FOR EACH ROW EXECUTE FUNCTION public.ats_retention_guard();

-- Apply the same assigned/team scope to the legacy entry point.
CREATE OR REPLACE FUNCTION public.anonymize_ats_candidate(_candidate_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE v_user uuid:=auth.uid(); v_workspace uuid; v_owner uuid;
BEGIN
  IF v_user IS NULL OR public.is_read_only_view() THEN
    RAISE EXCEPTION 'Anonimização não autorizada.' USING ERRCODE='42501';
  END IF;
  SELECT c.workspace_id,c.owner_id INTO v_workspace,v_owner
    FROM public.ats_candidates c WHERE c.id=_candidate_id FOR UPDATE;
  IF NOT public.ats_compliance_access(_candidate_id,'delete') THEN
    RAISE EXCEPTION 'Anonimização não autorizada.' USING ERRCODE='42501';
  END IF;
  UPDATE public.ats_candidates SET full_name='[REDACTED]',email=NULL,phone=NULL,
    linkedin_url=NULL,location=NULL,current_position=NULL,current_company=NULL,
    cv_url=NULL,cv_parsed=NULL,notes=NULL,tags=ARRAY[]::text[],
    lgpd_redacted_at=now(),updated_at=now() WHERE id=_candidate_id;
  UPDATE public.ats_candidate_consents SET granted=false,revoked_at=now()
    WHERE candidate_id=_candidate_id AND granted=true AND revoked_at IS NULL;
  INSERT INTO public.access_audit_log(workspace_id,actor_id,action,entity_type,entity_id,details)
    VALUES(v_workspace,v_user,'candidate_anonymized','ats_candidate',_candidate_id,
      jsonb_build_object('authorization','techhire.compliance.delete.workspace','source','anonymize_ats_candidate'));
END;
$fn$;
REVOKE ALL ON FUNCTION public.anonymize_ats_candidate(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.anonymize_ats_candidate(uuid) TO authenticated, service_role;


NOTIFY pgrst,'reload schema';
