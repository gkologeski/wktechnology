CREATE FUNCTION public.unipile_signed_inbound_commit(
  p_account uuid,p_message text,p_chat text,p_sender text,p_body text,
  p_envelope_hash text,p_occurred timestamptz,p_live boolean,p_self boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
DECLARE a record; envelope record; m record; result jsonb;
  eid uuid; bh text; now_at timestamptz:=clock_timestamp(); existed boolean; had_conversation boolean;
  provenance_value text:='history';
BEGIN
  PERFORM techerp_api.notification_service();
  IF public.is_read_only_view() THEN RAISE EXCEPTION 'Somente leitura.' USING ERRCODE='42501'; END IF;
  IF p_envelope_hash IS NULL OR p_envelope_hash !~ '^[a-f0-9]{64}$'
    OR p_live IS NULL OR p_self IS NULL OR p_occurred>now_at+interval '5 minutes'
  THEN RAISE EXCEPTION 'Envelope inválido.' USING ERRCODE='22023'; END IF;
  IF p_self THEN RETURN jsonb_build_object('accepted',false,'reason','self'); END IF;
  SELECT * INTO a FROM public.unipile_accounts WHERE id=p_account FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('accepted',false,'reason','account_unavailable'); END IF;
  IF a.status<>'connected' OR NOT public.is_workspace_member(a.workspace_id,a.owner_id)
    OR NOT public.unipile_personal_access(public.work_subject_context(a.workspace_id,a.owner_id),a.workspace_id,a.owner_id,'manage')
  THEN RETURN jsonb_build_object('accepted',false,'reason','account_unavailable'); END IF;
  bh:=encode(sha256(convert_to(coalesce(left(p_body,16000),''),'UTF8')),'hex');
  SELECT * INTO envelope FROM public.inbox_unipile_envelopes WHERE account_id=a.id AND provider_id=p_message;
  IF FOUND THEN
    IF envelope.chat_id IS DISTINCT FROM p_chat OR envelope.sender_id IS DISTINCT FROM p_sender
      OR envelope.body_hash IS DISTINCT FROM bh OR envelope.occurred_at IS DISTINCT FROM p_occurred
      OR envelope.self_sent IS DISTINCT FROM p_self
    THEN RAISE EXCEPTION 'Envelope divergente em retry.' USING ERRCODE='23505'; END IF;
    -- Never update/promote discovery provenance, even if a retry claims live=true.
    RETURN jsonb_build_object('accepted',true,'duplicate',true);
  END IF;
  SELECT EXISTS(SELECT 1 FROM public.unipile_inbound_messages WHERE account_id=a.id AND provider_message_id=p_message) INTO existed;
  SELECT EXISTS(SELECT 1 FROM public.linkedin_conversations WHERE account_id=a.id AND provider_chat_id=p_chat) INTO had_conversation;
  IF p_live AND p_occurred IS NOT NULL AND NOT existed THEN provenance_value:='live_signed'; END IF;
  INSERT INTO public.inbox_unipile_envelopes(
    account_id,provider_id,chat_id,sender_id,envelope_hash,body_hash,occurred_at,received_at,provenance,self_sent
  ) VALUES(a.id,p_message,p_chat,p_sender,p_envelope_hash,bh,p_occurred,now_at,provenance_value,false);
  result:=public.unipile_receive_message(a.id,p_message,p_chat,p_sender,p_body);
  SELECT * INTO m FROM public.linkedin_messages WHERE account_id=a.id AND provider_message_id=p_message AND direction='inbound';
  IF NOT FOUND THEN RAISE EXCEPTION 'Projeção pendente.' USING ERRCODE='40001'; END IF;
  IF provenance_value='history' THEN RETURN result; END IF;
  INSERT INTO public.inbox_channel_evidence(
    workspace_id,channel,account_id,conversation_id,provider_id,message_id,provenance,
    envelope_hash,body_hash,occurred_at,received_at
  ) VALUES(a.workspace_id,'linkedin',a.id,m.conversation_id,p_message,m.id,'unipile_signed',
    p_envelope_hash,bh,p_occurred,now_at) RETURNING id INTO eid;
  PERFORM techerp_api.inbox_record(eid,'message_received',m.id);
  IF NOT had_conversation THEN PERFORM techerp_api.inbox_record(eid,'conversation_created'); END IF;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.unipile_signed_inbound_commit(uuid,text,text,text,text,text,timestamptz,boolean,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.unipile_signed_inbound_commit(uuid,text,text,text,text,text,timestamptz,boolean,boolean) TO service_role;
NOTIFY pgrst,'reload schema';