ALTER TABLE public.sdr_workspace_settings
  ADD COLUMN IF NOT EXISTS template_interval_min_s integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS template_interval_max_s integer NOT NULL DEFAULT 0;
ALTER TABLE public.sdr_workspace_settings
  ADD CONSTRAINT sdr_ws_template_interval_chk
  CHECK (template_interval_min_s >= 0 AND template_interval_min_s <= template_interval_max_s AND template_interval_max_s <= 3600);

ALTER TABLE public.whatsapp_campaigns
  ADD COLUMN IF NOT EXISTS send_interval_min_s integer,
  ADD COLUMN IF NOT EXISTS send_interval_max_s integer,
  ADD COLUMN IF NOT EXISTS next_send_at timestamptz,
  ADD COLUMN IF NOT EXISTS dispatch_lease_until timestamptz;
ALTER TABLE public.whatsapp_campaigns
  ADD CONSTRAINT wa_campaign_interval_chk
  CHECK (
    (send_interval_min_s IS NULL AND send_interval_max_s IS NULL)
    OR (send_interval_min_s >= 0 AND send_interval_min_s <= send_interval_max_s AND send_interval_max_s <= 3600)
  );

-- Lease curto por campanha: duas execuções nunca disparam a mesma campanha juntas.
CREATE OR REPLACE FUNCTION public.wa_campaign_claim_dispatch(p_campaign uuid, p_seconds integer)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH c AS (
    UPDATE public.whatsapp_campaigns
       SET dispatch_lease_until = now() + make_interval(secs => greatest(5, least(p_seconds, 300)))
     WHERE id = p_campaign
       AND (dispatch_lease_until IS NULL OR dispatch_lease_until < now())
    RETURNING 1
  ) SELECT EXISTS (SELECT 1 FROM c);
$$;
REVOKE ALL ON FUNCTION public.wa_campaign_claim_dispatch(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wa_campaign_claim_dispatch(uuid, integer) TO service_role;