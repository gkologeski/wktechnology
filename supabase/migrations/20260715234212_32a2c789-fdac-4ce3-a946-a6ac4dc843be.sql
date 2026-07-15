
REVOKE ALL ON FUNCTION public.recompute_deal_value(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.deal_line_items_sync_deal_value() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recompute_deal_value(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.deal_line_items_sync_deal_value() TO service_role, authenticated;
