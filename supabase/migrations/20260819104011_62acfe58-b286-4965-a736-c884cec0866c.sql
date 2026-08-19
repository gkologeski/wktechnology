CREATE OR REPLACE FUNCTION public.backfill_activities_assigned_to_batch()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  UPDATE public.activities a
     SET assigned_to = COALESCE(a.created_by, a.owner_id)
   WHERE a.id IN (
     SELECT id FROM public.activities WHERE assigned_to IS NULL LIMIT 5000
   );
  GET DIAGNOSTICS n = ROW_COUNT;

  IF n = 0 THEN
    PERFORM cron.unschedule('backfill-activities-assigned-to')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'backfill-activities-assigned-to');
  END IF;

  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.backfill_activities_assigned_to_batch() FROM PUBLIC;

SELECT cron.unschedule('backfill-activities-assigned-to')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'backfill-activities-assigned-to');

SELECT cron.schedule(
  'backfill-activities-assigned-to',
  '* * * * *',
  $$SELECT public.backfill_activities_assigned_to_batch();$$
);