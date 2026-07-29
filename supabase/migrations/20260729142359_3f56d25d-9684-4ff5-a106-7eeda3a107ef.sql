-- Evolui as tabelas de prospecção para suportar dados reais do Apollo.io
-- e auditar queries enviadas à fonte.

ALTER TABLE public.prospecting_searches
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'apollo',
  ADD COLUMN IF NOT EXISTS apollo_query jsonb NULL;

ALTER TABLE public.prospecting_results
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'apollo',
  ADD COLUMN IF NOT EXISTS external_id text NULL,
  ADD COLUMN IF NOT EXISTS linkedin_url text NULL,
  ADD COLUMN IF NOT EXISTS phone text NULL,
  ADD COLUMN IF NOT EXISTS email text NULL,
  ADD COLUMN IF NOT EXISTS company_domain text NULL,
  ADD COLUMN IF NOT EXISTS company_size text NULL,
  ADD COLUMN IF NOT EXISTS industry text NULL,
  ADD COLUMN IF NOT EXISTS apollo_score numeric NULL,
  ADD COLUMN IF NOT EXISTS raw_payload jsonb NULL;

-- Índices para consultas comuns
CREATE INDEX IF NOT EXISTS idx_prospecting_results_external_id
  ON public.prospecting_results (external_id);

CREATE INDEX IF NOT EXISTS idx_prospecting_results_source
  ON public.prospecting_results (source);

-- Garante que source seja controlado e evite valores arbitrários
ALTER TABLE public.prospecting_searches
  DROP CONSTRAINT IF EXISTS prospecting_searches_source_check,
  ADD CONSTRAINT prospecting_searches_source_check
    CHECK (source IN ('apollo', 'manual', 'import'));

ALTER TABLE public.prospecting_results
  DROP CONSTRAINT IF EXISTS prospecting_results_source_check,
  ADD CONSTRAINT prospecting_results_source_check
    CHECK (source IN ('apollo', 'manual', 'import'));
