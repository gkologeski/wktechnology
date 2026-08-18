CREATE OR REPLACE FUNCTION public.ats_pipelines_enforce_single_default()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_default THEN
    UPDATE public.ats_pipelines p
    SET is_default = false, updated_at = now()
    WHERE p.id <> NEW.id
      AND p.is_default
      AND COALESCE(public.resolve_workspace_id(p.owner_id), p.owner_id)
        = COALESCE(public.resolve_workspace_id(NEW.owner_id), NEW.owner_id);
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.ats_pipelines_enforce_single_default() FROM PUBLIC, anon, authenticated;

WITH ws AS (
  SELECT p.id,
         COALESCE(public.resolve_workspace_id(p.owner_id), p.owner_id) AS wsid,
         p.is_default,
         p.created_at,
         (SELECT count(*) FROM public.ats_jobs j WHERE j.pipeline_id = p.id) AS jobs
  FROM public.ats_pipelines p
),
winner AS (
  SELECT DISTINCT ON (wsid) wsid, id
  FROM ws
  ORDER BY wsid, is_default DESC, jobs DESC, created_at ASC
)
UPDATE public.ats_pipelines p
SET is_default = (w.id = p.id), updated_at = now()
FROM ws s
JOIN winner w ON w.wsid = s.wsid
WHERE p.id = s.id
  AND p.is_default <> (w.id = p.id);