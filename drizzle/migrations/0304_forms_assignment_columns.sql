ALTER TABLE public.forms
  ADD COLUMN IF NOT EXISTS assignment_mode text NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS assignment_member_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS assignment_cursor integer NOT NULL DEFAULT 0;
ALTER TABLE public.forms ADD CONSTRAINT forms_assignment_mode_chk CHECK (assignment_mode IN ('auto','member','round_robin'));