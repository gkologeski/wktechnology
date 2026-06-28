
-- ============================================================
-- Onda 5 — Slice 5.3 Referrals 2.0 + Slice 5.5 Silver Medalist
-- ============================================================

-- 1) ats_referral_programs: portal público
ALTER TABLE public.ats_referral_programs
  ADD COLUMN IF NOT EXISTS public_slug text,
  ADD COLUMN IF NOT EXISTS landing_headline text,
  ADD COLUMN IF NOT EXISTS landing_body text,
  ADD COLUMN IF NOT EXISTS enable_public_form boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS ats_referral_programs_public_slug_uniq
  ON public.ats_referral_programs (public_slug)
  WHERE public_slug IS NOT NULL;

-- gerador de slug curto (8 chars base36-ish)
CREATE OR REPLACE FUNCTION public.generate_referral_slug()
RETURNS text
LANGUAGE sql
VOLATILE
SET search_path = public
AS $$
  SELECT lower(substring(replace(gen_random_uuid()::text, '-', ''), 1, 10));
$$;

-- view pública (somente campos seguros) usada pelo portal
CREATE OR REPLACE VIEW public.ats_referral_programs_public AS
SELECT
  id,
  public_slug,
  name,
  landing_headline,
  landing_body,
  terms_url
FROM public.ats_referral_programs
WHERE enable_public_form = true
  AND enabled = true
  AND public_slug IS NOT NULL;

GRANT SELECT ON public.ats_referral_programs_public TO anon;
GRANT SELECT ON public.ats_referral_programs_public TO authenticated;

-- 2) ats_referrals: aceitar submissões externas (sem user logado)
ALTER TABLE public.ats_referrals
  ALTER COLUMN referrer_user_id DROP NOT NULL;

ALTER TABLE public.ats_referrals
  ADD COLUMN IF NOT EXISTS referrer_name text,
  ADD COLUMN IF NOT EXISTS referrer_email text,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'internal';

-- 3) Silver Medalist: pool automático ao rejeitar candidato avançado
CREATE OR REPLACE FUNCTION public.ensure_silver_medalist_pool(_owner uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pool_id uuid;
BEGIN
  SELECT id INTO pool_id
  FROM public.ats_talent_pools
  WHERE owner_id = _owner AND system_key = 'silver_medalists'
  LIMIT 1;

  IF pool_id IS NULL THEN
    INSERT INTO public.ats_talent_pools(owner_id, name, description, type, system_key, color, created_by)
    VALUES (_owner, 'Silver Medalists',
            'Candidatos rejeitados em estágios avançados — re-engajar em futuras vagas.',
            'static', 'silver_medalists', '#94a3b8', _owner)
    RETURNING id INTO pool_id;
  END IF;

  RETURN pool_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.ats_handle_silver_medalist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pool_id uuid;
BEGIN
  IF NEW.status = 'rejected'
     AND COALESCE(OLD.status, '') <> 'rejected'
     AND NEW.stage_value IN ('interview', 'onsite', 'offer')
     AND NEW.candidate_id IS NOT NULL THEN
    pool_id := public.ensure_silver_medalist_pool(NEW.owner_id);

    INSERT INTO public.ats_talent_pool_members(pool_id, candidate_id, owner_id, added_by, source)
    VALUES (pool_id, NEW.candidate_id, NEW.owner_id, NEW.owner_id, 'silver_medalist')
    ON CONFLICT (pool_id, candidate_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ats_silver_medalist ON public.ats_applications;
CREATE TRIGGER trg_ats_silver_medalist
  AFTER UPDATE OF status ON public.ats_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.ats_handle_silver_medalist();
