ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_activities_assigned_to ON public.activities(assigned_to);