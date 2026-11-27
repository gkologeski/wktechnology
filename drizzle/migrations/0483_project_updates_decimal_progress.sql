ALTER TABLE public.project_updates
  ADD COLUMN IF NOT EXISTS progress_value numeric(5,2);

UPDATE public.project_updates
SET progress_value = progress_pct::numeric(5,2)
WHERE progress_value IS NULL
  AND progress_pct IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.project_updates'::regclass
      AND conname = 'project_updates_progress_value_check'
  ) THEN
    ALTER TABLE public.project_updates
      ADD CONSTRAINT project_updates_progress_value_check
      CHECK (progress_value IS NULL OR (progress_value >= 0 AND progress_value <= 100));
  END IF;
END $$;

COMMENT ON COLUMN public.project_updates.progress_value IS 'Evolução percentual do acompanhamento (0 a 100, com até 2 casas decimais).';
COMMENT ON COLUMN public.project_updates.progress_pct IS 'DEPRECATED: replaced by progress_value';

CREATE OR REPLACE FUNCTION public.project_updates_log_auto_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_title text;
  v_summary text;
  v_status_pt text;
  v_old_status_pt text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    v_status_pt := CASE NEW.status::text
      WHEN 'planning' THEN 'Planejamento'
      WHEN 'active' THEN 'Execução'
      WHEN 'on_hold' THEN 'Em espera'
      WHEN 'done' THEN 'Concluído'
      WHEN 'cancelled' THEN 'Cancelado'
      ELSE NEW.status::text END;
    v_old_status_pt := CASE OLD.status::text
      WHEN 'planning' THEN 'Planejamento'
      WHEN 'active' THEN 'Execução'
      WHEN 'on_hold' THEN 'Em espera'
      WHEN 'done' THEN 'Concluído'
      WHEN 'cancelled' THEN 'Cancelado'
      ELSE OLD.status::text END;
    v_title := 'Situação do projeto: ' || v_status_pt;
    v_summary := 'A situação passou de ' || v_old_status_pt || ' para ' || v_status_pt || '.';
    INSERT INTO public.project_updates (workspace_id, project_id, kind, title, summary, progress_pct, progress_value, expected_delivery_date, visibility, author_id, owner_id)
    VALUES (NEW.workspace_id, NEW.id, 'auto', v_title, v_summary, NEW.progress, NEW.progress::numeric(5,2), NEW.due_at, 'commercial', auth.uid(), NEW.owner_id);
  END IF;

  IF COALESCE(NEW.progress, 0) IS DISTINCT FROM COALESCE(OLD.progress, 0) THEN
    INSERT INTO public.project_updates (workspace_id, project_id, kind, title, summary, progress_pct, progress_value, expected_delivery_date, visibility, author_id, owner_id)
    VALUES (NEW.workspace_id, NEW.id, 'auto', 'Evolução atualizada',
      'A evolução passou de ' || COALESCE(OLD.progress, 0) || '% para ' || COALESCE(NEW.progress, 0) || '%.',
      NEW.progress, NEW.progress::numeric(5,2), NEW.due_at, 'commercial', auth.uid(), NEW.owner_id);
  END IF;

  IF NEW.due_at IS DISTINCT FROM OLD.due_at THEN
    INSERT INTO public.project_updates (workspace_id, project_id, kind, title, summary, progress_pct, progress_value, expected_delivery_date, visibility, author_id, owner_id)
    VALUES (NEW.workspace_id, NEW.id, 'auto', 'Previsão de entrega alterada',
      CASE
        WHEN OLD.due_at IS NULL THEN 'Previsão de entrega definida para ' || to_char(NEW.due_at, 'DD/MM/YYYY') || '.'
        WHEN NEW.due_at IS NULL THEN 'A previsão de entrega foi removida.'
        ELSE 'A previsão de entrega passou de ' || to_char(OLD.due_at, 'DD/MM/YYYY') || ' para ' || to_char(NEW.due_at, 'DD/MM/YYYY') || '.'
      END,
      NEW.progress, NEW.progress::numeric(5,2), NEW.due_at, 'commercial', auth.uid(), NEW.owner_id);
  END IF;

  RETURN NEW;
END;
$function$;