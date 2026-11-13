-- Private inbound journal; no user/anonymous reads until Inbox-specific grants are released.
CREATE TABLE public.unipile_inbound_messages(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),account_id uuid NOT NULL REFERENCES public.unipile_accounts(id),
 provider_message_id text NOT NULL,chat_id text NOT NULL,sender_id text NOT NULL,body text,
 created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(account_id,provider_message_id)
);
ALTER TABLE public.unipile_inbound_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.unipile_inbound_messages FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.unipile_inbound_messages TO service_role;
CREATE FUNCTION public.unipile_receive_message(p_account uuid,p_message text,p_chat text,p_sender text,p_body text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE a public.unipile_accounts; inserted uuid;candidate uuid;paused integer;
BEGIN
 SELECT * INTO a FROM public.unipile_accounts WHERE id=p_account FOR UPDATE;
 IF NOT FOUND OR a.status<>'connected' OR NOT public.unipile_personal_access(public.work_subject_context(a.workspace_id,a.owner_id),a.workspace_id,a.owner_id,'manage')
 THEN RETURN jsonb_build_object('accepted',false,'reason','account_unavailable');END IF;
 IF nullif(p_message,'') IS NULL OR nullif(p_chat,'') IS NULL OR nullif(p_sender,'') IS NULL OR length(p_message)>256 OR length(p_chat)>256 OR length(p_sender)>256 THEN RAISE EXCEPTION 'Invalid message identifiers';END IF;
 INSERT INTO public.unipile_inbound_messages(account_id,provider_message_id,chat_id,sender_id,body)
 VALUES(a.id,p_message,p_chat,p_sender,left(p_body,16000)) ON CONFLICT(account_id,provider_message_id) DO NOTHING RETURNING id INTO inserted;
 IF inserted IS NULL THEN RETURN jsonb_build_object('accepted',true,'duplicate',true,'paused',0);END IF;
 SELECT candidate_id INTO candidate FROM public.unipile_message_log WHERE account_id=a.id AND target_identifier=p_sender AND candidate_id IS NOT NULL ORDER BY created_at DESC LIMIT 1;
 IF candidate IS NOT NULL THEN
 UPDATE public.ats_sourcing_enrollments SET status='replied',finished_at=now(),next_run_at=NULL,last_error='Candidato respondeu no LinkedIn; cadência interrompida'
 WHERE owner_id=a.owner_id AND workspace_id=a.workspace_id AND candidate_id=candidate AND status='active';
 GET DIAGNOSTICS paused=ROW_COUNT;
 END IF;
 RETURN jsonb_build_object('accepted',true,'duplicate',false,'paused',coalesce(paused,0));
END $$;
REVOKE ALL ON FUNCTION public.unipile_receive_message(uuid,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.unipile_receive_message(uuid,text,text,text,text) TO service_role;
