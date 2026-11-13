ALTER TABLE public.prospecting_campaigns
  ADD COLUMN IF NOT EXISTS recent_contact_days integer NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS recent_contact_scope text NOT NULL DEFAULT 'calls';
ALTER TABLE public.prospecting_campaigns
  ADD CONSTRAINT prospecting_campaigns_recent_days_chk CHECK (recent_contact_days BETWEEN 0 AND 365),
  ADD CONSTRAINT prospecting_campaigns_recent_scope_chk CHECK (recent_contact_scope IN ('calls','calls_whatsapp'));
COMMENT ON COLUMN public.prospecting_campaigns.recent_contact_scope IS 'calls = ignora quem recebeu ligação de outra campanha nos últimos N dias; calls_whatsapp = ligação ou WhatsApp de campanha.';
CREATE INDEX IF NOT EXISTS prospecting_call_attempts_lead_recent_idx
  ON public.prospecting_call_attempts (workspace_id, lead_id, created_at DESC);