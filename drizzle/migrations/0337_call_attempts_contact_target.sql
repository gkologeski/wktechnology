ALTER TABLE public.prospecting_call_attempts
  ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS prospecting_call_attempts_contact_id_idx
  ON public.prospecting_call_attempts (campaign_id, contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS prospecting_call_attempts_contact_recent_idx
  ON public.prospecting_call_attempts (workspace_id, created_at) WHERE contact_id IS NOT NULL;
ALTER TABLE public.prospecting_call_attempts
  ADD CONSTRAINT prospecting_call_attempts_single_target
  CHECK (lead_id IS NULL OR contact_id IS NULL) NOT VALID;