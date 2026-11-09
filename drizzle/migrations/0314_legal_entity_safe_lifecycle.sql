CREATE OR REPLACE FUNCTION public._legal_entity_usage_counts(_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_strip_nulls(jsonb_build_object(
    'Lançamentos financeiros', NULLIF((SELECT count(*) FROM public.financial_entries WHERE legal_entity_id=_id),0),
    'Faturas', NULLIF((SELECT count(*) FROM public.customer_invoices WHERE legal_entity_id=_id),0),
    'NFS-e', NULLIF((SELECT count(*) FROM public.nfse_invoices WHERE legal_entity_id=_id),0),
    'Contas bancárias', NULLIF((SELECT count(*) FROM public.financial_bank_accounts WHERE legal_entity_id=_id),0),
    'Categorias', NULLIF((SELECT count(*) FROM public.financial_categories WHERE legal_entity_id=_id),0),
    'Centros de custo', NULLIF((SELECT count(*) FROM public.financial_cost_centers WHERE legal_entity_id=_id),0),
    'Contratações', NULLIF((SELECT count(*) FROM public.hiring_engagements WHERE legal_entity_id=_id),0),
    'Provisões mensais', NULLIF((SELECT count(*) FROM public.hiring_monthly_provisions WHERE legal_entity_id=_id),0),
    'Grupos de empresas', NULLIF((SELECT count(*) FROM public.legal_entity_group_members WHERE legal_entity_id=_id),0)
  ))
$$;
REVOKE ALL ON FUNCTION public._legal_entity_usage_counts(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._legal_entity_usage_counts(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.legal_entity_usage(_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM public.legal_entities le JOIN public.workspace_members wm
      ON wm.workspace_id = le.workspace_id AND wm.user_id = auth.uid() AND wm.status = 'active'
    WHERE le.id = _id) THEN public._legal_entity_usage_counts(_id) ELSE '{}'::jsonb END
$$;
REVOKE ALL ON FUNCTION public.legal_entity_usage(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.legal_entity_usage(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.legal_entities_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_default THEN RAISE EXCEPTION 'Defina outra empresa como padrão antes de excluir esta.'; END IF;
    u := public._legal_entity_usage_counts(OLD.id);
    IF u IS NOT NULL AND u <> '{}'::jsonb THEN
      RAISE EXCEPTION 'Não é possível excluir: existem registros vinculados. Desative a empresa em vez de excluir.';
    END IF;
    RETURN OLD;
  END IF;
  IF NEW.active = false AND NEW.is_default THEN
    RAISE EXCEPTION 'Defina outra empresa como padrão antes de desativar esta.';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_legal_entities_guard ON public.legal_entities;
CREATE TRIGGER trg_legal_entities_guard BEFORE DELETE OR UPDATE OF active, is_default ON public.legal_entities
FOR EACH ROW EXECUTE FUNCTION public.legal_entities_guard();

CREATE OR REPLACE FUNCTION public.financial_entries_active_entity_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.legal_entity_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.legal_entity_id IS DISTINCT FROM OLD.legal_entity_id)
     AND EXISTS (SELECT 1 FROM public.legal_entities WHERE id = NEW.legal_entity_id AND active = false) THEN
    RAISE EXCEPTION 'A empresa (CNPJ) selecionada está inativa. Reative-a ou escolha outra.';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_fin_entries_active_entity ON public.financial_entries;
CREATE TRIGGER trg_fin_entries_active_entity BEFORE INSERT OR UPDATE OF legal_entity_id ON public.financial_entries
FOR EACH ROW EXECUTE FUNCTION public.financial_entries_active_entity_guard();