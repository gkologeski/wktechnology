CREATE OR REPLACE FUNCTION public.prospecting_sequence_transition(p_run uuid,p_lease uuid,p_state text,p_cursor integer,p_due timestamptz,p_reason text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r public.prospecting_sequence_runs;c jsonb;verified_signal text;BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Serviço requerido.' USING ERRCODE='42501';END IF;
 SELECT * INTO r FROM public.prospecting_sequence_runs WHERE id=p_run AND state='active' AND lease_token=p_lease AND lease_until>now() FOR UPDATE;
 IF r.id IS NULL THEN RETURN false;END IF;
 -- Transbordo do limite de WhatsApp pode saltar direto para a próxima ligação, e só para ela.
 IF p_reason='whatsapp_limit_overflow_call' THEN
  c:=public.prospecting_sequence_context(p_run,p_lease);
  IF p_state<>'active' OR p_cursor<=r.cursor OR c#>>ARRAY['definition','steps',r.cursor::text,'type']<>'whatsapp' OR c#>>ARRAY['definition','steps',p_cursor::text,'type']<>'call' OR EXISTS(SELECT 1 FROM jsonb_array_elements(c->'definition'->'steps') WITH ORDINALITY o(s,i) WHERE o.i-1>r.cursor AND o.i-1<p_cursor AND o.s->>'type'='call') THEN RAISE EXCEPTION 'Transição inválida.' USING ERRCODE='22023';END IF;
 ELSIF p_state NOT IN('active','completed','human','agent','blocked','uncertain') OR p_cursor<r.cursor OR p_cursor>r.cursor+1 OR p_due IS NULL OR length(p_reason)>200 THEN RAISE EXCEPTION 'Transição inválida.' USING ERRCODE='22023';END IF;
 IF p_reason='meeting_booked' AND p_state='completed' THEN
  c:=public.prospecting_sequence_context(p_run,p_lease);
  IF coalesce((c#>>'{signals,meetingBooked}')::boolean,false) AND coalesce((c#>>'{definition,settings,stopOnMeeting}')::boolean,true) THEN verified_signal:='meeting';END IF;
 ELSIF p_reason='reply' AND p_state IN('human','agent') THEN
  c:=public.prospecting_sequence_context(p_run,p_lease);
  IF coalesce((c#>>'{signals,replied}')::boolean,false) OR coalesce((c#>>'{signals,previousReplied}')::boolean,false) THEN verified_signal:='reply';END IF;
 END IF;
 UPDATE public.prospecting_sequence_runs SET state=p_state,cursor=p_cursor,next_run_at=p_due,step_entered_at=CASE WHEN p_cursor>r.cursor THEN greatest(now(),p_due) ELSE step_entered_at END,reason=p_reason,lease_token=NULL,lease_until=NULL,updated_at=now() WHERE id=r.id;
 INSERT INTO public.prospecting_sequence_run_events(workspace_id,run_id,kind,reason,signal) VALUES(r.workspace_id,r.id,p_state,p_reason,verified_signal);
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.prospecting_sequence_transition(uuid,uuid,text,integer,timestamptz,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prospecting_sequence_transition(uuid,uuid,text,integer,timestamptz,text) TO service_role;