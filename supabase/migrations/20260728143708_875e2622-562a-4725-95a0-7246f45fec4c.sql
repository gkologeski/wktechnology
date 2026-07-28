ALTER TABLE public.prospecting_queues
  ADD COLUMN IF NOT EXISTS nurture_cadence_id uuid
  REFERENCES public.prospecting_cadences(id) ON DELETE SET NULL;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS nurture_started_at timestamptz;

CREATE INDEX IF NOT EXISTS leads_status_nurturing_idx
  ON public.leads (workspace_id, nurture_started_at DESC)
  WHERE status = 'nurturing';