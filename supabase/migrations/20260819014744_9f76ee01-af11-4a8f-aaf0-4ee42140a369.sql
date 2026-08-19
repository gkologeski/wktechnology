ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON public.leads(assigned_to);

UPDATE public.leads l
SET assigned_to = l.owner_id
WHERE l.assigned_to IS NULL
  AND l.owner_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = l.owner_id);