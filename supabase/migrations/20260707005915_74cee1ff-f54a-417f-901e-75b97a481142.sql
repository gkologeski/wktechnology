CREATE OR REPLACE FUNCTION public.get_entity_timeline(p_entity_kind text, p_entity_id uuid, p_since timestamp with time zone DEFAULT NULL::timestamp with time zone, p_until timestamp with time zone DEFAULT NULL::timestamp with time zone, p_limit integer DEFAULT 200)
 RETURNS TABLE(id text, source text, type text, subject text, body_excerpt text, occurred_at timestamp with time zone, actor_id uuid, direct_link boolean, mirrored_from_kind text, mirrored_from_id uuid, related_contact_id uuid, related_deal_id uuid, related_company_id uuid, related_lead_id uuid, related_ticket_id uuid, extra jsonb, is_pinned boolean)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
DECLARE
  v_contact_ids uuid[] := ARRAY[]::uuid[];
  v_deal_ids    uuid[] := ARRAY[]::uuid[];
  v_company_ids uuid[] := ARRAY[]::uuid[];
  v_lead_ids    uuid[] := ARRAY[]::uuid[];
  v_ticket_ids  uuid[] := ARRAY[]::uuid[];
  v_workspace_id uuid;
BEGIN
  IF p_entity_kind = 'contact' THEN
    v_contact_ids := ARRAY[p_entity_id];
    SELECT c.workspace_id, COALESCE(ARRAY[c.company_id], ARRAY[]::uuid[])
      INTO v_workspace_id, v_company_ids
      FROM contacts c WHERE c.id = p_entity_id;
    v_company_ids := COALESCE((SELECT array_agg(x) FROM unnest(v_company_ids) x WHERE x IS NOT NULL), ARRAY[]::uuid[]);

  ELSIF p_entity_kind = 'deal' THEN
    v_deal_ids := ARRAY[p_entity_id];
    SELECT d.workspace_id INTO v_workspace_id FROM deals d WHERE d.id = p_entity_id;
    SELECT COALESCE(array_agg(DISTINCT c), ARRAY[]::uuid[]) INTO v_contact_ids
      FROM (
        SELECT d.primary_contact_id AS c FROM deals d WHERE d.id = p_entity_id AND d.primary_contact_id IS NOT NULL
        UNION SELECT dc.contact_id FROM deal_contacts dc WHERE dc.deal_id = p_entity_id
      ) s WHERE c IS NOT NULL;
    SELECT COALESCE(array_agg(DISTINCT c.company_id), ARRAY[]::uuid[]) INTO v_company_ids
      FROM contacts c WHERE c.id = ANY(v_contact_ids) AND c.company_id IS NOT NULL;
    SELECT COALESCE(array_agg(DISTINCT cid), ARRAY[]::uuid[]) INTO v_company_ids
      FROM (
        SELECT unnest(v_company_ids) AS cid
        UNION SELECT d.company_id FROM deals d WHERE d.id = p_entity_id AND d.company_id IS NOT NULL
      ) s WHERE cid IS NOT NULL;

  ELSIF p_entity_kind = 'company' THEN
    v_company_ids := ARRAY[p_entity_id];
    SELECT co.workspace_id INTO v_workspace_id FROM companies co WHERE co.id = p_entity_id;
    SELECT COALESCE(array_agg(c.id), ARRAY[]::uuid[]) INTO v_contact_ids
      FROM contacts c WHERE c.company_id = p_entity_id;
    SELECT COALESCE(array_agg(d.id), ARRAY[]::uuid[]) INTO v_deal_ids
      FROM deals d WHERE d.company_id = p_entity_id;

  ELSIF p_entity_kind = 'lead' THEN
    v_lead_ids := ARRAY[p_entity_id];
    SELECT l.workspace_id INTO v_workspace_id FROM leads l WHERE l.id = p_entity_id;

  ELSIF p_entity_kind = 'ticket' THEN
    v_ticket_ids := ARRAY[p_entity_id];
    SELECT t.workspace_id INTO v_workspace_id FROM tickets t WHERE t.id = p_entity_id;
    SELECT COALESCE(array_remove(ARRAY[t.contact_id], NULL), ARRAY[]::uuid[]),
           COALESCE(array_remove(ARRAY[t.deal_id], NULL), ARRAY[]::uuid[]),
           COALESCE(array_remove(ARRAY[t.company_id], NULL), ARRAY[]::uuid[])
      INTO v_contact_ids, v_deal_ids, v_company_ids
      FROM tickets t WHERE t.id = p_entity_id;
  ELSE
    RAISE EXCEPTION 'invalid entity_kind: %', p_entity_kind;
  END IF;

  IF v_workspace_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      ('act_' || a.id::text) AS id,
      'activity'::text AS source,
      a.type::text AS type,
      a.subject AS subject,
      LEFT(COALESCE(a.body,''), 280) AS body_excerpt,
      COALESCE(a.due_date, a.created_at) AS occurred_at,
      a.owner_id AS actor_id,
      (CASE p_entity_kind
         WHEN 'contact' THEN a.related_contact_id = p_entity_id
         WHEN 'deal'    THEN a.related_deal_id    = p_entity_id
         WHEN 'company' THEN a.related_company_id = p_entity_id
         WHEN 'lead'    THEN a.related_lead_id    = p_entity_id
         WHEN 'ticket'  THEN a.related_ticket_id  = p_entity_id
         ELSE false
       END) AS direct_link,
      NULL::text AS mirrored_from_kind,
      NULL::uuid AS mirrored_from_id,
      a.related_contact_id AS related_contact_id,
      a.related_deal_id AS related_deal_id,
      a.related_company_id AS related_company_id,
      a.related_lead_id AS related_lead_id,
      a.related_ticket_id AS related_ticket_id,
      '{}'::jsonb AS extra,
      a.id AS source_uuid
    FROM activities a
    WHERE a.workspace_id = v_workspace_id
      AND (
        a.related_contact_id = ANY(v_contact_ids)
        OR a.related_deal_id    = ANY(v_deal_ids)
        OR a.related_company_id = ANY(v_company_ids)
        OR a.related_lead_id    = ANY(v_lead_ids)
        OR a.related_ticket_id  = ANY(v_ticket_ids)
      )

    UNION ALL
    SELECT
      ('meet_' || m.id::text), 'meeting', 'meeting',
      m.title, NULL,
      COALESCE(m.started_at, m.created_at),
      m.owner_id,
      (CASE p_entity_kind
         WHEN 'contact' THEN m.related_contact_id = p_entity_id
         WHEN 'deal'    THEN m.related_deal_id    = p_entity_id
         WHEN 'lead'    THEN m.related_lead_id    = p_entity_id
         WHEN 'ticket'  THEN m.related_ticket_id  = p_entity_id
         ELSE false
       END),
      NULL::text, NULL::uuid,
      m.related_contact_id, m.related_deal_id, NULL::uuid, m.related_lead_id, m.related_ticket_id,
      jsonb_build_object('status', m.status, 'ended_at', m.ended_at),
      m.id
    FROM meetings m
    WHERE m.workspace_id = v_workspace_id
      AND (m.related_contact_id = ANY(v_contact_ids)
        OR m.related_deal_id    = ANY(v_deal_ids)
        OR m.related_lead_id    = ANY(v_lead_ids)
        OR m.related_ticket_id  = ANY(v_ticket_ids))

    UNION ALL
    -- calendar_events for contact timeline: match by direct contact link
    SELECT
      ('cal_' || ce.id::text), 'calendar_event', 'meeting',
      ce.title, NULL,
      ce.start_at,
      ce.owner_id,
      true,
      NULL::text,
      NULL::uuid,
      ce.related_contact_id, NULL::uuid, NULL::uuid, NULL::uuid, NULL::uuid,
      '{}'::jsonb,
      ce.id
    FROM calendar_events ce
    WHERE p_entity_kind = 'contact'
      AND ce.workspace_id = v_workspace_id
      AND ce.related_contact_id = p_entity_id

    UNION ALL
    -- calendar_events for deal/lead/ticket/company timeline: match only via a linked activity of THIS entity
    SELECT
      ('cal_' || ce.id::text), 'calendar_event', 'meeting',
      ce.title, NULL,
      ce.start_at,
      ce.owner_id,
      false,
      'activity'::text,
      a.id,
      ce.related_contact_id,
      a.related_deal_id,
      a.related_company_id,
      a.related_lead_id,
      a.related_ticket_id,
      '{}'::jsonb,
      ce.id
    FROM calendar_events ce
    JOIN activities a ON a.id = ce.related_activity_id
    WHERE p_entity_kind <> 'contact'
      AND ce.workspace_id = v_workspace_id
      AND a.workspace_id = v_workspace_id
      AND (
        (p_entity_kind = 'deal'    AND a.related_deal_id    = p_entity_id)
        OR (p_entity_kind = 'lead'    AND a.related_lead_id    = p_entity_id)
        OR (p_entity_kind = 'ticket'  AND a.related_ticket_id  = p_entity_id)
        OR (p_entity_kind = 'company' AND (a.related_company_id = p_entity_id OR a.related_contact_id = ANY(v_contact_ids)))
      )

    UNION ALL
    -- calendar_events mirrored on deal/company timelines via the resolved
    -- "external client" contact (ce.related_contact_id is populated at ingest
    -- excluding internal/organizer/self domains, so this filter is equivalent
    -- to "meetings where a client contact was invited").
    SELECT
      ('cal_' || ce.id::text), 'calendar_event', 'meeting',
      ce.title, NULL,
      ce.start_at,
      ce.owner_id,
      false,
      'contact'::text,
      ce.related_contact_id,
      ce.related_contact_id, NULL::uuid, NULL::uuid, NULL::uuid, NULL::uuid,
      '{}'::jsonb,
      ce.id
    FROM calendar_events ce
    WHERE p_entity_kind IN ('deal','company')
      AND ce.workspace_id = v_workspace_id
      AND ce.related_contact_id = ANY(v_contact_ids)
      AND NOT EXISTS (
        SELECT 1 FROM activities a2
        WHERE a2.id = ce.related_activity_id
          AND (
            (p_entity_kind = 'deal'    AND a2.related_deal_id    = p_entity_id)
            OR (p_entity_kind = 'company' AND (a2.related_company_id = p_entity_id OR a2.related_contact_id = ANY(v_contact_ids)))
          )
      )

    UNION ALL
    SELECT
      ('email_' || em.id::text), 'email', 'email',
      em.subject, em.snippet,
      COALESCE(em.sent_at, em.received_at, em.created_at),
      em.owner_id,
      (CASE p_entity_kind
         WHEN 'contact' THEN et.contact_id = p_entity_id
         WHEN 'deal'    THEN et.deal_id    = p_entity_id
         WHEN 'company' THEN et.company_id = p_entity_id
         WHEN 'lead'    THEN et.lead_id    = p_entity_id
         ELSE false
       END),
      NULL::text, NULL::uuid,
      et.contact_id, et.deal_id, et.company_id, et.lead_id, NULL::uuid,
      jsonb_build_object('direction', em.direction, 'from_email', em.from_email),
      em.id
    FROM email_messages em
    JOIN email_threads et ON et.id = em.thread_id
    WHERE em.workspace_id = v_workspace_id
      AND (et.contact_id = ANY(v_contact_ids)
        OR et.deal_id    = ANY(v_deal_ids)
        OR et.company_id = ANY(v_company_ids)
        OR et.lead_id    = ANY(v_lead_ids))

    UNION ALL
    SELECT
      ('wa_' || wm.id::text), 'whatsapp', 'whatsapp',
      NULL::text, LEFT(COALESCE(wm.body,''), 280),
      COALESCE(wm.sent_at, wm.created_at),
      wm.owner_id,
      (p_entity_kind = 'contact' AND wc.contact_id = p_entity_id),
      CASE WHEN p_entity_kind <> 'contact' THEN 'contact' END,
      CASE WHEN p_entity_kind <> 'contact' THEN wc.contact_id END,
      wc.contact_id, NULL::uuid, NULL::uuid, NULL::uuid, NULL::uuid,
      jsonb_build_object('direction', wm.direction, 'status', wm.status),
      wm.id
    FROM whatsapp_messages wm
    JOIN whatsapp_conversations wc ON wc.id = wm.conversation_id
    WHERE wm.workspace_id = v_workspace_id
      AND wc.contact_id = ANY(v_contact_ids)
  ),
  pins AS (
    SELECT tp.source, tp.source_id
    FROM timeline_pins tp
    WHERE tp.workspace_id = v_workspace_id
      AND tp.entity_kind = p_entity_kind
      AND tp.entity_id   = p_entity_id
  ),
  combined AS (
    SELECT b.*,
      EXISTS (SELECT 1 FROM pins p WHERE p.source = b.source AND p.source_id = b.source_uuid) AS is_pinned
    FROM base b
  )
  SELECT
    c.id, c.source, c.type, c.subject, c.body_excerpt, c.occurred_at, c.actor_id,
    c.direct_link, c.mirrored_from_kind, c.mirrored_from_id,
    c.related_contact_id, c.related_deal_id, c.related_company_id, c.related_lead_id, c.related_ticket_id,
    c.extra, c.is_pinned
  FROM combined c
  WHERE c.is_pinned
     OR (
       (p_since IS NULL OR c.occurred_at >= p_since)
       AND (p_until IS NULL OR c.occurred_at <= p_until)
     )
  ORDER BY c.occurred_at DESC NULLS LAST
  LIMIT p_limit;
END;
$function$;