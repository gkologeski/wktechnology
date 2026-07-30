ALTER TABLE public.prospecting_results
  ADD COLUMN IF NOT EXISTS company_website text,
  ADD COLUMN IF NOT EXISTS company_employees integer,
  ADD COLUMN IF NOT EXISTS company_employee_range text,
  ADD COLUMN IF NOT EXISTS company_revenue numeric,
  ADD COLUMN IF NOT EXISTS company_city text,
  ADD COLUMN IF NOT EXISTS company_state text,
  ADD COLUMN IF NOT EXISTS company_country text,
  ADD COLUMN IF NOT EXISTS company_phone text,
  ADD COLUMN IF NOT EXISTS company_linkedin_url text,
  ADD COLUMN IF NOT EXISTS company_description text,
  ADD COLUMN IF NOT EXISTS company_technologies text[];

CREATE INDEX IF NOT EXISTS idx_companies_domain_lower
  ON public.companies (workspace_id, lower(domain))
  WHERE domain IS NOT NULL AND deleted_at IS NULL;