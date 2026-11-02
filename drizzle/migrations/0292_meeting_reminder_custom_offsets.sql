ALTER TABLE public.meeting_reminder_rules DROP CONSTRAINT meeting_reminder_rules_offset_minutes_check;
ALTER TABLE public.meeting_reminder_rules ADD CONSTRAINT meeting_reminder_rules_offset_minutes_check CHECK (offset_minutes BETWEEN 1 AND 43200);
ALTER TABLE public.meeting_reminder_rules ADD COLUMN IF NOT EXISTS offset_unit text NOT NULL DEFAULT 'minutes';
ALTER TABLE public.meeting_reminder_rules ADD CONSTRAINT meeting_reminder_rules_offset_unit_check CHECK (offset_unit IN ('minutes','hours','days'));
UPDATE public.meeting_reminder_rules SET offset_unit = CASE WHEN offset_minutes % 1440 = 0 THEN 'days' WHEN offset_minutes % 60 = 0 THEN 'hours' ELSE 'minutes' END;