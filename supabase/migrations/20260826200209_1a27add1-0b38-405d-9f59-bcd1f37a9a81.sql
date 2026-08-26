ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS meet_link text,
  ADD COLUMN IF NOT EXISTS calendar_sync_error text;