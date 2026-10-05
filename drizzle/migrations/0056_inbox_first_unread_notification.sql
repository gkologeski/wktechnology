CREATE OR REPLACE FUNCTION public.notify_assigned_inbox_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_workspace_id uuid;
  v_channel text;
  v_conversation_id uuid;
  v_sender text;
  v_body text;
  v_link text;
  v_preferences jsonb;
  v_is_active boolean;
BEGIN
  IF NEW.direction IS DISTINCT FROM 'inbound' THEN RETURN NEW; END IF;

  IF TG_TABLE_NAME = 'whatsapp_messages' THEN
    SELECT c.assigned_to, COALESCE(c.workspace_id, c.owner_id), c.id, c.contact_phone
      INTO v_user_id, v_workspace_id, v_conversation_id, v_sender
      FROM public.whatsapp_conversations c WHERE c.id = NEW.conversation_id;
    v_channel := 'WhatsApp'; v_body := NEW.body; v_link := '/inbox/whatsapp';
  ELSIF TG_TABLE_NAME = 'email_messages' THEN
    SELECT t.assigned_to, COALESCE(t.workspace_id, t.owner_id), t.id,
           COALESCE(NEW.from_name, NEW.from_email, t.subject, 'Remetente')
      INTO v_user_id, v_workspace_id, v_conversation_id, v_sender
      FROM public.email_threads t WHERE t.id = NEW.thread_id;
    v_channel := 'E-mail'; v_body := COALESCE(NEW.snippet, NEW.body_text, NEW.subject); v_link := '/inbox/email';
  ELSIF TG_TABLE_NAME = 'live_chat_messages' THEN
    SELECT s.assignee_id, COALESCE(s.workspace_id, s.owner_id), s.id,
           COALESCE(s.visitor_name, s.visitor_email, 'Visitante')
      INTO v_user_id, v_workspace_id, v_conversation_id, v_sender
      FROM public.live_chat_sessions s WHERE s.id = NEW.session_id;
    v_channel := 'Chat ao vivo'; v_body := NEW.body; v_link := '/inbox/chat';
  ELSE
    RETURN NEW;
  END IF;

  IF v_user_id IS NULL OR v_workspace_id IS NULL OR v_conversation_id IS NULL THEN RETURN NEW; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members wm
     WHERE wm.workspace_id = v_workspace_id AND wm.user_id = v_user_id
       AND COALESCE(wm.status, 'active') <> 'inactive'
    UNION ALL
    SELECT 1 FROM public.workspaces w WHERE w.id = v_workspace_id AND w.created_by = v_user_id
  ) INTO v_is_active;
  IF NOT COALESCE(v_is_active, false) THEN RETURN NEW; END IF;

  SELECT p.notification_preferences INTO v_preferences FROM public.profiles p WHERE p.id = v_user_id;
  IF COALESCE((v_preferences #>> '{message,inapp}')::boolean, true) IS NOT TRUE THEN RETURN NEW; END IF;

  -- A conversa já tem aviso não lido: mensagens seguintes permanecem agrupadas e silenciosas.
  IF EXISTS (
    SELECT 1 FROM public.notifications n
     WHERE n.user_id = v_user_id
       AND n.workspace_id = v_workspace_id
       AND n.type = 'message'
       AND n.entity = 'inbox_conversation'
       AND n.entity_id = v_conversation_id
       AND n.read_at IS NULL
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (
    owner_id, workspace_id, user_id, type, title, body, link, entity, entity_id, dedupe_key
  ) VALUES (
    v_workspace_id, v_workspace_id, v_user_id, 'message', 'Nova mensagem no ' || v_channel,
    left(COALESCE(v_sender, 'Cliente') || CASE WHEN NULLIF(btrim(COALESCE(v_body, '')), '') IS NULL THEN '' ELSE ': ' || regexp_replace(v_body, '<[^>]+>', ' ', 'g') END, 240),
    v_link, 'inbox_conversation', v_conversation_id,
    TG_TABLE_NAME || ':' || NEW.id::text || ':' || v_user_id::text
  ) ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_assigned_inbox_message() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_assigned_inbox_message() TO service_role;
