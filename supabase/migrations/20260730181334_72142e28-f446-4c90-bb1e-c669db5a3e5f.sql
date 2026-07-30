DROP INDEX IF EXISTS public.idx_leads_owner_assigned;
DROP INDEX IF EXISTS public.idx_contacts_owner_assigned;
DROP INDEX IF EXISTS public.idx_companies_owner_assigned;
DROP INDEX IF EXISTS public.idx_deals_owner_assigned;

ALTER TABLE public.leads DROP COLUMN IF EXISTS assigned_to;
ALTER TABLE public.contacts DROP COLUMN IF EXISTS assigned_to;
ALTER TABLE public.companies DROP COLUMN IF EXISTS assigned_to;
ALTER TABLE public.deals DROP COLUMN IF EXISTS assigned_to;

CREATE INDEX IF NOT EXISTS idx_leads_owner_assigned_user ON public.leads (owner_id, assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_owner_assigned_user ON public.contacts (owner_id, assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_companies_owner_assigned_user ON public.companies (owner_id, assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_deals_owner_assigned_user ON public.deals (owner_id, assigned_user_id);