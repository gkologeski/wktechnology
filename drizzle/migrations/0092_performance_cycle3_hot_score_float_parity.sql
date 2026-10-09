-- Paridade de ponto flutuante com computeHotScore: extract(epoch) devolve numeric; o JS usa double.
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
      GREATEST(0, LEAST(100, COALESCE(p_probability, 0)))::double precision / 100::double precision AS prob,
      CASE WHEN p_expected_close_date IS NULL THEN NULL
        ELSE (extract(epoch FROM ((p_expected_close_date::timestamp AT TIME ZONE 'UTC') - p_now)) * 1000)::double precision / 86400000::double precision END AS due_days,
      CASE WHEN COALESCE(p_updated_at, p_created_at) IS NULL THEN NULL
        ELSE (extract(epoch FROM (p_now - COALESCE(p_updated_at, p_created_at))) * 1000)::double precision / 86400000::double precision END AS age_days
  ), parts AS (
    SELECT prob,
      CASE WHEN due_days IS NULL THEN 0::double precision
        WHEN due_days < 0 THEN 1::double precision
        WHEN due_days <= 14 THEN 1::double precision
        WHEN due_days <= 60 THEN 1::double precision - (due_days - 14::double precision) / 46::double precision
        ELSE 0::double precision END AS due_soon,
      CASE WHEN age_days IS NULL THEN 1::double precision
        WHEN age_days > 90 THEN 0::double precision
        WHEN age_days > 30 THEN 1::double precision - (age_days - 30::double precision) / 60::double precision
        ELSE 1::double precision END AS age_decay
    FROM v
  )
  SELECT GREATEST(0, LEAST(100, floor(100::double precision * (0.4::double precision * prob + 0.25::double precision * due_soon + 0.2::double precision * 0::double precision + 0.15::double precision * age_decay) + 0.5::double precision)))::integer
  FROM parts;
$$;