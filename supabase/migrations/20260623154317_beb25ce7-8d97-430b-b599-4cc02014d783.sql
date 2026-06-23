ALTER TABLE public.calendar_accounts
  ADD COLUMN IF NOT EXISTS sync_page_token text,
  ADD COLUMN IF NOT EXISTS sync_in_progress boolean NOT NULL DEFAULT false;