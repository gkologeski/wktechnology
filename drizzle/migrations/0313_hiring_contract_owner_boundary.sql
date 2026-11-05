-- Correção aditiva: contracts.owner_id referencia auth.users; catálogos IAM usam convenção própria.
CREATE OR REPLACE FUNCTION public.hiring_employment_contract(w uuid,p_engagement uuid,p_contract uuid,p_options jsonb DEFAULT '{}')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE e public.hiring_engagements;c public.contracts;pe public.people;r uuid;monthly numeric;document_body text;document_title text;template_id uuid;BEGIN
 SELECT * INTO e FROM hiring_engagements WHERE id=p_engagement AND workspace_id=w FOR UPDATE;
 IF e.id IS NULL OR e.status<>'active' OR NOT public.hiring_employment_access(w,'techpeople.employment.manage.workspace') OR NOT public.hr_record_access('people','update',e.person_id) OR NOT public.user_has_permission(auth.uid(),w,'techcontracts.contracts.create.workspace') THEN RAISE EXCEPTION 'Sem permissão para contrato do vínculo.' USING ERRCODE='42501';END IF;
 IF e.purpose='client' AND e.commercial_contract_id IS DISTINCT FROM(SELECT hiring_contract_id FROM ats_jobs WHERE id=e.job_id AND workspace_id=w) THEN RAISE EXCEPTION 'A origem comercial mudou; revise o vínculo antes de novas operações.';END IF;
 IF public.hiring_recruitment_reason(w,e.job_id) IS NOT NULL THEN RAISE EXCEPTION '%',public.hiring_recruitment_reason(w,e.job_id);END IF;
 IF e.purchase_contract_id IS NOT NULL THEN RETURN e.purchase_contract_id;END IF;
 SELECT * INTO pe FROM people WHERE id=e.person_id AND workspace_id=w;
 PERFORM set_config('app.hiring_purchase','on',true);
 IF p_contract IS NOT NULL THEN
  SELECT * INTO c FROM contracts WHERE id=p_contract AND workspace_id=w FOR UPDATE;
  IF c.id IS NULL OR NOT public.work_record_access('techcontracts.contracts',c.id,'update') OR c.role::text<>'client' OR c.document_kind<>'main' OR c.contracting_legal_entity_id IS DISTINCT FROM e.legal_entity_id OR(c.hiring_person_id IS NOT NULL AND c.hiring_person_id<>pe.id) THEN RAISE EXCEPTION 'Contrato de compra incompatível com pessoa ou entidade WK.';END IF;
  IF c.counterparty_company_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM companies x WHERE x.id=c.counterparty_company_id AND x.workspace_id=w AND nullif(regexp_replace(to_jsonb(x)->>'cnpj','[^0-9]','','g'),'')=nullif(regexp_replace(pe.cnpj,'[^0-9]','','g'),'')) THEN RAISE EXCEPTION 'CNPJ do prestador não corresponde à contraparte do contrato de compra.';END IF;
  UPDATE contracts SET hiring_person_id=pe.id WHERE id=c.id; r:=c.id;
 ELSE
  IF coalesce(p_options->>'status','draft')<>'draft' THEN RAISE EXCEPTION 'O contrato de contratação nasce em rascunho. Ativação e assinatura usam o fluxo contratual.';END IF;
  monthly:=nullif(p_options->>'monthly_value','')::numeric;IF monthly<0 THEN RAISE EXCEPTION 'Valor mensal inválido.';END IF;
  -- A permissão de criação e os gatilhos shared_field_write_guard existentes protegem os valores configurados do contrato.

  template_id:=nullif(p_options->>'template_id','')::uuid;
  IF template_id IS NOT NULL AND NOT public.work_record_access('techcontracts.contract_templates',template_id,'view') THEN RAISE EXCEPTION 'Modelo contratual indisponível.' USING ERRCODE='42501';END IF;
  document_body:=nullif(p_options->>'body_html','');IF template_id IS NOT NULL AND document_body IS NULL THEN RAISE EXCEPTION 'Renderize o modelo contratual antes de preparar o documento.';END IF;
  document_title:=coalesce(nullif(trim(p_options->>'title'),''),'Compra — '||pe.full_name);
  INSERT INTO contracts(workspace_id,owner_id,assigned_to,role,document_kind,title,status,starts_at,ends_at,contracting_legal_entity_id,hiring_person_id,body_html,monthly_value,metadata)
  VALUES(w,auth.uid(),auth.uid(),'client','main',left(document_title,255),'draft',e.starts_at,e.ends_at,e.legal_entity_id,pe.id,document_body,monthly,jsonb_build_object('person_id',pe.id,'hiring_engagement_id',e.id,'source','hiring_stage4')) RETURNING id INTO r;
 END IF;
 PERFORM set_config('app.hiring_purchase','off',true);
 UPDATE hiring_engagements SET purchase_contract_id=r,revision=revision+1 WHERE id=e.id;
 INSERT INTO hiring_employment_events(workspace_id,engagement_id,actor_id,kind,detail) VALUES(w,e.id,auth.uid(),'purchase_contract_linked',jsonb_build_object('contract_id',r,'existing',p_contract IS NOT NULL));RETURN r;
END $$;


REVOKE ALL ON FUNCTION public.hiring_employment_contract(uuid,uuid,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.hiring_employment_contract(uuid,uuid,uuid,jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';
