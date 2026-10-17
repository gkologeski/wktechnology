-- Invoker-only, deterministic; occupational exclusions are workspace catalog data.
CREATE OR REPLACE FUNCTION public.crm_classify_title(v text,rules jsonb) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE s text:=public.crm_normalize_title(v); r jsonb; hit jsonb;
 domains text[]:=ARRAY[]::text[]; levels text[]:=ARRAY[]::text[];
 executive_titles text[]:=ARRAY[]::text[]; a text; l text; t text;
BEGIN
 IF s='' THEN RETURN jsonb_build_object('title',NULL,'area',NULL,'level',NULL); END IF;
 FOR r IN SELECT value FROM jsonb_array_elements(rules) ORDER BY(value->>'priority')::integer LOOP
  IF s ~ (r->>'pattern') AND NOT (coalesce(s ~ (r->>'exclude_pattern'),false)) THEN
   a:=r->>'area'; l:=r->>'level'; t:=r->>'title';
   IF a IS NOT NULL AND NOT a=ANY(domains) THEN domains:=array_append(domains,a); END IF;
   IF l IS NOT NULL AND NOT l=ANY(levels) THEN levels:=array_append(levels,l); END IF;
   IF l='C-Level' AND t IS NOT NULL AND NOT t=ANY(executive_titles) THEN executive_titles:=array_append(executive_titles,t); END IF;
   IF hit IS NULL AND t IS NOT NULL THEN hit:=r; END IF;
  END IF;
 END LOOP;
 IF cardinality(domains)>1 OR (('Societário'=ANY(levels) OR 'Presidência'=ANY(levels)) AND cardinality(levels)>1) OR cardinality(executive_titles)>1 THEN
  RETURN jsonb_build_object('title','Classificação ambígua','area','Classificação ambígua','level','Classificação ambígua');
 END IF;
 RETURN jsonb_build_object('title',coalesce(hit->>'title','Não classificado'),'area',coalesce(domains[1],'Não classificado'),'level',coalesce(levels[1],'Não classificado'));
END $$;
CREATE OR REPLACE FUNCTION public.crm_catalog_validate() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE r jsonb; p text;
BEGIN
 IF jsonb_typeof(NEW.rules)<>'array' OR jsonb_array_length(NEW.rules)>200 OR NEW.version<1 THEN RAISE EXCEPTION 'Invalid derivation catalog'; END IF;
 FOR r IN SELECT value FROM jsonb_array_elements(NEW.rules) LOOP
  IF jsonb_typeof(r)<>'object' OR coalesce(r->>'priority','') !~ '^[0-9]{1,6}$' OR r->>'pattern' IS NULL THEN RAISE EXCEPTION 'Invalid derivation rule'; END IF;
  FOR p IN SELECT r->>'pattern' UNION ALL SELECT r->>'exclude_pattern' WHERE r ? 'exclude_pattern' LOOP
   IF p IS NULL OR length(p)>500 OR p ~ '[*+?][*+?]' OR p LIKE '%\\1%' THEN RAISE EXCEPTION 'Invalid derivation pattern'; END IF;
   PERFORM '' ~ p;
  END LOOP;
 END LOOP;
 RETURN NEW;
END $$;
COMMENT ON FUNCTION public.crm_classify_title(text,jsonb) IS 'Deterministic catalog classifier; occupational exclusions avoid societal false positives; distinct executive roles remain ambiguous.';