DELETE FROM public.activities a
USING public.activities b
WHERE a.owner_id = b.owner_id
  AND a.type = b.type
  AND a.hs_object_id IS NOT NULL
  AND a.hs_object_id = b.hs_object_id
  AND a.ctid < b.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS activities_hs_unique_idx
ON public.activities (owner_id, type, hs_object_id)
WHERE hs_object_id IS NOT NULL;