
-- 1) Add stage column
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS stage text;

-- 2) Backfill stage
UPDATE public.tickets
SET stage = COALESCE(NULLIF(external_ids->>'hs_pipeline_stage', ''), status::text)
WHERE stage IS NULL;

-- 3) Assign orphan tickets to default pipeline (Pipeline de Tickets)
UPDATE public.tickets
SET pipeline_id = '1cd9a035-b1aa-4b19-b2bb-7ce9e9f263df'
WHERE pipeline_id IS NULL;

-- 4) Default trigger: apply owner's default ticket pipeline when NULL
CREATE OR REPLACE FUNCTION public.tickets_default_pipeline()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.pipeline_id IS NULL THEN
    SELECT id INTO NEW.pipeline_id
    FROM public.pipelines
    WHERE entity = 'ticket'
      AND owner_id = NEW.owner_id
    ORDER BY is_default DESC, created_at ASC
    LIMIT 1;
    IF NEW.pipeline_id IS NULL THEN
      SELECT id INTO NEW.pipeline_id
      FROM public.pipelines
      WHERE entity = 'ticket'
      ORDER BY is_default DESC, created_at ASC
      LIMIT 1;
    END IF;
  END IF;
  IF NEW.stage IS NULL OR NEW.stage = '' THEN
    NEW.stage := 'new';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tickets_default_pipeline ON public.tickets;
CREATE TRIGGER trg_tickets_default_pipeline
  BEFORE INSERT ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.tickets_default_pipeline();

-- 5) NOT NULL + defaults
ALTER TABLE public.tickets ALTER COLUMN stage SET DEFAULT 'new';
ALTER TABLE public.tickets ALTER COLUMN stage SET NOT NULL;
ALTER TABLE public.tickets ALTER COLUMN pipeline_id SET NOT NULL;

-- 6) Index for kanban grouping
CREATE INDEX IF NOT EXISTS idx_tickets_pipeline_stage
  ON public.tickets(pipeline_id, stage) WHERE deleted_at IS NULL;
