-- Preserve invoker RLS and field masking; no grants or role assignments change.
CREATE OR REPLACE FUNCTION public.get_sales_dashboard_deal_aggregates(p_workspace_id uuid, p_pipeline_id uuid, p_owner_mode text, p_owner_id uuid, p_open_stage_ids text[], p_won_stage_ids text[], p_lost_stage_ids text[], p_stage_probabilities jsonb, p_period_start timestamp with time zone, p_period_end timestamp with time zone, p_prev_start timestamp with time zone, p_prev_end timestamp with time zone, p_month_start timestamp with time zone, p_month_end timestamp with time zone)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  WITH scoped AS MATERIALIZED (
    SELECT d.*,
      COALESCE(d.stage_id, d.stage::text) AS stage_key,
      COALESCE((p_stage_probabilities ->> COALESCE(d.stage_id, d.stage::text))::numeric, 0) AS probability
    FROM public.shared_fields_deals d
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
$function$
;
CREATE OR REPLACE FUNCTION public.get_sales_dashboard_secondary_v2(p_workspace_id uuid, p_pipeline_id uuid, p_lead_pipeline_id uuid, p_owner_mode text, p_owner_id uuid, p_open_stage_ids text[], p_advanced_stage_ids text[], p_stage_probabilities jsonb, p_now timestamp with time zone, p_today timestamp with time zone, p_contacts_since timestamp with time zone, p_utc_offset_minutes integer, p_period_start timestamp with time zone, p_period_end timestamp with time zone, p_advanced_limit integer DEFAULT 8)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  WITH scoped_deals AS MATERIALIZED (
    SELECT d.id, d.name, d.value, d.stage::text AS stage, d.stage_id, d.pipeline_id, d.owner_id,
      d.assigned_to, d.company_id, d.expected_close_date, d.closed_at, d.updated_at, d.created_at,
      COALESCE(d.stage_id, d.stage::text) AS stage_key
    FROM public.shared_fields_deals d
    WHERE d.workspace_id = p_workspace_id
      AND d.deleted_at IS NULL
      AND (p_pipeline_id IS NULL OR d.pipeline_id = p_pipeline_id)
      AND (p_owner_mode = 'all' OR (p_owner_mode = 'none' AND d.owner_id IS NULL) OR (p_owner_mode = 'one' AND d.owner_id = p_owner_id))
  ), open_deals AS (
    SELECT sd.*,
      EXISTS (
        SELECT 1 FROM public.activities a
        WHERE a.workspace_id = p_workspace_id
          AND a.related_deal_id = sd.id
          AND (p_owner_mode = 'all' OR (p_owner_mode = 'none' AND a.owner_id IS NULL) OR (p_owner_mode = 'one' AND a.owner_id = p_owner_id))
          AND (CASE WHEN a.type = 'task' THEN COALESCE(a.due_date, a.activity_date, a.created_at)
                    ELSE COALESCE(a.activity_date, a.created_at) END) >= p_now - interval '7 days'
      ) AS has_recent_activity
    FROM scoped_deals sd
    WHERE sd.stage_key = ANY(p_open_stage_ids)
  ), advanced_all AS (
    SELECT o.*,
      public.sales_dashboard_hot_score(
        COALESCE((p_stage_probabilities ->> o.stage_key)::numeric, 0),
        o.expected_close_date::date, o.updated_at, o.created_at, p_now) AS hot_score
    FROM open_deals o WHERE o.stage_key = ANY(p_advanced_stage_ids)
  ), advanced AS (
    SELECT * FROM advanced_all
    ORDER BY hot_score DESC, value DESC NULLS LAST, id
    LIMIT GREATEST(0, LEAST(p_advanced_limit, 50))
  ), overdue AS (
    SELECT * FROM open_deals WHERE expected_close_date < p_today
      AND id NOT IN (SELECT id FROM advanced)
    ORDER BY value DESC NULLS LAST, id LIMIT 8
  ), stale AS (
    SELECT * FROM open_deals
    WHERE NOT has_recent_activity AND (expected_close_date IS NULL OR expected_close_date >= p_today)
      AND id NOT IN (SELECT id FROM advanced)
    ORDER BY value DESC NULLS LAST, id LIMIT 8
  ), contacts AS (
    SELECT ((a.created_at AT TIME ZONE 'UTC') - make_interval(mins => p_utc_offset_minutes))::date::text AS day,
      a.type::text AS type, count(*)::bigint AS n
    FROM public.activities a
    WHERE a.workspace_id = p_workspace_id
      AND a.created_at >= p_contacts_since
      AND (p_owner_mode = 'all' OR (p_owner_mode = 'none' AND a.owner_id IS NULL) OR (p_owner_mode = 'one' AND a.owner_id = p_owner_id))
    GROUP BY 1, 2
  ), journey AS (
    SELECT l.source, l.status::text AS status, l.stage_id::text AS stage_id,
      (l.converted_at IS NOT NULL) AS converted,
      (l.converted_deal_id IS NOT NULL) AS has_deal_ref,
      (sd.id IS NOT NULL) AS linked,
      sd.stage AS deal_stage, sd.stage_id AS deal_stage_id,
      count(*)::bigint AS n,
      COALESCE(sum(sd.value), 0)::numeric AS deal_value
    FROM public.leads l
    LEFT JOIN scoped_deals sd ON sd.id = l.converted_deal_id
    WHERE l.workspace_id = p_workspace_id
      AND l.deleted_at IS NULL
      AND l.created_at >= p_period_start AND l.created_at <= p_period_end
      AND (p_lead_pipeline_id IS NULL OR l.pipeline_id = p_lead_pipeline_id)
      AND (p_owner_mode = 'all' OR (p_owner_mode = 'none' AND l.owner_id IS NULL) OR (p_owner_mode = 'one' AND l.owner_id = p_owner_id))
    GROUP BY 1, 2, 3, 4, 5, 6, 7, 8
  )
  SELECT jsonb_build_object(
    'advanced', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.hot_score DESC, x.value DESC NULLS LAST, x.id) FROM advanced x), '[]'::jsonb),
    'advanced_total', (SELECT count(*) FROM advanced_all),
    'overdue', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.value DESC NULLS LAST, x.id) FROM overdue x), '[]'::jsonb),
    'stale', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.value DESC NULLS LAST, x.id) FROM stale x), '[]'::jsonb),
    'contacts', COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM contacts x), '[]'::jsonb),
    'journey', COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM journey x), '[]'::jsonb)
  );
$function$
;
