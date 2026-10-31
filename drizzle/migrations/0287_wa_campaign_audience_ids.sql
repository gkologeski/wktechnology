-- Público das campanhas WhatsApp: resolve grupos/filtros numa única consulta.
-- SECURITY INVOKER: RLS e grants por coluna do usuário continuam valendo; colunas
-- protegidas (catálogo shared_fields) são lidas pelas views mascaradas, como no app.
-- Termos já chegam limpos do servidor; valores entram só como literais (%L).
CREATE OR REPLACE FUNCTION public.wa_campaign_audience_ids(
  p_workspace uuid, p_base text, p_groups jsonb,
  p_groups_logic text DEFAULT 'or', p_limit int DEFAULT 5001)
RETURNS SETOF uuid
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public
AS $$
DECLARE
  g jsonb; f jsonb;
  ent text; col text; ckey text; op text; src text; a text; expr text; pred text; val text;
  cond text; f_sql text; g_sql text; all_sql text;
  terms text[];
  lim int := least(greatest(coalesce(p_limit, 5001), 1), 5001);
  glogic text := CASE WHEN p_groups_logic = 'and' THEN ' AND ' ELSE ' OR ' END;
  flogic text;
  shared constant jsonb := '{"contacts":["email","phone","mobile_phone","hs_raw","phone_digits","mobile_phone_digits","whatsapp_e164","whatsapp_digits"],"leads":["score","hs_raw"],"deals":["value","hs_raw"]}';
BEGIN
  IF p_base NOT IN ('leads','contacts','companies','deals') THEN
    RAISE EXCEPTION 'Base não permitida';
  END IF;
  IF jsonb_typeof(p_groups) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_groups) NOT BETWEEN 1 AND 10 THEN
    RAISE EXCEPTION 'Grupos inválidos';
  END IF;
  FOR g IN SELECT value FROM jsonb_array_elements(p_groups) LOOP
    IF jsonb_typeof(g->'filters') IS DISTINCT FROM 'array'
       OR jsonb_array_length(g->'filters') NOT BETWEEN 1 AND 20 THEN
      RAISE EXCEPTION 'Filtros inválidos';
    END IF;
    flogic := CASE WHEN g->>'logic' = 'or' THEN ' OR ' ELSE ' AND ' END;
    g_sql := NULL;
    FOR f IN SELECT value FROM jsonb_array_elements(g->'filters') LOOP
      ent := coalesce(f->>'entity', p_base);
      IF ent NOT IN ('leads','contacts','companies','deals') THEN
        RAISE EXCEPTION 'Entidade não permitida';
      END IF;
      op := f->>'op';
      IF op IS NULL OR op NOT IN ('eq','neq','ilike','not_ilike','gte','lte','is_null','is_not_null') THEN
        RAISE EXCEPTION 'Operador não permitido';
      END IF;
      ckey := f->>'custom_key';
      col := f->>'column';
      IF ckey IS NOT NULL THEN
        IF ckey !~* '^[a-z0-9_]{1,60}$' THEN RAISE EXCEPTION 'Campo personalizado inválido'; END IF;
        src := ent;
      ELSE
        IF col IS NULL OR NOT EXISTS (
          SELECT 1 FROM pg_attribute pa
          WHERE pa.attrelid = ('public.' || ent)::regclass
            AND pa.attname = col AND pa.attnum > 0 AND NOT pa.attisdropped) THEN
          RAISE EXCEPTION 'Campo não permitido';
        END IF;
        src := CASE WHEN coalesce(shared->ent, '[]'::jsonb) ? col THEN 'shared_fields_' || ent ELSE ent END;
      END IF;
      -- Filtro da própria base em coluna comum avalia direto na linha (alias b).
      a := CASE WHEN ent = p_base AND src = ent THEN 'b' ELSE 'r' END;
      expr := CASE WHEN ckey IS NOT NULL THEN format('%s.custom_fields->>%L', a, ckey)
                   ELSE format('%s.%I', a, col) END;
      val := coalesce(f->>'value', '');
      terms := ARRAY(SELECT jsonb_array_elements_text(coalesce(f->'terms', '[]'::jsonb)));
      IF coalesce(array_length(terms, 1), 0) > 20 THEN RAISE EXCEPTION 'Termos demais'; END IF;
      IF op IN ('ilike','not_ilike') AND coalesce(array_length(terms, 1), 0) = 0 THEN
        RAISE EXCEPTION 'Filtro sem termos';
      END IF;
      pred := CASE op
        WHEN 'is_null' THEN format('%s IS NULL', expr)
        WHEN 'is_not_null' THEN format('%s IS NOT NULL', expr)
        WHEN 'eq' THEN format('%s = %L', expr, val)
        WHEN 'gte' THEN format('%s >= %L', expr, val)
        WHEN 'lte' THEN format('%s <= %L', expr, val)
        WHEN 'neq' THEN format('(%s IS NULL OR %s <> %L)', expr, expr, val)
        WHEN 'ilike' THEN '(' || (SELECT string_agg(format('%s::text ILIKE %L', expr, '%' || x || '%'), ' OR ') FROM unnest(terms) x) || ')'
        ELSE '(' || (SELECT string_agg(format('(%s IS NULL OR %s::text NOT ILIKE %L)', expr, expr, '%' || x || '%'), ' AND ') FROM unnest(terms) x) || ')'
      END;
      IF ent = p_base THEN
        f_sql := CASE WHEN a = 'b' THEN pred
                 ELSE format('EXISTS (SELECT 1 FROM public.%I r WHERE r.id = b.id AND %s)', src, pred) END;
      ELSE
        cond := CASE p_base || '>' || ent
          WHEN 'contacts>companies' THEN 'r.id = b.company_id'
          WHEN 'contacts>deals' THEN 'r.primary_contact_id = b.id'
          WHEN 'contacts>leads' THEN 'r.converted_contact_id = b.id'
          WHEN 'companies>contacts' THEN 'r.company_id = b.id'
          WHEN 'companies>deals' THEN 'r.company_id = b.id'
          WHEN 'companies>leads' THEN 'r.company_id = b.id'
          WHEN 'deals>companies' THEN 'r.id = b.company_id'
          WHEN 'deals>contacts' THEN 'r.id = b.primary_contact_id'
          WHEN 'deals>leads' THEN 'r.converted_deal_id = b.id'
          WHEN 'leads>companies' THEN 'r.id = b.company_id'
          WHEN 'leads>contacts' THEN 'r.id = b.converted_contact_id'
          WHEN 'leads>deals' THEN 'r.id = b.converted_deal_id'
        END;
        f_sql := format(
          'EXISTS (SELECT 1 FROM public.%I r WHERE r.workspace_id = $1 AND r.deleted_at IS NULL AND %s AND %s)',
          src, cond, pred);
        -- Negócio ↔ contato também pela tabela de vínculos.
        IF p_base = 'contacts' AND ent = 'deals' THEN
          f_sql := format(
            '(%s OR EXISTS (SELECT 1 FROM public.deal_contacts dc JOIN public.%I r ON r.id = dc.deal_id WHERE dc.contact_id = b.id AND r.workspace_id = $1 AND r.deleted_at IS NULL AND %s))',
            f_sql, src, pred);
        ELSIF p_base = 'deals' AND ent = 'contacts' THEN
          f_sql := format(
            '(%s OR EXISTS (SELECT 1 FROM public.deal_contacts dc JOIN public.%I r ON r.id = dc.contact_id WHERE dc.deal_id = b.id AND r.workspace_id = $1 AND r.deleted_at IS NULL AND %s))',
            f_sql, src, pred);
        END IF;
      END IF;
      g_sql := CASE WHEN g_sql IS NULL THEN f_sql ELSE g_sql || flogic || f_sql END;
    END LOOP;
    all_sql := CASE WHEN all_sql IS NULL THEN '(' || g_sql || ')' ELSE all_sql || glogic || '(' || g_sql || ')' END;
  END LOOP;
  RETURN QUERY EXECUTE format(
    'SELECT b.id FROM public.%I b WHERE b.workspace_id = $1 AND b.deleted_at IS NULL AND (%s) ORDER BY b.id LIMIT %s',
    p_base, all_sql, lim)
  USING p_workspace;
END $$;
REVOKE ALL ON FUNCTION public.wa_campaign_audience_ids(uuid,text,jsonb,text,int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wa_campaign_audience_ids(uuid,text,jsonb,text,int) TO authenticated;