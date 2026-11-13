CREATE TABLE public.unipile_delivery_receipts(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),account_id uuid NOT NULL REFERENCES public.unipile_accounts(id),request_key text NOT NULL,
 lease_token uuid NOT NULL DEFAULT gen_random_uuid(),status text NOT NULL CHECK(status IN('started','sent','not_started','uncertain')),
 response jsonb,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(account_id,request_key)
);
ALTER TABLE public.unipile_delivery_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.unipile_delivery_receipts FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.unipile_delivery_receipts TO service_role;
CREATE FUNCTION public.unipile_delivery_begin(p_account uuid,p_key text,p_endpoint text,p_daily integer,p_interval integer,p_noted boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE a public.unipile_accounts;r public.unipile_delivery_receipts;b jsonb;
BEGIN
 SELECT * INTO a FROM public.unipile_accounts WHERE id=p_account FOR UPDATE;
 IF NOT FOUND OR a.status<>'connected' OR NOT public.unipile_personal_access(public.work_subject_context(a.workspace_id,a.owner_id),a.workspace_id,a.owner_id,'manage') THEN RAISE EXCEPTION 'Account unauthorized' USING ERRCODE='42501';END IF;
 IF p_endpoint NOT IN('message.send','invite.send') OR length(p_key)<>64 THEN RAISE EXCEPTION 'Invalid outbound operation';END IF;
 SELECT * INTO r FROM public.unipile_delivery_receipts WHERE account_id=p_account AND request_key=p_key FOR UPDATE;
 IF FOUND AND r.status='sent' THEN RETURN jsonb_build_object('ok',true,'cached',true,'response',r.response);END IF;
 IF FOUND AND r.status IN('started','uncertain') THEN RETURN jsonb_build_object('ok',false,'reason','delivery_uncertain');END IF;
 b:=public.unipile_request_reserve(p_account,p_endpoint,p_daily,p_interval,p_noted);
 IF NOT coalesce((b->>'ok')::boolean,false) THEN RETURN b;END IF;
 INSERT INTO public.unipile_delivery_receipts(account_id,request_key,status) VALUES(p_account,p_key,'started')
 ON CONFLICT(account_id,request_key) DO UPDATE SET status='started',lease_token=gen_random_uuid(),updated_at=now()
 RETURNING * INTO r;
 RETURN jsonb_build_object('ok',true,'cached',false,'id',r.id,'token',r.lease_token);
END $$;
CREATE FUNCTION public.unipile_delivery_finish(p_id uuid,p_token uuid,p_status text,p_response jsonb DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF p_status NOT IN('sent','not_started','uncertain') OR octet_length(coalesce(p_response::text,''))>65536 THEN RAISE EXCEPTION 'Invalid delivery result';END IF;
 UPDATE public.unipile_delivery_receipts SET status=p_status,response=p_response,updated_at=now()
 WHERE id=p_id AND lease_token=p_token AND status='started';
 IF NOT FOUND THEN RAISE EXCEPTION 'Delivery lease unavailable';END IF;
END $$;
REVOKE ALL ON FUNCTION public.unipile_delivery_begin(uuid,text,text,integer,integer,boolean),public.unipile_delivery_finish(uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.unipile_delivery_begin(uuid,text,text,integer,integer,boolean),public.unipile_delivery_finish(uuid,uuid,text,jsonb) TO service_role;
CREATE FUNCTION public.unipile_usage_snapshot(p_account uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE a public.unipile_accounts;tz text;result jsonb;aggregate jsonb;
BEGIN
 SELECT * INTO a FROM public.unipile_accounts WHERE id=p_account;
 IF NOT FOUND OR NOT public.unipile_personal_access(public.work_subject_context(a.workspace_id,a.owner_id),a.workspace_id,a.owner_id,'view') THEN RAISE EXCEPTION 'Account unauthorized' USING ERRCODE='42501';END IF;
 tz:=coalesce(a.daily_window->>'tz','America/Sao_Paulo');
 SELECT jsonb_agg(jsonb_build_object('endpoint',e.endpoint,'count',
 (SELECT count(*) FROM public.unipile_attempts x WHERE x.account_id=a.id AND x.endpoint=e.endpoint AND x.created_at>=date_trunc('day',now() AT TIME ZONE tz) AT TIME ZONE tz),
 'limit',CASE e.endpoint WHEN 'message.send' THEN least(50,(a.operation_policy->>'daily_messages')::integer) WHEN 'invite.send' THEN least(15,(a.operation_policy->>'daily_invites')::integer) ELSE e.cap END,
 'day_utc',(now() AT TIME ZONE tz)::date)) INTO result
 FROM (VALUES('profile.fetch',80),('profile.search',20),('message.send',50),('invite.send',15),('chat.list',200)) e(endpoint,cap);
 SELECT jsonb_build_object('window_hours',24,'total',count(*),
 'success',count(*) FILTER(WHERE status BETWEEN 200 AND 299),
 'errors',count(*) FILTER(WHERE status IS NULL OR status NOT BETWEEN 200 AND 299),
 'success_rate',CASE WHEN count(*)=0 THEN 0 ELSE (count(*) FILTER(WHERE status BETWEEN 200 AND 299))::numeric/count(*) END,
 'avg_latency_ms',avg(latency_ms),'p95_latency_ms',percentile_cont(0.95) WITHIN GROUP(ORDER BY latency_ms)) INTO aggregate
 FROM public.unipile_request_log WHERE account_id=a.id AND created_at>=now()-interval '24 hours';
 RETURN jsonb_build_object('buckets',result,'timezone',tz,'pausedUntil',a.paused_until,'aggregate',aggregate);
END $$;
REVOKE ALL ON FUNCTION public.unipile_usage_snapshot(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.unipile_usage_snapshot(uuid) TO service_role;
