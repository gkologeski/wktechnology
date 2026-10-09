CREATE OR REPLACE FUNCTION public.get_timeline_history_page(
  p_entity text, p_entity_id uuid,
  p_since timestamptz DEFAULT NULL, p_until timestamptz DEFAULT NULL,
  p_categories text[] DEFAULT NULL, p_actors uuid[] DEFAULT NULL,
  p_include_unassigned boolean DEFAULT false, p_search text DEFAULT NULL,
  p_cursor_at timestamptz DEFAULT NULL, p_cursor_id uuid DEFAULT NULL,
  p_page_size integer DEFAULT 40)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_page_size,40),1),100);
  v_ids uuid[] := ARRAY[]::uuid[];
  v_gids uuid[] := ARRAY[]::uuid[];
  v_gats timestamptz[] := ARRAY[]::timestamptz[];
  v_gid uuid; v_gat timestamptz; v_gby uuid; v_first boolean := true;
  r record; v_result jsonb;
  v_search text := NULLIF(btrim(COALESCE(p_search,'')),'');
  v_actor_filter boolean := COALESCE(cardinality(p_actors),0) > 0 OR COALESCE(p_include_unassigned,false);
BEGIN
  IF p_entity NOT IN ('leads','contacts','companies','deals') THEN RAISE EXCEPTION 'invalid entity'; END IF;
  IF (p_cursor_at IS NULL) <> (p_cursor_id IS NULL) THEN RAISE EXCEPTION 'cursor timestamp and id must be provided together'; END IF;
  FOR r IN SELECT h.id, h.changed_at, h.changed_by FROM public.property_history h
    WHERE h.entity = p_entity AND h.entity_id = p_entity_id
      AND (p_since IS NULL OR h.changed_at >= p_since) AND (p_until IS NULL OR h.changed_at < p_until)
    ORDER BY h.changed_at DESC, h.id DESC
  LOOP
    IF v_first OR NOT (r.changed_by IS NOT DISTINCT FROM v_gby) OR abs(extract(epoch FROM (v_gat - r.changed_at))) > 2 THEN
      v_gid := r.id; v_gat := r.changed_at; v_gby := r.changed_by; v_first := false;
    END IF;
    v_ids := v_ids || r.id; v_gids := v_gids || v_gid; v_gats := v_gats || v_gat;
  END LOOP;

  WITH map AS (SELECT * FROM unnest(v_ids, v_gids, v_gats) AS m(id, gid, g_at)),
  rows AS (
    SELECT m.gid, m.g_at, h.id, h.entity, h.entity_id, h.property, h.old_value, h.new_value, h.changed_at, h.changed_by,
      CASE WHEN h.property = 'stage_substatus_id' THEN 'substatus'
           WHEN h.property IN ('stage','stage_id','pipeline_id','status','lifecycle_stage') THEN 'stage'
           WHEN h.property IN ('assigned_to','owner_id') THEN 'owner' ELSE 'fields' END AS category
    FROM map m JOIN public.property_history h ON h.id = m.id),
  filtered AS (SELECT * FROM rows WHERE p_categories IS NULL OR category = ANY(p_categories)),
  grp AS (
    SELECT f.gid, f.g_at, (array_agg(f.changed_by))[1] AS g_by,
      jsonb_agg(jsonb_build_object('id',f.id,'entity',f.entity,'entity_id',f.entity_id,'property',f.property,
        'old_value',f.old_value,'new_value',f.new_value,'changed_at',f.changed_at,'changed_by',f.changed_by)
        ORDER BY f.changed_at DESC, f.id DESC) AS changes,
      array_agg(DISTINCT f.category) AS cats,
      bool_or(v_search IS NULL OR concat_ws(' ', f.property, f.old_value::text, f.new_value::text,
        CASE WHEN v_search IS NOT NULL AND f.property IN ('stage','stage_id','lifecycle_stage','status') THEN (
          SELECT string_agg(s->>'label', ' ') FROM public.pipelines pl, jsonb_array_elements(COALESCE(pl.stages,'[]'::jsonb)) s
          WHERE s->>'value' IN (f.old_value #>> '{}', f.new_value #>> '{}')) END,
        CASE WHEN v_search IS NOT NULL AND f.property = 'pipeline_id' THEN (
          SELECT string_agg(pl.name, ' ') FROM public.pipelines pl
          WHERE pl.id::text IN (f.old_value #>> '{}', f.new_value #>> '{}')) END,
        CASE WHEN v_search IS NOT NULL AND f.property IN ('assigned_to','owner_id') THEN (
          SELECT string_agg(pr.full_name, ' ') FROM public.profiles pr
          WHERE pr.id::text IN (f.old_value #>> '{}', f.new_value #>> '{}')) END
      ) ILIKE '%'||v_search||'%') AS hit
    FROM filtered f GROUP BY f.gid, f.g_at),
  scoped AS MATERIALIZED (
    SELECT * FROM grp WHERE hit AND (NOT v_actor_filter
      OR (COALESCE(cardinality(p_actors),0) > 0 AND g_by = ANY(p_actors))
      OR (COALESCE(p_include_unassigned,false) AND g_by IS NULL))),
  counts AS (SELECT c AS category, count(*)::bigint n FROM scoped, unnest(cats) c GROUP BY c),
  page_plus AS (SELECT * FROM scoped WHERE p_cursor_at IS NULL OR (g_at, gid) < (p_cursor_at, p_cursor_id)
    ORDER BY g_at DESC, gid DESC LIMIT v_limit + 1),
  page AS (SELECT * FROM page_plus ORDER BY g_at DESC, gid DESC LIMIT v_limit),
  tail AS (SELECT g_at, gid FROM page ORDER BY g_at ASC, gid ASC LIMIT 1)
  SELECT jsonb_build_object(
    'items', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',p.gid,'changed_at',p.g_at,'changed_by',p.g_by,'changes',p.changes) ORDER BY p.g_at DESC, p.gid DESC) FROM page p),'[]'::jsonb),
    'total', (SELECT count(*) FROM scoped),
    'counts', COALESCE((SELECT jsonb_object_agg(category, n) FROM counts),'{}'::jsonb),
    'has_more', (SELECT count(*) > v_limit FROM page_plus),
    'next_at', CASE WHEN (SELECT count(*) > v_limit FROM page_plus) THEN (SELECT g_at FROM tail) END,
    'next_id', CASE WHEN (SELECT count(*) > v_limit FROM page_plus) THEN (SELECT gid FROM tail) END)
  INTO v_result;
  RETURN v_result;
END; $$;