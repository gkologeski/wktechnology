UPDATE public.activities
SET created_at = COALESCE(hs_createdate, due_date, created_at),
    updated_at = COALESCE(hs_lastmodifieddate, hs_createdate, due_date, updated_at)
WHERE type = 'meeting' AND hs_object_id IS NOT NULL AND hs_createdate IS NOT NULL;