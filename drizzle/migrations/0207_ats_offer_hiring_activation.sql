-- Activate only after the 0206-aware server/frontend is deployed.
DO $$ DECLARE p record;BEGIN
 FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='ats_offers' AND policyname NOT LIKE 'view_as_ro_%' LOOP EXECUTE format('DROP POLICY %I ON public.ats_offers',p.policyname);END LOOP;
END $$;
-- Ordinary metadata remains queryable; private columns use the caller-bound RPC.
CREATE POLICY offer_select ON public.ats_offers FOR SELECT TO authenticated USING(public.ats_offer_action_access(to_jsonb(ats_offers),'view'));
CREATE POLICY offer_insert ON public.ats_offers FOR INSERT TO authenticated WITH CHECK(owner_id=auth.uid() AND public.ats_offer_action_access(to_jsonb(ats_offers),'create') AND public.ats_offer_action_access(to_jsonb(ats_offers),'terms_update'));
CREATE POLICY offer_update ON public.ats_offers FOR UPDATE TO authenticated USING(public.ats_offer_action_access(to_jsonb(ats_offers),'update')) WITH CHECK(public.ats_offer_action_access(to_jsonb(ats_offers),'update'));
CREATE POLICY offer_delete ON public.ats_offers FOR DELETE TO authenticated USING(public.ats_offer_action_access(to_jsonb(ats_offers),'delete'));
CREATE TRIGGER zzzz_ats_offer_guard BEFORE INSERT OR UPDATE OR DELETE ON public.ats_offers FOR EACH ROW EXECUTE FUNCTION public.ats_offer_guard();
CREATE UNIQUE INDEX ats_offer_one_signing_document ON public.ats_offers(esign_document_id) WHERE esign_document_id IS NOT NULL;
CREATE TRIGGER zzzz_ats_offer_document_guard BEFORE INSERT OR UPDATE OR DELETE ON public.esign_documents FOR EACH ROW EXECUTE FUNCTION public.ats_offer_document_guard();
CREATE TRIGGER zzzz_ats_offer_document_guard BEFORE INSERT OR UPDATE OR DELETE ON public.esign_signers FOR EACH ROW EXECUTE FUNCTION public.ats_offer_document_guard();
CREATE TRIGGER zzzz_ats_offer_document_guard BEFORE INSERT OR UPDATE OR DELETE ON public.esign_audit FOR EACH ROW EXECUTE FUNCTION public.ats_offer_document_guard();
CREATE POLICY offer_document_read ON public.esign_documents AS RESTRICTIVE FOR SELECT TO authenticated USING(public.ats_offer_document_access(id,'view'));
CREATE POLICY offer_signer_read ON public.esign_signers AS RESTRICTIVE FOR SELECT TO authenticated USING(public.ats_offer_document_access(document_id,'write'));
CREATE POLICY offer_audit_read ON public.esign_audit AS RESTRICTIVE FOR SELECT TO authenticated USING(public.ats_offer_document_access(document_id,'view'));
-- Staff must never receive the candidate's bearer token from a raw table read.
DO $$ DECLARE cols text;all_cols text;BEGIN
 SELECT string_agg(format('%I',attname),','),string_agg(format('%I',attname),',') FILTER(WHERE attname NOT IN('public_token','body','salary_amount','salary_currency','approval_note')) INTO all_cols,cols FROM pg_attribute WHERE attrelid='public.ats_offers'::regclass AND attnum>0 AND NOT attisdropped;
 REVOKE SELECT ON public.ats_offers FROM PUBLIC,anon,authenticated;
 EXECUTE format('REVOKE SELECT(%s) ON public.ats_offers FROM PUBLIC,anon,authenticated',all_cols);
 EXECUTE format('GRANT SELECT(%s) ON public.ats_offers TO authenticated',cols);
END $$;
-- A primary-key rewrite must not detach the hiring audit or its approval.
CREATE OR REPLACE FUNCTION public.ats_hiring_identity_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.id IS DISTINCT FROM OLD.id THEN RAISE EXCEPTION 'Identificador da candidatura é imutável.' USING ERRCODE='42501';END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.ats_hiring_identity_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER zzzz_ats_hiring_identity_guard BEFORE UPDATE ON public.ats_applications FOR EACH ROW EXECUTE FUNCTION public.ats_hiring_identity_guard();
CREATE TRIGGER zzzz_ats_hiring_guard BEFORE INSERT OR UPDATE OR DELETE ON public.ats_applications FOR EACH ROW EXECUTE FUNCTION public.ats_hiring_guard();
DO $$ DECLARE cols text;all_cols text;BEGIN
 SELECT string_agg(format('%I',attname),','),string_agg(format('%I',attname),',') FILTER(WHERE attname<>'hiring_details') INTO all_cols,cols FROM pg_attribute WHERE attrelid='public.ats_applications'::regclass AND attnum>0 AND NOT attisdropped;
 REVOKE SELECT ON public.ats_applications FROM PUBLIC,anon,authenticated;
 EXECUTE format('REVOKE SELECT(%s) ON public.ats_applications FROM PUBLIC,anon,authenticated',all_cols);
 EXECUTE format('GRANT SELECT(%s) ON public.ats_applications TO authenticated',cols);
END $$;
NOTIFY pgrst,'reload schema';
