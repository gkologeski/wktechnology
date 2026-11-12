-- EMPRESA-PROPOSTA: empresa emissora (CNPJ) de um negócio que o usuário pode ver.
-- A leitura de negócios passa por uma visão protegida sem essa coluna.
CREATE OR REPLACE FUNCTION public.deal_legal_entity_for_proposal(_deal_id uuid)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE e uuid;
BEGIN
  IF NOT public.sales_record_access('deals', _deal_id, 'view') THEN
    RAISE EXCEPTION 'Sem permissão para ver este negócio.' USING ERRCODE='42501';
  END IF;
  SELECT d.legal_entity_id INTO e FROM public.deals d WHERE d.id=_deal_id;
  RETURN e;
END $$;
REVOKE ALL ON FUNCTION public.deal_legal_entity_for_proposal(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.deal_legal_entity_for_proposal(uuid) TO authenticated, service_role;