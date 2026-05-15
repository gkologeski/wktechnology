ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS stage_id text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS stage_id text;
CREATE INDEX IF NOT EXISTS idx_deals_stage_id ON public.deals(stage_id);
CREATE INDEX IF NOT EXISTS idx_leads_stage_id ON public.leads(stage_id);