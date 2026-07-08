ALTER TABLE public.deal_line_items
  ADD COLUMN IF NOT EXISTS discount_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_type text NOT NULL DEFAULT 'pct';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'deal_line_items_discount_type_check'
  ) THEN
    ALTER TABLE public.deal_line_items
      ADD CONSTRAINT deal_line_items_discount_type_check
      CHECK (discount_type IN ('pct','amount'));
  END IF;
END $$;