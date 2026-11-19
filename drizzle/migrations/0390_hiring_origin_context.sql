-- Read-only origin preview uses the existing non-BYPASSRLS writer so that its
-- narrow reference-column privileges do not become direct browser grants.
GRANT CREATE ON SCHEMA public TO techerp_request_writer;
CREATE FUNCTION public.hiring_preparation_origin_context(w uuid,k text,s text,i uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE title text; entity uuid; origin_deal uuid; origin_contract uuid;
 entity_name text; entity_cnpj text; entity_active boolean;
BEGIN
 IF i IS NULL OR s NOT IN('project','deal','commercial_contract') OR NOT public.hiring_preparation_access(w,k,'view') THEN
  RAISE EXCEPTION 'Sem permissão para conferir a origem.' USING ERRCODE='42501';
 END IF;
 IF s='project' THEN
  SELECT name,legal_entity_id,deal_id,contract_id INTO title,entity,origin_deal,origin_contract
   FROM public.projects WHERE id=i AND workspace_id=w;
 ELSIF s='deal' THEN
  SELECT name,legal_entity_id,id INTO title,entity,origin_deal FROM public.deals WHERE id=i AND workspace_id=w AND deleted_at IS NULL;
 ELSE
  SELECT c.title,coalesce(c.contracting_legal_entity_id,c.legal_entity_id),c.deal_id,c.id INTO title,entity,origin_deal,origin_contract
   FROM public.contracts c WHERE c.id=i AND c.workspace_id=w AND c.role::text='provider';
 END IF;
 IF NOT FOUND THEN RAISE EXCEPTION 'Origem indisponível para consulta.' USING ERRCODE='42501'; END IF;
 SELECT name,cnpj,active INTO entity_name,entity_cnpj,entity_active FROM public.legal_entities WHERE id=entity AND workspace_id=w;
 RETURN jsonb_build_object('source',s,'id',i,'title',title,'legal_entity_id',entity,'legal_entity_name',entity_name,
  'cnpj',entity_cnpj,'active',entity_active,'deal_id',origin_deal,'contract_id',origin_contract);
END $$;
ALTER FUNCTION public.hiring_preparation_origin_context(uuid,text,text,uuid) OWNER TO techerp_request_writer;
REVOKE ALL ON FUNCTION public.hiring_preparation_origin_context(uuid,text,text,uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.hiring_preparation_origin_context(uuid,text,text,uuid) TO authenticated;
REVOKE CREATE ON SCHEMA public FROM techerp_request_writer;
