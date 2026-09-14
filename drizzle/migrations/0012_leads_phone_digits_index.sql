ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS phone_digits TEXT
  GENERATED ALWAYS AS (NULLIF(regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g'), '')) STORED;

CREATE INDEX IF NOT EXISTS idx_leads_workspace_phone_digits
  ON public.leads (workspace_id, phone_digits)
  WHERE deleted_at IS NULL AND phone_digits IS NOT NULL;