ALTER TABLE public.prospecting_qualifications
  ADD COLUMN IF NOT EXISTS questionnaire_points numeric,
  ADD COLUMN IF NOT EXISTS icp_points numeric,
  ADD COLUMN IF NOT EXISTS total_score numeric;

COMMENT ON COLUMN public.prospecting_qualifications.questionnaire_points IS 'Pontos do questionário normalizados (0-50) na nota unificada do lead.';
COMMENT ON COLUMN public.prospecting_qualifications.icp_points IS 'Pontos de aderência ao ICP normalizados (0-35) na nota unificada do lead.';
COMMENT ON COLUMN public.prospecting_qualifications.total_score IS 'Nota unificada do lead (0-85) = questionnaire_points + icp_points.';