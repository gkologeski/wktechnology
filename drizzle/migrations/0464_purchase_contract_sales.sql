CREATE TABLE public.contract_purchase_sales(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
 purchase_contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
 sale_contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
 created_by uuid,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(purchase_contract_id,sale_contract_id)
);
CREATE INDEX contract_purchase_sales_sale_idx ON public.contract_purchase_sales(sale_contract_id);
GRANT SELECT ON public.contract_purchase_sales TO authenticated;
GRANT ALL ON public.contract_purchase_sales TO service_role;
ALTER TABLE public.contract_purchase_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY contract_purchase_sales_view ON public.contract_purchase_sales FOR SELECT TO authenticated
 USING(public.work_record_access('techcontracts.contracts',purchase_contract_id,'view')
   AND public.work_record_access('techcontracts.contracts',sale_contract_id,'view'));

CREATE OR REPLACE FUNCTION public.contract_purchase_sale_set(p_purchase uuid,p_sale uuid,p_link boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $function$
DECLARE actor uuid:=auth.uid();p contracts;s contracts;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'Sessão obrigatória.' USING ERRCODE='42501';END IF;
 SELECT * INTO p FROM contracts WHERE id=p_purchase FOR UPDATE;
 IF p.id IS NULL OR NOT work_context_access(work_access_context(),p.workspace_id,'techcontracts.contracts','update',ARRAY[p.owner_id,p.assigned_to]) THEN
  RAISE EXCEPTION 'Sem permissão para alterar este contrato.' USING ERRCODE='42501';END IF;
 IF p.role::text<>'client' THEN RAISE EXCEPTION 'Use apenas em contratos de compra.' USING ERRCODE='23514';END IF;
 IF NOT p_link THEN
  DELETE FROM contract_purchase_sales WHERE purchase_contract_id=p.id AND sale_contract_id=p_sale;
  RETURN jsonb_build_object('linked',false);
 END IF;
 SELECT * INTO s FROM contracts WHERE id=p_sale;
 IF s.id IS NULL OR s.workspace_id<>p.workspace_id OR NOT work_context_access(work_access_context(),s.workspace_id,'techcontracts.contracts','view',ARRAY[s.owner_id,s.assigned_to]) THEN
  RAISE EXCEPTION 'Contrato de venda indisponível.' USING ERRCODE='42501';END IF;
 IF s.role::text<>'provider' THEN RAISE EXCEPTION 'Escolha um contrato de venda.' USING ERRCODE='23514';END IF;
 IF s.id=p.parent_contract_id THEN RETURN jsonb_build_object('linked',true,'primary',true);END IF;
 INSERT INTO contract_purchase_sales(workspace_id,purchase_contract_id,sale_contract_id,created_by)
 VALUES(p.workspace_id,p.id,s.id,actor) ON CONFLICT DO NOTHING;
 RETURN jsonb_build_object('linked',true,'primary',false);
END $function$;
REVOKE ALL ON FUNCTION public.contract_purchase_sale_set(uuid,uuid,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contract_purchase_sale_set(uuid,uuid,boolean) TO authenticated;