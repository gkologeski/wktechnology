ALTER TABLE public.prospecting_campaigns
  ADD COLUMN IF NOT EXISTS meeting_assignment_mode text NOT NULL DEFAULT 'unassigned',
  ADD COLUMN IF NOT EXISTS meeting_member_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS meeting_duration_minutes integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS meeting_horizon_days integer NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS meeting_template_name text,
  ADD COLUMN IF NOT EXISTS meeting_template_language text,
  ADD COLUMN IF NOT EXISTS meeting_rr_cursor integer NOT NULL DEFAULT 0;
ALTER TABLE public.prospecting_campaigns
  ADD CONSTRAINT prospecting_campaigns_meeting_mode_chk CHECK (meeting_assignment_mode IN ('auto','member','round_robin','unassigned')),
  ADD CONSTRAINT prospecting_campaigns_meeting_duration_chk CHECK (meeting_duration_minutes BETWEEN 15 AND 120),
  ADD CONSTRAINT prospecting_campaigns_meeting_horizon_chk CHECK (meeting_horizon_days BETWEEN 1 AND 30);
ALTER TABLE public.prospecting_call_attempts
  ADD COLUMN IF NOT EXISTS host_user_id uuid,
  ADD COLUMN IF NOT EXISTS meeting_id uuid;
ALTER TABLE public.prospecting_scripts
  ADD COLUMN IF NOT EXISTS allow_booking boolean NOT NULL DEFAULT false;