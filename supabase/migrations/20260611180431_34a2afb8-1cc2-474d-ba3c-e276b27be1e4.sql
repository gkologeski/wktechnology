CREATE OR REPLACE FUNCTION public.platform_cron_status()
RETURNS TABLE(jobname text, schedule text, last_start timestamp with time zone, last_end timestamp with time zone, status text, duration_ms integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'cron'
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH recent AS (
    SELECT DISTINCT ON (d.jobid)
           d.jobid, d.start_time, d.end_time, d.status
      FROM cron.job_run_details d
     WHERE d.start_time > now() - interval '24 hours'
     ORDER BY d.jobid, d.start_time DESC
  )
  SELECT j.jobname::TEXT,
         j.schedule::TEXT,
         r.start_time,
         r.end_time,
         r.status::TEXT,
         CASE WHEN r.end_time IS NOT NULL AND r.start_time IS NOT NULL
              THEN (EXTRACT(EPOCH FROM (r.end_time - r.start_time)) * 1000)::INT END
  FROM cron.job j
  LEFT JOIN recent r ON r.jobid = j.jobid
  ORDER BY j.jobname;
END $function$;

REVOKE ALL ON FUNCTION public.platform_cron_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_cron_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_cron_status() TO service_role;