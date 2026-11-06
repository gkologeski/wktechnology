ALTER TABLE public.whatsapp_campaigns
  ADD COLUMN IF NOT EXISTS template_rotation jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS rotation_mode text NOT NULL DEFAULT 'sequential';
ALTER TABLE public.whatsapp_campaigns
  ADD CONSTRAINT whatsapp_campaigns_rotation_mode_chk CHECK (rotation_mode IN ('sequential','weighted'));
ALTER TABLE public.whatsapp_campaign_recipients
  ADD COLUMN IF NOT EXISTS template_name text,
  ADD COLUMN IF NOT EXISTS template_language text;
COMMENT ON COLUMN public.whatsapp_campaigns.template_rotation IS 'Modelos adicionais em rodízio [{name,language,body,variableCount,weight}]; o modelo principal continua em template_name.';
COMMENT ON COLUMN public.whatsapp_campaign_recipients.template_name IS 'Modelo fixado para o destinatário no primeiro envio (rodízio).';