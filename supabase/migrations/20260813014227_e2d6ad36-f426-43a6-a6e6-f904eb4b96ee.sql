ALTER TABLE public.survey_templates DROP CONSTRAINT IF EXISTS survey_templates_kind_check;
ALTER TABLE public.survey_templates ADD CONSTRAINT survey_templates_kind_check CHECK (kind = ANY (ARRAY['csat'::text, 'nps'::text, 'form'::text]));
ALTER TABLE public.survey_templates ALTER COLUMN question DROP NOT NULL;