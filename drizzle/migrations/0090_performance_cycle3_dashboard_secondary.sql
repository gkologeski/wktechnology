CREATE OR REPLACE FUNCTION public.get_sales_dashboard_secondary(
  p_workspace_id uuid,
  p_pipeline_id uuid,
  p_lead_pipeline_id uuid,
  p_owner_mode text,
  p_owner_id uuid,
  p_open_stage_ids text[],
  p_advanced_stage_ids text[],
  p_now timestamptz,
  p_today timestamptz,
  p_contacts_since timestamptz,
  p_utc_offset_minutes integer,
  p_period_start timestamptz,
  p_period_end timestamptz
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH scoped_deals AS MATERIALIZED (
    SELECT d.id, d.name, d.value, d.stage::text AS stage, d.stage_id, d.pipeline_id, d.owner_id,
      d.assigned_to, d.company_id, d.expected_close_date, d.closed_at, d.updated_at,
      COALESCE(d.stage_id, d.stage::text) AS stage_key
    FROM public.deals d
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
  ), advanced AS (
    SELECT * FROM open_deals WHERE stage_key = ANY(p_advanced_stage_ids)
  ), overdue AS (
    SELECT * FROM open_deals WHERE expected_close_date < p_today
    ORDER BY value DESC NULLS LAST, id LIMIT 16
  ), stale AS (
    SELECT * FROM open_deals
    WHERE NOT has_recent_activity AND (expected_close_date IS NULL OR expected_close_date >= p_today)
    ORDER BY value DESC NULLS LAST, id LIMIT 16
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
    'advanced', COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM advanced x), '[]'::jsonb),
    'overdue', COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM overdue x), '[]'::jsonb),
    'stale', COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM stale x), '[]'::jsonb),
    'contacts', COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM contacts x), '[]'::jsonb),
    'journey', COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM journey x), '[]'::jsonb)
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_sales_dashboard_secondary(uuid, uuid, uuid, text, uuid, text[], text[], timestamptz, timestamptz, timestamptz, integer, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_sales_dashboard_secondary(uuid, uuid, uuid, text, uuid, text[], text[], timestamptz, timestamptz, timestamptz, integer, timestamptz, timestamptz) TO service_role;