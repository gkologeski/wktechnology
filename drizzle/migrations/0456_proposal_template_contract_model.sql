-- Reusable model association only: never creates a proposal or a contract.
ALTER TABLE public.contract_templates ADD CONSTRAINT contract_templates_workspace_id_id_key UNIQUE(workspace_id,id);
ALTER TABLE public.proposal_templates ADD COLUMN contract_template_id uuid;
ALTER TABLE public.proposal_templates ADD CONSTRAINT proposal_templates_contract_template_fkey
 FOREIGN KEY(workspace_id,contract_template_id) REFERENCES public.contract_templates(workspace_id,id) ON DELETE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

-- Invoker visibility checks apply the caller's existing contract-template RLS.
CREATE FUNCTION public.proposal_template_contract_model_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.contract_template_id IS NOT NULL AND
   (TG_OP='INSERT' OR NEW.contract_template_id IS DISTINCT FROM OLD.contract_template_id) THEN
  IF NOT EXISTS(SELECT 1 FROM public.contract_templates t WHERE t.id=NEW.contract_template_id
    AND t.workspace_id=NEW.workspace_id AND t.status='published') THEN
   RAISE EXCEPTION 'Modelo de contrato publicado indisponível neste workspace.' USING ERRCODE='42501';
  END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.proposal_template_contract_model_guard() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER proposal_template_contract_model_guard BEFORE INSERT OR UPDATE ON public.proposal_templates
 FOR EACH ROW EXECUTE FUNCTION public.proposal_template_contract_model_guard();
NOTIFY pgrst,'reload schema';
