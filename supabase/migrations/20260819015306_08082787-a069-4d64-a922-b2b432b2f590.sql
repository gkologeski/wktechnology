ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_companies_assigned_to ON public.companies(assigned_to);

ALTER TABLE public.companies DISABLE TRIGGER companies_audit;
ALTER TABLE public.companies DISABLE TRIGGER trg_audit_companies;
ALTER TABLE public.companies DISABLE TRIGGER companies_wf_event;
ALTER TABLE public.companies DISABLE TRIGGER trg_wf_events_companies;
ALTER TABLE public.companies DISABLE TRIGGER companies_updated;

UPDATE public.companies c
SET assigned_to = c.owner_id
WHERE c.assigned_to IS NULL
  AND c.owner_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = c.owner_id);

ALTER TABLE public.companies ENABLE TRIGGER companies_audit;
ALTER TABLE public.companies ENABLE TRIGGER trg_audit_companies;
ALTER TABLE public.companies ENABLE TRIGGER companies_wf_event;
ALTER TABLE public.companies ENABLE TRIGGER trg_wf_events_companies;
ALTER TABLE public.companies ENABLE TRIGGER companies_updated;