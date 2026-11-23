ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS counterparty_kind text NOT NULL DEFAULT 'company',
  ADD COLUMN IF NOT EXISTS counterparty_contact_id uuid REFERENCES public.contacts(id) ON DELETE RESTRICT;
ALTER TABLE public.contracts DROP CONSTRAINT IF EXISTS contracts_counterparty_kind_chk;
ALTER TABLE public.contracts ADD CONSTRAINT contracts_counterparty_kind_chk CHECK (counterparty_kind IN ('company','person'));
CREATE INDEX IF NOT EXISTS contracts_counterparty_contact_idx ON public.contracts(counterparty_contact_id) WHERE counterparty_contact_id IS NOT NULL;
COMMENT ON COLUMN public.contracts.counterparty_kind IS 'company = contraparte PJ (counterparty_company_id); person = profissional PF (counterparty_contact_id).';

CREATE OR REPLACE FUNCTION public.contract_counterparty_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public','pg_temp' AS $$
DECLARE c record;
BEGIN
 IF NEW.counterparty_contact_id IS NULL THEN
  IF NEW.counterparty_kind='person' AND NEW.counterparty_company_id IS NOT NULL THEN
   RAISE EXCEPTION 'Contraparte pessoa física não usa empresa; informe o contato.' USING ERRCODE='23514';END IF;
  RETURN NEW;
 END IF;
 SELECT id,workspace_id,company_id INTO c FROM public.contacts WHERE id=NEW.counterparty_contact_id;
 IF c.id IS NULL OR c.workspace_id IS DISTINCT FROM NEW.workspace_id THEN
  RAISE EXCEPTION 'Contato da contraparte não encontrado neste workspace.' USING ERRCODE='42501';END IF;
 IF NEW.counterparty_kind='company' AND NEW.counterparty_company_id IS NOT NULL AND c.company_id IS DISTINCT FROM NEW.counterparty_company_id THEN
  RAISE EXCEPTION 'O contato precisa pertencer à empresa da contraparte.' USING ERRCODE='23514';END IF;
 IF NEW.counterparty_kind='person' AND NEW.counterparty_company_id IS NOT NULL THEN
  RAISE EXCEPTION 'Contraparte pessoa física não usa empresa; informe o contato.' USING ERRCODE='23514';END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS contract_counterparty_guard ON public.contracts;
CREATE TRIGGER contract_counterparty_guard BEFORE INSERT OR UPDATE OF counterparty_kind,counterparty_contact_id,counterparty_company_id,workspace_id
 ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.contract_counterparty_guard();

CREATE OR REPLACE FUNCTION public.contract_accepted_proposal_guard()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE s jsonb;previous jsonb;
BEGIN
 IF current_user IN('postgres','supabase_admin','service_role') AND pg_trigger_depth()>1 THEN
  IF NOT EXISTS(SELECT 1 FROM public.workspaces WHERE id=NEW.workspace_id) THEN RETURN NEW;END IF;
 END IF;
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
 IF s->>'workspace_id' IS DISTINCT FROM NEW.workspace_id::text OR s->'proposal'->>'deal_id' IS DISTINCT FROM NEW.deal_id::text OR s->'proposal'->>'quote_id' IS DISTINCT FROM NEW.quote_id::text THEN
  RAISE EXCEPTION 'Proposta Comercial e contrato devem ter a mesma origem.' USING ERRCODE='42501';END IF;
 -- Venda (provider): contraparte = cliente da proposta. Compra (client): a proposta
 -- aceita da venda é o anexo técnico e a contraparte é o fornecedor (PJ ou PF).
 IF NEW.role::text='provider' AND s->'proposal'->>'company_id' IS DISTINCT FROM NEW.counterparty_company_id::text THEN
  RAISE EXCEPTION 'Proposta Comercial e contrato devem ter a mesma origem e empresa.' USING ERRCODE='42501';END IF;
 NEW.metadata:=coalesce(NEW.metadata,'{}')||jsonb_build_object('accepted_proposal',s);
 RETURN NEW;
END $function$;