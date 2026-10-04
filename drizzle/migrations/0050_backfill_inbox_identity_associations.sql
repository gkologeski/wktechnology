CREATE OR REPLACE FUNCTION public.inbox_phone_digits(_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT NULLIF(regexp_replace(COALESCE(_value, ''), '[^0-9]', '', 'g'), '')
$$;

REVOKE ALL ON FUNCTION public.inbox_phone_digits(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.inbox_phone_digits(text) TO authenticated, service_role;

WITH candidates AS (
  SELECT wc.id,
         array_agg(DISTINCT c.id) FILTER (WHERE c.id IS NOT NULL) AS contact_ids
  FROM public.whatsapp_conversations wc
  LEFT JOIN public.contacts c
    ON c.workspace_id = wc.workspace_id
   AND c.deleted_at IS NULL
   AND (c.phone_digits = public.inbox_phone_digits(wc.contact_phone)
        OR c.mobile_phone_digits = public.inbox_phone_digits(wc.contact_phone))
  WHERE wc.contact_id IS NULL AND wc.lead_id IS NULL AND wc.identity_status = 'unresolved'
  GROUP BY wc.id
)
UPDATE public.whatsapp_conversations wc
SET contact_id = CASE WHEN cardinality(candidates.contact_ids) = 1 THEN candidates.contact_ids[1] ELSE NULL END,
    identity_status = CASE WHEN cardinality(candidates.contact_ids) = 1 THEN 'matched'
                           WHEN cardinality(candidates.contact_ids) > 1 THEN 'ambiguous'
                           ELSE 'unresolved' END
FROM candidates
WHERE wc.id = candidates.id;

WITH candidates AS (
  SELECT wc.id,
         array_agg(DISTINCT l.id) FILTER (WHERE l.id IS NOT NULL) AS lead_ids
  FROM public.whatsapp_conversations wc
  LEFT JOIN public.leads l
    ON l.workspace_id = wc.workspace_id
   AND l.deleted_at IS NULL
   AND (l.phone_digits = public.inbox_phone_digits(wc.contact_phone)
        OR l.mobile_phone_digits = public.inbox_phone_digits(wc.contact_phone))
  WHERE wc.contact_id IS NULL AND wc.lead_id IS NULL AND wc.identity_status = 'unresolved'
  GROUP BY wc.id
)
UPDATE public.whatsapp_conversations wc
SET lead_id = CASE WHEN cardinality(candidates.lead_ids) = 1 THEN candidates.lead_ids[1] ELSE NULL END,
    identity_status = CASE WHEN cardinality(candidates.lead_ids) = 1 THEN 'matched'
                           WHEN cardinality(candidates.lead_ids) > 1 THEN 'ambiguous'
                           ELSE 'not_found' END
FROM candidates
WHERE wc.id = candidates.id;

WITH senders AS (
  SELECT DISTINCT ON (em.thread_id) em.thread_id, lower(em.from_email) AS email
  FROM public.email_messages em
  WHERE em.direction = 'inbound' AND em.from_email IS NOT NULL
  ORDER BY em.thread_id, em.created_at DESC
), candidates AS (
  SELECT et.id,
         array_agg(DISTINCT c.id) FILTER (WHERE c.id IS NOT NULL) AS contact_ids
  FROM public.email_threads et
  JOIN senders s ON s.thread_id = et.id
  LEFT JOIN public.contacts c
    ON c.workspace_id = et.workspace_id AND c.deleted_at IS NULL AND lower(c.email) = s.email
  WHERE et.contact_id IS NULL AND et.lead_id IS NULL AND et.identity_status = 'unresolved'
  GROUP BY et.id
)
UPDATE public.email_threads et
SET contact_id = CASE WHEN cardinality(candidates.contact_ids) = 1 THEN candidates.contact_ids[1] ELSE NULL END,
    identity_status = CASE WHEN cardinality(candidates.contact_ids) = 1 THEN 'matched'
                           WHEN cardinality(candidates.contact_ids) > 1 THEN 'ambiguous'
                           ELSE 'unresolved' END
FROM candidates
WHERE et.id = candidates.id;

WITH senders AS (
  SELECT DISTINCT ON (em.thread_id) em.thread_id, lower(em.from_email) AS email
  FROM public.email_messages em
  WHERE em.direction = 'inbound' AND em.from_email IS NOT NULL
  ORDER BY em.thread_id, em.created_at DESC
), candidates AS (
  SELECT et.id,
         array_agg(DISTINCT l.id) FILTER (WHERE l.id IS NOT NULL) AS lead_ids
  FROM public.email_threads et
  JOIN senders s ON s.thread_id = et.id
  LEFT JOIN public.leads l
    ON l.workspace_id = et.workspace_id AND l.deleted_at IS NULL AND lower(l.email) = s.email
  WHERE et.contact_id IS NULL AND et.lead_id IS NULL AND et.identity_status = 'unresolved'
  GROUP BY et.id
)
UPDATE public.email_threads et
SET lead_id = CASE WHEN cardinality(candidates.lead_ids) = 1 THEN candidates.lead_ids[1] ELSE NULL END,
    identity_status = CASE WHEN cardinality(candidates.lead_ids) = 1 THEN 'matched'
                           WHEN cardinality(candidates.lead_ids) > 1 THEN 'ambiguous'
                           ELSE 'not_found' END
FROM candidates
WHERE et.id = candidates.id;

WITH candidates AS (
  SELECT ls.id,
         array_agg(DISTINCT c.id) FILTER (WHERE c.id IS NOT NULL) AS contact_ids
  FROM public.live_chat_sessions ls
  LEFT JOIN public.contacts c
    ON c.workspace_id = ls.workspace_id AND c.deleted_at IS NULL
   AND lower(c.email) = lower(ls.visitor_email)
  WHERE ls.contact_id IS NULL AND ls.lead_id IS NULL AND ls.identity_status = 'unresolved'
  GROUP BY ls.id
)
UPDATE public.live_chat_sessions ls
SET contact_id = CASE WHEN cardinality(candidates.contact_ids) = 1 THEN candidates.contact_ids[1] ELSE NULL END,
    identity_status = CASE WHEN cardinality(candidates.contact_ids) = 1 THEN 'matched'
                           WHEN cardinality(candidates.contact_ids) > 1 THEN 'ambiguous'
                           ELSE 'unresolved' END
FROM candidates
WHERE ls.id = candidates.id;

WITH candidates AS (
  SELECT ls.id,
         array_agg(DISTINCT l.id) FILTER (WHERE l.id IS NOT NULL) AS lead_ids
  FROM public.live_chat_sessions ls
  LEFT JOIN public.leads l
    ON l.workspace_id = ls.workspace_id AND l.deleted_at IS NULL
   AND lower(l.email) = lower(ls.visitor_email)
  WHERE ls.contact_id IS NULL AND ls.lead_id IS NULL AND ls.identity_status = 'unresolved'
  GROUP BY ls.id
)
UPDATE public.live_chat_sessions ls
SET lead_id = CASE WHEN cardinality(candidates.lead_ids) = 1 THEN candidates.lead_ids[1] ELSE NULL END,
    identity_status = CASE WHEN cardinality(candidates.lead_ids) = 1 THEN 'matched'
                           WHEN cardinality(candidates.lead_ids) > 1 THEN 'ambiguous'
                           ELSE 'not_found' END
FROM candidates
WHERE ls.id = candidates.id;