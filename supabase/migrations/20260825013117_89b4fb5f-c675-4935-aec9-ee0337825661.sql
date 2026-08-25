-- 1) Novos campos em deal_line_items
ALTER TABLE public.deal_line_items
  ADD COLUMN IF NOT EXISTS contracting_preset_id uuid REFERENCES public.contracting_presets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS job_profile_id uuid REFERENCES public.job_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS seniority text,
  ADD COLUMN IF NOT EXISTS unit text;

-- 2) Novos campos em quote_line_items
ALTER TABLE public.quote_line_items
  ADD COLUMN IF NOT EXISTS service_catalog_id uuid REFERENCES public.service_catalog(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contracting_preset_id uuid REFERENCES public.contracting_presets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS job_profile_id uuid REFERENCES public.job_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS seniority text,
  ADD COLUMN IF NOT EXISTS unit text;

-- 3) Novos campos em people_allocations
ALTER TABLE public.people_allocations
  ADD COLUMN IF NOT EXISTS competencies text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS contracting_preset_id uuid REFERENCES public.contracting_presets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_quote_line_items_service_catalog ON public.quote_line_items(service_catalog_id);
CREATE INDEX IF NOT EXISTS idx_deal_line_items_preset ON public.deal_line_items(contracting_preset_id);

-- 4) Remoção do catálogo de produtos
ALTER TABLE public.deal_line_items DROP COLUMN IF EXISTS product_id;
ALTER TABLE public.services DROP COLUMN IF EXISTS product_id;
ALTER TABLE public.prospecting_questionnaires DROP COLUMN IF EXISTS product_id;
DROP TABLE IF EXISTS public.products CASCADE;