-- Backfill creation/update dates from HubSpot fields
UPDATE public.tickets
SET created_at = hs_createdate
WHERE hs_createdate IS NOT NULL
  AND created_at <> hs_createdate;

UPDATE public.tickets
SET updated_at = hs_lastmodifieddate
WHERE hs_lastmodifieddate IS NOT NULL
  AND updated_at <> hs_lastmodifieddate;

-- Backfill assignee_id from hubspot_owners.mapped_user_id
UPDATE public.tickets t
SET assignee_id = ho.mapped_user_id
FROM public.hubspot_owners ho
WHERE t.hubspot_owner_id IS NOT NULL
  AND t.assignee_id IS NULL
  AND ho.id = t.hubspot_owner_id
  AND ho.mapped_user_id IS NOT NULL;