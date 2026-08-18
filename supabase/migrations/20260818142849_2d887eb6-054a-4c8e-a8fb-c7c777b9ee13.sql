-- 1) Remove pipelines "Pipeline padrão" duplicados e sem vagas vinculadas
WITH ws AS (
  SELECT p.id,
         public.resolve_workspace_id(p.owner_id) AS wsid,
         p.name,
         p.created_at,
         (SELECT count(*) FROM public.ats_jobs j WHERE j.pipeline_id = p.id) AS jobs
  FROM public.ats_pipelines p
),
ranked AS (
  SELECT id, wsid, jobs,
         row_number() OVER (PARTITION BY wsid ORDER BY jobs DESC, created_at ASC) AS rn,
         count(*) OVER (PARTITION BY wsid) AS total
  FROM ws
)
DELETE FROM public.ats_pipelines p
USING ranked r
WHERE p.id = r.id
  AND r.jobs = 0
  AND r.rn > 1
  AND r.total > 1
  AND p.name = 'Pipeline padrão';

-- 2) Elege um único pipeline padrão por workspace
WITH ws AS (
  SELECT p.id,
         public.resolve_workspace_id(p.owner_id) AS wsid,
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

-- 3) Gatilho: exclusividade do pipeline padrão por workspace
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
      AND public.resolve_workspace_id(p.owner_id) = public.resolve_workspace_id(NEW.owner_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ats_pipelines_single_default ON public.ats_pipelines;
CREATE TRIGGER trg_ats_pipelines_single_default
AFTER INSERT OR UPDATE OF is_default, owner_id ON public.ats_pipelines
FOR EACH ROW
WHEN (NEW.is_default)
EXECUTE FUNCTION public.ats_pipelines_enforce_single_default();