
CREATE OR REPLACE FUNCTION public.recompute_deal_value(_deal_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_total numeric;
  item_count integer;
BEGIN
  IF _deal_id IS NULL THEN RETURN; END IF;

  SELECT
    COUNT(*),
    COALESCE(SUM(
      GREATEST(
        (COALESCE(quantity,0) * COALESCE(unit_price,0))
        - CASE
            WHEN COALESCE(discount_type,'pct') = 'amount'
              THEN LEAST(
                COALESCE(discount_amount,0) * COALESCE(quantity,0),
                COALESCE(quantity,0) * COALESCE(unit_price,0)
              )
            ELSE (COALESCE(quantity,0) * COALESCE(unit_price,0)) * (COALESCE(discount_pct,0) / 100.0)
          END
      , 0)
      * (1 + COALESCE(tax_rate,0) / 100.0)
    ), 0)
  INTO item_count, new_total
  FROM public.deal_line_items
  WHERE deal_id = _deal_id;

  IF item_count > 0 THEN
    UPDATE public.deals SET value = new_total WHERE id = _deal_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.deal_line_items_sync_deal_value()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_deal_value(OLD.deal_id);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' AND NEW.deal_id IS DISTINCT FROM OLD.deal_id THEN
    PERFORM public.recompute_deal_value(OLD.deal_id);
    PERFORM public.recompute_deal_value(NEW.deal_id);
    RETURN NEW;
  ELSE
    PERFORM public.recompute_deal_value(NEW.deal_id);
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_deal_line_items_sync_deal_value ON public.deal_line_items;
CREATE TRIGGER trg_deal_line_items_sync_deal_value
AFTER INSERT OR UPDATE OR DELETE ON public.deal_line_items
FOR EACH ROW EXECUTE FUNCTION public.deal_line_items_sync_deal_value();

COMMENT ON COLUMN public.deals.value IS 'Auto-sincronizado com a soma líquida de deal_line_items quando houver itens; caso contrário, editável manualmente.';

-- Backfill: recalcula valor de todos os deals que já têm itens
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT DISTINCT deal_id FROM public.deal_line_items WHERE deal_id IS NOT NULL LOOP
    PERFORM public.recompute_deal_value(r.deal_id);
  END LOOP;
END $$;
