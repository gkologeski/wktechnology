
ALTER TABLE public.ats_interviews
  ADD COLUMN IF NOT EXISTS transcript text,
  ADD COLUMN IF NOT EXISTS ai_summary text,
  ADD COLUMN IF NOT EXISTS ai_strengths jsonb,
  ADD COLUMN IF NOT EXISTS ai_concerns jsonb,
  ADD COLUMN IF NOT EXISTS ai_followups jsonb,
  ADD COLUMN IF NOT EXISTS ai_recommendation text,
  ADD COLUMN IF NOT EXISTS ai_score numeric,
  ADD COLUMN IF NOT EXISTS ai_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS ai_model text;
