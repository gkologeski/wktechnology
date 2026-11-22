CREATE FUNCTION public.widget_inbound_commit(
  p_session uuid,p_visitor text,p_request uuid,p_body text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
DECLARE s record; old record;
  mid uuid; eid uuid; sid uuid; bh text; vh text; now_at timestamptz:=clock_timestamp();
BEGIN
  PERFORM techerp_api.notification_service();
  IF public.is_read_only_view() THEN RAISE EXCEPTION 'Somente leitura.' USING ERRCODE='42501'; END IF;
  IF p_request IS NULL OR length(p_body) NOT BETWEEN 1 AND 2000
    OR p_body IS NULL OR p_visitor IS NULL OR p_visitor !~ '^[a-zA-Z0-9_-]{8,64}$'
  THEN RAISE EXCEPTION 'Mensagem inválida.' USING ERRCODE='22023'; END IF;
  SELECT * INTO s FROM public.live_chat_sessions WHERE id=p_session FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sessão inválida.' USING ERRCODE='42501'; END IF;
  IF s.visitor_id IS DISTINCT FROM p_visitor OR s.workspace_id IS NULL
    OR s.owner_id IS DISTINCT FROM s.workspace_id
  THEN RAISE EXCEPTION 'Sessão inválida.' USING ERRCODE='42501'; END IF;
  bh:=encode(sha256(convert_to(p_body,'UTF8')),'hex');
  vh:=encode(sha256(convert_to(p_visitor,'UTF8')),'hex');
  SELECT * INTO old FROM public.inbox_widget_receipts WHERE session_id=s.id AND request_id=p_request;
  IF FOUND THEN
    IF old.body_hash IS DISTINCT FROM bh OR old.visitor_hash IS DISTINCT FROM vh THEN
      RAISE EXCEPTION 'Tentativa reutilizada para outro conteúdo.' USING ERRCODE='23505';
    END IF;
    RETURN old.message_id;
  END IF;
  IF s.status='closed' THEN RAISE EXCEPTION 'Conversa encerrada.' USING ERRCODE='42501'; END IF;
  INSERT INTO public.live_chat_messages(session_id,workspace_id,owner_id,direction,body,created_at)
    VALUES(s.id,s.workspace_id,s.workspace_id,'inbound',p_body,now_at) RETURNING id INTO mid;
  INSERT INTO public.inbox_widget_receipts(session_id,request_id,message_id,body_hash,visitor_hash,received_at)
    VALUES(s.id,p_request,mid,bh,vh,now_at);
  INSERT INTO public.inbox_channel_evidence(
    workspace_id,channel,account_id,conversation_id,provider_id,message_id,
    provenance,envelope_hash,body_hash,occurred_at,received_at
  ) VALUES(s.workspace_id,'chat',s.workspace_id,s.id,p_request::text,mid,'widget_session',
    encode(sha256(convert_to(s.id::text||':'||p_request::text||':'||vh||':'||bh,'UTF8')),'hex'),
    bh,now_at,now_at) RETURNING id INTO eid;
  PERFORM techerp_api.inbox_record(eid,'message_received',mid);
  IF NOT EXISTS(SELECT 1 FROM public.live_chat_messages WHERE session_id=s.id AND id<>mid) THEN
    INSERT INTO public.inbox_channel_evidence(
      workspace_id,channel,account_id,conversation_id,provider_id,provenance,envelope_hash,
      occurred_at,received_at
    ) VALUES(s.workspace_id,'chat',s.workspace_id,s.id,'session:'||s.id::text,'widget_session',
      encode(sha256(convert_to(s.id::text||':'||vh,'UTF8')),'hex'),s.created_at,now_at)
    ON CONFLICT(channel,account_id,provider_id) DO NOTHING RETURNING id INTO sid;
    IF sid IS NOT NULL THEN PERFORM techerp_api.inbox_record(sid,'conversation_created'); END IF;
  END IF;
  UPDATE public.live_chat_sessions SET last_message_at=now_at WHERE id=s.id;
  RETURN mid;
END $$;
REVOKE ALL ON FUNCTION public.widget_inbound_commit(uuid,text,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.widget_inbound_commit(uuid,text,uuid,text) TO service_role;
NOTIFY pgrst,'reload schema';