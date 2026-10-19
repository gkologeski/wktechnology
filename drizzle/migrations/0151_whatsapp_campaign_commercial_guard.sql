ALTER TABLE public.whatsapp_campaigns
  ADD COLUMN IF NOT EXISTS exclude_customers boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS exclude_open_deals boolean NOT NULL DEFAULT true;
ALTER TABLE public.whatsapp_campaign_recipients
  ADD COLUMN IF NOT EXISTS override_commercial boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.whatsapp_campaigns.exclude_customers IS 'Não envia a quem já é cliente (negócio ganho ou contrato ativo).';
COMMENT ON COLUMN public.whatsapp_campaigns.exclude_open_deals IS 'Não envia a quem tem negócio em aberto.';
COMMENT ON COLUMN public.whatsapp_campaign_recipients.override_commercial IS 'Liberação manual do bloqueio de cliente/negociação.';