-- Fórmula idêntica a computeHotScore (src/lib/deals/hot-score.ts) sem o termo de engajamento,
-- que o painel não fornece (nextActivityAt ausente => 0).
CREATE OR REPLACE FUNCTION public.sales_dashboard_hot_score(
  p_probability numeric,
  p_expected_close_date date,
  p_updated_at timestamptz,
  p_created_at timestamptz,
  p_now timestamptz
)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  WITH v AS (
    SELECT
      GREATEST(0, LEAST(100, COALESCE(p_probability, 0)))::double precision / 100 AS prob,
      CASE WHEN p_expected_close_date IS NULL THEN NULL
        ELSE extract(epoch FROM ((p_expected_close_date::timestamp AT TIME ZONE 'UTC') - p_now)) / 86400.0 END AS due_days,
      CASE WHEN COALESCE(p_updated_at, p_created_at) IS NULL THEN NULL
        ELSE extract(epoch FROM (p_now - COALESCE(p_updated_at, p_created_at))) / 86400.0 END AS age_days
  ), parts AS (
    SELECT prob,
      CASE WHEN due_days IS NULL THEN 0
        WHEN due_days < 0 THEN 1
        WHEN due_days <= 14 THEN 1
        WHEN due_days <= 60 THEN 1 - (due_days - 14) / 46
        ELSE 0 END AS due_soon,
      CASE WHEN age_days IS NULL THEN 1
        WHEN age_days > 90 THEN 0
        WHEN age_days > 30 THEN 1 - (age_days - 30) / 60
        ELSE 1 END AS age_decay
    FROM v
  )
  SELECT GREATEST(0, LEAST(100, floor(100 * (0.4 * prob + 0.25 * due_soon + 0.15 * age_decay) + 0.5)))::integer
  FROM parts;
$$;

GRANT EXECUTE ON FUNCTION public.sales_dashboard_hot_score(numeric, date, timestamptz, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sales_dashboard_hot_score(numeric, date, timestamptz, timestamptz, timestamptz) TO service_role;

-- Mesma assinatura: o ranking dos avançados passa a ser feito no banco (top 8, desempate estável).
-- Novo parâmetro de probabilidades vai em jsonb já existente? Não: usa p_open/p_advanced e lê
-- a probabilidade do jsonb p_stage_probabilities da função de agregados não disponível aqui,
-- então a nova versão recebe as probabilidades por um overload explícito.
CREATE OR REPLACE FUNCTION public.get_sales_dashboard_secondary_v2(
  p_workspace_id uuid,
  p_pipeline_id uuid,
  p_lead_pipeline_id uuid,
  p_owner_mode text,
  p_owner_id uuid,
  p_open_stage_ids text[],
  p_advanced_stage_ids text[],
  p_stage_probabilities jsonb,
  p_now timestamptz,
  p_today timestamptz,
  p_contacts_since timestamptz,
  p_utc_offset_minutes integer,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_advanced_limit integer DEFAULT 8
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH scoped_deals AS MATERIALIZED (
    SELECT d.id, d.name, d.value, d.stage::text AS stage, d.stage_id, d.pipeline_id, d.owner_id,
      d.assigned_to, d.company_id, d.expected_close_date, d.closed_at, d.updated_at, d.created_at,
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
$$;

GRANT EXECUTE ON FUNCTION public.get_sales_dashboard_secondary_v2(uuid, uuid, uuid, text, uuid, text[], text[], jsonb, timestamptz, timestamptz, timestamptz, integer, timestamptz, timestamptz, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_sales_dashboard_secondary_v2(uuid, uuid, uuid, text, uuid, text[], text[], jsonb, timestamptz, timestamptz, timestamptz, integer, timestamptz, timestamptz, integer) TO service_role;
COMMENT ON FUNCTION public.get_sales_dashboard_secondary(uuid, uuid, uuid, text, uuid, text[], text[], timestamptz, timestamptz, timestamptz, integer, timestamptz, timestamptz) IS 'DEPRECATED: replaced by get_sales_dashboard_secondary_v2 (top-N avançados no banco)';