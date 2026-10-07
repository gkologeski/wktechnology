CREATE OR REPLACE FUNCTION public.sdr_reserve_send_quota(p_job uuid, p_lease uuid, p_limit integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE j record; v_confirmed integer; v_reserved integer;
BEGIN
  SELECT * INTO j FROM public.sdr_turn_jobs WHERE id = p_job;
  IF NOT FOUND OR j.status <> 'running' OR j.lease_token IS DISTINCT FROM p_lease THEN
    RETURN jsonb_build_object('result','lease_lost');
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('sdr-quota:' || j.workspace_id::text, 0));
  SELECT count(DISTINCT a.provider_ref) INTO v_confirmed
    FROM public.sdr_actions a
   WHERE a.workspace_id = j.workspace_id AND a.kind = 'message_sent'
     AND a.status = 'success' AND a.provider_ref IS NOT NULL
     AND a.created_at >= now() - interval '24 hours';
  -- Reservas ativas de outros trabalhos ainda sem envio confirmado registrado.
  SELECT count(*) INTO v_reserved
    FROM public.sdr_turn_jobs t
   WHERE t.workspace_id = j.workspace_id AND t.id <> j.id
     AND t.status IN ('running','sent') AND t.send_reserved_until > now()
     AND NOT EXISTS (SELECT 1 FROM public.sdr_actions a2
                      WHERE a2.job_id = t.id AND a2.kind = 'message_sent' AND a2.status = 'success');
  IF j.send_reserved_until > now() THEN
    RETURN jsonb_build_object('result','already_reserved','used',v_confirmed,'reserved',v_reserved,'limit',p_limit);
  END IF;
  IF v_confirmed + v_reserved >= GREATEST(0, p_limit) THEN
    RETURN jsonb_build_object('result','daily_limit','used',v_confirmed,'reserved',v_reserved,'limit',p_limit);
  END IF;
  UPDATE public.sdr_turn_jobs SET send_reserved_until = now() + interval '90 seconds' WHERE id = p_job;
  RETURN jsonb_build_object('result','ok','used',v_confirmed,'reserved',v_reserved + 1,'limit',p_limit);
END;
$$;
REVOKE ALL ON FUNCTION public.sdr_reserve_send_quota(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sdr_reserve_send_quota(uuid, uuid, integer) TO service_role;