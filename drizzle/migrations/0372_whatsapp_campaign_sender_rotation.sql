ALTER TABLE public.whatsapp_campaigns
  ADD COLUMN IF NOT EXISTS sender_rotation text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS sender_rotation_mode text NOT NULL DEFAULT 'sequential';
ALTER TABLE public.whatsapp_campaigns
  ADD CONSTRAINT whatsapp_campaigns_sender_rotation_mode_chk CHECK (sender_rotation_mode IN ('sequential','random')),
  ADD CONSTRAINT whatsapp_campaigns_sender_rotation_len_chk CHECK (coalesce(array_length(sender_rotation,1),0) <= 4);
ALTER TABLE public.whatsapp_campaign_recipients
  ADD COLUMN IF NOT EXISTS sender_phone_number_id text;
COMMENT ON COLUMN public.whatsapp_campaigns.sender_rotation IS 'Números adicionais (phone_number_id) do rodízio; principal em sender_phone_number_id';
COMMENT ON COLUMN public.whatsapp_campaign_recipients.sender_phone_number_id IS 'Número fixado no primeiro envio (ROTACAO-NUMEROS)';