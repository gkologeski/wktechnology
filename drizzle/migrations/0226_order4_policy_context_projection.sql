-- Keep the exact current actor/workspace/team/readonly rules while avoiding
-- copying the entire ERP permission catalog for every sales row evaluated.
CREATE OR REPLACE FUNCTION public.sales_policy_context(resources text[])
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb;keys jsonb;BEGIN
 IF resources IS NULL OR cardinality(resources)=0 OR cardinality(resources)>24 OR EXISTS(SELECT 1 FROM unnest(resources) r WHERE r IS NULL OR length(r)>100 OR r!~'^(techsales|system)\.[a-z_][a-z0-9_.]*$') THEN RETURN '{}'::jsonb;END IF;
 c:=public.sales_access_context();
 SELECT coalesce(jsonb_object_agg(k.key,k.value),'{}'::jsonb) INTO keys
 FROM jsonb_each(coalesce(c->'keys','{}'::jsonb)) k
 WHERE EXISTS(SELECT 1 FROM unnest(resources) r WHERE starts_with(k.key,r||'.'));
 RETURN jsonb_set(c,'{keys}',keys,false);
END$$;
REVOKE ALL ON FUNCTION public.sales_policy_context(text[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sales_policy_context(text[]) TO authenticated;

-- Only our simple permissive scope policies are projected. Legacy restrictive
-- policies, column ACLs, source-aware summary/approval helpers and other modules
-- retain their independent checks. No policy roles or commands are changed.
DO $policies$
DECLARE p record;resources text[];qual text;check_expr text;command text;replacement text;
BEGIN
 FOR p IN SELECT pol.* FROM pg_policies pol WHERE pol.schemaname='public' AND pol.permissive='PERMISSIVE' AND pol.policyname LIKE 'sales\_%' ESCAPE '\' AND (position('sales_access_context()' IN coalesce(pol.qual,''))>0 OR position('sales_access_context()' IN coalesce(pol.with_check,''))>0) LOOP
  SELECT array_agg(DISTINCT m[1]) INTO resources
  FROM regexp_matches(coalesce(p.qual,'')||' '||coalesce(p.with_check,''),$resource$'((?:techsales|system)\.[a-z_][a-z0-9_.]*)'$resource$,'g') m;
  IF coalesce(cardinality(resources),0)=0 THEN CONTINUE;END IF;
  replacement:='sales_policy_context('||quote_literal(resources)||'::text[])';
  qual:=replace(p.qual,'sales_access_context()',replacement);
  check_expr:=replace(p.with_check,'sales_access_context()',replacement);
  command:=format('ALTER POLICY %I ON public.%I',p.policyname,p.tablename);
  IF p.qual IS NOT NULL THEN command:=command||' USING ('||qual||')';END IF;
  IF p.with_check IS NOT NULL THEN command:=command||' WITH CHECK ('||check_expr||')';END IF;
  EXECUTE command;
 END LOOP;
END $policies$;
