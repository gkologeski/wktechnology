ALTER TABLE public.whatsapp_campaigns ADD COLUMN IF NOT EXISTS recent_contact_days integer NOT NULL DEFAULT 7;
ALTER TABLE public.email_broadcasts ADD COLUMN IF NOT EXISTS recent_contact_days integer NOT NULL DEFAULT 7;
ALTER TABLE public.whatsapp_campaign_recipients ADD COLUMN IF NOT EXISTS override_recent boolean NOT NULL DEFAULT false;
ALTER TABLE public.email_broadcast_recipients ADD COLUMN IF NOT EXISTS override_recent boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS wa_campaign_recipients_ws_sent_idx ON public.whatsapp_campaign_recipients (workspace_id, sent_at) WHERE status = 'sent';
CREATE INDEX IF NOT EXISTS email_broadcast_recipients_ws_sent_idx ON public.email_broadcast_recipients (workspace_id, sent_at) WHERE sent_at IS NOT NULL;
COMMENT ON COLUMN public.whatsapp_campaigns.recent_contact_days IS 'Dias sem reenviar ao mesmo telefone por outra campanha de WhatsApp (0 desliga).';
COMMENT ON COLUMN public.email_broadcasts.recent_contact_days IS 'Dias sem reenviar ao mesmo e-mail por outra campanha de e-mail (0 desliga).';