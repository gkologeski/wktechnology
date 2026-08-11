ALTER TABLE public.prospecting_questionnaires
  ADD COLUMN IF NOT EXISTS field_layout jsonb NOT NULL DEFAULT '[]'::jsonb;