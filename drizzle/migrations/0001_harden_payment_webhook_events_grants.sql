-- payment_webhook_events é gravada/lida apenas pelo servidor (service_role).
-- Remove o grant residual de leitura para anon/authenticated: a tabela mantém
-- RLS habilitada sem políticas, portanto nenhum acesso de cliente é esperado.
REVOKE ALL ON TABLE public.payment_webhook_events FROM anon;
REVOKE ALL ON TABLE public.payment_webhook_events FROM authenticated;
GRANT ALL ON TABLE public.payment_webhook_events TO service_role;