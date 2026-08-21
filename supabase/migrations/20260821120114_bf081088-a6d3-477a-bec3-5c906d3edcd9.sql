ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS deals_closed_at_idx
  ON public.deals (workspace_id, closed_at)
  WHERE closed_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.deals_set_closed_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.stage = 'won' AND NEW.closed_at IS NULL THEN
      NEW.closed_at := now();
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: só age quando a etapa mudou e o app não definiu closed_at explicitamente
  IF NEW.closed_at IS DISTINCT FROM OLD.closed_at THEN
    RETURN NEW;
  END IF;

  IF NEW.stage = 'won' AND OLD.stage IS DISTINCT FROM 'won' AND NEW.closed_at IS NULL THEN
    NEW.closed_at := now();
  ELSIF NEW.stage IS DISTINCT FROM 'won' AND OLD.stage = 'won' THEN
    NEW.closed_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deals_set_closed_at ON public.deals;
CREATE TRIGGER trg_deals_set_closed_at
  BEFORE INSERT OR UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.deals_set_closed_at();

-- Backfill dos negócios já ganhos
UPDATE public.deals d
SET closed_at = COALESCE(se.entered_at, d.updated_at)
FROM (
  SELECT DISTINCT ON (entity_id) entity_id, entered_at
  FROM public.stage_entries
  WHERE entity = 'deals'
  ORDER BY entity_id, entered_at DESC
) se
WHERE se.entity_id = d.id
  AND d.stage = 'won'
  AND d.closed_at IS NULL;

UPDATE public.deals
SET closed_at = updated_at
WHERE stage = 'won' AND closed_at IS NULL;