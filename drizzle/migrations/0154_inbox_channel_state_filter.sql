DROP FUNCTION IF EXISTS public.get_inbox_channel_page(text, text, text, uuid, timestamptz, uuid, integer);
CREATE OR REPLACE FUNCTION public.get_inbox_channel_page(p_channel text, p_assignee text DEFAULT 'all'::text, p_search text DEFAULT NULL::text, p_workspace_id uuid DEFAULT NULL::uuid, p_cursor_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_cursor_id uuid DEFAULT NULL::uuid, p_page_size integer DEFAULT 50, p_state text DEFAULT 'all'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_page_size,50),1),100);
  v_search text := NULLIF(btrim(COALESCE(p_search,'')),'');
  v_like text;
  v_uid uuid := auth.uid();
  v_state text := COALESCE(p_state,'all');
  v_result jsonb;
BEGIN
  IF p_channel NOT IN ('email','whatsapp','chat') THEN RAISE EXCEPTION 'invalid channel'; END IF;
  IF COALESCE(p_assignee,'all') NOT IN ('all','mine','unassigned','interacted') THEN RAISE EXCEPTION 'invalid assignee filter'; END IF;
  IF v_state NOT IN ('all','open','closed') THEN RAISE EXCEPTION 'invalid state filter'; END IF;
  IF (p_cursor_at IS NULL) <> (p_cursor_id IS NULL) THEN RAISE EXCEPTION 'cursor fields must be provided together'; END IF;
  v_like := CASE WHEN v_search IS NULL THEN NULL
    ELSE '%' || replace(replace(replace(v_search,'\','\\'),'%','\%'),'_','\_') || '%' END;

  WITH base0 AS MATERIALIZED (
    SELECT t.id, COALESCE(t.last_message_at, t.created_at) AS sort_at, t.assigned_to AS assignee, false AS interacted, false AS closed,
      jsonb_build_object('id',t.id,'subject',t.subject,'snippet',t.snippet,'last_message_at',t.last_message_at,
        'message_count',t.message_count,'contact_id',t.contact_id,'lead_id',t.lead_id,
        'identity_status',t.identity_status,'account_id',t.account_id,'assigned_to',t.assigned_to) AS row
    FROM public.email_threads t
    LEFT JOIN public.contacts c ON c.id = t.contact_id
    LEFT JOIN public.leads l ON l.id = t.lead_id
    WHERE p_channel = 'email' AND (v_like IS NULL OR concat_ws(' ', t.subject, t.snippet, c.first_name, c.last_name, c.email,
      l.first_name, l.last_name, l.email) ILIKE v_like)
    UNION ALL
    SELECT w.id, COALESCE(w.last_message_at, w.created_at), w.assigned_to, w.last_inbound_at IS NOT NULL, w.status = 'closed',
      jsonb_build_object('id',w.id,'contact_id',w.contact_id,'lead_id',w.lead_id,'identity_status',w.identity_status,
        'contact_phone',w.contact_phone,'twilio_number',w.twilio_number,'provider',w.provider,
        'wa_phone_number_id',w.wa_phone_number_id,'last_inbound_at',w.last_inbound_at,
        'last_message_at',w.last_message_at,'last_message_preview',w.last_message_preview,
        'unread_count',w.unread_count,'status',w.status,'assigned_to',w.assigned_to)
    FROM public.whatsapp_conversations w
    LEFT JOIN public.contacts c ON c.id = w.contact_id
    LEFT JOIN public.leads l ON l.id = w.lead_id
    WHERE p_channel = 'whatsapp' AND (v_like IS NULL OR concat_ws(' ', w.contact_phone, w.last_message_preview, c.first_name, c.last_name,
      c.email, l.first_name, l.last_name, l.email) ILIKE v_like)
    UNION ALL
    SELECT s.id, COALESCE(s.last_message_at, s.created_at), s.assignee_id, false, s.status = 'closed',
      jsonb_build_object('id',s.id,'visitor_id',s.visitor_id,'visitor_name',s.visitor_name,'visitor_email',s.visitor_email,
        'visitor_url',s.visitor_url,'contact_id',s.contact_id,'lead_id',s.lead_id,'identity_status',s.identity_status,
        'status',s.status,'assignee_id',s.assignee_id,'last_message_at',s.last_message_at,'created_at',s.created_at)
    FROM public.live_chat_sessions s
    LEFT JOIN public.contacts c ON c.id = s.contact_id
    LEFT JOIN public.leads l ON l.id = s.lead_id
    WHERE p_channel = 'chat' AND (p_workspace_id IS NULL OR s.owner_id = p_workspace_id)
      AND (v_like IS NULL OR concat_ws(' ', s.visitor_name, s.visitor_email, s.visitor_url, c.first_name,
        c.last_name, c.email, l.first_name, l.last_name, l.email) ILIKE v_like)
  ),
  base AS (
    SELECT * FROM base0
    WHERE v_state = 'all' OR (v_state = 'open' AND NOT closed) OR (v_state = 'closed' AND closed)),
  chosen AS (
    SELECT * FROM base
    WHERE COALESCE(p_assignee,'all') = 'all'
      OR (p_assignee = 'mine' AND assignee = v_uid)
      OR (p_assignee = 'unassigned' AND assignee IS NULL)
      OR (p_assignee = 'interacted' AND interacted)),
  page_plus AS (
    SELECT * FROM chosen WHERE p_cursor_at IS NULL OR (sort_at, id) < (p_cursor_at, p_cursor_id)
    ORDER BY sort_at DESC, id DESC LIMIT v_limit + 1),
  page AS (SELECT * FROM page_plus ORDER BY sort_at DESC, id DESC LIMIT v_limit),
  tail AS (SELECT sort_at, id FROM page ORDER BY sort_at ASC, id ASC LIMIT 1)
  SELECT jsonb_build_object(
    'items', COALESCE((SELECT jsonb_agg(p.row || jsonb_build_object('sort_at', p.sort_at)
      ORDER BY p.sort_at DESC, p.id DESC) FROM page p), '[]'::jsonb),
    'counts', (SELECT jsonb_build_object('all', count(*),
        'mine', count(*) FILTER (WHERE assignee = v_uid),
        'unassigned', count(*) FILTER (WHERE assignee IS NULL),
        'interacted', count(*) FILTER (WHERE interacted)) FROM base),
    'state_counts', (SELECT jsonb_build_object('all', count(*),
        'open', count(*) FILTER (WHERE NOT closed),
        'closed', count(*) FILTER (WHERE closed)) FROM base0),
    'total', (SELECT count(*) FROM chosen),
    'has_more', (SELECT count(*) FROM page_plus) > v_limit,
    'next_cursor', CASE WHEN (SELECT count(*) FROM page_plus) > v_limit
      THEN (SELECT jsonb_build_object('at', sort_at, 'id', id) FROM tail) END)
  INTO v_result;
  RETURN v_result;
END $function$;
GRANT EXECUTE ON FUNCTION public.get_inbox_channel_page(text, text, text, uuid, timestamptz, uuid, integer, text) TO authenticated;