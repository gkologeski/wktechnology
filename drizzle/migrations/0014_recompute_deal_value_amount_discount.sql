CREATE OR REPLACE FUNCTION public.recompute_deal_value(_deal_id uuid)
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
    (
      (COALESCE(quantity,0) * COALESCE(unit_price,0))
      - LEAST(
          GREATEST(
            CASE WHEN COALESCE(discount_type,'pct') = 'amount'
              THEN COALESCE(discount_amount,0)
              ELSE (COALESCE(quantity,0) * COALESCE(unit_price,0)) * COALESCE(discount_pct,0) / 100.0
            END,
          0),
          COALESCE(quantity,0) * COALESCE(unit_price,0)
        )
    ) * (1 + COALESCE(tax_rate,0) / 100.0)
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