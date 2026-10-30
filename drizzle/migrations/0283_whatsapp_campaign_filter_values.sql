-- Valores distintos para sugestões do filtro "Criar público" (campanhas WhatsApp).
-- SECURITY INVOKER: respeita RLS do usuário; coluna validada no catálogo e chave personalizada por regex.
CREATE OR REPLACE FUNCTION public.whatsapp_campaign_filter_values(
  p_entity text, p_workspace uuid, p_column text, p_custom_key text DEFAULT NULL,
  p_search text DEFAULT NULL, p_limit int DEFAULT 200)
RETURNS SETOF text
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public
AS $$
DECLARE expr text; lim int := least(greatest(coalesce(p_limit,200),1),500);
BEGIN
  IF p_entity NOT IN ('leads','contacts','companies','deals') THEN
    RAISE EXCEPTION 'Entidade não permitida';
  END IF;
  IF p_custom_key IS NOT NULL THEN
    IF p_custom_key !~ '^[a-z0-9_]{1,60}$' THEN RAISE EXCEPTION 'Campo personalizado inválido'; END IF;
    expr := format('btrim(custom_fields->>%L)', p_custom_key);
  ELSE
    IF NOT EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = ('public.'||p_entity)::regclass
        AND a.attname = p_column AND a.attnum > 0 AND NOT a.attisdropped) THEN
      RAISE EXCEPTION 'Campo não permitido';
    END IF;
    expr := format('btrim(%I::text)', p_column);
  END IF;
  RETURN QUERY EXECUTE format(
    'SELECT v FROM (SELECT DISTINCT ON (lower(v)) v FROM (SELECT %s AS v FROM public.%I WHERE workspace_id = $1) s
       WHERE v IS NOT NULL AND v <> '''' AND ($2 IS NULL OR v ILIKE ''%%'' || $2 || ''%%'')
       ORDER BY lower(v), v) d ORDER BY v LIMIT %s', expr, p_entity, lim)
  USING p_workspace, nullif(btrim(coalesce(p_search,'')),'');
END $$;
REVOKE ALL ON FUNCTION public.whatsapp_campaign_filter_values(text,uuid,text,text,text,int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.whatsapp_campaign_filter_values(text,uuid,text,text,text,int) TO authenticated;