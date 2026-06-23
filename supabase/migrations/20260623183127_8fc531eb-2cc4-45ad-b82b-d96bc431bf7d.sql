
INSERT INTO public.notifications (owner_id, user_id, type, title, body, link, entity, entity_id)
SELECT
  a.workspace_id,
  m.mentioned_id,
  'mention',
  COALESCE(p.full_name, 'Alguém') || ' mencionou você',
  LEFT(regexp_replace(COALESCE(a.subject, a.body, ''), '<[^>]+>', '', 'g'), 180),
  CASE
    WHEN a.related_ticket_id IS NOT NULL THEN '/tickets/' || a.related_ticket_id
    WHEN a.related_deal_id IS NOT NULL THEN '/deals/' || a.related_deal_id
    WHEN a.related_contact_id IS NOT NULL THEN '/contacts/' || a.related_contact_id
    WHEN a.related_company_id IS NOT NULL THEN '/companies/' || a.related_company_id
    WHEN a.related_lead_id IS NOT NULL THEN '/leads/' || a.related_lead_id
    ELSE NULL
  END,
  CASE
    WHEN a.related_ticket_id IS NOT NULL THEN 'ticket'
    WHEN a.related_deal_id IS NOT NULL THEN 'deal'
    WHEN a.related_contact_id IS NOT NULL THEN 'contact'
    WHEN a.related_company_id IS NOT NULL THEN 'company'
    WHEN a.related_lead_id IS NOT NULL THEN 'lead'
    ELSE NULL
  END,
  COALESCE(a.related_ticket_id, a.related_deal_id, a.related_contact_id, a.related_company_id, a.related_lead_id)
FROM public.activities a
CROSS JOIN LATERAL unnest(a.mentions) AS m(mentioned_id)
LEFT JOIN public.profiles p ON p.id = COALESCE(a.created_by, a.owner_id)
WHERE a.mentions IS NOT NULL
  AND array_length(a.mentions, 1) > 0
  AND m.mentioned_id <> COALESCE(a.created_by, a.owner_id)
  AND a.workspace_id IS NOT NULL
  AND public.is_workspace_member(a.workspace_id, m.mentioned_id)
  AND NOT EXISTS (
    SELECT 1 FROM public.notifications n
    WHERE n.user_id = m.mentioned_id
      AND n.entity_id = COALESCE(a.related_ticket_id, a.related_deal_id, a.related_contact_id, a.related_company_id, a.related_lead_id)
      AND n.type = 'mention'
      AND n.created_at >= a.created_at - interval '1 minute'
      AND n.created_at <= a.created_at + interval '1 minute'
  );
