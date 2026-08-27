CREATE OR REPLACE FUNCTION public.reorder_pipeline_substatuses(_ids uuid[])
RETURNS integer
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  WITH ordered AS (
    SELECT id, (ord - 1) AS position
    FROM unnest(_ids) WITH ORDINALITY AS t(id, ord)
  ), updated AS (
    UPDATE public.pipeline_stage_substatuses s
    SET position = o.position
    FROM ordered o
    WHERE s.id = o.id AND s.position IS DISTINCT FROM o.position
    RETURNING s.id
  )
  SELECT count(*)::int FROM updated;
$$;

GRANT EXECUTE ON FUNCTION public.reorder_pipeline_substatuses(uuid[]) TO authenticated;