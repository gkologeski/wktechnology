
-- 1) Coluna manager_id em people_allocations
ALTER TABLE public.people_allocations
  ADD COLUMN IF NOT EXISTS manager_id uuid REFERENCES public.people(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_people_allocations_manager_id
  ON public.people_allocations(manager_id) WHERE manager_id IS NOT NULL;

-- 2) Função que recalcula people.manager_id a partir da alocação ativa mais recente
CREATE OR REPLACE FUNCTION public.people_allocations_sync_manager()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_person uuid;
  new_manager uuid;
BEGIN
  target_person := COALESCE(NEW.person_id, OLD.person_id);
  IF target_person IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT manager_id INTO new_manager
  FROM public.people_allocations
  WHERE person_id = target_person
    AND status = 'active'
    AND manager_id IS NOT NULL
    AND (starts_at IS NULL OR starts_at <= CURRENT_DATE)
    AND (ends_at IS NULL OR ends_at >= CURRENT_DATE)
  ORDER BY starts_at DESC NULLS LAST, updated_at DESC
  LIMIT 1;

  UPDATE public.people SET manager_id = new_manager, updated_at = now()
  WHERE id = target_person
    AND (manager_id IS DISTINCT FROM new_manager);

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_people_allocations_sync_manager ON public.people_allocations;
CREATE TRIGGER trg_people_allocations_sync_manager
AFTER INSERT OR UPDATE OF manager_id, status, starts_at, ends_at, person_id
     OR DELETE
ON public.people_allocations
FOR EACH ROW
EXECUTE FUNCTION public.people_allocations_sync_manager();

-- 3) Backfill: copiar people.manager_id atual para a alocação ativa mais recente sem manager.
DO $$
DECLARE
  r RECORD;
  target_alloc uuid;
BEGIN
  FOR r IN
    SELECT p.id AS person_id, p.manager_id
    FROM public.people p
    WHERE p.manager_id IS NOT NULL AND p.archived = false
  LOOP
    -- Já existe alocação com esse manager? Pula.
    IF EXISTS (
      SELECT 1 FROM public.people_allocations
      WHERE person_id = r.person_id AND manager_id = r.manager_id
    ) THEN
      CONTINUE;
    END IF;

    SELECT id INTO target_alloc
    FROM public.people_allocations
    WHERE person_id = r.person_id
      AND status = 'active'
      AND manager_id IS NULL
    ORDER BY starts_at DESC NULLS LAST, updated_at DESC
    LIMIT 1;

    IF target_alloc IS NOT NULL THEN
      UPDATE public.people_allocations
      SET manager_id = r.manager_id, updated_at = now()
      WHERE id = target_alloc;
    END IF;
  END LOOP;
END $$;
