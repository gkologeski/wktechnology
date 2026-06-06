ALTER TABLE public.prospecting_campaigns
  ADD COLUMN IF NOT EXISTS audience_mode text NOT NULL DEFAULT 'static',
  ADD COLUMN IF NOT EXISTS audience_rules jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.prospecting_campaigns
  DROP CONSTRAINT IF EXISTS prospecting_campaigns_audience_mode_check;
ALTER TABLE public.prospecting_campaigns
  ADD CONSTRAINT prospecting_campaigns_audience_mode_check
  CHECK (audience_mode IN ('static','dynamic'));