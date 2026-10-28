-- contacts usa grants por coluna; a coluna audience (0256) ficou sem grant e
-- quebrava a listagem de Contatos e a criação de contatos somente financeiros.
GRANT SELECT (audience), INSERT (audience) ON TABLE public.contacts TO authenticated;