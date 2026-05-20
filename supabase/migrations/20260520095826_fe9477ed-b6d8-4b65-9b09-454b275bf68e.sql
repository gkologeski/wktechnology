
ALTER TABLE public.custom_properties
  ADD COLUMN IF NOT EXISTS ai_prompt text;
