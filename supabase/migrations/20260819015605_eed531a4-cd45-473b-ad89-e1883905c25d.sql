ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_assigned_to ON public.contacts(assigned_to);

ALTER TABLE public.contacts DISABLE TRIGGER contacts_audit;
ALTER TABLE public.contacts DISABLE TRIGGER trg_audit_contacts;
ALTER TABLE public.contacts DISABLE TRIGGER contacts_wf_event;
ALTER TABLE public.contacts DISABLE TRIGGER trg_wf_events_contacts;
ALTER TABLE public.contacts DISABLE TRIGGER contacts_updated;

UPDATE public.contacts c
SET assigned_to = c.owner_id
WHERE c.assigned_to IS NULL
  AND c.owner_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = c.owner_id);

ALTER TABLE public.contacts ENABLE TRIGGER contacts_audit;
ALTER TABLE public.contacts ENABLE TRIGGER trg_audit_contacts;
ALTER TABLE public.contacts ENABLE TRIGGER contacts_wf_event;
ALTER TABLE public.contacts ENABLE TRIGGER trg_wf_events_contacts;
ALTER TABLE public.contacts ENABLE TRIGGER contacts_updated;