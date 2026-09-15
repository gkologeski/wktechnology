-- Modelo de cobrança compartilhado entre catálogo, negócio, cotação e contrato.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'billing_model') THEN
    CREATE TYPE public.billing_model AS ENUM (
      'per_unit', 'per_hour', 'per_headcount_month', 'percent_of_base', 'fixed'
    );
  END IF;
END $$;

ALTER TABLE public.service_catalog
  ADD COLUMN IF NOT EXISTS billing_model public.billing_model,
  ADD COLUMN IF NOT EXISTS default_cadence text,
  ADD COLUMN IF NOT EXISTS default_percent numeric,
  ADD COLUMN IF NOT EXISTS percent_base_label text,
  ADD COLUMN IF NOT EXISTS allowed_units text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE public.deal_line_items
  ADD COLUMN IF NOT EXISTS billing_model public.billing_model,
  ADD COLUMN IF NOT EXISTS percent numeric,
  ADD COLUMN IF NOT EXISTS percent_base_amount numeric,
  ADD COLUMN IF NOT EXISTS cadence text;

ALTER TABLE public.quote_line_items
  ADD COLUMN IF NOT EXISTS billing_model public.billing_model,
  ADD COLUMN IF NOT EXISTS percent numeric,
  ADD COLUMN IF NOT EXISTS percent_base_amount numeric,
  ADD COLUMN IF NOT EXISTS cadence text;

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS unit text,
  ADD COLUMN IF NOT EXISTS billing_model public.billing_model,
  ADD COLUMN IF NOT EXISTS percent numeric,
  ADD COLUMN IF NOT EXISTS percent_base_amount numeric,
  ADD COLUMN IF NOT EXISTS source_deal_line_item_id uuid;

ALTER TABLE public.contracting_presets
  ADD COLUMN IF NOT EXISTS billing_model public.billing_model,
  ADD COLUMN IF NOT EXISTS cadence text,
  ADD COLUMN IF NOT EXISTS percent numeric;

-- Backfill: modelo de cobrança padrão a partir da unidade atual do catálogo.
UPDATE public.service_catalog
   SET billing_model = CASE
         WHEN lower(coalesce(unit, '')) IN ('hour', 'hora', 'h') THEN 'per_hour'::public.billing_model
         WHEN lower(coalesce(unit, '')) IN ('month', 'mes', 'mês') THEN 'fixed'::public.billing_model
         ELSE 'per_unit'::public.billing_model
       END,
       default_cadence = CASE
         WHEN service_type = 'recurring' THEN 'monthly'
         ELSE NULL
       END,
       allowed_units = CASE
         WHEN allowed_units = '{}'::text[] AND unit IS NOT NULL THEN ARRAY[unit]
         ELSE allowed_units
       END
 WHERE billing_model IS NULL;

UPDATE public.deal_line_items dli
   SET billing_model = COALESCE(sc.billing_model, 'per_unit'::public.billing_model),
       unit = COALESCE(dli.unit, sc.unit),
       cadence = COALESCE(dli.cadence, sc.default_cadence)
  FROM public.service_catalog sc
 WHERE dli.service_catalog_id = sc.id
   AND dli.billing_model IS NULL;

UPDATE public.deal_line_items
   SET billing_model = 'per_unit'::public.billing_model
 WHERE billing_model IS NULL;

UPDATE public.services s
   SET unit = COALESCE(s.unit, sc.unit),
       billing_model = COALESCE(s.billing_model, sc.billing_model, 'per_unit'::public.billing_model)
  FROM public.service_catalog sc
 WHERE sc.name = s.name
   AND s.billing_model IS NULL;

UPDATE public.services
   SET billing_model = 'per_unit'::public.billing_model
 WHERE billing_model IS NULL;

CREATE INDEX IF NOT EXISTS services_source_deal_line_item_idx
  ON public.services (source_deal_line_item_id);