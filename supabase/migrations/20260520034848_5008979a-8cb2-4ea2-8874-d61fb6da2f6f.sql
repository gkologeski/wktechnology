ALTER TABLE public.forms
  ADD COLUMN IF NOT EXISTS display_mode TEXT NOT NULL DEFAULT 'inline',
  ADD COLUMN IF NOT EXISTS popup_config JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.forms DROP CONSTRAINT IF EXISTS forms_display_mode_check;
ALTER TABLE public.forms ADD CONSTRAINT forms_display_mode_check
  CHECK (display_mode IN ('inline','popup','slidein'));