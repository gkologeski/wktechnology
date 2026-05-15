
-- Enums
CREATE TYPE public.integration_status AS ENUM ('connected', 'pending', 'error', 'disconnected');
CREATE TYPE public.job_kind AS ENUM ('import', 'enrich', 'export', 'sync');
CREATE TYPE public.job_status AS ENUM ('queued', 'running', 'done', 'failed', 'partial');
CREATE TYPE public.job_entity AS ENUM ('lead', 'contact', 'company', 'deal');

-- integrations
CREATE TABLE public.integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  provider TEXT NOT NULL,
  status public.integration_status NOT NULL DEFAULT 'pending',
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  credentials_secret_ref TEXT,
  oauth_tokens JSONB,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, provider)
);

ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY integrations_owner_all ON public.integrations
  FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TRIGGER integrations_set_updated_at BEFORE UPDATE ON public.integrations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- enrichment_jobs
CREATE TABLE public.enrichment_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  integration_id UUID REFERENCES public.integrations(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  kind public.job_kind NOT NULL,
  entity public.job_entity,
  scope JSONB NOT NULL DEFAULT '{}'::jsonb,
  status public.job_status NOT NULL DEFAULT 'queued',
  total INT NOT NULL DEFAULT 0,
  processed INT NOT NULL DEFAULT 0,
  succeeded INT NOT NULL DEFAULT 0,
  failed INT NOT NULL DEFAULT 0,
  credits_used INT NOT NULL DEFAULT 0,
  error TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.enrichment_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY enrichment_jobs_owner_all ON public.enrichment_jobs
  FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE INDEX enrichment_jobs_owner_created ON public.enrichment_jobs (owner_id, created_at DESC);
CREATE TRIGGER enrichment_jobs_set_updated_at BEFORE UPDATE ON public.enrichment_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- enrichment_job_items
CREATE TABLE public.enrichment_job_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.enrichment_jobs(id) ON DELETE CASCADE,
  entity_id UUID,
  status TEXT NOT NULL DEFAULT 'pending',
  before JSONB,
  after JSONB,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.enrichment_job_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY enrichment_job_items_owner_all ON public.enrichment_job_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.enrichment_jobs j WHERE j.id = enrichment_job_items.job_id AND j.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.enrichment_jobs j WHERE j.id = enrichment_job_items.job_id AND j.owner_id = auth.uid()));

CREATE INDEX enrichment_job_items_job ON public.enrichment_job_items (job_id);

-- credit_ledger
CREATE TABLE public.credit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  integration_id UUID REFERENCES public.integrations(id) ON DELETE SET NULL,
  job_id UUID REFERENCES public.enrichment_jobs(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  delta INT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY credit_ledger_owner_all ON public.credit_ledger
  FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE INDEX credit_ledger_owner_created ON public.credit_ledger (owner_id, created_at DESC);

-- credit_limits
CREATE TABLE public.credit_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  integration_id UUID REFERENCES public.integrations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  monthly_limit INT,
  per_run_confirm_above INT NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, provider)
);

ALTER TABLE public.credit_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY credit_limits_owner_all ON public.credit_limits
  FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TRIGGER credit_limits_set_updated_at BEFORE UPDATE ON public.credit_limits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Optional CEP fields on companies
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS cep TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT;
