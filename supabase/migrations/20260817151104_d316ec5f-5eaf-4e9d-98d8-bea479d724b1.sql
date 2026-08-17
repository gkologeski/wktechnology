DO $$
DECLARE
  w RECORD;
  p RECORD;
  v_open TEXT[];
  v_won TEXT;
  v_lost TEXT;
  v_last TEXT;
BEGIN
  FOR w IN SELECT DISTINCT workspace_id FROM public.leads WHERE stage_id IS NULL AND workspace_id IS NOT NULL LOOP
    SELECT id, stages INTO p
    FROM public.pipelines
    WHERE entity = 'lead' AND workspace_id = w.workspace_id
    ORDER BY is_default DESC, created_at ASC
    LIMIT 1;

    IF p.id IS NULL THEN CONTINUE; END IF;

    SELECT array_agg(s->>'value' ORDER BY ord)
      INTO v_open
    FROM jsonb_array_elements(p.stages) WITH ORDINALITY AS t(s, ord)
    WHERE COALESCE(s->>'type', 'open') = 'open';

    SELECT s->>'value' INTO v_won
    FROM jsonb_array_elements(p.stages) WITH ORDINALITY AS t(s, ord)
    WHERE s->>'type' = 'won' ORDER BY ord LIMIT 1;

    SELECT s->>'value' INTO v_lost
    FROM jsonb_array_elements(p.stages) WITH ORDINALITY AS t(s, ord)
    WHERE s->>'type' = 'lost' ORDER BY ord LIMIT 1;

    SELECT s->>'value' INTO v_last
    FROM jsonb_array_elements(p.stages) WITH ORDINALITY AS t(s, ord)
    ORDER BY ord DESC LIMIT 1;

    UPDATE public.leads l
    SET pipeline_id = p.id,
        stage_id = CASE
          WHEN l.status = 'qualified' THEN COALESCE(v_won, v_open[array_length(v_open,1)], v_open[1])
          WHEN l.status = 'disqualified' THEN COALESCE(v_lost, v_last)
          WHEN l.status IN ('contacted', 'nurturing') THEN COALESCE(v_open[2], v_open[1])
          ELSE COALESCE(v_open[1], v_last)
        END
    WHERE l.workspace_id = w.workspace_id
      AND l.stage_id IS NULL
      AND CASE
          WHEN l.status = 'qualified' THEN COALESCE(v_won, v_open[array_length(v_open,1)], v_open[1])
          WHEN l.status = 'disqualified' THEN COALESCE(v_lost, v_last)
          WHEN l.status IN ('contacted', 'nurturing') THEN COALESCE(v_open[2], v_open[1])
          ELSE COALESCE(v_open[1], v_last)
        END IS NOT NULL;
  END LOOP;
END $$;