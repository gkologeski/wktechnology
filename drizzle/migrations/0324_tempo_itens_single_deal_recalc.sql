-- TEMPO-ITENS: three triggers recalculated deals.value per line-item write with
-- different formulas (two ignored discount by amount), causing up to three
-- deal updates (each firing ~19 deal triggers) per edit. Keep only the
-- complete formula (recompute_deal_value).
DROP TRIGGER IF EXISTS dli_recompute_amount ON public.deal_line_items;
DROP TRIGGER IF EXISTS trg_deal_line_items_recalc_value ON public.deal_line_items;
COMMENT ON FUNCTION public.recompute_deal_amount() IS 'DEPRECATED: replaced by deal_line_items_sync_deal_value/recompute_deal_value';
COMMENT ON FUNCTION public.trg_deal_line_items_recalc_value() IS 'DEPRECATED: replaced by deal_line_items_sync_deal_value/recompute_deal_value';