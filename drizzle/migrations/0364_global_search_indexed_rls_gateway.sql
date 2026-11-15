-- Index discovery is private. The callable gateway has no LOGIN/BYPASSRLS and
-- inherits authenticated policies; only its final RLS/field-protected rows leave SQL.
DO $$BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='techerp_search_gateway') THEN
  CREATE ROLE techerp_search_gateway NOLOGIN NOSUPERUSER NOBYPASSRLS INHERIT;
 ELSIF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='techerp_search_gateway' AND (rolcanlogin OR rolsuper OR rolbypassrls)) THEN
  RAISE EXCEPTION 'Unsafe search gateway owner';
 END IF;
END $$;
GRANT authenticated TO techerp_search_gateway;
GRANT techerp_search_gateway TO postgres;
GRANT USAGE,CREATE ON SCHEMA public TO techerp_search_gateway;
CREATE SCHEMA IF NOT EXISTS global_search_private;
REVOKE ALL ON SCHEMA global_search_private FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA global_search_private TO techerp_search_gateway;

CREATE OR REPLACE FUNCTION global_search_private.index_ids(_entity text,_q text)
RETURNS SETOF uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE w uuid:=(public.work_access_context()->>'workspace')::uuid;p text;words text[];tsq tsquery;
BEGIN
 IF auth.uid() IS NULL OR w IS NULL OR length(btrim(coalesce(_q,'')))<3 OR length(_q)>200 THEN RETURN;END IF;
 p:='%'||replace(replace(replace(btrim(_q),'\','\\'),'%','\%'),'_','\_')||'%';
 IF _entity='contact' THEN
  RETURN QUERY SELECT c.id FROM public.contacts c WHERE c.workspace_id=w AND (c.first_name ILIKE p OR c.last_name ILIKE p OR c.email ILIKE p);
 ELSIF _entity='company' THEN
  RETURN QUERY SELECT c.id FROM public.companies c WHERE c.workspace_id=w AND (c.name ILIKE p OR c.domain ILIKE p);
 ELSIF _entity='activity' THEN
  RETURN QUERY SELECT a.id FROM public.activities a WHERE a.workspace_id=w AND a.subject ILIKE p;
 ELSIF _entity='activity_body' THEN
  words:=array_remove(regexp_split_to_array(btrim(regexp_replace(public.search_fold(_q),'[^a-z0-9 ]',' ','g')),'\s+'),'');
  IF coalesce(cardinality(words),0)=0 THEN RETURN;END IF;
  SELECT string_agg(CASE WHEN i=cardinality(words)
    THEN coalesce(nullif(nullif(querytree(plainto_tsquery('portuguese',word)),'T'),''),quote_literal(word))||':*'
    ELSE coalesce(nullif(nullif(querytree(plainto_tsquery('portuguese',word)),'T'),''),quote_literal(word)) END,' & ')::tsquery
    INTO tsq FROM unnest(words) WITH ORDINALITY AS x(word,i);
  RETURN QUERY SELECT a.id FROM public.activities a WHERE a.workspace_id=w AND public.activity_body_search_doc(a.body)@@tsq;
 END IF;
END $$;
REVOKE ALL ON FUNCTION global_search_private.index_ids(text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION global_search_private.index_ids(text,text) TO techerp_search_gateway;

CREATE OR REPLACE FUNCTION public.global_search_candidate_ids(_entity text,_q text,_limit integer DEFAULT 60)
RETURNS SETOF uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE w uuid:=(public.work_access_context()->>'workspace')::uuid;
 lim int:=least(greatest(coalesce(_limit,60),1),200);p text;
BEGIN
 IF auth.uid() IS NULL OR w IS NULL OR length(btrim(coalesce(_q,'')))<3 OR length(_q)>200 THEN RETURN;END IF;
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
  RETURN QUERY SELECT a.id FROM public.activities a
   WHERE a.workspace_id=w AND a.id=ANY(ARRAY(SELECT global_search_private.index_ids('activity',_q))) LIMIT lim;
 END IF;
END $$;
ALTER FUNCTION public.global_search_candidate_ids(text,text,integer) OWNER TO techerp_search_gateway;
REVOKE ALL ON FUNCTION public.global_search_candidate_ids(text,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.global_search_candidate_ids(text,text,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.global_search_activity_body_ids(_q text,_limit integer DEFAULT 40)
RETURNS TABLE(id uuid,snippet text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE w uuid:=(public.work_access_context()->>'workspace')::uuid;
 lim int:=least(greatest(coalesce(_limit,40),1),100);
BEGIN
 IF auth.uid() IS NULL OR w IS NULL OR length(btrim(coalesce(_q,'')))<3 OR length(_q)>200 THEN RETURN;END IF;
 -- Materialize only visible hits before constructing snippets from their body.
 RETURN QUERY WITH visible AS MATERIALIZED (
  SELECT a.id,a.body FROM public.activities a
  WHERE a.workspace_id=w AND a.id=ANY(ARRAY(SELECT global_search_private.index_ids('activity_body',_q)))
  ORDER BY a.created_at DESC,a.id LIMIT lim)
 SELECT v.id,ts_headline('portuguese',public.activity_body_plain(v.body),plainto_tsquery('portuguese',_q),
  'MaxWords=18, MinWords=8, StartSel="", StopSel="", MaxFragments=1') FROM visible v;
END $$;
ALTER FUNCTION public.global_search_activity_body_ids(text,integer) OWNER TO techerp_search_gateway;
REVOKE ALL ON FUNCTION public.global_search_activity_body_ids(text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.global_search_activity_body_ids(text,integer) TO authenticated;
REVOKE CREATE ON SCHEMA public FROM techerp_search_gateway;
