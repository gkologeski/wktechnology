
CREATE OR REPLACE FUNCTION public.companies_facets(p_limit int DEFAULT 50)
RETURNS TABLE(facet text, value text, count bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  (SELECT 'industry'::text AS facet, industry::text AS value, count(*)::bigint
     FROM public.companies WHERE industry IS NOT NULL AND industry <> ''
     GROUP BY industry ORDER BY count(*) DESC LIMIT p_limit)
  UNION ALL
  (SELECT 'size'::text, size::text, count(*)::bigint
     FROM public.companies WHERE size IS NOT NULL AND size <> ''
     GROUP BY size ORDER BY count(*) DESC LIMIT p_limit)
  UNION ALL
  (SELECT 'state'::text, state::text, count(*)::bigint
     FROM public.companies WHERE state IS NOT NULL AND state <> ''
     GROUP BY state ORDER BY count(*) DESC LIMIT p_limit);
$$;

GRANT EXECUTE ON FUNCTION public.companies_facets(int) TO authenticated;

CREATE OR REPLACE FUNCTION public.leads_source_facets(p_limit int DEFAULT 50)
RETURNS TABLE(value text, count bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT source::text, count(*)::bigint
  FROM public.leads
  WHERE source IS NOT NULL AND btrim(source) <> ''
  GROUP BY source
  ORDER BY count(*) DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.leads_source_facets(int) TO authenticated;
