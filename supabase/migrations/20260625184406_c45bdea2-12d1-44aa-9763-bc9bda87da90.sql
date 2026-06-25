-- 1) timeline_pins table
CREATE TABLE IF NOT EXISTS public.timeline_pins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  entity_kind text NOT NULL CHECK (entity_kind IN ('deal','contact','company','lead','ticket')),
  entity_id uuid NOT NULL,
  source text NOT NULL CHECK (source IN ('activity','meeting','calendar_event','email','whatsapp')),
  source_id uuid NOT NULL,
  pinned_at timestamptz NOT NULL DEFAULT now(),
  pinned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (workspace_id, entity_kind, entity_id, source, source_id)
);

CREATE INDEX IF NOT EXISTS idx_timeline_pins_entity ON public.timeline_pins (workspace_id, entity_kind, entity_id);

GRANT SELECT, INSERT, DELETE ON public.timeline_pins TO authenticated;
GRANT ALL ON public.timeline_pins TO service_role;

ALTER TABLE public.timeline_pins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can read pins" ON public.timeline_pins
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "members can create pins" ON public.timeline_pins
  FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()) AND pinned_by = auth.uid());

CREATE POLICY "owners can remove pins" ON public.timeline_pins
  FOR DELETE TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));

-- 2) Index for calendar_events by contact and time
CREATE INDEX IF NOT EXISTS idx_calendar_events_contact_time
  ON public.calendar_events (related_contact_id, start_at DESC)
  WHERE related_contact_id IS NOT NULL;

-- 3) RPC
CREATE OR REPLACE FUNCTION public.get_entity_timeline(
  p_entity_kind text,
  p_entity_id uuid,
  p_since timestamptz DEFAULT NULL,
  p_until timestamptz DEFAULT NULL,
  p_limit int DEFAULT 200
) RETURNS TABLE (
  id text,
  source text,
  type text,
  subject text,
  body_excerpt text,
  occurred_at timestamptz,
  actor_id uuid,
  direct_link boolean,
  mirrored_from_kind text,
  mirrored_from_id uuid,
  related_contact_id uuid,
  related_deal_id uuid,
  related_company_id uuid,
  related_lead_id uuid,
  related_ticket_id uuid,
  extra jsonb,
  is_pinned boolean
) LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
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
    SELECT workspace_id, COALESCE(ARRAY[company_id], ARRAY[]::uuid[])
      INTO v_workspace_id, v_company_ids
      FROM contacts WHERE id = p_entity_id;
    v_company_ids := COALESCE((SELECT array_agg(c) FROM unnest(v_company_ids) c WHERE c IS NOT NULL), ARRAY[]::uuid[]);

  ELSIF p_entity_kind = 'deal' THEN
    v_deal_ids := ARRAY[p_entity_id];
    SELECT workspace_id INTO v_workspace_id FROM deals WHERE id = p_entity_id;
    SELECT COALESCE(array_agg(DISTINCT c), ARRAY[]::uuid[]) INTO v_contact_ids
      FROM (
        SELECT primary_contact_id AS c FROM deals WHERE id = p_entity_id AND primary_contact_id IS NOT NULL
        UNION SELECT contact_id FROM deal_contacts WHERE deal_id = p_entity_id
      ) s WHERE c IS NOT NULL;
    SELECT COALESCE(array_agg(DISTINCT company_id), ARRAY[]::uuid[]) INTO v_company_ids
      FROM contacts WHERE id = ANY(v_contact_ids) AND company_id IS NOT NULL;
    -- also include the deal's own company
    SELECT COALESCE(array_agg(DISTINCT cid), ARRAY[]::uuid[]) INTO v_company_ids
      FROM (
        SELECT unnest(v_company_ids) AS cid
        UNION SELECT company_id FROM deals WHERE id = p_entity_id AND company_id IS NOT NULL
      ) s WHERE cid IS NOT NULL;

  ELSIF p_entity_kind = 'company' THEN
    v_company_ids := ARRAY[p_entity_id];
    SELECT workspace_id INTO v_workspace_id FROM companies WHERE id = p_entity_id;
    SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_contact_ids
      FROM contacts WHERE company_id = p_entity_id;
    SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_deal_ids
      FROM deals WHERE company_id = p_entity_id;

  ELSIF p_entity_kind = 'lead' THEN
    v_lead_ids := ARRAY[p_entity_id];
    SELECT workspace_id INTO v_workspace_id FROM leads WHERE id = p_entity_id;

  ELSIF p_entity_kind = 'ticket' THEN
    v_ticket_ids := ARRAY[p_entity_id];
    SELECT workspace_id INTO v_workspace_id FROM tickets WHERE id = p_entity_id;
    SELECT COALESCE(array_remove(ARRAY[contact_id], NULL), ARRAY[]::uuid[]),
           COALESCE(array_remove(ARRAY[deal_id], NULL), ARRAY[]::uuid[]),
           COALESCE(array_remove(ARRAY[company_id], NULL), ARRAY[]::uuid[])
      INTO v_contact_ids, v_deal_ids, v_company_ids
      FROM tickets WHERE id = p_entity_id;
  ELSE
    RAISE EXCEPTION 'invalid entity_kind: %', p_entity_kind;
  END IF;

  IF v_workspace_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH base AS (
    -- activities
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
      a.related_contact_id, a.related_deal_id, a.related_company_id, a.related_lead_id, a.related_ticket_id,
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
    -- meetings (internal)
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
    -- calendar_events (mirrored via contact)
    SELECT
      ('cal_' || ce.id::text), 'calendar_event', 'meeting',
      ce.title, NULL,
      ce.start_at,
      ce.owner_id,
      (p_entity_kind = 'contact' AND ce.related_contact_id = p_entity_id),
      CASE WHEN p_entity_kind <> 'contact' THEN 'contact' END,
      CASE WHEN p_entity_kind <> 'contact' THEN ce.related_contact_id END,
      ce.related_contact_id, NULL::uuid, NULL::uuid, NULL::uuid, NULL::uuid,
      '{}'::jsonb,
      ce.id
    FROM calendar_events ce
    WHERE ce.workspace_id = v_workspace_id
      AND ce.related_contact_id = ANY(v_contact_ids)

    UNION ALL
    -- emails via thread
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
    -- whatsapp via conversation
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
$$;

GRANT EXECUTE ON FUNCTION public.get_entity_timeline(text, uuid, timestamptz, timestamptz, int) TO authenticated;