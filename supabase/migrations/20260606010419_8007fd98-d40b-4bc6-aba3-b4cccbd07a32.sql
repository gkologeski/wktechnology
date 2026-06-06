ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS payment_link_url TEXT,
  ADD COLUMN IF NOT EXISTS payment_session_id TEXT,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_quotes_payment_session_id
  ON public.quotes (payment_session_id)
  WHERE payment_session_id IS NOT NULL;