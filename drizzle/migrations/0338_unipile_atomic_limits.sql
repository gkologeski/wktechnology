ALTER TABLE public.unipile_accounts ADD COLUMN operation_policy jsonb NOT NULL DEFAULT '{"paused":false,"daily_messages":15,"weekly_messages":75,"daily_invites":5,"weekly_invites":20,"min_interval_seconds":60}';
ALTER TABLE public.unipile_accounts ADD CONSTRAINT unipile_operation_policy_valid CHECK(coalesce(jsonb_typeof(operation_policy)='object' AND jsonb_typeof(operation_policy->'paused')='boolean' AND jsonb_typeof(operation_policy->'daily_messages')='number' AND (operation_policy->>'daily_messages')::numeric BETWEEN 0 AND 50 AND trunc((operation_policy->>'daily_messages')::numeric)=(operation_policy->>'daily_messages')::numeric AND jsonb_typeof(operation_policy->'weekly_messages')='number' AND (operation_policy->>'weekly_messages')::numeric BETWEEN 0 AND 250 AND trunc((operation_policy->>'weekly_messages')::numeric)=(operation_policy->>'weekly_messages')::numeric AND jsonb_typeof(operation_policy->'daily_invites')='number' AND (operation_policy->>'daily_invites')::numeric BETWEEN 0 AND 15 AND trunc((operation_policy->>'daily_invites')::numeric)=(operation_policy->>'daily_invites')::numeric AND jsonb_typeof(operation_policy->'weekly_invites')='number' AND (operation_policy->>'weekly_invites')::numeric BETWEEN 0 AND 100 AND trunc((operation_policy->>'weekly_invites')::numeric)=(operation_policy->>'weekly_invites')::numeric AND jsonb_typeof(operation_policy->'min_interval_seconds')='number' AND (operation_policy->>'min_interval_seconds')::numeric BETWEEN 60 AND 3600 AND trunc((operation_policy->>'min_interval_seconds')::numeric)=(operation_policy->>'min_interval_seconds')::numeric,false));
ALTER TABLE public.unipile_accounts ADD COLUMN paused_until timestamptz;
ALTER TABLE public.unipile_accounts ADD COLUMN next_outbound_at timestamptz;
CREATE TABLE public.unipile_attempts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),account_id uuid NOT NULL REFERENCES public.unipile_accounts(id),endpoint text NOT NULL,noted boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX unipile_attempts_window ON public.unipile_attempts(account_id,endpoint,created_at DESC);
ALTER TABLE public.unipile_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.unipile_attempts FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.unipile_attempts TO service_role;
-- Preserve legacy attempts conservatively at the bucket's last request timestamp.
-- Invite notes were not recorded: treat legacy invitations as noted, never reopen that allowance.
INSERT INTO public.unipile_attempts(account_id,endpoint,noted,created_at)
SELECT b.account_id,b.endpoint,b.endpoint='invite.send',coalesce(b.last_request_at,b.day_utc::timestamp AT TIME ZONE 'UTC')
FROM public.unipile_rate_buckets b CROSS JOIN LATERAL generate_series(1,b.count) n
WHERE b.day_utc>=((now() AT TIME ZONE 'UTC')::date-32) AND b.count>0;
CREATE FUNCTION public.unipile_request_reserve(p_account uuid,p_endpoint text,p_daily integer,p_interval integer,p_noted boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE a public.unipile_accounts; used integer;cap integer;weekly integer;tz text;h integer;d date;last_at timestamptz;v_id uuid;
BEGIN
 SELECT * INTO a FROM public.unipile_accounts WHERE id=p_account FOR UPDATE;
 IF NOT FOUND OR a.status<>'connected' OR NOT public.unipile_personal_access(public.work_subject_context(a.workspace_id,a.owner_id),a.workspace_id,a.owner_id,'manage')
 THEN RAISE EXCEPTION 'LinkedIn account unauthorized or disconnected' USING ERRCODE='42501';END IF;
 IF p_endpoint NOT IN('profile.fetch','profile.search','message.send','invite.send','chat.list','hosted.link','job.publish') OR p_daily<1 OR p_interval<0 THEN RAISE EXCEPTION 'Invalid operation';END IF;
 IF coalesce((a.operation_policy->>'paused')::boolean,false) OR a.paused_until>now() THEN RETURN jsonb_build_object('ok',false,'reason','account_paused','retryAt',a.paused_until);END IF;
 tz:=coalesce(a.daily_window->>'tz','America/Sao_Paulo');d:=(now() AT TIME ZONE tz)::date;
 cap:=least(p_daily,CASE p_endpoint WHEN 'message.send' THEN least(50,greatest(0,(a.operation_policy->>'daily_messages')::integer)) WHEN 'invite.send' THEN least(15,greatest(0,(a.operation_policy->>'daily_invites')::integer)) ELSE p_daily END);
 IF p_endpoint IN('message.send','invite.send') THEN
 h:=extract(hour FROM now() AT TIME ZONE tz);
 IF h<coalesce((a.daily_window->>'start_hour')::integer,8) OR h>=coalesce((a.daily_window->>'end_hour')::integer,20) THEN RETURN jsonb_build_object('ok',false,'reason','out_of_window','retryAt',((d+CASE WHEN h<coalesce((a.daily_window->>'start_hour')::integer,8) THEN 0 ELSE 1 END)+make_interval(hours=>coalesce((a.daily_window->>'start_hour')::integer,8))) AT TIME ZONE tz);END IF;
 IF a.next_outbound_at>now() THEN RETURN jsonb_build_object('ok',false,'reason','minimum_interval','retryAt',a.next_outbound_at);END IF;
 END IF;
 SELECT max(created_at) INTO last_at FROM public.unipile_attempts WHERE account_id=a.id AND endpoint=p_endpoint;
 IF last_at+make_interval(secs=>p_interval)>now() THEN RETURN jsonb_build_object('ok',false,'reason','minimum_interval','retryAt',last_at+make_interval(secs=>p_interval));END IF;
 SELECT count(*) INTO used FROM public.unipile_attempts WHERE account_id=a.id AND endpoint=p_endpoint AND created_at>=d::timestamp AT TIME ZONE tz;
 IF used>=cap THEN RETURN jsonb_build_object('ok',false,'reason','daily_limit','retryAt',(d+1)::timestamp AT TIME ZONE tz);END IF;
 IF p_endpoint IN('message.send','invite.send') THEN
 weekly:=CASE p_endpoint WHEN 'message.send' THEN least(250,greatest(0,(a.operation_policy->>'weekly_messages')::integer)) ELSE least(100,greatest(0,(a.operation_policy->>'weekly_invites')::integer)) END;
 SELECT count(*),min(created_at) INTO used,last_at FROM public.unipile_attempts WHERE account_id=a.id AND endpoint=p_endpoint AND created_at>now()-interval '7 days';
 IF used>=weekly THEN RETURN jsonb_build_object('ok',false,'reason','weekly_limit','retryAt',last_at+interval '7 days');END IF;
 IF p_noted THEN
 SELECT count(*) INTO used FROM public.unipile_attempts WHERE account_id=a.id AND endpoint='invite.send' AND noted AND created_at>=date_trunc('month',now() AT TIME ZONE tz) AT TIME ZONE tz;
 IF used>=5 THEN RETURN jsonb_build_object('ok',false,'reason','noted_invitation_limit','retryAt',(date_trunc('month',now() AT TIME ZONE tz)+interval '1 month') AT TIME ZONE tz);END IF;
 END IF;
 UPDATE public.unipile_accounts SET next_outbound_at=now()+make_interval(secs=>greatest(60,p_interval,coalesce((a.operation_policy->>'min_interval_seconds')::integer,60))) WHERE id=a.id;
 END IF;
 INSERT INTO public.unipile_attempts(account_id,endpoint,noted) VALUES(a.id,p_endpoint,p_noted) RETURNING id INTO v_id;
 INSERT INTO public.unipile_rate_buckets(account_id,endpoint,day_utc,count,last_request_at) VALUES(a.id,p_endpoint,(now() AT TIME ZONE 'UTC')::date,1,now())
 ON CONFLICT(account_id,endpoint,day_utc) DO UPDATE SET count=unipile_rate_buckets.count+1,last_request_at=now();
 RETURN jsonb_build_object('ok',true,'attemptId',v_id);
END $$;
REVOKE ALL ON FUNCTION public.unipile_request_reserve(uuid,text,integer,integer,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.unipile_request_reserve(uuid,text,integer,integer,boolean) TO service_role;
