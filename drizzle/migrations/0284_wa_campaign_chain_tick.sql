-- Encadeamento do disparo espaçado das campanhas WhatsApp.
-- Ao terminar uma rodada com contatos pendentes e próximo envio próximo, o
-- servidor pede ao banco que acorde a próxima rodada da MESMA campanha. O
-- endereço e as credenciais são exatamente os da tarefa agendada
-- 'whatsapp-campaign-tick' (nenhum segredo trafega pelo app). Só service_role
-- executa; o lease wa_campaign_claim_dispatch continua impedindo rodadas
-- simultâneas.
CREATE OR REPLACE FUNCTION public.wa_campaign_chain_tick(
  p_campaign uuid,
  p_hop integer,
  p_timeout_ms integer
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_command text;
  v_url text;
  v_headers jsonb;
  v_id bigint;
BEGIN
  IF p_campaign IS NULL OR p_hop IS NULL OR p_hop < 1 OR p_hop > 1000 THEN
    RAISE EXCEPTION 'Encadeamento inválido.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.whatsapp_campaigns
     WHERE id = p_campaign AND status = 'running'
  ) THEN
    RETURN NULL;
  END IF;

  SELECT command INTO v_command
    FROM cron.job
   WHERE jobname = 'whatsapp-campaign-tick' AND active
   LIMIT 1;
  IF v_command IS NULL THEN
    RETURN NULL;
  END IF;

  v_url := substring(v_command from 'url:=''([^'']+)''');
  v_headers := substring(v_command from 'headers:=''(\{[^'']*\})''::jsonb')::jsonb;
  IF v_url IS NULL
     OR v_url !~ '^https://[^/]+/api/public/hooks/whatsapp-campaign-tick$'
     OR v_headers IS NULL
     OR NOT (v_headers ? 'Authorization') THEN
    RETURN NULL;
  END IF;

  SELECT net.http_post(
    url := v_url,
    body := jsonb_build_object('campaignId', p_campaign, 'hop', p_hop),
    headers := v_headers,
    timeout_milliseconds := greatest(5000, least(coalesce(p_timeout_ms, 45000), 60000))
  ) INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.wa_campaign_chain_tick(uuid, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.wa_campaign_chain_tick(uuid, integer, integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wa_campaign_chain_tick(uuid, integer, integer) TO service_role;

COMMENT ON FUNCTION public.wa_campaign_chain_tick(uuid, integer, integer) IS
  'Acorda a próxima rodada do disparo espaçado de UMA campanha em execução, usando o endereço e as credenciais da tarefa agendada whatsapp-campaign-tick. Somente service_role. Limite de 1000 encadeamentos por cadeia; a tarefa agendada reinicia a cadeia.';