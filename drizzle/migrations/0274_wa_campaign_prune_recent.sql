CREATE INDEX IF NOT EXISTS wa_campaign_recipients_ws_phone_sent_idx
  ON public.whatsapp_campaign_recipients (workspace_id, phone, sent_at) WHERE status = 'sent';

CREATE OR REPLACE FUNCTION public.wa_phone_recent_key(p text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN regexp_replace(coalesce(p,''), '\D', '', 'g') ~ '^55\d{2}9?\d{8}$'
      THEN '+55' || substr(regexp_replace(p, '\D', '', 'g'), 3, 2) || right(regexp_replace(p, '\D', '', 'g'), 8)
    ELSE '+' || regexp_replace(coalesce(p,''), '\D', '', 'g')
  END
$$;

-- Marca de uma vez como ignorados os pendentes que receberam WhatsApp de outra
-- campanha dentro do período da campanha. SECURITY INVOKER: RLS do usuário vale.
CREATE OR REPLACE FUNCTION public.wa_campaign_prune_recent(p_campaign_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_ws uuid; v_days int; v_n int;
BEGIN
  SELECT workspace_id, coalesce(recent_contact_days, 0) INTO v_ws, v_days
    FROM whatsapp_campaigns WHERE id = p_campaign_id;
  IF v_ws IS NULL THEN RAISE EXCEPTION 'Campanha não encontrada.'; END IF;
  IF auth.uid() IS NOT NULL AND NOT public.is_workspace_member(v_ws, auth.uid()) THEN
    RAISE EXCEPTION 'Sem acesso a esta campanha.';
  END IF;
  IF v_days <= 0 THEN RETURN 0; END IF;
  WITH sent AS (
    SELECT DISTINCT public.wa_phone_recent_key(s.phone) k
      FROM whatsapp_campaign_recipients s
     WHERE s.workspace_id = v_ws AND s.status = 'sent'
       AND s.campaign_id <> p_campaign_id
       AND s.sent_at >= now() - make_interval(days => v_days)
  )
  UPDATE whatsapp_campaign_recipients r
     SET status = 'skipped', error = 'Envio recente'
    FROM sent
   WHERE r.campaign_id = p_campaign_id AND r.status = 'pending'
     AND coalesce(r.override_recent, false) = false
     AND public.wa_phone_recent_key(r.phone) = sent.k;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END $$;

REVOKE ALL ON FUNCTION public.wa_campaign_prune_recent(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wa_campaign_prune_recent(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.wa_phone_recent_key(text) TO authenticated, service_role;