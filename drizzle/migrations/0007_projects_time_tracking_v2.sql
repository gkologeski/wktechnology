-- TechProjects: apontamento de horas (horário início/fim, origem, idempotência, aprovação)

ALTER TABLE public.project_time_entries
  ADD COLUMN IF NOT EXISTS start_time time,
  ADD COLUMN IF NOT EXISTS end_time time,
  ADD COLUMN IF NOT EXISTS duration_minutes integer,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_by uuid,
  ADD COLUMN IF NOT EXISTS reject_reason text,
  ADD COLUMN IF NOT EXISTS locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_by uuid;

ALTER TABLE public.project_time_entries
  DROP CONSTRAINT IF EXISTS project_time_entries_source_check;
ALTER TABLE public.project_time_entries
  ADD CONSTRAINT project_time_entries_source_check
  CHECK (source IN ('manual','timer','api','integration','import'));

ALTER TABLE public.project_time_entries
  DROP CONSTRAINT IF EXISTS project_time_entries_status_check;
ALTER TABLE public.project_time_entries
  ADD CONSTRAINT project_time_entries_status_check
  CHECK (status IN ('draft','submitted','approved','rejected','locked'));

-- Backfill: status a partir da aprovação já existente; duração a partir de hours
UPDATE public.project_time_entries
   SET status = 'approved'
 WHERE approved_at IS NOT NULL AND status = 'draft';

UPDATE public.project_time_entries
   SET duration_minutes = GREATEST(0, ROUND(hours * 60))::int
 WHERE duration_minutes IS NULL AND hours IS NOT NULL;

-- Idempotência de integrações
CREATE UNIQUE INDEX IF NOT EXISTS project_time_entries_external_uniq
  ON public.project_time_entries (workspace_id, source, external_id)
  WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS project_time_entries_user_date_idx
  ON public.project_time_entries (workspace_id, user_id, entry_date);

CREATE INDEX IF NOT EXISTS project_time_entries_status_idx
  ON public.project_time_entries (workspace_id, status);

-- Autorização de apontamento por membro de projeto
ALTER TABLE public.project_members
  ADD COLUMN IF NOT EXISTS can_track_time boolean NOT NULL DEFAULT true;

-- ===== Validação e normalização =====
CREATE OR REPLACE FUNCTION public.project_time_entries_validate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_overlap record;
BEGIN
  IF NEW.project_id IS NULL THEN
    RAISE EXCEPTION 'Apontamento exige um projeto.';
  END IF;
  IF NEW.user_id IS NULL THEN
    RAISE EXCEPTION 'Apontamento exige um profissional.';
  END IF;

  -- Duração: prioriza horário início/fim; senão usa hours
  IF NEW.start_time IS NOT NULL AND NEW.end_time IS NOT NULL THEN
    IF NEW.end_time <= NEW.start_time THEN
      RAISE EXCEPTION 'O horário final deve ser maior que o horário inicial.';
    END IF;
    NEW.duration_minutes :=
      ROUND(EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 60)::int;
  ELSIF NEW.duration_minutes IS NULL AND NEW.hours IS NOT NULL THEN
    NEW.duration_minutes := GREATEST(0, ROUND(NEW.hours * 60))::int;
  END IF;

  IF NEW.duration_minutes IS NOT NULL THEN
    IF NEW.duration_minutes < 0 THEN
      RAISE EXCEPTION 'A duração do apontamento não pode ser negativa.';
    END IF;
    NEW.hours := ROUND((NEW.duration_minutes::numeric / 60), 2);
  END IF;

  -- Sobreposição de horários do mesmo profissional no mesmo dia
  IF NEW.start_time IS NOT NULL AND NEW.end_time IS NOT NULL THEN
    SELECT t.start_time, t.end_time INTO v_overlap
      FROM public.project_time_entries t
     WHERE t.user_id = NEW.user_id
       AND t.entry_date = NEW.entry_date
       AND t.id IS DISTINCT FROM NEW.id
       AND t.start_time IS NOT NULL
       AND t.end_time IS NOT NULL
       AND t.start_time < NEW.end_time
       AND t.end_time > NEW.start_time
     LIMIT 1;
    IF v_overlap IS NOT NULL THEN
      RAISE EXCEPTION 'Já existe um apontamento entre % e % neste dia.',
        to_char(v_overlap.start_time, 'HH24:MI'), to_char(v_overlap.end_time, 'HH24:MI');
    END IF;
  END IF;

  IF NEW.created_by IS NULL THEN
    NEW.created_by := COALESCE(auth.uid(), NEW.user_id);
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS project_time_entries_validate_trg ON public.project_time_entries;
CREATE TRIGGER project_time_entries_validate_trg
  BEFORE INSERT OR UPDATE ON public.project_time_entries
  FOR EACH ROW EXECUTE FUNCTION public.project_time_entries_validate();

-- ===== Auditoria de alterações =====
CREATE OR REPLACE FUNCTION public.project_time_entries_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws uuid := COALESCE(NEW.workspace_id, OLD.workspace_id);
BEGIN
  INSERT INTO public.audit_logs (workspace_owner_id, actor_user_id, entity, entity_id,
                                 action, before, after, module_id)
  VALUES (
    v_ws,
    auth.uid(),
    'project_time_entries',
    COALESCE(NEW.id, OLD.id),
    lower(TG_OP),
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
    'projects'
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS project_time_entries_audit_trg ON public.project_time_entries;
CREATE TRIGGER project_time_entries_audit_trg
  AFTER INSERT OR UPDATE OR DELETE ON public.project_time_entries
  FOR EACH ROW EXECUTE FUNCTION public.project_time_entries_audit();
