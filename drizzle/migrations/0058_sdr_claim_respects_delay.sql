CREATE OR REPLACE FUNCTION public.sdr_claim_jobs(p_limit integer, p_lease_seconds integer)
RETURNS SETOF public.sdr_turn_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT DISTINCT ON (j.conversation_id) j.id
    FROM public.sdr_turn_jobs j
    WHERE ((j.status = 'queued' AND (j.lease_until IS NULL OR j.lease_until < now()))
           OR (j.status = 'running' AND j.lease_until < now()))
      AND j.attempts < 3
      AND NOT EXISTS (
        SELECT 1 FROM public.sdr_turn_jobs r
        WHERE r.conversation_id = j.conversation_id
          AND r.id <> j.id
          AND r.status = 'running'
          AND r.lease_until >= now()
      )
    ORDER BY j.conversation_id, j.created_at
    LIMIT GREATEST(1, LEAST(p_limit, 50))
  ), locked AS (
    SELECT j.id FROM public.sdr_turn_jobs j
    JOIN candidates c ON c.id = j.id
    FOR UPDATE OF j SKIP LOCKED
  )
  UPDATE public.sdr_turn_jobs t
  SET status = 'running',
      lease_token = gen_random_uuid(),
      lease_until = now() + make_interval(secs => GREATEST(30, p_lease_seconds)),
      attempts = t.attempts + 1,
      updated_at = now()
  FROM locked
  WHERE t.id = locked.id
  RETURNING t.*;
END;
$$;
REVOKE ALL ON FUNCTION public.sdr_claim_jobs(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sdr_claim_jobs(integer, integer) TO service_role;
