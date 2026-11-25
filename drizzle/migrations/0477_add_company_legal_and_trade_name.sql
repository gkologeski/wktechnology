ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS legal_name text,
  ADD COLUMN IF NOT EXISTS trade_name text;

COMMENT ON COLUMN public.companies.legal_name IS 'Razão social oficial da empresa (CRM).';
COMMENT ON COLUMN public.companies.trade_name IS 'Nome fantasia da empresa (CRM).';

UPDATE public.companies
SET legal_name = NULLIF(BTRIM(custom_fields->>'razao_social'), '')
WHERE legal_name IS NULL
  AND custom_fields ? 'razao_social'
  AND NULLIF(BTRIM(custom_fields->>'razao_social'), '') IS NOT NULL;

CREATE OR REPLACE FUNCTION public.capture_proposal_document_version()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE line_items jsonb; client jsonb; person jsonb; agent_name text;
BEGIN
 IF NEW.status::text<>'sent' OR NOT NEW.locked OR NEW.sent_at IS NULL THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND OLD.locked THEN RETURN NEW; END IF;
 IF NEW.quote_id IS NOT NULL THEN
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',i.id,'name',i.name,'description',i.description,'quantity',i.quantity,'unit_price',i.unit_price,'discount_pct',i.discount_pct,'discount_amount',i.discount_amount,'discount_type',i.discount_type,'tax_rate',i.tax_rate,'unit',i.unit,'billing_model',i.billing_model,'percent',i.percent,'percent_base_amount',i.percent_base_amount,'cadence',i.cadence,'job_profile_id',i.job_profile_id,'seniority',i.seniority,'service_catalog_id',i.service_catalog_id,'contracting_preset_id',i.contracting_preset_id)||jsonb_build_object('service',jsonb_build_object('name',s.name),'preset',jsonb_build_object('name',c.name)) ORDER BY i.position,i.id),'[]') INTO line_items
  FROM quote_line_items i LEFT JOIN service_catalog s ON s.id=i.service_catalog_id AND s.workspace_id=NEW.workspace_id LEFT JOIN contracting_presets c ON c.id=i.contracting_preset_id AND c.workspace_id=NEW.workspace_id WHERE i.quote_id=NEW.quote_id AND i.workspace_id=NEW.workspace_id;
 ELSE line_items:='[]'; END IF;
 IF jsonb_array_length(line_items)=0 AND NEW.deal_id IS NOT NULL THEN
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',i.id,'name',i.name,'description',i.description,'quantity',i.quantity,'unit_price',i.unit_price,'discount_pct',i.discount_pct,'discount_amount',i.discount_amount,'discount_type',i.discount_type,'tax_rate',i.tax_rate,'unit',i.unit,'billing_model',i.billing_model,'percent',i.percent,'percent_base_amount',i.percent_base_amount,'cadence',i.cadence,'job_profile_id',i.job_profile_id,'seniority',i.seniority,'service_catalog_id',i.service_catalog_id,'contracting_preset_id',i.contracting_preset_id)||jsonb_build_object('service',jsonb_build_object('name',s.name),'preset',jsonb_build_object('name',c.name)) ORDER BY i.position,i.id),'[]') INTO line_items
  FROM deal_line_items i LEFT JOIN service_catalog s ON s.id=i.service_catalog_id AND s.workspace_id=NEW.workspace_id LEFT JOIN contracting_presets c ON c.id=i.contracting_preset_id AND c.workspace_id=NEW.workspace_id WHERE i.deal_id=NEW.deal_id AND i.workspace_id=NEW.workspace_id;
 END IF;
 SELECT jsonb_build_object('id',id,'name',name,'legal_name',legal_name,'trade_name',trade_name,'cnpj',cnpj,'address',address,'city',city,'state',state) INTO client FROM companies WHERE id=NEW.company_id AND workspace_id=NEW.workspace_id;
 SELECT jsonb_build_object('first_name',first_name,'last_name',last_name,'email',email) INTO person FROM contacts WHERE id=NEW.contact_id AND workspace_id=NEW.workspace_id;
 SELECT full_name INTO agent_name FROM profiles WHERE id=NEW.owner_id;
 INSERT INTO proposal_document_versions(proposal_id,version,workspace_id,document)
 VALUES(NEW.id,NEW.version,NEW.workspace_id,jsonb_build_object('proposal',jsonb_build_object('id',NEW.id,'title',NEW.title,'body',NEW.body,'design_json',NEW.design_json,'version',NEW.version,'total_amount',NEW.total_amount,'currency',NEW.currency,'deal_id',NEW.deal_id,'quote_id',NEW.quote_id,'company_id',NEW.company_id,'assigned_to',NEW.assigned_to),'items',line_items,'company',client,'contact',person,'agent',agent_name));
 RETURN NEW;
END $function$;