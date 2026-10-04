ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS logo_url text;
COMMENT ON COLUMN public.companies.logo_url IS 'Logotipo manual; tem prioridade sobre o logotipo automático por domínio.';