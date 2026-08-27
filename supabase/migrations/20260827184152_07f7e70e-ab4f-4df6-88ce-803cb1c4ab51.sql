-- 1) Tabela de substatus por etapa de pipeline
CREATE TABLE public.pipeline_stage_substatuses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  pipeline_id uuid NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
  stage_value text NOT NULL,
  name text NOT NULL,
  description text,
  color text,
  position integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pipeline_stage_substatuses TO authenticated;
GRANT ALL ON public.pipeline_stage_substatuses TO service_role;

ALTER TABLE public.pipeline_stage_substatuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ws_select_pipeline_stage_substatuses"
ON public.pipeline_stage_substatuses FOR SELECT TO authenticated
USING (workspace_id IN (SELECT current_user_workspaces()));

CREATE POLICY "ws_insert_pipeline_stage_substatuses"
ON public.pipeline_stage_substatuses FOR INSERT TO authenticated
WITH CHECK (workspace_id IN (SELECT current_user_workspaces()));

CREATE POLICY "ws_update_pipeline_stage_substatuses"
ON public.pipeline_stage_substatuses FOR UPDATE TO authenticated
USING (workspace_id IN (SELECT current_user_workspaces()))
WITH CHECK (workspace_id IN (SELECT current_user_workspaces()));

CREATE POLICY "ws_delete_pipeline_stage_substatuses"
ON public.pipeline_stage_substatuses FOR DELETE TO authenticated
USING (workspace_id IN (SELECT current_user_workspaces()));

CREATE INDEX idx_pss_pipeline_stage
  ON public.pipeline_stage_substatuses (pipeline_id, stage_value, position);
CREATE INDEX idx_pss_workspace
  ON public.pipeline_stage_substatuses (workspace_id);
CREATE UNIQUE INDEX uq_pss_default_per_stage
  ON public.pipeline_stage_substatuses (pipeline_id, stage_value)
  WHERE is_default;
CREATE UNIQUE INDEX uq_pss_name_per_stage
  ON public.pipeline_stage_substatuses (pipeline_id, stage_value, lower(name));

CREATE TRIGGER trg_pss_updated_at
BEFORE UPDATE ON public.pipeline_stage_substatuses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Campo opcional nos registros
ALTER TABLE public.leads
  ADD COLUMN stage_substatus_id uuid
  REFERENCES public.pipeline_stage_substatuses(id) ON DELETE SET NULL;
ALTER TABLE public.deals
  ADD COLUMN stage_substatus_id uuid
  REFERENCES public.pipeline_stage_substatuses(id) ON DELETE SET NULL;

CREATE INDEX idx_leads_stage_substatus ON public.leads (stage_substatus_id);
CREATE INDEX idx_deals_stage_substatus ON public.deals (stage_substatus_id);

-- 3) Coerência entre etapa e substatus
CREATE OR REPLACE FUNCTION public.sync_stage_substatus()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ss record;
BEGIN
  -- etapa mudou e o substatus não foi definido explicitamente na mesma operação
  IF TG_OP = 'UPDATE'
     AND NEW.stage_id IS DISTINCT FROM OLD.stage_id
     AND NEW.stage_substatus_id IS NOT DISTINCT FROM OLD.stage_substatus_id THEN
    NEW.stage_substatus_id := NULL;
    IF NEW.pipeline_id IS NOT NULL AND NEW.stage_id IS NOT NULL THEN
      SELECT id INTO NEW.stage_substatus_id
        FROM public.pipeline_stage_substatuses
       WHERE pipeline_id = NEW.pipeline_id
         AND stage_value = NEW.stage_id
         AND is_default
         AND is_active
       LIMIT 1;
    END IF;
  END IF;

  IF NEW.stage_substatus_id IS NOT NULL THEN
    SELECT pipeline_id, stage_value INTO ss
      FROM public.pipeline_stage_substatuses
     WHERE id = NEW.stage_substatus_id;
    IF ss IS NULL THEN
      RAISE EXCEPTION 'Substatus inexistente.';
    END IF;
    IF NEW.pipeline_id IS NULL OR ss.pipeline_id IS DISTINCT FROM NEW.pipeline_id THEN
      RAISE EXCEPTION 'O substatus pertence a outro pipeline.';
    END IF;
    IF ss.stage_value IS DISTINCT FROM NEW.stage_id THEN
      RAISE EXCEPTION 'O substatus pertence a outra etapa do pipeline.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_leads_stage_substatus
BEFORE INSERT OR UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.sync_stage_substatus();

CREATE TRIGGER trg_deals_stage_substatus
BEFORE INSERT OR UPDATE ON public.deals
FOR EACH ROW EXECUTE FUNCTION public.sync_stage_substatus();