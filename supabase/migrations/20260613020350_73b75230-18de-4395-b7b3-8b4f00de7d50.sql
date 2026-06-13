
CREATE OR REPLACE FUNCTION public.dashboard_metrics()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_open_leads int;
  v_active_deals int;
  v_pipeline numeric;
  v_won int;
  v_lost int;
  v_by_stage jsonb;
  v_last30 jsonb;
BEGIN
  SELECT count(*) INTO v_open_leads
    FROM public.leads
   WHERE status IN ('new','contacted');

  SELECT count(*), coalesce(sum(value),0)
    INTO v_active_deals, v_pipeline
    FROM public.deals
   WHERE stage NOT IN ('won','lost');

  SELECT
    count(*) FILTER (WHERE stage = 'won'),
    count(*) FILTER (WHERE stage = 'lost')
    INTO v_won, v_lost
    FROM public.deals
   WHERE stage IN ('won','lost');

  SELECT coalesce(jsonb_object_agg(stage, total), '{}'::jsonb) INTO v_by_stage
    FROM (
      SELECT stage, coalesce(sum(value),0)::numeric AS total
        FROM public.deals
       GROUP BY stage
    ) s;

  SELECT coalesce(jsonb_object_agg(day, cnt), '{}'::jsonb) INTO v_last30
    FROM (
      SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
             count(*) AS cnt
        FROM public.deals
       WHERE created_at >= (now() - interval '30 days')
       GROUP BY 1
    ) d;

  RETURN jsonb_build_object(
    'open_leads', v_open_leads,
    'active_deals', v_active_deals,
    'pipeline_value', v_pipeline,
    'won', v_won,
    'lost', v_lost,
    'value_by_stage', v_by_stage,
    'deals_last_30_days', v_last30
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.dashboard_metrics() TO authenticated;
