CREATE TABLE IF NOT EXISTS public.wa_timeline_backup_2026_11 (
  activity_id uuid PRIMARY KEY,
  workspace_id uuid,
  row_data jsonb NOT NULL,
  backed_up_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.wa_timeline_backup_2026_11 TO authenticated;
GRANT ALL ON public.wa_timeline_backup_2026_11 TO service_role;
ALTER TABLE public.wa_timeline_backup_2026_11 ENABLE ROW LEVEL SECURITY;
CREATE POLICY wa_timeline_backup_admin_read ON public.wa_timeline_backup_2026_11
  FOR SELECT TO authenticated
  USING (public.is_active_workspace_admin(workspace_id, auth.uid()));

CREATE INDEX IF NOT EXISTS activities_wa_day_idx
  ON public.activities (workspace_id, (external_ids->>'wa_day'))
  WHERE external_ids ? 'wa_day';

CREATE OR REPLACE FUNCTION public.wa_timeline_rebuild_day(p_workspace uuid, p_contact uuid, p_day date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_key text := 'conv:' || p_contact || ':' || p_day;
  v_msgs jsonb; v_count int; v_first timestamptz;
  v_author uuid; v_act uuid; v_subject text;
BEGIN
  SELECT coalesce(jsonb_agg(x.j ORDER BY x.at, x.id), '[]'::jsonb), count(*), min(x.at)
    INTO v_msgs, v_count, v_first
  FROM (
    SELECT m.id, coalesce(m.sent_at, m.created_at) AS at,
      jsonb_build_object(
        'id', m.id,
        'wa_message_id', m.wa_message_id,
        'direction', m.direction,
        'at', coalesce(m.sent_at, m.created_at),
        'body', coalesce(nullif(m.body, ''),
                 CASE WHEN m.template_name IS NOT NULL THEN '[modelo ' || m.template_name || ']'
                      WHEN m.media_url IS NOT NULL THEN '[mídia]' ELSE '' END),
        'status', m.status,
        'error', m.error_message,
        'template', m.template_name,
        'origin', CASE WHEN m.direction = 'inbound' THEN 'client'
                       WHEN m.raw ? 'sdr' THEN 'agent'
                       WHEN m.is_template THEN 'campaign' ELSE 'inbox' END,
        'author', (SELECT p.full_name FROM profiles p WHERE p.id = m.sent_by)
      ) AS j
    FROM whatsapp_messages m
    JOIN whatsapp_conversations c ON c.id = m.conversation_id
    WHERE c.workspace_id = p_workspace AND c.contact_id = p_contact
      AND (coalesce(m.sent_at, m.created_at) AT TIME ZONE 'America/Sao_Paulo')::date = p_day
  ) x;

  SELECT a.id INTO v_act FROM activities a
   WHERE a.workspace_id = p_workspace AND a.external_ids ? 'wa_day'
     AND a.external_ids->>'wa_day' = v_key AND a.deleted_at IS NULL
   LIMIT 1;

  IF v_count = 0 THEN
    IF v_act IS NOT NULL THEN UPDATE activities SET deleted_at = now() WHERE id = v_act; END IF;
    RETURN;
  END IF;

  v_subject := 'WhatsApp · ' || to_char(p_day, 'DD/MM/YYYY') || ' · ' || v_count
               || CASE WHEN v_count = 1 THEN ' mensagem' ELSE ' mensagens' END;

  IF v_act IS NOT NULL THEN
    UPDATE activities SET subject = v_subject, body = '',
      external_ids = external_ids || jsonb_build_object('messages', v_msgs, 'message_count', v_count),
      updated_at = now()
    WHERE id = v_act;
    RETURN;
  END IF;

  SELECT c.assigned_to INTO v_author FROM whatsapp_conversations c
   WHERE c.workspace_id = p_workspace AND c.contact_id = p_contact
     AND EXISTS (SELECT 1 FROM workspace_members w WHERE w.workspace_id = p_workspace AND w.user_id = c.assigned_to AND w.status = 'active')
   LIMIT 1;
  IF v_author IS NULL THEN
    SELECT coalesce(ct.assigned_to, ct.owner_id) INTO v_author FROM contacts ct
     WHERE ct.id = p_contact AND ct.workspace_id = p_workspace;
    IF NOT EXISTS (SELECT 1 FROM workspace_members w WHERE w.workspace_id = p_workspace AND w.user_id = v_author AND w.status = 'active') THEN
      v_author := NULL;
    END IF;
  END IF;
  IF v_author IS NULL THEN
    SELECT w.created_by INTO v_author FROM workspaces w WHERE w.id = p_workspace;
  END IF;
  IF v_author IS NULL THEN
    SELECT wm.user_id INTO v_author FROM workspace_members wm
     WHERE wm.workspace_id = p_workspace AND wm.status = 'active' ORDER BY wm.created_at LIMIT 1;
  END IF;
  IF v_author IS NULL THEN RETURN; END IF;

  INSERT INTO activities(workspace_id, owner_id, assigned_to, created_by, type, related_contact_id,
    subject, body, completed, hs_createdate, activity_date, external_ids)
  VALUES (p_workspace, v_author, v_author, v_author, 'whatsapp', p_contact, v_subject, '', true,
    v_first, v_first,
    jsonb_build_object('wa_day', v_key, 'source', 'whatsapp_day', 'messages', v_msgs, 'message_count', v_count));
END $$;

REVOKE ALL ON FUNCTION public.wa_timeline_rebuild_day(uuid, uuid, date) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.wa_register_daily_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE c record;
BEGIN
  BEGIN
    SELECT workspace_id, contact_id INTO c FROM whatsapp_conversations WHERE id = NEW.conversation_id;
    IF c.contact_id IS NULL THEN RETURN NEW; END IF;
    PERFORM wa_timeline_rebuild_day(c.workspace_id, c.contact_id,
      (coalesce(NEW.sent_at, NEW.created_at) AT TIME ZONE 'America/Sao_Paulo')::date);
  EXCEPTION WHEN others THEN
    RAISE WARNING 'wa_register_daily_activity: %', SQLSTATE;
  END;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS wa_outbound_register_activity ON public.whatsapp_messages;
CREATE TRIGGER wa_register_daily_activity
  AFTER INSERT OR UPDATE OF status, body ON public.whatsapp_messages
  FOR EACH ROW EXECUTE FUNCTION public.wa_register_daily_activity();

INSERT INTO public.wa_timeline_backup_2026_11 (activity_id, workspace_id, row_data)
SELECT a.id, a.workspace_id, to_jsonb(a) FROM public.activities a
WHERE a.type = 'whatsapp' AND a.deleted_at IS NULL
ON CONFLICT (activity_id) DO NOTHING;

UPDATE public.activities SET deleted_at = now()
WHERE type = 'whatsapp' AND deleted_at IS NULL
  AND id IN (SELECT activity_id FROM public.wa_timeline_backup_2026_11);

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT DISTINCT c.workspace_id, c.contact_id,
      (coalesce(m.sent_at, m.created_at) AT TIME ZONE 'America/Sao_Paulo')::date AS d
    FROM public.whatsapp_messages m
    JOIN public.whatsapp_conversations c ON c.id = m.conversation_id
    WHERE c.contact_id IS NOT NULL
  LOOP
    PERFORM public.wa_timeline_rebuild_day(r.workspace_id, r.contact_id, r.d);
  END LOOP;
END $$;