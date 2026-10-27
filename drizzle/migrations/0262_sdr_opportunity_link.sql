-- CRM links and canonical enrollment are changed together after current source/record authorization.
CREATE FUNCTION public.sdr_link_opportunity(p_enrollment uuid,p_deal uuid,p_contact uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE e public.sdr_enrollments;refs jsonb;
BEGIN
 SELECT * INTO e FROM public.sdr_enrollments WHERE id=p_enrollment FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.deals WHERE id=p_deal AND workspace_id=e.workspace_id)
 OR (p_contact IS NOT NULL AND (p_contact IS DISTINCT FROM e.contact_id OR NOT EXISTS(SELECT 1 FROM public.contacts WHERE id=p_contact AND workspace_id=e.workspace_id))) THEN
 RAISE EXCEPTION 'Vínculo comercial indisponível.' USING ERRCODE='42501';END IF;
 refs:=jsonb_build_array(jsonb_build_object('table','deals','id',p_deal,'action',CASE WHEN p_contact IS NULL THEN 'view' ELSE 'update' END));
 IF p_contact IS NOT NULL THEN refs:=refs||jsonb_build_array(jsonb_build_object('table','contacts','id',p_contact,'action','view'));END IF;
 IF NOT public.sales_worker_authorize('sdr_enrollments',e.id,refs) THEN RAISE EXCEPTION 'Sem permissão atual para vincular o negócio.' USING ERRCODE='42501';END IF;
 IF p_contact IS NOT NULL THEN INSERT INTO public.deal_contacts(deal_id,contact_id) VALUES(p_deal,p_contact) ON CONFLICT DO NOTHING;END IF;
 UPDATE public.sdr_enrollments SET deal_id=p_deal WHERE id=e.id AND workspace_id=e.workspace_id;
END $$;
REVOKE ALL ON FUNCTION public.sdr_link_opportunity(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sdr_link_opportunity(uuid,uuid,uuid) TO service_role;
