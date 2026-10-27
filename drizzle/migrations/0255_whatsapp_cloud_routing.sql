ALTER TABLE public.wa_cloud_connections ADD COLUMN webhook_received_at timestamptz;
ALTER TABLE public.whatsapp_campaigns ADD COLUMN sender_phone_number_id text;
ALTER TABLE public.whatsapp_campaigns ADD COLUMN consent_evidence text;
ALTER TABLE public.whatsapp_campaigns ADD CONSTRAINT wa_cloud_campaign_consent CHECK(sender_phone_number_id IS NULL OR (template_name IS NOT NULL AND length(btrim(consent_evidence))>=10 AND consent_evidence IS NOT NULL));
CREATE FUNCTION public.wa_cloud_campaign_sender_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.sender_phone_number_id IS NOT NULL AND NOT EXISTS(
  SELECT 1 FROM wa_cloud_numbers n JOIN wa_cloud_connections c ON c.id=n.connection_id AND c.workspace_id=n.workspace_id
  WHERE n.phone_number_id=NEW.sender_phone_number_id AND n.workspace_id=NEW.workspace_id AND n.available AND c.enabled
    AND c.webhook_verified_at IS NOT NULL AND c.webhook_received_at IS NOT NULL
 ) THEN RAISE EXCEPTION 'Sender unavailable in workspace'; END IF;
 IF TG_OP='UPDATE' AND NEW.sender_phone_number_id IS DISTINCT FROM OLD.sender_phone_number_id AND OLD.status<>'draft'
 THEN RAISE EXCEPTION 'Sender cannot change after campaign starts'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.wa_cloud_campaign_sender_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER wa_cloud_campaign_sender BEFORE INSERT OR UPDATE OF sender_phone_number_id,workspace_id ON public.whatsapp_campaigns
 FOR EACH ROW EXECUTE FUNCTION public.wa_cloud_campaign_sender_guard();
