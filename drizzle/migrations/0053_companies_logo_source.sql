ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS logo_source text NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS logo_updated_at timestamptz;
ALTER TABLE public.companies DROP CONSTRAINT IF EXISTS companies_logo_source_chk;
ALTER TABLE public.companies ADD CONSTRAINT companies_logo_source_chk CHECK (logo_source IN ('manual','auto','none'));
ALTER TABLE public.companies DROP CONSTRAINT IF EXISTS companies_logo_url_len_chk;
ALTER TABLE public.companies ADD CONSTRAINT companies_logo_url_len_chk CHECK (logo_url IS NULL OR length(logo_url) <= 120000);
COMMENT ON COLUMN public.companies.logo_source IS 'manual = logotipo enviado; auto = por domínio/site; none = sempre iniciais.';