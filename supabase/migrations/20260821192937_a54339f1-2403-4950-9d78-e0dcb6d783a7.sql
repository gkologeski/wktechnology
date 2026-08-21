CREATE OR REPLACE FUNCTION public.pipelines_enforce_single_default()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_default IS TRUE AND NEW.workspace_id IS NOT NULL THEN
    UPDATE public.pipelines
       SET is_default = false
     WHERE workspace_id = NEW.workspace_id
       AND entity = NEW.entity
       AND id <> NEW.id
       AND is_default IS TRUE;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pipelines_enforce_single_default ON public.pipelines;

CREATE TRIGGER pipelines_enforce_single_default
AFTER INSERT OR UPDATE OF is_default, entity, workspace_id ON public.pipelines
FOR EACH ROW
EXECUTE FUNCTION public.pipelines_enforce_single_default();