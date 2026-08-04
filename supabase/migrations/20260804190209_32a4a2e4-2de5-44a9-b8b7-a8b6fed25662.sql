ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS remind_before_minutes integer,
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS activities_reminder_due_idx
  ON public.activities (due_date)
  WHERE remind_before_minutes IS NOT NULL AND reminder_sent_at IS NULL;

ALTER TABLE public.email_accounts
  ADD COLUMN IF NOT EXISTS signature_html text;