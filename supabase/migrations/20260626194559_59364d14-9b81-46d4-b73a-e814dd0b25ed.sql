CREATE OR REPLACE FUNCTION public.recalc_deal_value(_deal_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sum numeric;
  v_current numeric;
BEGIN
  IF _deal_id IS NULL THEN RETURN; END IF;

  SELECT COALESCE(SUM(
    COALESCE(quantity,0)
    * COALESCE(unit_price,0)
    * (1 - COALESCE(discount_pct,0) / 100.0)
    * (1 + COALESCE(tax_rate,0) / 100.0)
  ), NULL)
  INTO v_sum
  FROM public.deal_line_items
  WHERE deal_id = _deal_id;

  -- Sem itens: preserva valor manual
  IF v_sum IS NULL THEN RETURN; END IF;

  SELECT value INTO v_current FROM public.deals WHERE id = _deal_id;

  IF v_current IS DISTINCT FROM v_sum THEN
    UPDATE public.deals SET value = v_sum WHERE id = _deal_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalc_deal_value(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.trg_deal_line_items_recalc_value()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_deal_value(OLD.deal_id);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.recalc_deal_value(NEW.deal_id);
    IF NEW.deal_id IS DISTINCT FROM OLD.deal_id THEN
      PERFORM public.recalc_deal_value(OLD.deal_id);
    END IF;
    RETURN NEW;
  ELSE
    PERFORM public.recalc_deal_value(NEW.deal_id);
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_deal_line_items_recalc_value ON public.deal_line_items;
CREATE TRIGGER trg_deal_line_items_recalc_value
AFTER INSERT OR UPDATE OR DELETE ON public.deal_line_items
FOR EACH ROW EXECUTE FUNCTION public.trg_deal_line_items_recalc_value();

-- Backfill
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT DISTINCT deal_id FROM public.deal_line_items WHERE deal_id IS NOT NULL LOOP
    PERFORM public.recalc_deal_value(r.deal_id);
  END LOOP;
END $$;