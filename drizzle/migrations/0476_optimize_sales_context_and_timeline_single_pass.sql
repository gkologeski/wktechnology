CREATE OR REPLACE FUNCTION public.rep_restricted_workspaces_for(_res text, _act text)
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT w FROM public.rep_restricted_workspaces() w
   WHERE NOT public.user_has_permission(auth.uid(), w, 'techsales.' || _res || '.' || _act || '.workspace');
$function$;

CREATE OR REPLACE FUNCTION public.sales_policy_context(resources text[])
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  u uuid := auth.uid();
  w uuid;
  keys jsonb;
  t jsonb;
BEGIN
  IF resources IS NULL OR cardinality(resources) = 0 OR cardinality(resources) > 24
     OR EXISTS (
       SELECT 1 FROM unnest(resources) r
        WHERE r IS NULL OR length(r) > 100 OR r !~ '^(techsales|system)\.[a-z_][a-z0-9_.]*$'
     ) THEN
    RETURN '{}'::jsonb;
  END IF;
  IF u IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;
  IF current_setting('app.api_subject', true) = 'on' THEN
    SELECT workspace_id INTO w
      FROM techerp_api.subject_sessions
     WHERE txid = txid_current_if_assigned() AND user_id = u;
  ELSE
    SELECT active_workspace_id INTO w FROM public.profiles WHERE id = u;
  END IF;
  IF w IS NULL OR NOT public.is_workspace_member(w, u) THEN
    RETURN '{}'::jsonb;
  END IF;
  SELECT coalesce(jsonb_object_agg(x, true), '{}'::jsonb) INTO keys
    FROM public.user_effective_permissions(u, w) x
   WHERE EXISTS (SELECT 1 FROM unnest(resources) r WHERE starts_with(x, r || '.'));
  SELECT coalesce(jsonb_object_agg(x.user_id::text, true), '{}'::jsonb) INTO t
    FROM public.my_team_member_pairs() x
   WHERE x.workspace_id = w;
  RETURN jsonb_build_object(
    'workspace', w,
    'actor', u,
    'keys', keys,
    'team', t,
    'read_only', public.is_read_only_view()
  );
END
$function$;

CREATE OR REPLACE FUNCTION public.get_timeline_activity_page(
  p_entity_kind text,
  p_entity_id uuid,
  p_since timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_until timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_categories text[] DEFAULT NULL::text[],
  p_assignees uuid[] DEFAULT NULL::uuid[],
  p_include_unassigned boolean DEFAULT false,
  p_search text DEFAULT NULL::text,
  p_cursor_at timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_cursor_id uuid DEFAULT NULL::uuid,
  p_page_size integer DEFAULT 40
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_page_size, 40), 1), 100);
  v_result jsonb;
  v_workspace uuid;
  v_contacts uuid[] := ARRAY[]::uuid[];
  v_company uuid;
  v_entity_pred text;
BEGIN
  IF p_entity_kind NOT IN ('lead','contact','company','deal','ticket') THEN
    RAISE EXCEPTION 'invalid entity kind';
  END IF;
  IF (p_cursor_at IS NULL) <> (p_cursor_id IS NULL) THEN
    RAISE EXCEPTION 'cursor timestamp and id must be provided together';
  END IF;

  IF p_entity_kind = 'deal' THEN
    SELECT d.workspace_id, d.company_id,
      array_remove(ARRAY[d.primary_contact_id] || ARRAY(SELECT dc.contact_id FROM public.deal_contacts dc WHERE dc.deal_id = d.id), NULL)
      INTO v_workspace, v_company, v_contacts
      FROM public.shared_fields_deals d
     WHERE d.id = p_entity_id;
    IF v_workspace IS NULL THEN
      RETURN jsonb_build_object('items','[]'::jsonb,'total',0,'counts','{}'::jsonb,'has_more',false,'next_at',NULL,'next_id',NULL);
    END IF;
    v_entity_pred := 'a.workspace_id = $1 AND (a.related_deal_id = $2 OR (cardinality($3) > 0 AND a.related_contact_id = ANY($3)) OR ($4 IS NOT NULL AND a.related_company_id = $4))';
  ELSIF p_entity_kind = 'lead' THEN
    v_entity_pred := 'a.related_lead_id = $2';
  ELSIF p_entity_kind = 'contact' THEN
    v_entity_pred := 'a.related_contact_id = $2';
  ELSIF p_entity_kind = 'company' THEN
    v_entity_pred := 'a.related_company_id = $2';
  ELSE
    v_entity_pred := 'a.related_ticket_id = $2';
  END IF;

  -- Single index-backed pass per entity kind (no CASE predicate, no duplicate RLS evaluation).
  EXECUTE format($q$
    WITH scoped AS MATERIALIZED (
      SELECT a.id,a.owner_id,a.type,a.subject,a.body,a.due_date,a.completed,a.related_lead_id,a.related_contact_id,a.related_company_id,a.related_deal_id,a.created_at,a.updated_at,a.outcome,a.outcome_set_at,a.external_ids,a.duration_ms,a.disposition,a.recording_url,a.meeting_outcome,a.meeting_location,a.task_status,a.task_priority,a.email_direction,a.email_status,a.hubspot_owner_id,a.hs_object_id,a.hs_createdate,a.hs_lastmodifieddate,a.mentions,a.attachments,a.relink_checked_at,a.workspace_id,a.deleted_at,a.created_by,a.recording_sid,a.recording_duration_seconds,a.recording_channels,a.transcription,a.transcription_status,a.transcription_model,a.related_ticket_id,a.custom_fields,a.meeting_key,a.remind_before_minutes,a.reminder_sent_at,a.assigned_to,a.activity_date,a.task_type,a.recurrence,a.recurrence_parent_id,a.contacted_contact_ids,a.pinned_at,a.follow_up_of,
        CASE WHEN $5 = 'deal' AND a.related_deal_id IS DISTINCT FROM $2 THEN CASE WHEN a.related_contact_id = ANY($3) THEN 'contact' ELSE 'company' END ELSE NULL END AS timeline_related_via,
        COALESCE(a.hs_createdate, a.created_at) AS effective_at,
        CASE WHEN a.type IN ('call','email','whatsapp','task','meeting','survey') THEN a.type::text WHEN a.type IN ('sms','linkedin_message','postal_mail') THEN 'message' ELSE 'note' END AS category
      FROM public.activities a
      WHERE a.deleted_at IS NULL
        AND (%s)
        AND ($6 IS NULL OR COALESCE(a.hs_createdate, a.created_at) >= $6)
        AND ($7 IS NULL OR COALESCE(a.hs_createdate, a.created_at) < $7)
        AND ($8 IS NULL OR cardinality($8) = 0 OR CASE WHEN a.type IN ('call','email','whatsapp','task','meeting','survey') THEN a.type::text WHEN a.type IN ('sms','linkedin_message','postal_mail') THEN 'message' ELSE 'note' END = ANY($8))
        AND ((COALESCE(cardinality($9), 0) = 0 AND NOT COALESCE($10, false)) OR (COALESCE(cardinality($9), 0) > 0 AND COALESCE(a.assigned_to, a.owner_id) = ANY($9)) OR (COALESCE($10, false) AND COALESCE(a.assigned_to, a.owner_id) IS NULL))
        AND (NULLIF(btrim($11), '') IS NULL OR concat_ws(' ', a.subject, a.body) ILIKE '%%' || $11 || '%%' OR EXISTS (
          SELECT 1 FROM public.email_messages em
          WHERE em.id = CASE WHEN (a.external_ids->>'email_message_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN (a.external_ids->>'email_message_id')::uuid ELSE NULL END
            AND concat_ws(' ', em.from_name, em.from_email, em.subject, em.body_text, em.body_html) ILIKE '%%' || $11 || '%%'
        ))
    ),
    counts AS (
      SELECT COALESCE(sum(n), 0)::bigint AS total, COALESCE(jsonb_object_agg(category, n), '{}'::jsonb) AS categories
      FROM (SELECT category, count(*)::bigint AS n FROM scoped GROUP BY category) c
    ),
    page_plus AS (
      SELECT * FROM scoped
      WHERE $12 IS NULL OR (effective_at, id) < ($12, $13)
      ORDER BY effective_at DESC, id DESC LIMIT $14 + 1
    ),
    page AS (SELECT * FROM page_plus ORDER BY effective_at DESC, id DESC LIMIT $14),
    tail AS (SELECT effective_at, id FROM page ORDER BY effective_at ASC, id ASC LIMIT 1)
    SELECT jsonb_build_object(
      'items', COALESCE((SELECT jsonb_agg(to_jsonb(p) - 'effective_at' - 'category' ORDER BY effective_at DESC, id DESC) FROM page p), '[]'::jsonb),
      'total', COALESCE((SELECT total FROM counts), 0),
      'counts', COALESCE((SELECT categories FROM counts), '{}'::jsonb),
      'has_more', (SELECT count(*) > $14 FROM page_plus),
      'next_at', CASE WHEN (SELECT count(*) > $14 FROM page_plus) THEN (SELECT effective_at FROM tail) ELSE NULL END,
      'next_id', CASE WHEN (SELECT count(*) > $14 FROM page_plus) THEN (SELECT id FROM tail) ELSE NULL END
    )
  $q$, v_entity_pred)
  INTO v_result
  USING v_workspace, p_entity_id, v_contacts, v_company, p_entity_kind, p_since, p_until, p_categories, p_assignees, p_include_unassigned, p_search, p_cursor_at, p_cursor_id, v_limit;

  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_timeline_calendar_page(
  p_entity_kind text,
  p_entity_id uuid,
  p_since timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_until timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_search text DEFAULT NULL::text,
  p_cursor_at timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_cursor_id uuid DEFAULT NULL::uuid,
  p_page_size integer DEFAULT 40
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_page_size, 40), 1), 100);
  v_contact_ids uuid[] := ARRAY[]::uuid[];
  v_activity_ids uuid[] := ARRAY[]::uuid[];
  v_mirrored_cids text[] := ARRAY[]::text[];
  v_workspace_id uuid;
  v_search text := NULLIF(btrim(COALESCE(p_search, '')), '');
  v_result jsonb;
BEGIN
  IF p_entity_kind NOT IN ('lead','contact','company','deal','ticket') THEN
    RAISE EXCEPTION 'invalid entity kind';
  END IF;
  IF (p_cursor_at IS NULL) <> (p_cursor_id IS NULL) THEN
    RAISE EXCEPTION 'cursor timestamp and id must be provided together';
  END IF;

  IF p_entity_kind = 'contact' THEN
    v_contact_ids := ARRAY[p_entity_id];
    SELECT c.workspace_id INTO v_workspace_id FROM public.contacts c WHERE c.id = p_entity_id;
  ELSIF p_entity_kind = 'deal' THEN
    SELECT d.workspace_id,
      COALESCE(array_remove(ARRAY[d.primary_contact_id] || ARRAY(SELECT dc.contact_id FROM public.deal_contacts dc WHERE dc.deal_id = d.id), NULL), ARRAY[]::uuid[])
      INTO v_workspace_id, v_contact_ids
      FROM public.deals d WHERE d.id = p_entity_id;
    SELECT COALESCE(array_agg(DISTINCT c), ARRAY[]::uuid[]) INTO v_contact_ids FROM unnest(v_contact_ids) AS c;
  ELSIF p_entity_kind = 'company' THEN
    SELECT co.workspace_id INTO v_workspace_id FROM public.companies co WHERE co.id = p_entity_id;
    IF v_workspace_id IS NOT NULL THEN
      SELECT COALESCE(array_agg(c.id), ARRAY[]::uuid[]) INTO v_contact_ids FROM public.contacts c WHERE c.company_id = p_entity_id;
    END IF;
  ELSIF p_entity_kind = 'lead' THEN
    SELECT l.workspace_id INTO v_workspace_id FROM public.leads l WHERE l.id = p_entity_id;
  ELSE
    SELECT t.workspace_id INTO v_workspace_id FROM public.tickets t WHERE t.id = p_entity_id;
  END IF;

  IF v_workspace_id IS NULL THEN
    RETURN jsonb_build_object('items','[]'::jsonb,'total',0,'has_more',false,'next_at',NULL,'next_id',NULL);
  END IF;

  -- Single index-backed pass over activities collects both related activity IDs and mirrored calendar_event_ids.
  IF p_entity_kind = 'contact' THEN
    SELECT COALESCE(array_agg(a.external_ids->>'calendar_event_id') FILTER (WHERE a.deleted_at IS NULL AND a.external_ids ? 'calendar_event_id' AND a.external_ids->>'calendar_event_id' IS NOT NULL), ARRAY[]::text[])
      INTO v_mirrored_cids
      FROM public.activities a
     WHERE a.related_contact_id = p_entity_id;
  ELSIF p_entity_kind = 'deal' THEN
    SELECT COALESCE(array_agg(a.id) FILTER (WHERE a.workspace_id = v_workspace_id), ARRAY[]::uuid[]),
           COALESCE(array_agg(a.external_ids->>'calendar_event_id') FILTER (WHERE a.deleted_at IS NULL AND a.external_ids ? 'calendar_event_id' AND a.external_ids->>'calendar_event_id' IS NOT NULL), ARRAY[]::text[])
      INTO v_activity_ids, v_mirrored_cids
      FROM public.activities a
     WHERE a.related_deal_id = p_entity_id;
  ELSIF p_entity_kind = 'lead' THEN
    SELECT COALESCE(array_agg(a.id) FILTER (WHERE a.workspace_id = v_workspace_id), ARRAY[]::uuid[]),
           COALESCE(array_agg(a.external_ids->>'calendar_event_id') FILTER (WHERE a.deleted_at IS NULL AND a.external_ids ? 'calendar_event_id' AND a.external_ids->>'calendar_event_id' IS NOT NULL), ARRAY[]::text[])
      INTO v_activity_ids, v_mirrored_cids
      FROM public.activities a
     WHERE a.related_lead_id = p_entity_id;
  ELSIF p_entity_kind = 'ticket' THEN
    SELECT COALESCE(array_agg(a.id) FILTER (WHERE a.workspace_id = v_workspace_id), ARRAY[]::uuid[]),
           COALESCE(array_agg(a.external_ids->>'calendar_event_id') FILTER (WHERE a.deleted_at IS NULL AND a.external_ids ? 'calendar_event_id' AND a.external_ids->>'calendar_event_id' IS NOT NULL), ARRAY[]::text[])
      INTO v_activity_ids, v_mirrored_cids
      FROM public.activities a
     WHERE a.related_ticket_id = p_entity_id;
  ELSE
    SELECT COALESCE(array_agg(DISTINCT a.id) FILTER (WHERE a.workspace_id = v_workspace_id), ARRAY[]::uuid[]),
           COALESCE(array_agg(a.external_ids->>'calendar_event_id') FILTER (WHERE a.related_company_id = p_entity_id AND a.deleted_at IS NULL AND a.external_ids ? 'calendar_event_id' AND a.external_ids->>'calendar_event_id' IS NOT NULL), ARRAY[]::text[])
      INTO v_activity_ids, v_mirrored_cids
      FROM public.activities a
     WHERE a.related_company_id = p_entity_id
        OR (cardinality(v_contact_ids) > 0 AND a.related_contact_id = ANY(v_contact_ids));
  END IF;

  WITH contact_events AS MATERIALIZED (
    SELECT ce.id, ce.calendar_account_id, ce.recurring_event_id, ce.title, ce.description,
      ce.start_at, ce.end_at, ce.location, ce.html_link, ce.hangout_link, ce.attendees,
      ce.recording_url, ce.related_contact_id, ce.created_at
    FROM public.calendar_events ce
    WHERE p_entity_kind IN ('contact','deal','company')
      AND cardinality(v_contact_ids) > 0
      AND ce.workspace_id = v_workspace_id
      AND ce.related_contact_id = ANY(v_contact_ids)
      AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(COALESCE(ce.attendees, '[]'::jsonb)) att
        WHERE lower(att->>'email') LIKE '%@wktechnology.com.br'
           OR lower(att->>'email') LIKE '%@wkconsultoria.com.br'
      )
  ),
  candidate_recurring AS MATERIALIZED (
    SELECT DISTINCT ce.calendar_account_id, ce.recurring_event_id
    FROM contact_events ce
    WHERE ce.recurring_event_id IS NOT NULL
  ),
  candidate_nonrecurring AS MATERIALIZED (
    SELECT DISTINCT ce.calendar_account_id, ce.title AS series_title
    FROM contact_events ce
    WHERE ce.recurring_event_id IS NULL
      AND ce.title IS NOT NULL AND ce.title <> ''
  ),
  long_recurring AS MATERIALIZED (
    SELECT cs.calendar_account_id, cs.recurring_event_id
    FROM candidate_recurring cs
    WHERE (SELECT count(*) FROM (
      SELECT 1 FROM public.calendar_events s
      WHERE s.calendar_account_id = cs.calendar_account_id
        AND s.recurring_event_id IS NOT NULL
        AND s.recurring_event_id = cs.recurring_event_id
      LIMIT 6
    ) visible_siblings) >= 6
  ),
  long_nonrecurring AS MATERIALIZED (
    SELECT cs.calendar_account_id, cs.series_title
    FROM candidate_nonrecurring cs
    WHERE (SELECT count(*) FROM (
      SELECT 1 FROM public.calendar_events s
      WHERE s.calendar_account_id = cs.calendar_account_id
        AND s.recurring_event_id IS NULL
        AND s.title IS NOT NULL AND s.title <> ''
        AND s.title = cs.series_title
      LIMIT 6
    ) visible_siblings) >= 6
  ),
  combined AS (
    SELECT ce.id, ce.title, ce.description, ce.start_at, ce.end_at, ce.location, ce.html_link, ce.hangout_link,
      ce.attendees, ce.recording_url, ce.related_contact_id, ce.created_at
    FROM contact_events ce
    WHERE NOT (
      (ce.recurring_event_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM long_recurring lr
        WHERE lr.calendar_account_id = ce.calendar_account_id
          AND lr.recurring_event_id = ce.recurring_event_id
      ))
      OR (ce.recurring_event_id IS NULL AND ce.title IS NOT NULL AND ce.title <> '' AND EXISTS (
        SELECT 1 FROM long_nonrecurring ln
        WHERE ln.calendar_account_id = ce.calendar_account_id
          AND ln.series_title = ce.title
      ))
    )
    UNION
    SELECT ce.id, ce.title, ce.description, ce.start_at, ce.end_at, ce.location, ce.html_link, ce.hangout_link,
      ce.attendees, ce.recording_url, ce.related_contact_id, ce.created_at
    FROM public.calendar_events ce
    WHERE cardinality(v_activity_ids) > 0
      AND ce.workspace_id = v_workspace_id
      AND ce.related_activity_id = ANY(v_activity_ids)
  ),
  scoped AS MATERIALIZED (
    SELECT c.*, COALESCE(c.start_at, c.created_at) AS effective_at
    FROM combined c
    WHERE NOT (c.id::text = ANY(v_mirrored_cids))
      AND (p_since IS NULL OR COALESCE(c.start_at, c.created_at) >= p_since)
      AND (p_until IS NULL OR COALESCE(c.start_at, c.created_at) < p_until)
      AND (v_search IS NULL OR concat_ws(' ', c.title, c.description, c.location) ILIKE '%'||v_search||'%')
  ),
  page_plus AS (
    SELECT * FROM scoped
    WHERE p_cursor_at IS NULL OR (effective_at, id) < (p_cursor_at, p_cursor_id)
    ORDER BY effective_at DESC, id DESC LIMIT v_limit + 1
  ),
  page AS (SELECT * FROM page_plus ORDER BY effective_at DESC, id DESC LIMIT v_limit),
  tail AS (SELECT effective_at, id FROM page ORDER BY effective_at ASC, id ASC LIMIT 1)
  SELECT jsonb_build_object(
    'items', COALESCE((SELECT jsonb_agg(to_jsonb(p) - 'effective_at' ORDER BY effective_at DESC, id DESC) FROM page p), '[]'::jsonb),
    'total', (SELECT count(*) FROM scoped),
    'has_more', (SELECT count(*) > v_limit FROM page_plus),
    'next_at', CASE WHEN (SELECT count(*) > v_limit FROM page_plus) THEN (SELECT effective_at FROM tail) END,
    'next_id', CASE WHEN (SELECT count(*) > v_limit FROM page_plus) THEN (SELECT id FROM tail) END)
  INTO v_result;
  RETURN v_result;
END;
$function$;