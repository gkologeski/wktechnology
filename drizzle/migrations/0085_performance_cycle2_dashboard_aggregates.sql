CREATE OR REPLACE FUNCTION public.get_sales_dashboard_deal_aggregates(
  p_workspace_id uuid,
  p_pipeline_id uuid,
  p_owner_mode text,
  p_owner_id uuid,
  p_open_stage_ids text[],
  p_won_stage_ids text[],
  p_lost_stage_ids text[],
  p_stage_probabilities jsonb,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_prev_start timestamptz,
  p_prev_end timestamptz,
  p_month_start timestamptz,
  p_month_end timestamptz
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH scoped AS MATERIALIZED (
    SELECT d.*,
      COALESCE(d.stage_id, d.stage::text) AS stage_key,
      COALESCE((p_stage_probabilities ->> COALESCE(d.stage_id, d.stage::text))::numeric, 0) AS probability
    FROM public.deals d
    WHERE d.workspace_id = p_workspace_id
      AND d.deleted_at IS NULL
      AND (p_pipeline_id IS NULL OR d.pipeline_id = p_pipeline_id)
      AND (p_owner_mode = 'all' OR (p_owner_mode = 'none' AND d.owner_id IS NULL) OR (p_owner_mode = 'one' AND d.owner_id = p_owner_id))
  ), agg AS (
    SELECT
      count(*) FILTER (WHERE stage_key = ANY(p_open_stage_ids))::bigint AS open_count,
      COALESCE(sum(value) FILTER (WHERE stage_key = ANY(p_open_stage_ids)), 0)::numeric AS pipeline_value,
      count(*) FILTER (WHERE stage_key = ANY(p_open_stage_ids) AND expected_close_date BETWEEN p_month_start AND p_month_end)::bigint AS forecast_count,
      COALESCE(sum(value * probability / 100) FILTER (WHERE stage_key = ANY(p_open_stage_ids) AND expected_close_date BETWEEN p_month_start AND p_month_end), 0)::numeric AS forecast_value,
      count(*) FILTER (WHERE stage_key = ANY(p_won_stage_ids) AND closed_at BETWEEN p_month_start AND p_month_end)::bigint AS won_month_count,
      COALESCE(sum(value) FILTER (WHERE stage_key = ANY(p_won_stage_ids) AND closed_at BETWEEN p_month_start AND p_month_end), 0)::numeric AS won_month_value,
      count(*) FILTER (WHERE stage_key = ANY(p_won_stage_ids) AND closed_at BETWEEN p_period_start AND p_period_end)::bigint AS won_period_count,
      COALESCE(sum(value) FILTER (WHERE stage_key = ANY(p_won_stage_ids) AND closed_at BETWEEN p_period_start AND p_period_end), 0)::numeric AS won_period_value,
      count(*) FILTER (WHERE stage_key = ANY(p_lost_stage_ids) AND closed_at BETWEEN p_period_start AND p_period_end)::bigint AS lost_period_count,
      count(*) FILTER (WHERE stage_key = ANY(p_won_stage_ids) AND closed_at BETWEEN p_prev_start AND p_prev_end)::bigint AS won_prev_count,
      COALESCE(sum(value) FILTER (WHERE stage_key = ANY(p_won_stage_ids) AND closed_at BETWEEN p_prev_start AND p_prev_end), 0)::numeric AS won_prev_value,
      count(*) FILTER (WHERE stage_key = ANY(p_lost_stage_ids) AND closed_at BETWEEN p_prev_start AND p_prev_end)::bigint AS lost_prev_count
    FROM scoped
  ), stages AS (
    SELECT COALESCE(jsonb_object_agg(stage_key, jsonb_build_object('count', n, 'value', value_sum)), '{}'::jsonb) AS value
    FROM (
      SELECT stage_key, count(*)::bigint n, COALESCE(sum(value), 0)::numeric value_sum
      FROM scoped WHERE stage_key = ANY(p_open_stage_ids) GROUP BY stage_key
    ) grouped
  )
  SELECT to_jsonb(agg) || jsonb_build_object('stages', stages.value) FROM agg CROSS JOIN stages;
$$;

GRANT EXECUTE ON FUNCTION public.get_sales_dashboard_deal_aggregates(uuid, uuid, text, uuid, text[], text[], text[], jsonb, timestamptz, timestamptz, timestamptz, timestamptz, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_sales_dashboard_deal_aggregates(uuid, uuid, text, uuid, text[], text[], text[], jsonb, timestamptz, timestamptz, timestamptz, timestamptz, timestamptz, timestamptz) TO service_role;

CREATE INDEX IF NOT EXISTS deals_dashboard_scope_idx
  ON public.deals (workspace_id, pipeline_id, owner_id, closed_at)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS deals_dashboard_open_idx
  ON public.deals (workspace_id, pipeline_id, owner_id, stage_id, expected_close_date)
  WHERE deleted_at IS NULL;