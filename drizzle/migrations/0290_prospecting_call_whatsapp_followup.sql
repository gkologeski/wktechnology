ALTER TABLE public.prospecting_campaigns
  ADD COLUMN IF NOT EXISTS followup_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS followup_sender_phone_number_id text,
  ADD COLUMN IF NOT EXISTS followup_template_name text,
  ADD COLUMN IF NOT EXISTS followup_template_language text NOT NULL DEFAULT 'pt_BR',
  ADD COLUMN IF NOT EXISTS followup_answered_text text;

ALTER TABLE public.prospecting_call_attempts
  ADD COLUMN IF NOT EXISTS followup_campaign_id uuid,
  ADD COLUMN IF NOT EXISTS followup_status text,
  ADD COLUMN IF NOT EXISTS followup_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS followup_error text;

CREATE INDEX IF NOT EXISTS prospecting_call_attempts_followup_campaign_idx
  ON public.prospecting_call_attempts (followup_campaign_id) WHERE followup_campaign_id IS NOT NULL;

COMMENT ON COLUMN public.prospecting_call_attempts.followup_campaign_id IS 'Campanha cuja configuração de WhatsApp pós-ligação vale para ligações de teste (sem entrar na fila).';