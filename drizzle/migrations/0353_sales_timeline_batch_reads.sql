-- Eliminate per-record RLS/context round trips without changing grants or timeouts.
-- Both functions remain SECURITY INVOKER; all table reads retain caller RLS.
CREATE OR REPLACE FUNCTION public.sales_capabilities(t text, ids uuid[])
 RETURNS TABLE(id uuid, can_view boolean, can_update boolean, can_delete boolean, can_assign boolean, can_approve boolean, can_export boolean, can_manage boolean)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE i uuid; c jsonb; res text; tbl text;BEGIN
 IF coalesce(cardinality(ids),0)>500 THEN RAISE EXCEPTION 'Limite excedido.';END IF;
 IF coalesce(cardinality(ids),0)=0 THEN RETURN;END IF;
 c := sales_access_context();
 res := CASE t WHEN 'quotes' THEN 'techsales.quotes' WHEN 'deals' THEN 'techsales.deals' WHEN 'proposals' THEN 'techsales.proposals'
   WHEN 'leads' THEN 'techsales.leads' WHEN 'contacts' THEN 'techsales.contacts' WHEN 'companies' THEN 'techsales.companies' END;
 IF res IS NOT NULL THEN
   tbl := t;
   RETURN QUERY EXECUTE format($q$
     SELECT x.id, true,
       public.sales_context_access($1,x.workspace_id,$2,'update',x.o), public.sales_context_access($1,x.workspace_id,$2,'delete',x.o),
       public.sales_context_access($1,x.workspace_id,$2,'assign',x.o), public.sales_context_access($1,x.workspace_id,$2,'approve',x.o),
       public.sales_context_access($1,x.workspace_id,$2,'export',x.o), public.sales_context_access($1,x.workspace_id,$2,'manage',x.o)
     FROM (SELECT r.id, r.workspace_id, ARRAY[coalesce(r.assigned_to,r.owner_id)]::uuid[] o FROM public.%I r WHERE r.id = ANY($3)) x
     WHERE public.sales_context_access($1,x.workspace_id,$2,'view',x.o)$q$, tbl)
   USING c, res, ids;
   RETURN;
 END IF;
 IF t = 'activities' THEN
   RETURN QUERY
     SELECT x.id, true,
       public.sales_context_access(c,x.workspace_id,x.resource,'update',x.o),
       public.sales_context_access(c,x.workspace_id,x.resource,'delete',x.o),
       public.sales_context_access(c,x.workspace_id,x.resource,'assign',x.o),
       public.sales_context_access(c,x.workspace_id,x.resource,'approve',x.o),
       public.sales_context_access(c,x.workspace_id,x.resource,'export',x.o),
       public.sales_context_access(c,x.workspace_id,x.resource,'manage',x.o)
     FROM (SELECT a.id, a.workspace_id,
       CASE WHEN a.type::text='note' THEN 'techsales.notes'
         WHEN a.type::text='task' THEN 'techsales.tasks' ELSE 'techsales.activities' END resource,
       ARRAY[coalesce(a.assigned_to,a.owner_id)]::uuid[] o
       FROM public.activities a JOIN unnest(ids) requested(requested_id) ON requested.requested_id = a.id) x
     WHERE public.sales_context_access(c,x.workspace_id,x.resource,'view',x.o);
   RETURN;
 END IF;
 FOREACH i IN ARRAY ids LOOP
 IF sales_private.record_access_ctx(c,t,i,'view') THEN RETURN QUERY SELECT i,true,
   sales_private.record_access_ctx(c,t,i,'update'),sales_private.record_access_ctx(c,t,i,'delete'),
   sales_private.record_access_ctx(c,t,i,'assign'),sales_private.record_access_ctx(c,t,i,'approve'),
   sales_private.record_access_ctx(c,t,i,'export'),sales_private.record_access_ctx(c,t,i,'manage');END IF;
 END LOOP;END $function$;

--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.get_timeline_calendar_page(p_entity_kind text, p_entity_id uuid, p_since timestamp with time zone DEFAULT NULL::timestamp with time zone, p_until timestamp with time zone DEFAULT NULL::timestamp with time zone, p_search text DEFAULT NULL::text, p_cursor_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_cursor_id uuid DEFAULT NULL::uuid, p_page_size integer DEFAULT 40)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_page_size,40),1),100);
  v_contact_ids uuid[] := ARRAY[]::uuid[];
  v_workspace_id uuid;
  v_search text := NULLIF(btrim(COALESCE(p_search,'')),'');
  v_result jsonb;
BEGIN
  IF p_entity_kind NOT IN ('lead','contact','company','deal','ticket') THEN RAISE EXCEPTION 'invalid entity kind'; END IF;
  IF (p_cursor_at IS NULL) <> (p_cursor_id IS NULL) THEN RAISE EXCEPTION 'cursor timestamp and id must be provided together'; END IF;
  IF p_entity_kind = 'contact' THEN
    v_contact_ids := ARRAY[p_entity_id];
    SELECT c.workspace_id INTO v_workspace_id FROM contacts c WHERE c.id = p_entity_id;
  ELSIF p_entity_kind = 'deal' THEN
    SELECT d.workspace_id INTO v_workspace_id FROM deals d WHERE d.id = p_entity_id;
    SELECT COALESCE(array_agg(DISTINCT c), ARRAY[]::uuid[]) INTO v_contact_ids FROM (
      SELECT d.primary_contact_id AS c FROM deals d WHERE d.id = p_entity_id AND d.primary_contact_id IS NOT NULL
      UNION SELECT dc.contact_id FROM deal_contacts dc WHERE dc.deal_id = p_entity_id) s WHERE c IS NOT NULL;
  ELSIF p_entity_kind = 'company' THEN
    SELECT co.workspace_id INTO v_workspace_id FROM companies co WHERE co.id = p_entity_id;
    SELECT COALESCE(array_agg(c.id), ARRAY[]::uuid[]) INTO v_contact_ids FROM contacts c WHERE c.company_id = p_entity_id;
  ELSIF p_entity_kind = 'lead' THEN
    SELECT l.workspace_id INTO v_workspace_id FROM leads l WHERE l.id = p_entity_id;
  ELSE
    SELECT t.workspace_id INTO v_workspace_id FROM tickets t WHERE t.id = p_entity_id;
  END IF;
  IF v_workspace_id IS NULL THEN
    RETURN jsonb_build_object('items','[]'::jsonb,'total',0,'has_more',false,'next_at',NULL,'next_id',NULL);
  END IF;

  WITH long_series AS MATERIALIZED (
    -- Same visible siblings as _calendar_event_is_long_series, counted once.
    -- Recurring IDs ignore title; non-recurring events group by nonempty title.
    SELECT s.calendar_account_id, s.recurring_event_id,
      CASE WHEN s.recurring_event_id IS NULL THEN s.title END AS series_title
    FROM public.calendar_events s
    WHERE (s.recurring_event_id IS NOT NULL OR (s.title IS NOT NULL AND s.title <> ''))
    GROUP BY s.calendar_account_id, s.recurring_event_id,
      CASE WHEN s.recurring_event_id IS NULL THEN s.title END
    HAVING count(*) >= 6
  ), linked AS (
    SELECT ce.id FROM calendar_events ce
    WHERE p_entity_kind = 'contact' AND ce.workspace_id = v_workspace_id AND ce.related_contact_id = p_entity_id
      AND EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(ce.attendees,'[]'::jsonb)) att
        WHERE lower(att->>'email') LIKE '%@wktechnology.com.br' OR lower(att->>'email') LIKE '%@wkconsultoria.com.br')
      AND NOT EXISTS (SELECT 1 FROM long_series ls
        WHERE ls.calendar_account_id = ce.calendar_account_id
          AND ((ce.recurring_event_id IS NOT NULL AND ls.recurring_event_id = ce.recurring_event_id)
            OR (ce.recurring_event_id IS NULL AND ls.recurring_event_id IS NULL AND ls.series_title = ce.title)))
    UNION
    SELECT ce.id FROM calendar_events ce JOIN activities a ON a.id = ce.related_activity_id
    WHERE p_entity_kind <> 'contact' AND ce.workspace_id = v_workspace_id AND a.workspace_id = v_workspace_id
      AND ((p_entity_kind = 'deal' AND a.related_deal_id = p_entity_id)
        OR (p_entity_kind = 'lead' AND a.related_lead_id = p_entity_id)
        OR (p_entity_kind = 'ticket' AND a.related_ticket_id = p_entity_id)
        OR (p_entity_kind = 'company' AND (a.related_company_id = p_entity_id OR a.related_contact_id = ANY(v_contact_ids))))
    UNION
    SELECT ce.id FROM calendar_events ce
    WHERE p_entity_kind IN ('deal','company') AND ce.workspace_id = v_workspace_id AND ce.related_contact_id = ANY(v_contact_ids)
      AND EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(ce.attendees,'[]'::jsonb)) att
        WHERE lower(att->>'email') LIKE '%@wktechnology.com.br' OR lower(att->>'email') LIKE '%@wkconsultoria.com.br')
      AND NOT EXISTS (SELECT 1 FROM long_series ls
        WHERE ls.calendar_account_id = ce.calendar_account_id
          AND ((ce.recurring_event_id IS NOT NULL AND ls.recurring_event_id = ce.recurring_event_id)
            OR (ce.recurring_event_id IS NULL AND ls.recurring_event_id IS NULL AND ls.series_title = ce.title)))
  ),
  mirrored AS (
    SELECT a.external_ids->>'calendar_event_id' AS cid FROM activities a
    WHERE a.deleted_at IS NULL AND a.external_ids ? 'calendar_event_id'
      AND CASE p_entity_kind WHEN 'lead' THEN a.related_lead_id = p_entity_id WHEN 'contact' THEN a.related_contact_id = p_entity_id
        WHEN 'company' THEN a.related_company_id = p_entity_id WHEN 'deal' THEN a.related_deal_id = p_entity_id
        WHEN 'ticket' THEN a.related_ticket_id = p_entity_id ELSE false END),
  scoped AS MATERIALIZED (
    SELECT ce.id, ce.title, ce.description, ce.start_at, ce.end_at, ce.location, ce.html_link, ce.hangout_link,
      ce.attendees, ce.recording_url, ce.related_contact_id, ce.created_at, COALESCE(ce.start_at, ce.created_at) AS effective_at
    FROM calendar_events ce JOIN linked l ON l.id = ce.id
    WHERE NOT EXISTS (SELECT 1 FROM mirrored m WHERE m.cid = ce.id::text)
      AND (p_since IS NULL OR COALESCE(ce.start_at, ce.created_at) >= p_since)
      AND (p_until IS NULL OR COALESCE(ce.start_at, ce.created_at) < p_until)
      AND (v_search IS NULL OR concat_ws(' ', ce.title, ce.description, ce.location) ILIKE '%'||v_search||'%')),
  page_plus AS (SELECT * FROM scoped WHERE p_cursor_at IS NULL OR (effective_at, id) < (p_cursor_at, p_cursor_id)
    ORDER BY effective_at DESC, id DESC LIMIT v_limit + 1),
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
END; $function$

;
