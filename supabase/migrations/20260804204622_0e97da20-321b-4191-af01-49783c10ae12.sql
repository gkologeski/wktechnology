-- A coluna signature_html foi adicionada sem grant de leitura para o papel authenticated,
-- o que fazia a listagem de contas de e-mail falhar (tela aparecia vazia).
GRANT SELECT (signature_html) ON public.email_accounts TO authenticated;
GRANT UPDATE (signature_html) ON public.email_accounts TO authenticated;

-- Garante que tokens continuem inacessíveis ao papel authenticated.
REVOKE SELECT (access_token, refresh_token) ON public.email_accounts FROM authenticated;