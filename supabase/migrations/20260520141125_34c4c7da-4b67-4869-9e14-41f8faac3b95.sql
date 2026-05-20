CREATE OR REPLACE FUNCTION public.recompute_deal_amount()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_deal UUID;
  v_total NUMERIC(14,2);
BEGIN
  v_deal := COALESCE(NEW.deal_id, OLD.deal_id);
  SELECT COALESCE(SUM(
    quantity * unit_price * (1 - discount_pct/100.0) * (1 + tax_rate/100.0)
  ), 0)::NUMERIC(14,2)
  INTO v_total
  FROM public.deal_line_items
  WHERE deal_id = v_deal;
  UPDATE public.deals SET value = v_total WHERE id = v_deal;
  RETURN NULL;
END;
$function$;