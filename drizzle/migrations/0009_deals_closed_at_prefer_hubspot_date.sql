-- Preserva a data de fechamento original do HubSpot ao mudar a etapa de negócios importados.
CREATE OR REPLACE FUNCTION public.deals_hs_close_date(_hs_raw jsonb)
RETURNS timestamptz
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN _hs_raw IS NULL THEN NULL
    WHEN nullif(_hs_raw->'properties'->>'closedate', '') IS NULL THEN NULL
    ELSE (_hs_raw->'properties'->>'closedate')::timestamptz
  END
$$;

CREATE OR REPLACE FUNCTION public.deals_set_closed_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  hs_close timestamptz;
BEGIN
  hs_close := public.deals_hs_close_date(NEW.hs_raw);

  IF TG_OP = 'INSERT' THEN
    IF NEW.stage = 'won' AND NEW.closed_at IS NULL THEN
      NEW.closed_at := coalesce(hs_close, now());
    END IF;
    IF NEW.stage = 'lost' AND NEW.lost_at IS NULL THEN
      NEW.lost_at := coalesce(hs_close, now());
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: ganho — só age quando o app não definiu closed_at explicitamente
  IF NEW.closed_at IS NOT DISTINCT FROM OLD.closed_at THEN
    IF NEW.stage = 'won' AND OLD.stage IS DISTINCT FROM 'won' AND NEW.closed_at IS NULL THEN
      NEW.closed_at := coalesce(hs_close, now());
    ELSIF NEW.stage IS DISTINCT FROM 'won' AND OLD.stage = 'won' THEN
      NEW.closed_at := NULL;
    END IF;
  END IF;

  -- UPDATE: perdido — mesma lógica, respeitando lost_at informado pelo app
  IF NEW.lost_at IS NOT DISTINCT FROM OLD.lost_at THEN
    IF NEW.stage = 'lost' AND OLD.stage IS DISTINCT FROM 'lost' AND NEW.lost_at IS NULL THEN
      NEW.lost_at := coalesce(hs_close, now());
    ELSIF NEW.stage IS DISTINCT FROM 'lost' AND OLD.stage = 'lost' THEN
      NEW.lost_at := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;