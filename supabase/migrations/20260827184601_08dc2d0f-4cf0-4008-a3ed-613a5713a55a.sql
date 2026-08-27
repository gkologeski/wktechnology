CREATE OR REPLACE FUNCTION public.pss_set_workspace_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.workspace_id IS NULL THEN
    SELECT workspace_id INTO NEW.workspace_id
      FROM public.pipelines WHERE id = NEW.pipeline_id;
  END IF;
  IF NEW.workspace_id IS NULL THEN
    NEW.workspace_id := public.default_workspace_for_user(auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.pss_set_workspace_id() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_pss_set_workspace_id
BEFORE INSERT ON public.pipeline_stage_substatuses
FOR EACH ROW EXECUTE FUNCTION public.pss_set_workspace_id();