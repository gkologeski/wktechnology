ALTER TABLE public.whatsapp_campaigns
  ADD COLUMN IF NOT EXISTS template_language text;

ALTER TABLE public.whatsapp_campaign_recipients
  ADD COLUMN IF NOT EXISTS wa_message_id text;

COMMENT ON COLUMN public.whatsapp_campaigns.content_sid IS 'Legado Twilio (não utilizado; envio agora é pela API oficial da Meta)';