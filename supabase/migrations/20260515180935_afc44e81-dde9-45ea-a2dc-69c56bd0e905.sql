
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS external_ids jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.contacts  ADD COLUMN IF NOT EXISTS external_ids jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.deals     ADD COLUMN IF NOT EXISTS external_ids jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.leads     ADD COLUMN IF NOT EXISTS external_ids jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS external_ids jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_companies_external_ids ON public.companies USING GIN (external_ids);
CREATE INDEX IF NOT EXISTS idx_contacts_external_ids  ON public.contacts  USING GIN (external_ids);
CREATE INDEX IF NOT EXISTS idx_deals_external_ids     ON public.deals     USING GIN (external_ids);
CREATE INDEX IF NOT EXISTS idx_leads_external_ids     ON public.leads     USING GIN (external_ids);
CREATE INDEX IF NOT EXISTS idx_activities_external_ids ON public.activities USING GIN (external_ids);

ALTER TABLE public.enrichment_jobs ADD COLUMN IF NOT EXISTS step_logs jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER PUBLICATION supabase_realtime ADD TABLE public.enrichment_jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.enrichment_job_items;
ALTER TABLE public.enrichment_jobs REPLICA IDENTITY FULL;
ALTER TABLE public.enrichment_job_items REPLICA IDENTITY FULL;
