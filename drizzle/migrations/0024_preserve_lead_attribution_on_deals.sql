ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source TEXT;

CREATE INDEX IF NOT EXISTS deals_lead_id_idx ON public.deals(lead_id);
CREATE INDEX IF NOT EXISTS deals_workspace_lead_idx ON public.deals(workspace_id, lead_id);
CREATE INDEX IF NOT EXISTS deals_workspace_source_idx ON public.deals(workspace_id, source);
CREATE INDEX IF NOT EXISTS leads_workspace_created_source_idx ON public.leads(workspace_id, created_at, source) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS leads_workspace_pipeline_stage_idx ON public.leads(workspace_id, pipeline_id, stage_id) WHERE deleted_at IS NULL;

UPDATE public.deals AS d
SET lead_id = l.id,
    source = l.source
FROM public.leads AS l
WHERE l.converted_deal_id = d.id
  AND l.workspace_id = d.workspace_id
  AND d.lead_id IS NULL;

CREATE OR REPLACE FUNCTION public.deals_validate_lead_workspace()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.lead_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.leads AS l
    WHERE l.id = NEW.lead_id
      AND l.workspace_id = NEW.workspace_id
  ) THEN
    RAISE EXCEPTION 'O lead informado não pertence ao workspace do negócio.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS deals_lead_workspace_guard ON public.deals;
CREATE TRIGGER deals_lead_workspace_guard
  BEFORE INSERT OR UPDATE OF lead_id, workspace_id ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.deals_validate_lead_workspace();

COMMENT ON COLUMN public.deals.lead_id IS 'Lead de origem do negócio, preservado na conversão para atribuição rastreável.';
COMMENT ON COLUMN public.deals.source IS 'Snapshot da origem principal do lead no momento da conversão.';