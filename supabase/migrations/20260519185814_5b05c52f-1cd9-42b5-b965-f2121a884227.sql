CREATE TYPE quote_status AS ENUM ('draft','sent','accepted','declined','expired');

CREATE TABLE public.quotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  number TEXT NOT NULL,
  title TEXT,
  status quote_status NOT NULL DEFAULT 'draft',
  valid_until DATE,
  currency TEXT NOT NULL DEFAULT 'BRL',
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  notes TEXT,
  terms TEXT,
  public_token TEXT NOT NULL UNIQUE,
  view_count INTEGER NOT NULL DEFAULT 0,
  sent_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,
  signature_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_quotes_owner ON public.quotes(owner_id);
CREATE INDEX idx_quotes_deal ON public.quotes(deal_id);
CREATE INDEX idx_quotes_token ON public.quotes(public_token);

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quotes owner select" ON public.quotes FOR SELECT
  USING (auth.uid() = owner_id OR public.is_workspace_admin(owner_id, auth.uid()));
CREATE POLICY "quotes owner insert" ON public.quotes FOR INSERT
  WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "quotes owner update" ON public.quotes FOR UPDATE
  USING (auth.uid() = owner_id OR public.is_workspace_admin(owner_id, auth.uid()));
CREATE POLICY "quotes owner delete" ON public.quotes FOR DELETE
  USING (auth.uid() = owner_id OR public.is_workspace_admin(owner_id, auth.uid()));

CREATE TRIGGER update_quotes_updated_at
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.quote_line_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  quantity NUMERIC(14,3) NOT NULL DEFAULT 1,
  unit_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount_pct NUMERIC(6,3) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(6,3) NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_qli_quote ON public.quote_line_items(quote_id);

ALTER TABLE public.quote_line_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qli owner select" ON public.quote_line_items FOR SELECT
  USING (auth.uid() = owner_id OR public.is_workspace_admin(owner_id, auth.uid()));
CREATE POLICY "qli owner insert" ON public.quote_line_items FOR INSERT
  WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "qli owner update" ON public.quote_line_items FOR UPDATE
  USING (auth.uid() = owner_id OR public.is_workspace_admin(owner_id, auth.uid()));
CREATE POLICY "qli owner delete" ON public.quote_line_items FOR DELETE
  USING (auth.uid() = owner_id OR public.is_workspace_admin(owner_id, auth.uid()));
