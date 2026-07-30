ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS assigned_to uuid;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS assigned_to uuid;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS assigned_to uuid;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS assigned_to uuid;

CREATE INDEX IF NOT EXISTS idx_leads_owner_assigned ON public.leads (owner_id, assigned_to);
CREATE INDEX IF NOT EXISTS idx_contacts_owner_assigned ON public.contacts (owner_id, assigned_to);
CREATE INDEX IF NOT EXISTS idx_companies_owner_assigned ON public.companies (owner_id, assigned_to);
CREATE INDEX IF NOT EXISTS idx_deals_owner_assigned ON public.deals (owner_id, assigned_to);