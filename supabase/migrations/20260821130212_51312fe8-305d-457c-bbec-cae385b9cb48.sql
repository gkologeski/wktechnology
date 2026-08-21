ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS lost_at timestamptz;

CREATE INDEX IF NOT EXISTS deals_lost_at_idx
  ON public.deals (lost_at)
  WHERE stage = 'lost';

CREATE OR REPLACE FUNCTION public.deals_set_closed_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.stage = 'won' AND NEW.closed_at IS NULL THEN
      NEW.closed_at := now();
    END IF;
    IF NEW.stage = 'lost' AND NEW.lost_at IS NULL THEN
      NEW.lost_at := now();
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: ganho — só age quando o app não definiu closed_at explicitamente
  IF NEW.closed_at IS NOT DISTINCT FROM OLD.closed_at THEN
    IF NEW.stage = 'won' AND OLD.stage IS DISTINCT FROM 'won' AND NEW.closed_at IS NULL THEN
      NEW.closed_at := now();
    ELSIF NEW.stage IS DISTINCT FROM 'won' AND OLD.stage = 'won' THEN
      NEW.closed_at := NULL;
    END IF;
  END IF;

  -- UPDATE: perdido — mesma lógica, respeitando lost_at informado pelo app
  IF NEW.lost_at IS NOT DISTINCT FROM OLD.lost_at THEN
    IF NEW.stage = 'lost' AND OLD.stage IS DISTINCT FROM 'lost' AND NEW.lost_at IS NULL THEN
      NEW.lost_at := now();
    ELSIF NEW.stage IS DISTINCT FROM 'lost' AND OLD.stage = 'lost' THEN
      NEW.lost_at := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Backfill: data de fechamento original do HubSpot guardada em hs_raw
UPDATE public.deals d
SET lost_at = (d.hs_raw -> 'properties' ->> 'closedate')::timestamptz
WHERE d.stage = 'lost'
  AND d.lost_at IS NULL
  AND nullif(d.hs_raw -> 'properties' ->> 'closedate', '') IS NOT NULL;