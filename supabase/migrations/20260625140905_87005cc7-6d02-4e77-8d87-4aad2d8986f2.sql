
-- ============================================================
-- Fases 2/3/4 ATS — schema base
-- ============================================================

-- 1) Self-scheduling: slots oferecidos + slot escolhido
ALTER TABLE public.ats_interviews
  ADD COLUMN IF NOT EXISTS self_schedule_token text UNIQUE,
  ADD COLUMN IF NOT EXISTS offered_slots jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS self_scheduled_at timestamptz;

-- 2) Ofertas: token público para o candidato aceitar/recusar
ALTER TABLE public.ats_offers
  ADD COLUMN IF NOT EXISTS public_token text UNIQUE,
  ADD COLUMN IF NOT EXISTS viewed_at timestamptz;

-- 3) Match score IA (job ↔ candidate)
CREATE TABLE IF NOT EXISTS public.ats_match_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  job_id uuid NOT NULL REFERENCES public.ats_jobs(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES public.ats_candidates(id) ON DELETE CASCADE,
  application_id uuid REFERENCES public.ats_applications(id) ON DELETE SET NULL,
  score numeric NOT NULL CHECK (score >= 0 AND score <= 100),
  summary text,
  strengths jsonb NOT NULL DEFAULT '[]'::jsonb,
  gaps jsonb NOT NULL DEFAULT '[]'::jsonb,
  model text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, candidate_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ats_match_scores TO authenticated;
GRANT ALL ON public.ats_match_scores TO service_role;
ALTER TABLE public.ats_match_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "match_owner_all" ON public.ats_match_scores
  FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- 4) Fraud / risk flags do candidato (heurísticas e IA)
CREATE TABLE IF NOT EXISTS public.ats_candidate_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  candidate_id uuid NOT NULL REFERENCES public.ats_candidates(id) ON DELETE CASCADE,
  kind text NOT NULL, -- 'duplicate_email', 'duplicate_phone', 'ai_generated_cv', 'suspicious_video', 'manual'
  severity text NOT NULL DEFAULT 'low', -- low | medium | high
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ats_candidate_flags TO authenticated;
GRANT ALL ON public.ats_candidate_flags TO service_role;
ALTER TABLE public.ats_candidate_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "flags_owner_all" ON public.ats_candidate_flags
  FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- 5) DEI: campos opcionais auto-declarados (apenas owner enxerga)
ALTER TABLE public.ats_candidates
  ADD COLUMN IF NOT EXISTS dei_gender text,
  ADD COLUMN IF NOT EXISTS dei_race text,
  ADD COLUMN IF NOT EXISTS dei_disability text,
  ADD COLUMN IF NOT EXISTS dei_lgbtqia text;

-- 6) Backfill tokens públicos onde faltam
UPDATE public.ats_offers
   SET public_token = encode(gen_random_bytes(18), 'hex')
 WHERE public_token IS NULL;

UPDATE public.ats_interviews
   SET self_schedule_token = encode(gen_random_bytes(18), 'hex')
 WHERE self_schedule_token IS NULL AND kind = 'self_schedule';

-- 7) Política pública: leitura de oferta por token (com candidato/vaga via joins server-side)
DROP POLICY IF EXISTS "offers_public_read_by_token" ON public.ats_offers;
CREATE POLICY "offers_public_read_by_token" ON public.ats_offers
  FOR SELECT TO anon USING (public_token IS NOT NULL);
GRANT SELECT ON public.ats_offers TO anon;
