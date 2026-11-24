CREATE OR REPLACE FUNCTION public.hiring_contract_signature_context(p_ws uuid, p_contract uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c public.contracts;
BEGIN
 IF NOT public.hiring_signature_access(p_ws,p_contract,'view') THEN RAISE EXCEPTION 'Sem acesso à evidência do contrato.' USING ERRCODE='42501';END IF;
 SELECT * INTO c FROM public.contracts WHERE id=p_contract AND workspace_id=p_ws;
 RETURN jsonb_build_object('witnesses_detected',upper(regexp_replace(c.body_html,'<[^>]*>',' ','g')) ~ 'TESTEMUNHA', 'hash',public.hiring_contract_fingerprint(c.id),'reason',public.hiring_contract_signature_reason(c.id,p_ws,c.deal_id),'deal_id',c.deal_id,
 'entity_id',c.contracting_legal_entity_id,'entities',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'name',name,'cnpj',cnpj) ORDER BY name) FROM public.legal_entities WHERE workspace_id=p_ws AND active),'[]'),'can_manage',public.hiring_signature_access(p_ws,c.id,'manage'),'commercial_source',EXISTS(SELECT 1 FROM public.hiring_commercial_contracts WHERE contract_id=c.id AND workspace_id=p_ws),
 'is_purchase',c.role='client',
 'evidence',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'kind',kind,'document_id',document_id,'current_version',contract_hash=public.hiring_contract_fingerprint(c.id),'recorded_at',recorded_at,'signed_on',signed_on,'reference',reference,'note',note,'revoked_at',revoked_at,'revocation_reason',revocation_reason) ORDER BY recorded_at DESC) FROM public.hiring_contract_evidence WHERE contract_id=c.id AND workspace_id=p_ws),'[]'));
END $$;
NOTIFY pgrst, 'reload schema';