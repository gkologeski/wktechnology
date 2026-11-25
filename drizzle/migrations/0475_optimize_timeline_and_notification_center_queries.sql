CREATE INDEX IF NOT EXISTS calendar_events_ws_contact_idx
  ON public.calendar_events (workspace_id, related_contact_id)
  WHERE related_contact_id IS NOT NULL;

ALTER POLICY sales_view ON public.calendar_events
USING (((workspace_id::text || ':system.calendars') IN (SELECT public.sales_full_grants('{system.calendars}'::text[], 'view')))
  OR public.sales_context_access((SELECT public.sales_policy_context('{system.calendars}'::text[])), workspace_id, 'system.calendars'::text, 'view'::text, ARRAY[owner_id]));

ALTER POLICY rep_scope_select_calendar_events ON public.calendar_events
USING ((NOT (workspace_id IN (SELECT public.rep_restricted_workspaces_for('activities'::text, 'view'::text))))
  OR (owner_id = (SELECT auth.uid()))
  OR (related_contact_id IN (SELECT public.rep_my_contact_ids()))
  OR (EXISTS (SELECT 1 FROM public.activities a WHERE a.id = calendar_events.related_activity_id AND a.workspace_id = calendar_events.workspace_id))
  OR ((workspace_id IN (SELECT public.my_perm_workspaces('techsales.activities.view.team'::text))) AND (owner_id IN (SELECT public.my_team_member_ids()))));

ALTER POLICY sales_view ON public.email_threads
USING (((workspace_id::text || ':techsales.inbox.email') IN (SELECT public.sales_full_grants('{techsales.inbox.email}'::text[], 'view')))
  OR public.sales_context_access((SELECT public.sales_policy_context('{techsales.inbox.email}'::text[])), workspace_id, 'techsales.inbox.email'::text, 'view'::text, ARRAY[COALESCE(assigned_to, owner_id)]));

ALTER POLICY rep_scope_select_email_threads ON public.email_threads
USING ((NOT (workspace_id IN (SELECT public.rep_restricted_workspaces_for('inbox.email'::text, 'view'::text))))
  OR (owner_id = (SELECT auth.uid()))
  OR (assigned_to = (SELECT auth.uid()))
  OR (lead_id IN (SELECT public.rep_my_lead_ids()))
  OR (deal_id IN (SELECT public.rep_my_deal_ids()))
  OR (contact_id IN (SELECT public.rep_my_contact_ids()))
  OR (company_id IN (SELECT public.rep_my_company_ids()))
  OR ((workspace_id IN (SELECT public.my_perm_workspaces('techsales.inbox.email.view.team'::text)))
      AND ((owner_id IN (SELECT public.my_team_member_ids())) OR (assigned_to IN (SELECT public.my_team_member_ids())))));

ALTER POLICY sales_view ON public.email_messages
USING (EXISTS (
  SELECT 1 FROM public.email_threads parent_email_threads
  WHERE parent_email_threads.id = email_messages.thread_id
    AND email_messages.workspace_id = parent_email_threads.workspace_id
    AND (((parent_email_threads.workspace_id::text || ':techsales.inbox.email') IN (SELECT public.sales_full_grants('{techsales.inbox.email}'::text[], 'view')))
      OR public.sales_context_access((SELECT public.sales_policy_context('{techsales.inbox.email}'::text[])), parent_email_threads.workspace_id, 'techsales.inbox.email'::text, 'view'::text, ARRAY[COALESCE(parent_email_threads.assigned_to, parent_email_threads.owner_id)]))
));

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
  v_activity_cal_ids uuid[] := ARRAY[]::uuid[];
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
    SELECT d.workspace_id INTO v_workspace_id FROM public.deals d WHERE d.id = p_entity_id;
    SELECT COALESCE(array_agg(DISTINCT c), ARRAY[]::uuid[]) INTO v_contact_ids FROM (
      SELECT d.primary_contact_id AS c FROM public.deals d WHERE d.id = p_entity_id AND d.primary_contact_id IS NOT NULL
      UNION
      SELECT dc.contact_id FROM public.deal_contacts dc WHERE dc.deal_id = p_entity_id
    ) s WHERE c IS NOT NULL;
  ELSIF p_entity_kind = 'company' THEN
    SELECT co.workspace_id INTO v_workspace_id FROM public.companies co WHERE co.id = p_entity_id;
    SELECT COALESCE(array_agg(c.id), ARRAY[]::uuid[]) INTO v_contact_ids FROM public.contacts c WHERE c.company_id = p_entity_id;
  ELSIF p_entity_kind = 'lead' THEN
    SELECT l.workspace_id INTO v_workspace_id FROM public.leads l WHERE l.id = p_entity_id;
  ELSE
    SELECT t.workspace_id INTO v_workspace_id FROM public.tickets t WHERE t.id = p_entity_id;
  END IF;

  IF v_workspace_id IS NULL THEN
    RETURN jsonb_build_object('items','[]'::jsonb,'total',0,'has_more',false,'next_at',NULL,'next_id',NULL);
  END IF;

  -- Index-backed lookup per entity kind avoids generic-plan Seq Scans on activities.
  IF p_entity_kind = 'contact' THEN
    SELECT COALESCE(array_agg(a.external_ids->>'calendar_event_id'), ARRAY[]::text[])
      INTO v_mirrored_cids
      FROM public.activities a
     WHERE a.deleted_at IS NULL
       AND a.related_contact_id = p_entity_id
       AND a.external_ids ? 'calendar_event_id'
       AND a.external_ids->>'calendar_event_id' IS NOT NULL;
  ELSIF p_entity_kind = 'deal' THEN
    SELECT COALESCE(array_agg(DISTINCT ce.id), ARRAY[]::uuid[])
      INTO v_activity_cal_ids
      FROM public.activities a
      JOIN public.calendar_events ce ON ce.related_activity_id = a.id
     WHERE a.workspace_id = v_workspace_id
       AND ce.workspace_id = v_workspace_id
       AND a.related_deal_id = p_entity_id;
    SELECT COALESCE(array_agg(a.external_ids->>'calendar_event_id'), ARRAY[]::text[])
      INTO v_mirrored_cids
      FROM public.activities a
     WHERE a.deleted_at IS NULL
       AND a.related_deal_id = p_entity_id
       AND a.external_ids ? 'calendar_event_id'
       AND a.external_ids->>'calendar_event_id' IS NOT NULL;
  ELSIF p_entity_kind = 'lead' THEN
    SELECT COALESCE(array_agg(DISTINCT ce.id), ARRAY[]::uuid[])
      INTO v_activity_cal_ids
      FROM public.activities a
      JOIN public.calendar_events ce ON ce.related_activity_id = a.id
     WHERE a.workspace_id = v_workspace_id
       AND ce.workspace_id = v_workspace_id
       AND a.related_lead_id = p_entity_id;
    SELECT COALESCE(array_agg(a.external_ids->>'calendar_event_id'), ARRAY[]::text[])
      INTO v_mirrored_cids
      FROM public.activities a
     WHERE a.deleted_at IS NULL
       AND a.related_lead_id = p_entity_id
       AND a.external_ids ? 'calendar_event_id'
       AND a.external_ids->>'calendar_event_id' IS NOT NULL;
  ELSIF p_entity_kind = 'ticket' THEN
    SELECT COALESCE(array_agg(DISTINCT ce.id), ARRAY[]::uuid[])
      INTO v_activity_cal_ids
      FROM public.activities a
      JOIN public.calendar_events ce ON ce.related_activity_id = a.id
     WHERE a.workspace_id = v_workspace_id
       AND ce.workspace_id = v_workspace_id
       AND a.related_ticket_id = p_entity_id;
    SELECT COALESCE(array_agg(a.external_ids->>'calendar_event_id'), ARRAY[]::text[])
      INTO v_mirrored_cids
      FROM public.activities a
     WHERE a.deleted_at IS NULL
       AND a.related_ticket_id = p_entity_id
       AND a.external_ids ? 'calendar_event_id'
       AND a.external_ids->>'calendar_event_id' IS NOT NULL;
  ELSE
    SELECT COALESCE(array_agg(DISTINCT ce_id), ARRAY[]::uuid[])
      INTO v_activity_cal_ids
      FROM (
        SELECT ce.id AS ce_id
          FROM public.activities a
          JOIN public.calendar_events ce ON ce.related_activity_id = a.id
         WHERE a.workspace_id = v_workspace_id
           AND ce.workspace_id = v_workspace_id
           AND a.related_company_id = p_entity_id
        UNION ALL
        SELECT ce.id AS ce_id
          FROM public.activities a
          JOIN public.calendar_events ce ON ce.related_activity_id = a.id
         WHERE a.workspace_id = v_workspace_id
           AND ce.workspace_id = v_workspace_id
           AND cardinality(v_contact_ids) > 0
           AND a.related_contact_id = ANY(v_contact_ids)
      ) comp_cals;
    SELECT COALESCE(array_agg(a.external_ids->>'calendar_event_id'), ARRAY[]::text[])
      INTO v_mirrored_cids
      FROM public.activities a
     WHERE a.deleted_at IS NULL
       AND a.related_company_id = p_entity_id
       AND a.external_ids ? 'calendar_event_id'
       AND a.external_ids->>'calendar_event_id' IS NOT NULL;
  END IF;

  WITH contact_events AS MATERIALIZED (
    SELECT ce.id, ce.calendar_account_id, ce.recurring_event_id, ce.title
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
    -- Dedicated branch matches partial index calendar_events_recurring_event_idx under caller RLS.
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
    -- Dedicated branch matches partial index calendar_events_account_nonrecurring_title_idx under caller RLS.
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
  linked AS (
    SELECT ce.id FROM contact_events ce
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
    SELECT id FROM unnest(v_activity_cal_ids) AS id
  ),
  scoped AS MATERIALIZED (
    SELECT ce.id, ce.title, ce.description, ce.start_at, ce.end_at, ce.location, ce.html_link, ce.hangout_link,
      ce.attendees, ce.recording_url, ce.related_contact_id, ce.created_at, COALESCE(ce.start_at, ce.created_at) AS effective_at
    FROM public.calendar_events ce JOIN linked l ON l.id = ce.id
    WHERE NOT (ce.id::text = ANY(v_mirrored_cids))
      AND (p_since IS NULL OR COALESCE(ce.start_at, ce.created_at) >= p_since)
      AND (p_until IS NULL OR COALESCE(ce.start_at, ce.created_at) < p_until)
      AND (v_search IS NULL OR concat_ws(' ', ce.title, ce.description, ce.location) ILIKE '%'||v_search||'%')
  ),
  page_plus AS (
    SELECT * FROM scoped
    WHERE p_cursor_at IS NULL OR (effective_at, id) < (p_cursor_at, p_cursor_id)
    ORDER BY effective_at DESC, id DESC LIMIT v_limit + 1
  ),
  page AS (SELECT * FROM page_plus ORDER BY effective_at DESC, id DESC LIMIT v_limit),
  tail AS (SELECT effective_at, id FROM page ORDER BY effective_at ASC, id ASC LIMIT 1)
  SELECT jsonb_build_object(
    'items', COALESCE((SELECT jsonb_agg(to_jsonb(p) - 'effective_at' ORDER BY effective_at DESC, id DESC) FROM page p),'[]'::jsonb),
    'total', (SELECT count(*) FROM scoped),
    'has_more', (SELECT count(*) > v_limit FROM page_plus),
    'next_at', CASE WHEN (SELECT count(*) > v_limit FROM page_plus) THEN (SELECT effective_at FROM tail) END,
    'next_id', CASE WHEN (SELECT count(*) > v_limit FROM page_plus) THEN (SELECT id FROM tail) END)
  INTO v_result;
  RETURN v_result;
END;
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
  v_candidate_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  IF p_entity_kind NOT IN ('lead','contact','company','deal','ticket') THEN
    RAISE EXCEPTION 'invalid entity kind';
  END IF;
  IF (p_cursor_at IS NULL) <> (p_cursor_id IS NULL) THEN
    RAISE EXCEPTION 'cursor timestamp and id must be provided together';
  END IF;

  -- Index-backed lookup per entity kind avoids generic-plan Seq Scans on activities.
  IF p_entity_kind = 'deal' THEN
    SELECT d.workspace_id, d.company_id,
      array_remove(ARRAY[d.primary_contact_id] || ARRAY(SELECT dc.contact_id FROM public.deal_contacts dc WHERE dc.deal_id = d.id), NULL)
      INTO v_workspace, v_company, v_contacts
      FROM public.shared_fields_deals d
     WHERE d.id = p_entity_id;
    IF v_workspace IS NOT NULL THEN
      SELECT COALESCE(array_agg(DISTINCT id), ARRAY[]::uuid[]) INTO v_candidate_ids FROM (
        SELECT a.id FROM public.activities a
         WHERE a.deleted_at IS NULL AND a.workspace_id = v_workspace AND a.related_deal_id = p_entity_id
           AND (p_since IS NULL OR COALESCE(a.hs_createdate, a.created_at) >= p_since)
           AND (p_until IS NULL OR COALESCE(a.hs_createdate, a.created_at) < p_until)
        UNION ALL
        SELECT a.id FROM public.activities a
         WHERE a.deleted_at IS NULL AND a.workspace_id = v_workspace
           AND cardinality(v_contacts) > 0 AND a.related_contact_id = ANY(v_contacts)
           AND (p_since IS NULL OR COALESCE(a.hs_createdate, a.created_at) >= p_since)
           AND (p_until IS NULL OR COALESCE(a.hs_createdate, a.created_at) < p_until)
        UNION ALL
        SELECT a.id FROM public.activities a
         WHERE a.deleted_at IS NULL AND a.workspace_id = v_workspace
           AND v_company IS NOT NULL AND a.related_company_id = v_company
           AND (p_since IS NULL OR COALESCE(a.hs_createdate, a.created_at) >= p_since)
           AND (p_until IS NULL OR COALESCE(a.hs_createdate, a.created_at) < p_until)
      ) deal_acts;
    END IF;
  ELSIF p_entity_kind = 'lead' THEN
    SELECT COALESCE(array_agg(a.id), ARRAY[]::uuid[]) INTO v_candidate_ids
      FROM public.activities a
     WHERE a.deleted_at IS NULL AND a.related_lead_id = p_entity_id
       AND (p_since IS NULL OR COALESCE(a.hs_createdate, a.created_at) >= p_since)
       AND (p_until IS NULL OR COALESCE(a.hs_createdate, a.created_at) < p_until);
  ELSIF p_entity_kind = 'contact' THEN
    SELECT COALESCE(array_agg(a.id), ARRAY[]::uuid[]) INTO v_candidate_ids
      FROM public.activities a
     WHERE a.deleted_at IS NULL AND a.related_contact_id = p_entity_id
       AND (p_since IS NULL OR COALESCE(a.hs_createdate, a.created_at) >= p_since)
       AND (p_until IS NULL OR COALESCE(a.hs_createdate, a.created_at) < p_until);
  ELSIF p_entity_kind = 'company' THEN
    SELECT COALESCE(array_agg(a.id), ARRAY[]::uuid[]) INTO v_candidate_ids
      FROM public.activities a
     WHERE a.deleted_at IS NULL AND a.related_company_id = p_entity_id
       AND (p_since IS NULL OR COALESCE(a.hs_createdate, a.created_at) >= p_since)
       AND (p_until IS NULL OR COALESCE(a.hs_createdate, a.created_at) < p_until);
  ELSE
    SELECT COALESCE(array_agg(a.id), ARRAY[]::uuid[]) INTO v_candidate_ids
      FROM public.activities a
     WHERE a.deleted_at IS NULL AND a.related_ticket_id = p_entity_id
       AND (p_since IS NULL OR COALESCE(a.hs_createdate, a.created_at) >= p_since)
       AND (p_until IS NULL OR COALESCE(a.hs_createdate, a.created_at) < p_until);
  END IF;

  IF COALESCE(cardinality(v_candidate_ids), 0) = 0 THEN
    RETURN jsonb_build_object('items','[]'::jsonb,'total',0,'counts','{}'::jsonb,'has_more',false,'next_at',NULL,'next_id',NULL);
  END IF;

  WITH scoped AS MATERIALIZED (
    SELECT a.id,a.owner_id,a.type,a.subject,a.body,a.due_date,a.completed,a.related_lead_id,a.related_contact_id,a.related_company_id,a.related_deal_id,a.created_at,a.updated_at,a.outcome,a.outcome_set_at,a.external_ids,a.duration_ms,a.disposition,a.recording_url,a.meeting_outcome,a.meeting_location,a.task_status,a.task_priority,a.email_direction,a.email_status,a.hubspot_owner_id,a.hs_object_id,a.hs_createdate,a.hs_lastmodifieddate,a.mentions,a.attachments,a.relink_checked_at,a.workspace_id,a.deleted_at,a.created_by,a.recording_sid,a.recording_duration_seconds,a.recording_channels,a.transcription,a.transcription_status,a.transcription_model,a.related_ticket_id,a.custom_fields,a.meeting_key,a.remind_before_minutes,a.reminder_sent_at,a.assigned_to,a.activity_date,a.task_type,a.recurrence,a.recurrence_parent_id,a.contacted_contact_ids,a.pinned_at,a.follow_up_of,
      CASE WHEN p_entity_kind='deal' AND a.related_deal_id IS DISTINCT FROM p_entity_id THEN CASE WHEN a.related_contact_id=ANY(v_contacts) THEN 'contact' ELSE 'company' END ELSE NULL END AS timeline_related_via,
      COALESCE(a.hs_createdate,a.created_at) effective_at,
      CASE WHEN a.type IN ('call','email','whatsapp','task','meeting','survey') THEN a.type::text WHEN a.type IN ('sms','linkedin_message','postal_mail') THEN 'message' ELSE 'note' END category
    FROM public.activities a
    WHERE a.id = ANY(v_candidate_ids)
      AND a.deleted_at IS NULL
      AND (p_categories IS NULL OR cardinality(p_categories)=0 OR CASE WHEN a.type IN ('call','email','whatsapp','task','meeting','survey') THEN a.type::text WHEN a.type IN ('sms','linkedin_message','postal_mail') THEN 'message' ELSE 'note' END=ANY(p_categories))
      AND ((COALESCE(cardinality(p_assignees),0)=0 AND NOT COALESCE(p_include_unassigned,false)) OR (COALESCE(cardinality(p_assignees),0)>0 AND COALESCE(a.assigned_to,a.owner_id)=ANY(p_assignees)) OR (COALESCE(p_include_unassigned,false) AND COALESCE(a.assigned_to,a.owner_id) IS NULL))
      AND (NULLIF(btrim(p_search),'') IS NULL OR concat_ws(' ',a.subject,a.body) ILIKE '%'||p_search||'%' OR EXISTS (SELECT 1 FROM public.email_messages em WHERE em.id=CASE WHEN (a.external_ids->>'email_message_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN (a.external_ids->>'email_message_id')::uuid ELSE NULL END AND concat_ws(' ',em.from_name,em.from_email,em.subject,em.body_text,em.body_html) ILIKE '%'||p_search||'%'))
  ),
  counts AS (
    SELECT COALESCE(sum(n),0)::bigint total, COALESCE(jsonb_object_agg(category,n),'{}'::jsonb) categories
    FROM (SELECT category, count(*)::bigint n FROM scoped GROUP BY category) c
  ),
  page_plus AS (
    SELECT * FROM scoped WHERE p_cursor_at IS NULL OR (effective_at,id)<(p_cursor_at,p_cursor_id)
    ORDER BY effective_at DESC, id DESC LIMIT v_limit+1
  ),
  page AS (SELECT * FROM page_plus ORDER BY effective_at DESC, id DESC LIMIT v_limit),
  tail AS (SELECT effective_at, id FROM page ORDER BY effective_at ASC, id ASC LIMIT 1)
  SELECT jsonb_build_object(
    'items', COALESCE((SELECT jsonb_agg(to_jsonb(p)-'effective_at'-'category' ORDER BY effective_at DESC,id DESC) FROM page p),'[]'::jsonb),
    'total', COALESCE((SELECT total FROM counts),0),
    'counts', COALESCE((SELECT categories FROM counts),'{}'::jsonb),
    'has_more', (SELECT count(*)>v_limit FROM page_plus),
    'next_at', CASE WHEN (SELECT count(*)>v_limit FROM page_plus) THEN (SELECT effective_at FROM tail) ELSE NULL END,
    'next_id', CASE WHEN (SELECT count(*)>v_limit FROM page_plus) THEN (SELECT id FROM tail) ELSE NULL END
  ) INTO v_result;
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notification_center_badge(p_workspace uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  u uuid := techerp_api.notification_center_actor(p_workspace);
  unread_count integer;
BEGIN
  -- Materialize caller's unread workspace-proven rows first so per-row visibility checks never run on other users' rows.
  WITH own_unread AS MATERIALIZED (
    SELECT n.id, n.created_at, c.source_table, c.source_id
    FROM public.notifications n
    JOIN public.notification_workspace_context c ON c.notification_id = n.id
    WHERE n.user_id = u
      AND n.workspace_id = p_workspace
      AND c.workspace_id = p_workspace
      AND n.entity_id = c.source_id
      AND n.created_at <= statement_timestamp()
      AND n.read_at IS NULL
      AND (n.snoozed_until IS NULL OR n.snoozed_until <= statement_timestamp())
    ORDER BY n.created_at DESC, n.id DESC
  )
  SELECT count(*)::integer INTO unread_count FROM (
    SELECT 1 FROM own_unread j
    WHERE techerp_api.notification_hr_notice_visible(j.id, u)
      AND techerp_api.notification_center_source_visible(p_workspace, u, j.source_table, j.source_id)
    ORDER BY j.created_at DESC, j.id DESC LIMIT 100
  ) eligible;
  RETURN jsonb_build_object('unread', unread_count, 'unreadCapped', unread_count = 100, 'checkedAt', statement_timestamp());
END
$function$;

CREATE OR REPLACE FUNCTION public.notification_center_list(
  p_workspace uuid,
  p_scope text DEFAULT 'workspace'::text,
  p_status text DEFAULT 'all'::text,
  p_category text DEFAULT NULL::text,
  p_q text DEFAULT ''::text,
  p_cursor jsonb DEFAULT NULL::jsonb,
  p_cutoff timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_module text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  u uuid := techerp_api.notification_center_actor(p_workspace);
  cutoff timestamptz := coalesce(p_cutoff, statement_timestamp());
  cursor_at timestamptz;
  cursor_id uuid;
  pattern text;
  result jsonb;
BEGIN
  IF p_scope IS NULL OR p_scope NOT IN('workspace','legacy') OR p_status IS NULL
   OR p_status NOT IN('all','unread','read','snoozed') OR p_q IS NULL OR length(p_q)>120
   OR (p_category IS NOT NULL AND p_category NOT IN('mention','assignment','deal_stage','ticket','task','sla','message',
    'workflow','approval','hiring','form','portfolio','platform')) OR cutoff>statement_timestamp()+interval '1 second' THEN
   RAISE EXCEPTION 'Filtro de notificações inválido.' USING ERRCODE='22023';END IF;
  IF p_module IS NOT NULL AND p_module NOT IN('crm','ats','people','contracts','projects','finance') THEN
   RAISE EXCEPTION 'Módulo de notificações inválido.' USING ERRCODE='22023';END IF;
  IF p_cursor IS NOT NULL AND p_cursor<>'null'::jsonb THEN
   IF p_cutoff IS NULL OR jsonb_typeof(p_cursor)<>'object'
    OR NOT p_cursor?'createdAt' OR NOT p_cursor?'id'
    OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_cursor)k WHERE k NOT IN('createdAt','id')) THEN
    RAISE EXCEPTION 'Cursor de notificações inválido.' USING ERRCODE='22023';END IF;
   BEGIN cursor_at:=(p_cursor->>'createdAt')::timestamptz;cursor_id:=(p_cursor->>'id')::uuid;
   EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'Cursor de notificações inválido.' USING ERRCODE='22023';END;
   IF cursor_at IS NULL OR cursor_id IS NULL OR cursor_at>cutoff THEN
    RAISE EXCEPTION 'Cursor de notificações inválido.' USING ERRCODE='22023';END IF;
  END IF;
  pattern:='%'||replace(replace(replace(btrim(p_q),'\','\\'),'%','\%'),'_','\_')||'%';
  WITH own_rows AS MATERIALIZED (
    SELECT n.*, c.source_table, c.source_id, c.event_key AS proven_event_key, c.workspace_id AS proven_workspace
    FROM public.notifications n
    LEFT JOIN public.notification_workspace_context c ON c.notification_id = n.id
    WHERE n.user_id = u AND n.created_at <= cutoff
      AND ((p_scope='workspace' AND c.workspace_id=p_workspace AND n.workspace_id=c.workspace_id AND n.entity_id=c.source_id)
        OR (p_scope='legacy' AND c.notification_id IS NULL))
      AND (p_category IS NULL OR coalesce(techerp_api.notification_business_category(c.event_key), techerp_api.notification_center_category(n.type)) = p_category)
      AND (btrim(p_q)='' OR (p_scope='workspace' AND (n.title ILIKE pattern ESCAPE '\' OR n.body ILIKE pattern ESCAPE '\')))
  ),
  candidates AS MATERIALIZED (
    SELECT r.* FROM own_rows r
    WHERE techerp_api.notification_hr_notice_visible(r.id, u)
      AND (p_module IS NULL OR (p_scope='workspace' AND techerp_api.notification_business_module(r.proven_event_key, p_workspace, u, r.source_table, r.source_id) = p_module))
  ),
  page AS MATERIALIZED (
    SELECT * FROM candidates n WHERE
      (p_scope='legacy' OR techerp_api.notification_center_source_visible(p_workspace, u, n.source_table, n.source_id))
      AND (p_status='snoozed' AND n.snoozed_until>statement_timestamp()
        OR p_status<>'snoozed' AND (n.snoozed_until IS NULL OR n.snoozed_until<=statement_timestamp())
          AND (p_status='all' OR p_status='unread' AND n.read_at IS NULL OR p_status='read' AND n.read_at IS NOT NULL))
      AND (cursor_at IS NULL OR (n.created_at, n.id) < (cursor_at, cursor_id))
    ORDER BY created_at DESC, id DESC LIMIT 31
  ),
  unread AS (
    SELECT 1 FROM candidates n WHERE n.read_at IS NULL
      AND (n.snoozed_until IS NULL OR n.snoozed_until<=statement_timestamp())
      AND (p_scope='legacy' OR techerp_api.notification_center_source_visible(p_workspace, u, n.source_table, n.source_id)) LIMIT 100
  ),
  items AS (SELECT * FROM page ORDER BY created_at DESC, id DESC LIMIT 30),
  last_item AS (SELECT created_at, id FROM items ORDER BY created_at, id LIMIT 1)
  SELECT jsonb_build_object(
    'items', coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id',id,'type',type,'eventKey',coalesce(proven_event_key,'legacy.'||type),'title',CASE WHEN p_scope='legacy' THEN 'Notificação do histórico pessoal' ELSE title END,
      'body',CASE WHEN p_scope='legacy' THEN 'Este aviso não possui origem de workspace comprovada. Consulte seus registros no TechERP.' ELSE body END,
      'link',CASE WHEN p_scope='legacy' THEN NULL WHEN source_table='hiring_fiscal_documents' THEN techerp_api.notification_finance_fiscal_href(p_workspace,source_id) WHEN source_table IN('ats_applications','ats_interviews','ats_offers','people_documents','hiring_preparation_requests') THEN techerp_api.notification_hr_href(p_workspace,source_table,source_id) WHEN source_table='project_milestones' THEN techerp_api.notification_project_milestone_href(p_workspace,source_id) ELSE link END,
      'entity',CASE WHEN p_scope='legacy' THEN NULL ELSE entity END,
      'entity_id',CASE WHEN p_scope='legacy' THEN NULL ELSE entity_id END,
      'moduleKey',CASE WHEN p_scope='legacy' THEN NULL ELSE techerp_api.notification_business_module(proven_event_key,p_workspace,u,source_table,source_id) END,
      'created_at',created_at,'read_at',read_at,'snoozed_until',snoozed_until
    ) ORDER BY created_at DESC,id DESC) FROM items),'[]'::jsonb),
    'unread',(SELECT count(*) FROM unread),'unreadCapped',(SELECT count(*)=100 FROM unread),
    'nextCursor',CASE WHEN (SELECT count(*) FROM page)>30 THEN
      (SELECT jsonb_build_object('createdAt',created_at,'id',id) FROM last_item) ELSE NULL END,'cutoff',cutoff
  ) INTO result;
  RETURN result;
END
$function$;

CREATE OR REPLACE FUNCTION public.notification_center_lookup(p_workspace uuid, p_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  u uuid := techerp_api.notification_center_actor(p_workspace);
  result jsonb;
BEGIN
  IF p_ids IS NULL OR cardinality(p_ids) NOT BETWEEN 1 AND 30 OR coalesce(array_ndims(p_ids), 0) <> 1 THEN
    RAISE EXCEPTION 'Selecione de um a trinta avisos.' USING ERRCODE = '22023';
  END IF;
  IF array_position(p_ids, NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'Selecione de um a trinta avisos.' USING ERRCODE = '22023';
  END IF;
  WITH own_rows AS MATERIALIZED (
    SELECT n.id, n.type, n.title, n.body, n.link, n.entity, n.entity_id, n.created_at, n.read_at, n.snoozed_until,
      c.source_table, c.source_id, c.event_key
    FROM public.notifications n
    JOIN public.notification_workspace_context c ON c.notification_id = n.id
    WHERE n.id = ANY(p_ids)
      AND n.user_id = u
      AND n.workspace_id = p_workspace
      AND c.workspace_id = p_workspace
      AND n.entity_id = c.source_id
      AND n.created_at <= statement_timestamp()
  )
  SELECT jsonb_build_object(
    'items', coalesce(jsonb_agg(jsonb_build_object(
      'id', n.id, 'type', n.type, 'eventKey', coalesce(n.event_key, 'legacy.' || n.type),
      'title', n.title, 'body', n.body,
      'link', CASE WHEN n.source_table='hiring_fiscal_documents' THEN techerp_api.notification_finance_fiscal_href(p_workspace, n.source_id)
        WHEN n.source_table IN('ats_applications','ats_interviews','ats_offers','people_documents','hiring_preparation_requests') THEN techerp_api.notification_hr_href(p_workspace, n.source_table, n.source_id)
        WHEN n.source_table='project_milestones' THEN techerp_api.notification_project_milestone_href(p_workspace, n.source_id)
        ELSE n.link END,
      'entity', n.entity, 'entity_id', n.entity_id,
      'moduleKey', techerp_api.notification_business_module(n.event_key, p_workspace, u, n.source_table, n.source_id),
      'created_at', n.created_at, 'read_at', n.read_at, 'snoozed_until', n.snoozed_until
    ) ORDER BY n.created_at DESC, n.id DESC), '[]'::jsonb),
    'checkedAt', statement_timestamp()
  ) INTO result
  FROM own_rows n
  WHERE techerp_api.notification_hr_notice_visible(n.id, u)
    AND techerp_api.notification_center_source_visible(p_workspace, u, n.source_table, n.source_id);
  RETURN result;
END
$function$;