-- Private keyset pages keep broad FTS searches bounded before caller-RLS checks.
-- No raw body/ID page is callable by authenticated/anon/service clients.
CREATE OR REPLACE FUNCTION global_search_private.activity_page(_part text,_q text,_before_at timestamptz,_before_id uuid,_limit integer)
RETURNS TABLE(id uuid,created_at timestamptz) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE w uuid:=(public.work_access_context()->>'workspace')::uuid;words text[];tsq tsquery;
 query text;needle text;probe_ids uuid[];probe_dates timestamptz[];
BEGIN
 IF auth.uid() IS NULL OR w IS NULL OR length(btrim(coalesce(_q,'')))<3 OR length(_q)>200 THEN RETURN;END IF;
 IF _part='subject' THEN
  needle:='%'||replace(replace(replace(btrim(_q),'\','\\'),'%','\%'),'_','\_')||'%';
  query:='SELECT a.id,a.created_at FROM public.activities a WHERE a.workspace_id=$1 AND a.subject ILIKE $2
    AND ($3::timestamptz IS NULL OR (a.created_at,a.id)<($3,$4))';
 ELSIF _part='content' THEN
 words:=array_remove(regexp_split_to_array(btrim(regexp_replace(public.search_fold(_q),'[^a-z0-9 ]',' ','g')),'\s+'),'');
 IF coalesce(cardinality(words),0)=0 THEN RETURN;END IF;
 SELECT string_agg(CASE WHEN i=cardinality(words)
   THEN coalesce(nullif(nullif(querytree(plainto_tsquery('portuguese',word)),'T'),''),quote_literal(word))||':*'
   ELSE coalesce(nullif(nullif(querytree(plainto_tsquery('portuguese',word)),'T'),''),quote_literal(word)) END,' & ')::tsquery
   INTO tsq FROM unnest(words) WITH ORDINALITY AS x(word,i);
  needle:=tsq::text;
  query:='SELECT a.id,a.created_at FROM public.activities a WHERE a.workspace_id=$1 AND public.activity_body_search_doc(a.body)@@$2::tsquery
    AND ($3::timestamptz IS NULL OR (a.created_at,a.id)<($3,$4))';
 ELSE RETURN;END IF;
 -- A GIN-planned probe handles absent/sparse terms without scanning recent bodies.
 -- 2048 is a strategy threshold, never a result/access cutoff: dense terms use
 -- ordered keyset pages, and the caller continues until enough visible hits.
 EXECUTE 'WITH raw_hits AS MATERIALIZED('||query||')
   SELECT array_agg(h.id ORDER BY h.id),array_agg(h.created_at ORDER BY h.id) FROM (SELECT * FROM raw_hits LIMIT 2049)h'
   INTO probe_ids,probe_dates USING w,needle,_before_at,_before_id;
 IF coalesce(cardinality(probe_ids),0)<=2048 THEN
  RETURN QUERY SELECT x.id,x.created_at FROM unnest(probe_ids,probe_dates)x(id,created_at)
    ORDER BY x.created_at DESC,x.id DESC LIMIT least(greatest(coalesce(_limit,32),1),500);
  RETURN;
 END IF;
 RETURN QUERY EXECUTE query||' ORDER BY a.created_at DESC,a.id DESC LIMIT $5'
   USING w,needle,_before_at,_before_id,least(greatest(coalesce(_limit,32),1),500);
END $$;
ALTER FUNCTION global_search_private.activity_page(text,text,timestamptz,uuid,integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION global_search_private.activity_page(text,text,timestamptz,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION global_search_private.activity_page(text,text,timestamptz,uuid,integer) TO techerp_search_gateway;

CREATE OR REPLACE FUNCTION public.global_search_activity_body_ids(_q text,_limit integer DEFAULT 40)
RETURNS TABLE(id uuid,snippet text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb:=public.work_access_context();w uuid:=(c->>'workspace')::uuid;
 lim int:=least(greatest(coalesce(_limit,40),1),100);page_size int;ids uuid[];
 before_at timestamptz;before_id uuid;found int:=0;added int;
BEGIN
 IF auth.uid() IS NULL OR w IS NULL OR length(btrim(coalesce(_q,'')))<3 OR length(_q)>200 THEN RETURN;END IF;
 IF NOT EXISTS(SELECT 1 FROM unnest(ARRAY['techsales.activities','techsales.notes','techsales.tasks'])r CROSS JOIN unnest(ARRAY['own','team','workspace','custom'])s WHERE c->'keys' ? (r||'.view.'||s)) THEN RETURN;END IF;
 page_size:=least(500,greatest(32,lim*4));
 LOOP
  WITH batch AS MATERIALIZED(SELECT * FROM global_search_private.activity_page('content',_q,before_at,before_id,page_size))
  SELECT array_agg(b.id ORDER BY b.created_at DESC,b.id DESC),
    (array_agg(b.created_at ORDER BY b.created_at ASC,b.id ASC))[1],
    (array_agg(b.id ORDER BY b.created_at ASC,b.id ASC))[1]
    INTO ids,before_at,before_id FROM batch b;
  IF coalesce(cardinality(ids),0)=0 THEN RETURN;END IF;
  -- The gateway owner has NOLOGIN/NOBYPASSRLS and inherits all authenticated policies.
  RETURN QUERY WITH visible AS MATERIALIZED(
    SELECT a.id,a.body,a.created_at FROM public.activities a
    WHERE a.workspace_id=w AND a.id=ANY(ids)
    ORDER BY a.created_at DESC,a.id DESC LIMIT (lim-found))
    SELECT v.id,ts_headline('portuguese',public.activity_body_plain(v.body),plainto_tsquery('portuguese',_q),
      'MaxWords=18, MinWords=8, StartSel="", StopSel="", MaxFragments=1') FROM visible v ORDER BY v.created_at DESC,v.id DESC;
  GET DIAGNOSTICS added=ROW_COUNT;
  found:=found+added;
  IF found>=lim OR cardinality(ids)<page_size THEN RETURN;END IF;
 END LOOP;
END $$;
ALTER FUNCTION public.global_search_activity_body_ids(text,integer) OWNER TO techerp_search_gateway;
REVOKE ALL ON FUNCTION public.global_search_activity_body_ids(text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.global_search_activity_body_ids(text,integer) TO authenticated;
CREATE OR REPLACE FUNCTION public.global_search_candidate_ids(_entity text,_q text,_limit integer DEFAULT 60)
RETURNS SETOF uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb:=public.work_access_context();w uuid:=(c->>'workspace')::uuid;resources text[];
 lim int:=least(greatest(coalesce(_limit,60),1),200);p text;
 page_size int;ids uuid[];before_at timestamptz;before_id uuid;found int:=0;added int;
BEGIN
 IF auth.uid() IS NULL OR w IS NULL OR length(btrim(coalesce(_q,'')))<3 OR length(_q)>200 THEN RETURN;END IF;
 resources:=CASE _entity WHEN 'contact' THEN ARRAY['techsales.contacts'] WHEN 'company' THEN ARRAY['techsales.companies'] WHEN 'activity' THEN ARRAY['techsales.activities','techsales.notes','techsales.tasks'] ELSE ARRAY[]::text[] END;
 IF NOT EXISTS(SELECT 1 FROM unnest(resources)r CROSS JOIN unnest(ARRAY['own','team','workspace','custom'])s WHERE c->'keys' ? (r||'.view.'||s)) THEN RETURN;END IF;
 p:='%'||replace(replace(replace(btrim(_q),'\','\\'),'%','\%'),'_','\_')||'%';
 IF _entity='contact' THEN
  -- Recheck predicates on the masked view: a hidden email cannot cause a hit.
  RETURN QUERY SELECT c.id FROM public.shared_fields_contacts c
   WHERE c.workspace_id=w AND c.id=ANY(ARRAY(SELECT global_search_private.index_ids('contact',_q)))
   AND (c.first_name ILIKE p OR c.last_name ILIKE p OR c.email ILIKE p) LIMIT lim;
 ELSIF _entity='company' THEN
  RETURN QUERY SELECT c.id FROM public.companies c
   WHERE c.workspace_id=w AND c.id=ANY(ARRAY(SELECT global_search_private.index_ids('company',_q))) LIMIT lim;
 ELSIF _entity='activity' THEN
  page_size:=least(500,greatest(32,lim*4));
  LOOP
   WITH batch AS MATERIALIZED(SELECT * FROM global_search_private.activity_page('subject',_q,before_at,before_id,page_size))
   SELECT array_agg(b.id ORDER BY b.created_at DESC,b.id DESC),
     (array_agg(b.created_at ORDER BY b.created_at ASC,b.id ASC))[1],
     (array_agg(b.id ORDER BY b.created_at ASC,b.id ASC))[1]
     INTO ids,before_at,before_id FROM batch b;
   IF coalesce(cardinality(ids),0)=0 THEN RETURN;END IF;
   RETURN QUERY SELECT a.id FROM public.activities a WHERE a.workspace_id=w AND a.id=ANY(ids)
     ORDER BY a.created_at DESC,a.id DESC LIMIT (lim-found);
   GET DIAGNOSTICS added=ROW_COUNT;found:=found+added;
   IF found>=lim OR cardinality(ids)<page_size THEN RETURN;END IF;
  END LOOP;
 END IF;
END $$;
ALTER FUNCTION public.global_search_candidate_ids(text,text,integer) OWNER TO techerp_search_gateway;
REVOKE ALL ON FUNCTION public.global_search_candidate_ids(text,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.global_search_candidate_ids(text,text,integer) TO authenticated;

