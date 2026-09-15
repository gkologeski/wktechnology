-- O valor do negócio passa a respeitar a forma de cobrança do item:
-- valor fixo, percentual de uma base, ou quantidade x valor unitário.
CREATE OR REPLACE FUNCTION public.recompute_deal_value(_deal_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sum numeric;
  v_current numeric;
BEGIN
  IF _deal_id IS NULL THEN RETURN; END IF;

  WITH gross AS (
    SELECT
      CASE
        WHEN billing_model = 'fixed' THEN COALESCE(unit_price, 0)
        WHEN billing_model = 'percent_of_base'
          THEN COALESCE(quantity, 0) * COALESCE(percent_base_amount, 0) * COALESCE(percent, 0) / 100.0
        ELSE COALESCE(quantity, 0) * COALESCE(unit_price, 0)
      END AS g,
      COALESCE(discount_type, 'pct') AS dtype,
      COALESCE(discount_amount, 0) AS damount,
      COALESCE(discount_pct, 0) AS dpct,
      COALESCE(tax_rate, 0) AS tax
    FROM public.deal_line_items
    WHERE deal_id = _deal_id
  )
  SELECT COALESCE(SUM(
    (g - LEAST(GREATEST(
        CASE WHEN dtype = 'amount' THEN damount ELSE g * dpct / 100.0 END, 0), g))
    * (1 + tax / 100.0)
  ), NULL)
  INTO v_sum
  FROM gross;

  -- Sem itens: preserva valor manual
  IF v_sum IS NULL THEN RETURN; END IF;

  SELECT value INTO v_current FROM public.deals WHERE id = _deal_id;

  IF v_current IS DISTINCT FROM v_sum THEN
    UPDATE public.deals SET value = v_sum WHERE id = _deal_id;
  END IF;
END;
$function$;