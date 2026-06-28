
-- Candidate-level DSAR requests
CREATE TABLE public.ats_dsar_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  candidate_id UUID NOT NULL REFERENCES public.ats_candidates(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL CHECK (request_type IN ('export','erasure','rectification','access')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','rejected')),
  subject_email TEXT,
  notes TEXT,
  requested_by UUID,
  processed_by UUID,
  processed_at TIMESTAMPTZ,
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ats_dsar_requests TO authenticated;
GRANT ALL ON public.ats_dsar_requests TO service_role;
ALTER TABLE public.ats_dsar_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ats_dsar_owner_all" ON public.ats_dsar_requests
  FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE INDEX ats_dsar_owner_status_idx ON public.ats_dsar_requests(owner_id, status, created_at DESC);
CREATE INDEX ats_dsar_candidate_idx ON public.ats_dsar_requests(candidate_id);
CREATE TRIGGER ats_dsar_updated_at BEFORE UPDATE ON public.ats_dsar_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Candidate consents
CREATE TABLE public.ats_candidate_consents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  candidate_id UUID NOT NULL REFERENCES public.ats_candidates(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL,
  granted BOOLEAN NOT NULL DEFAULT true,
  source TEXT NOT NULL DEFAULT 'manual',
  legal_basis TEXT,
  expires_at TIMESTAMPTZ,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  evidence JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ats_candidate_consents TO authenticated;
GRANT ALL ON public.ats_candidate_consents TO service_role;
ALTER TABLE public.ats_candidate_consents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ats_consents_owner_all" ON public.ats_candidate_consents
  FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE INDEX ats_consents_candidate_idx ON public.ats_candidate_consents(candidate_id, purpose);

-- Retention fields on candidates
ALTER TABLE public.ats_candidates
  ADD COLUMN IF NOT EXISTS retention_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lgpd_redacted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS ats_candidates_retention_idx
  ON public.ats_candidates(owner_id, retention_until)
  WHERE retention_until IS NOT NULL AND lgpd_redacted_at IS NULL;

-- Anonymization function: strips PII but preserves stats / aggregate footprint
CREATE OR REPLACE FUNCTION public.anonymize_ats_candidate(_candidate_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner UUID;
BEGIN
  SELECT owner_id INTO v_owner FROM public.ats_candidates WHERE id = _candidate_id;
  IF v_owner IS NULL THEN RAISE EXCEPTION 'candidate_not_found'; END IF;
  IF v_owner <> auth.uid() THEN RAISE EXCEPTION 'forbidden'; END IF;

  UPDATE public.ats_candidates SET
    full_name = '[REDACTED]',
    email = NULL,
    phone = NULL,
    linkedin_url = NULL,
    location = NULL,
    current_position = NULL,
    current_company = NULL,
    cv_url = NULL,
    cv_parsed = NULL,
    notes = NULL,
    tags = ARRAY[]::TEXT[],
    lgpd_redacted_at = now(),
    updated_at = now()
  WHERE id = _candidate_id;

  -- Revoke active consents
  UPDATE public.ats_candidate_consents
  SET granted = false, revoked_at = now()
  WHERE candidate_id = _candidate_id AND granted = true AND revoked_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.anonymize_ats_candidate(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.anonymize_ats_candidate(UUID) TO authenticated;
