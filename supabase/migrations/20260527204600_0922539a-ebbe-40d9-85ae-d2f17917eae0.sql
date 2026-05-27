ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_contacts_deleted_at ON public.contacts(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_companies_deleted_at ON public.companies(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deals_deleted_at ON public.deals(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activities_deleted_at ON public.activities(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_deleted_at ON public.leads(deleted_at) WHERE deleted_at IS NOT NULL;