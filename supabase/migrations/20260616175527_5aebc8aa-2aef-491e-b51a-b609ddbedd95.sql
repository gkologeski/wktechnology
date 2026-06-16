ALTER TABLE public.bug_reports
  ADD COLUMN IF NOT EXISTS user_resolution_confirmed boolean,
  ADD COLUMN IF NOT EXISTS user_resolution_feedback text,
  ADD COLUMN IF NOT EXISTS user_resolution_at timestamptz;