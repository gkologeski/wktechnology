ALTER TABLE public.project_time_entries
  ADD CONSTRAINT project_time_entries_hours_check_v2
  CHECK (hours > 0 OR (source = 'import' AND hours >= 0)) NOT VALID;
ALTER TABLE public.project_time_entries VALIDATE CONSTRAINT project_time_entries_hours_check_v2;
ALTER TABLE public.project_time_entries DROP CONSTRAINT project_time_entries_hours_check;