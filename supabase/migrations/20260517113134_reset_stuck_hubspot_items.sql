-- Resetar itens HubSpot presos em "running" sem progresso real (sem after/finished_at).
-- O novo código de batch v4 vai concluí-los rapidamente.
UPDATE public.enrichment_job_items
SET status = 'pending',
    before = (before - 'paused' - 'last_heartbeat_at' - 'started_at')
WHERE status = 'running'
  AND (after IS NULL OR after->>'finished_at' IS NULL)
  AND before->>'step' IN ('contacts','deals','leads','activities-notes','activities-calls','activities-meetings','activities-tasks','activities-emails');
