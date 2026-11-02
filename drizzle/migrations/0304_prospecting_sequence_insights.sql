ALTER TABLE public.prospecting_sequence_run_events ADD COLUMN signal text CHECK(signal IN('reply','meeting'));
-- Invoker/RLS aggregates: only already-readable columns, never private receipts or targets.
CREATE INDEX sequence_run_events_workspace_recent ON public.prospecting_sequence_run_events(workspace_id,id DESC);
CREATE FUNCTION public.prospecting_sequence_insights(p_workspace uuid,p_version uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE ctx jsonb;v public.prospecting_sequence_versions;states jsonb;counts jsonb;history jsonb;responded integer;meetings integer;BEGIN
 ctx:=public.sales_access_context();
 SELECT id,owner_id INTO v.id,v.owner_id FROM public.prospecting_sequence_versions WHERE id=p_version AND workspace_id=p_workspace;
 IF v.id IS NULL OR ctx->>'workspace' IS DISTINCT FROM p_workspace::text OR NOT public.sales_context_access(ctx,p_workspace,'system.automation.sequences','view',ARRAY[v.owner_id]) THEN RAISE EXCEPTION 'Indicadores indisponíveis.' USING ERRCODE='42501';END IF;
 SELECT coalesce(jsonb_object_agg(s.state,s.n),'{}') INTO states FROM(SELECT state,count(*) n FROM public.prospecting_sequence_runs WHERE workspace_id=p_workspace AND version_id=p_version GROUP BY state) s;
 SELECT jsonb_build_object('emailAccepted',count(*) FILTER(WHERE e.kind='email' AND e.status='succeeded'),'whatsappAccepted',count(*) FILTER(WHERE e.kind='whatsapp' AND e.status='succeeded'),'callActivities',count(*) FILTER(WHERE e.kind='call' AND e.status='succeeded' AND e.projection_state IN('none','complete')),'taskActivities',count(*) FILTER(WHERE e.kind='task' AND e.status='succeeded' AND e.projection_state IN('none','complete')),'uncertainEffects',count(*) FILTER(WHERE e.status='uncertain'),'projectionPending',count(*) FILTER(WHERE e.projection_state='pending')) INTO counts
 FROM public.prospecting_sequence_effects e JOIN public.prospecting_sequence_runs r ON r.id=e.run_id AND r.workspace_id=e.workspace_id WHERE r.workspace_id=p_workspace AND r.version_id=p_version;
 SELECT count(DISTINCT ev.run_id) FILTER(WHERE ev.signal='reply'),count(DISTINCT ev.run_id) FILTER(WHERE ev.signal='meeting') INTO responded,meetings FROM public.prospecting_sequence_run_events ev JOIN public.prospecting_sequence_runs r ON r.id=ev.run_id AND r.workspace_id=ev.workspace_id WHERE r.workspace_id=p_workspace AND r.version_id=p_version;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',h.id::text,'runId',h.run_id,'kind',h.kind,'reason',h.reason,'createdAt',h.created_at) ORDER BY h.id DESC),'[]') INTO history FROM(SELECT ev.id,ev.run_id,ev.kind,ev.reason,ev.created_at FROM public.prospecting_sequence_run_events ev JOIN public.prospecting_sequence_runs r ON r.id=ev.run_id AND r.workspace_id=ev.workspace_id WHERE r.workspace_id=p_workspace AND r.version_id=p_version ORDER BY ev.id DESC LIMIT 50) h;
 RETURN jsonb_build_object('states',states,'counts',counts,'responses',responded,'meetings',meetings,'history',history,'coverage','current_scope');
END $$;
REVOKE ALL ON FUNCTION public.prospecting_sequence_insights(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.prospecting_sequence_insights(uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.prospecting_sequence_transition(p_run uuid,p_lease uuid,p_state text,p_cursor integer,p_due timestamptz,p_reason text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r public.prospecting_sequence_runs;c jsonb;verified_signal text;BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Serviço requerido.' USING ERRCODE='42501';END IF;
 SELECT * INTO r FROM public.prospecting_sequence_runs WHERE id=p_run AND state='active' AND lease_token=p_lease AND lease_until>now() FOR UPDATE;
 IF r.id IS NULL THEN RETURN false;END IF;
 IF p_state NOT IN('active','completed','human','agent','blocked','uncertain') OR p_cursor<r.cursor OR p_cursor>r.cursor+1 OR p_due IS NULL OR length(p_reason)>200 THEN RAISE EXCEPTION 'Transição inválida.' USING ERRCODE='22023';END IF;
 -- Business labels supplied by users never become conversion evidence.
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
