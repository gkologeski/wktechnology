ALTER TABLE public.calendar_events ALTER COLUMN calendar_account_id DROP NOT NULL;
ALTER TABLE public.calendar_events DROP CONSTRAINT calendar_events_calendar_account_id_fkey;
ALTER TABLE public.calendar_events
  ADD CONSTRAINT calendar_events_calendar_account_id_fkey
  FOREIGN KEY (calendar_account_id) REFERENCES public.calendar_accounts(id) ON DELETE SET NULL;