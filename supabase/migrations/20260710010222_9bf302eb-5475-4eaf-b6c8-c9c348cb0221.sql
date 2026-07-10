ALTER TABLE public.quote_line_items
  ADD COLUMN IF NOT EXISTS discount_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_type text NOT NULL DEFAULT 'pct' CHECK (discount_type IN ('pct','amount'));