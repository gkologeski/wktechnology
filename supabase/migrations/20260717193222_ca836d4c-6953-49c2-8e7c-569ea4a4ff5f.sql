
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS leads_company_id_idx ON public.leads(company_id);

-- Backfill best-effort by exact (case-insensitive) name match within same owner
UPDATE public.leads l
SET company_id = c.id
FROM public.companies c
WHERE l.company_id IS NULL
  AND l.company_name IS NOT NULL
  AND length(trim(l.company_name)) > 0
  AND lower(trim(c.name)) = lower(trim(l.company_name))
  AND c.owner_id = l.owner_id;
