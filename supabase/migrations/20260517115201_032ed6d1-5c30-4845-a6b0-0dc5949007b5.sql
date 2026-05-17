UPDATE public.enrichment_job_items
SET status = 'pending',
    after = NULL,
    error = NULL,
    before = (before
      - 'paused' - 'last_heartbeat_at' - 'cursor' - 'read_index'
      - 'running_succeeded' - 'running_failed' - 'imported_hs_ids'
      - 'discovered' - 'target_ids' - 'parent_map' - 'parents_map'
      - 'deal_contacts_map' - 'started_at' - 'last_processed')
WHERE job_id IN (
  SELECT id FROM public.enrichment_jobs
  WHERE provider='hubspot' AND status IN ('queued','running')
)
AND (before->>'step') <> 'companies';

UPDATE public.enrichment_jobs j
SET processed = COALESCE(sub.done_count, 0),
    succeeded = COALESCE(sub.sum_ok, 0),
    failed = COALESCE(sub.sum_fail, 0),
    error = NULL
FROM (
  SELECT job_id,
         COUNT(*) FILTER (WHERE status IN ('done','failed')) AS done_count,
         SUM(COALESCE((after->>'succeeded')::int, 0)) AS sum_ok,
         SUM(COALESCE((after->>'failed')::int, 0)) AS sum_fail
  FROM public.enrichment_job_items
  GROUP BY job_id
) sub
WHERE j.id = sub.job_id
  AND j.provider='hubspot'
  AND j.status IN ('queued','running');