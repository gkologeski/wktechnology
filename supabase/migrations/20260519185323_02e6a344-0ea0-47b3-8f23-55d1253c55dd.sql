CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  sku TEXT,
  description TEXT,
  unit_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  tax_rate NUMERIC(6,3) NOT NULL DEFAULT 0,
  unit TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_products_owner ON public.products(owner_id);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products owner select" ON public.products FOR SELECT
  USING (auth.uid() = owner_id OR public.is_workspace_admin(auth.uid(), owner_id));
CREATE POLICY "products owner insert" ON public.products FOR INSERT
  WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "products owner update" ON public.products FOR UPDATE
  USING (auth.uid() = owner_id OR public.is_workspace_admin(auth.uid(), owner_id));
CREATE POLICY "products owner delete" ON public.products FOR DELETE
  USING (auth.uid() = owner_id OR public.is_workspace_admin(auth.uid(), owner_id));
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.deal_line_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  quantity NUMERIC(14,3) NOT NULL DEFAULT 1,
  unit_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount_pct NUMERIC(6,3) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(6,3) NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_dli_deal ON public.deal_line_items(deal_id);
CREATE INDEX idx_dli_owner ON public.deal_line_items(owner_id);
ALTER TABLE public.deal_line_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dli owner select" ON public.deal_line_items FOR SELECT
  USING (auth.uid() = owner_id OR public.is_workspace_admin(auth.uid(), owner_id));
CREATE POLICY "dli owner insert" ON public.deal_line_items FOR INSERT
  WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "dli owner update" ON public.deal_line_items FOR UPDATE
  USING (auth.uid() = owner_id OR public.is_workspace_admin(auth.uid(), owner_id));
CREATE POLICY "dli owner delete" ON public.deal_line_items FOR DELETE
  USING (auth.uid() = owner_id OR public.is_workspace_admin(auth.uid(), owner_id));
CREATE TRIGGER update_dli_updated_at
  BEFORE UPDATE ON public.deal_line_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.recompute_deal_amount()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  UPDATE public.deals SET amount = v_total WHERE id = v_deal;
  RETURN NULL;
END;
$$;

CREATE TRIGGER dli_recompute_amount
  AFTER INSERT OR UPDATE OR DELETE ON public.deal_line_items
  FOR EACH ROW EXECUTE FUNCTION public.recompute_deal_amount();
