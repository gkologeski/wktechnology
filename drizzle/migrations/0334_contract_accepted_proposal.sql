-- Freeze the customer-facing specifications when the proposal is sent.
-- Existing published proposals deliberately have no reconstructed historical snapshot.
CREATE TABLE public.proposal_document_versions (
 proposal_id uuid NOT NULL REFERENCES public.proposals(id) ON DELETE RESTRICT,
 version integer NOT NULL,
 workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
 document jsonb NOT NULL,
 captured_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(proposal_id,version)
);
ALTER TABLE public.proposal_document_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.proposal_document_versions FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.proposal_document_versions TO authenticated,service_role;
CREATE POLICY proposal_document_version_read ON public.proposal_document_versions FOR SELECT TO authenticated
 USING (EXISTS(SELECT 1 FROM public.proposals p WHERE p.id=proposal_id AND p.version=proposal_document_versions.version AND p.workspace_id=proposal_document_versions.workspace_id));

CREATE OR REPLACE FUNCTION public.capture_proposal_document_version()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE line_items jsonb;client jsonb;person jsonb;agent_name text;
BEGIN
 IF NEW.status::text<>'sent' OR NOT NEW.locked OR NEW.sent_at IS NULL THEN RETURN NEW;END IF;
 IF TG_OP='UPDATE' AND OLD.locked THEN RETURN NEW;END IF;
 IF NEW.quote_id IS NOT NULL THEN
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',i.id,'name',i.name,'description',i.description,'quantity',i.quantity,'unit_price',i.unit_price,'discount_pct',i.discount_pct,'discount_amount',i.discount_amount,'discount_type',i.discount_type,'tax_rate',i.tax_rate,'unit',i.unit,'billing_model',i.billing_model,'percent',i.percent,'percent_base_amount',i.percent_base_amount,'cadence',i.cadence,'job_profile_id',i.job_profile_id,'seniority',i.seniority,'service_catalog_id',i.service_catalog_id,'contracting_preset_id',i.contracting_preset_id)||jsonb_build_object('service',jsonb_build_object('name',s.name),'preset',jsonb_build_object('name',c.name)) ORDER BY i.position,i.id),'[]') INTO line_items
  FROM quote_line_items i LEFT JOIN service_catalog s ON s.id=i.service_catalog_id AND s.workspace_id=NEW.workspace_id LEFT JOIN contracting_presets c ON c.id=i.contracting_preset_id AND c.workspace_id=NEW.workspace_id WHERE i.quote_id=NEW.quote_id AND i.workspace_id=NEW.workspace_id;
 ELSE line_items:='[]';END IF;
 IF jsonb_array_length(line_items)=0 AND NEW.deal_id IS NOT NULL THEN
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',i.id,'name',i.name,'description',i.description,'quantity',i.quantity,'unit_price',i.unit_price,'discount_pct',i.discount_pct,'discount_amount',i.discount_amount,'discount_type',i.discount_type,'tax_rate',i.tax_rate,'unit',i.unit,'billing_model',i.billing_model,'percent',i.percent,'percent_base_amount',i.percent_base_amount,'cadence',i.cadence,'job_profile_id',i.job_profile_id,'seniority',i.seniority,'service_catalog_id',i.service_catalog_id,'contracting_preset_id',i.contracting_preset_id)||jsonb_build_object('service',jsonb_build_object('name',s.name),'preset',jsonb_build_object('name',c.name)) ORDER BY i.position,i.id),'[]') INTO line_items
  FROM deal_line_items i LEFT JOIN service_catalog s ON s.id=i.service_catalog_id AND s.workspace_id=NEW.workspace_id LEFT JOIN contracting_presets c ON c.id=i.contracting_preset_id AND c.workspace_id=NEW.workspace_id WHERE i.deal_id=NEW.deal_id AND i.workspace_id=NEW.workspace_id;
 END IF;
 SELECT jsonb_build_object('id',id,'name',name,'cnpj',cnpj,'address',address,'city',city,'state',state) INTO client FROM companies WHERE id=NEW.company_id AND workspace_id=NEW.workspace_id;
 SELECT jsonb_build_object('first_name',first_name,'last_name',last_name,'email',email,'phone',phone) INTO person FROM contacts WHERE id=NEW.contact_id AND workspace_id=NEW.workspace_id;
 SELECT full_name INTO agent_name FROM profiles WHERE id=NEW.owner_id;
 INSERT INTO proposal_document_versions(proposal_id,version,workspace_id,document)
 VALUES(NEW.id,NEW.version,NEW.workspace_id,jsonb_build_object('proposal',jsonb_build_object('id',NEW.id,'title',NEW.title,'body',NEW.body,'version',NEW.version,'total_amount',NEW.total_amount,'currency',NEW.currency,'deal_id',NEW.deal_id,'quote_id',NEW.quote_id,'company_id',NEW.company_id,'assigned_to',NEW.assigned_to),'items',line_items,'company',client,'contact',person,'agent',agent_name));
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.capture_proposal_document_version() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER capture_proposal_document_version AFTER INSERT OR UPDATE ON public.proposals FOR EACH ROW EXECUTE FUNCTION public.capture_proposal_document_version();

-- Invoker preserves proposal RLS, active membership, explicit deny and tenant scope.
CREATE OR REPLACE FUNCTION public.proposal_contract_source(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE p public.proposals;s jsonb;
BEGIN
 SELECT * INTO p FROM proposals WHERE id=p_id;
 IF p.id IS NULL OR p.status::text<>'accepted' OR NOT p.locked OR p.decided_at IS NULL THEN
  RAISE EXCEPTION 'Selecione uma Proposta Comercial aceita pelo cliente.' USING ERRCODE='42501';END IF;
 SELECT document INTO s FROM proposal_document_versions WHERE proposal_id=p.id AND version=p.version AND workspace_id=p.workspace_id;
 IF s IS NULL THEN RAISE EXCEPTION 'Proposta sem versão preservada. Gere uma nova proposta e obtenha novo aceite; não é possível reconstruir o histórico.' USING ERRCODE='23514';END IF;
 RETURN s||jsonb_build_object('workspace_id',p.workspace_id,'decided_at',p.decided_at);
END $$;
REVOKE ALL ON FUNCTION public.proposal_contract_source(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.proposal_contract_source(uuid) TO authenticated;

-- All writers, including direct REST/RPC, bind the same immutable accepted version.
CREATE OR REPLACE FUNCTION public.contract_accepted_proposal_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE s jsonb;previous jsonb;
BEGIN
 IF TG_OP='UPDATE' THEN
  previous:=OLD.metadata->'accepted_proposal';
  IF previous IS NOT NULL THEN
   IF (NEW.proposal_id,NEW.quote_id,NEW.counterparty_company_id,NEW.deal_id,NEW.metadata->'accepted_proposal') IS DISTINCT FROM (OLD.proposal_id,OLD.quote_id,OLD.counterparty_company_id,OLD.deal_id,previous) THEN
    RAISE EXCEPTION 'A versão aceita vinculada ao contrato é imutável.' USING ERRCODE='23514';END IF;
   RETURN NEW;
  END IF;
  IF NEW.proposal_id IS NOT DISTINCT FROM OLD.proposal_id THEN
   IF NEW.metadata->'accepted_proposal' IS DISTINCT FROM OLD.metadata->'accepted_proposal' THEN RAISE EXCEPTION 'Vínculo de aceite protegido.' USING ERRCODE='42501';END IF;
   RETURN NEW;
  END IF;
  IF OLD.status::text<>'draft' THEN RAISE EXCEPTION 'Vincule a Proposta Comercial em um contrato em rascunho.' USING ERRCODE='23514';END IF;
 END IF;
 IF NEW.proposal_id IS NULL THEN
  IF NEW.metadata ? 'accepted_proposal' THEN RAISE EXCEPTION 'Informe a Proposta Comercial.' USING ERRCODE='23514';END IF;
  RETURN NEW;
 END IF;
 IF NEW.metadata IS NOT NULL AND jsonb_typeof(NEW.metadata)<>'object' THEN RAISE EXCEPTION 'Metadados do vínculo inválidos.' USING ERRCODE='23514';END IF;
 s:=proposal_contract_source(NEW.proposal_id);
 IF s->>'workspace_id' IS DISTINCT FROM NEW.workspace_id::text OR s->'proposal'->>'company_id' IS DISTINCT FROM NEW.counterparty_company_id::text OR s->'proposal'->>'deal_id' IS DISTINCT FROM NEW.deal_id::text OR s->'proposal'->>'quote_id' IS DISTINCT FROM NEW.quote_id::text THEN
  RAISE EXCEPTION 'Proposta Comercial e contrato devem ter a mesma origem e empresa.' USING ERRCODE='42501';END IF;
 NEW.metadata:=coalesce(NEW.metadata,'{}')||jsonb_build_object('accepted_proposal',s);
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.contract_accepted_proposal_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER contract_accepted_proposal_guard BEFORE INSERT OR UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.contract_accepted_proposal_guard();

-- Used by the internal/public/PDF loader after its normal identity/token check.
CREATE OR REPLACE FUNCTION public.proposal_document_snapshot(p_id uuid,p_version integer)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
 SELECT document FROM proposal_document_versions WHERE proposal_id=p_id AND version=p_version;
$$;
REVOKE ALL ON FUNCTION public.proposal_document_snapshot(uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.proposal_document_snapshot(uuid,integer) TO authenticated,service_role;
