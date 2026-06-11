
CREATE OR REPLACE FUNCTION public.platform_cron_status()
RETURNS TABLE(jobname text, schedule text, last_start timestamp with time zone, last_end timestamp with time zone, status text, duration_ms integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'cron'
AS $function$
BEGIN
  -- Allow service_role (auth.uid() IS NULL) since the server function already
  -- validates platform_admin before calling. For regular authenticated users,
  -- still require platform_admin.
  IF auth.uid() IS NOT NULL AND NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  SELECT j.jobname::TEXT,
         j.schedule::TEXT,
         r.start_time,
         r.end_time,
         r.status::TEXT,
         CASE WHEN r.end_time IS NOT NULL AND r.start_time IS NOT NULL
              THEN (EXTRACT(EPOCH FROM (r.end_time - r.start_time)) * 1000)::INT END
  FROM cron.job j
  LEFT JOIN LATERAL (
    SELECT * FROM cron.job_run_details d
     WHERE d.jobid = j.jobid
     ORDER BY d.start_time DESC NULLS LAST LIMIT 1
  ) r ON true
  ORDER BY j.jobname;
END $function$;
