SET LOCAL statement_timeout = 0;

CREATE OR REPLACE FUNCTION public.search_fold(_t text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
  SELECT translate(lower(coalesce(_t, '')),
    'áàâãäéèêëíìîïóòôõöúùûüçñ',
    'aaaaaeeeeiiiiooooouuuucn')
$$;

CREATE OR REPLACE FUNCTION public.activity_body_plain(_body text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
  SELECT regexp_replace(regexp_replace(left(coalesce(_body, ''), 20000), '<[^>]*>', ' ', 'g'), '&[a-z#0-9]+;', ' ', 'gi')
$$;

CREATE OR REPLACE FUNCTION public.activity_body_search_doc(_body text)
RETURNS tsvector LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
  SELECT to_tsvector('portuguese'::regconfig, public.search_fold(public.activity_body_plain(_body)))
$$;

CREATE INDEX IF NOT EXISTS activities_body_fts_idx
  ON public.activities USING gin (public.activity_body_search_doc(body));

-- IDs + trecho de atividades cujo texto contém as palavras (prefixo na última).
-- Restrito aos workspaces do usuário; o app relê as linhas com RLS.
CREATE OR REPLACE FUNCTION public.global_search_activity_body_ids(_q text, _limit int DEFAULT 40)
RETURNS TABLE(id uuid, snippet text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  words text[];
  tsq tsquery;
  lim int := least(greatest(coalesce(_limit, 40), 1), 100);
BEGIN
  IF auth.uid() IS NULL OR length(trim(coalesce(_q, ''))) < 2 THEN RETURN; END IF;
  words := regexp_split_to_array(trim(regexp_replace(public.search_fold(_q), '[^a-z0-9 ]', ' ', 'g')), '\s+');
  words := array_remove(words, '');
  IF coalesce(array_length(words, 1), 0) = 0 THEN RETURN; END IF;
  SELECT string_agg(
           CASE WHEN i = array_length(words, 1) THEN quote_literal(w) || ':*' ELSE quote_literal(w) END,
           ' & ')::tsquery
    INTO tsq
    FROM unnest(words) WITH ORDINALITY AS u(w, i);
  -- normaliza com o dicionário português
  tsq := (SELECT string_agg(
            CASE WHEN i = array_length(words, 1)
              THEN coalesce(nullif(querytree(plainto_tsquery('portuguese', w)), 'T'), quote_literal(w)) || ':*'
              ELSE coalesce(nullif(querytree(plainto_tsquery('portuguese', w)), 'T'), quote_literal(w)) END,
            ' & ')::tsquery
          FROM unnest(words) WITH ORDINALITY AS u(w, i));
  RETURN QUERY
    SELECT a.id,
      ts_headline('portuguese', public.activity_body_plain(a.body), plainto_tsquery('portuguese', _q),
        'MaxWords=18, MinWords=8, StartSel="", StopSel="", MaxFragments=1')
    FROM activities a
    WHERE public.activity_body_search_doc(a.body) @@ tsq
      AND a.workspace_id IN (SELECT current_user_workspaces())
    ORDER BY a.created_at DESC
    LIMIT lim;
END;
$$;

REVOKE ALL ON FUNCTION public.global_search_activity_body_ids(text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.global_search_activity_body_ids(text, int) TO authenticated;