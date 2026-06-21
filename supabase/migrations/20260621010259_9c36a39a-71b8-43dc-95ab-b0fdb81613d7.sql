
CREATE OR REPLACE FUNCTION public.propagate_activity_assoc(
  p_filter_col text,
  p_filter_id uuid,
  p_set_col text,
  p_set_id uuid,
  p_since timestamptz DEFAULT NULL,
  p_batch int DEFAULT 2000
) RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fn$
DECLARE
  v_total int := 0;
  v_batch int := 0;
  v_allowed text[] := ARRAY[
    'related_contact_id','related_company_id','related_deal_id',
    'related_lead_id','related_ticket_id'
  ];
BEGIN
  IF NOT (p_filter_col = ANY(v_allowed)) OR NOT (p_set_col = ANY(v_allowed)) THEN
    RAISE EXCEPTION 'invalid column';
  END IF;
  IF p_filter_col = p_set_col THEN
    RETURN 0;
  END IF;

  LOOP
    EXECUTE format($q$
      WITH cte AS (
        SELECT id FROM public.activities
        WHERE %I = $1
          AND %I IS NULL
          AND ($2::timestamptz IS NULL OR created_at >= $2)
        LIMIT $3
      )
      UPDATE public.activities a SET %I = $4
      FROM cte WHERE a.id = cte.id
    $q$, p_filter_col, p_set_col, p_set_col)
    USING p_filter_id, p_since, p_batch, p_set_id;

    GET DIAGNOSTICS v_batch = ROW_COUNT;
    v_total := v_total + v_batch;
    EXIT WHEN v_batch = 0;
  END LOOP;

  RETURN v_total;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.propagate_activity_assoc(text, uuid, text, uuid, timestamptz, int) TO authenticated;
