ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_deals_assigned_to ON public.deals(assigned_to);

UPDATE public.deals d
SET assigned_to = d.owner_id
WHERE d.assigned_to IS NULL
  AND d.owner_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = d.owner_id);