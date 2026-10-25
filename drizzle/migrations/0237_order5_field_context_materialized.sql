-- Resolve field rules once per statement, rather than once per visible row.
-- Preserve every column expression, security barrier, owner, ACL and underlying RLS.
-- Refuse unexpected definitions instead of replacing an unreviewed view.
DO $migration$
DECLARE v text; body text; old_tail text:=$tail$CROSS JOIN LATERAL ( SELECT shared_field_context() -> 'rules'::text AS rules
         OFFSET 0) m;$tail$; replacement text;
BEGIN
 PERFORM set_config('search_path','public,pg_temp',true);
 FOREACH v IN ARRAY ARRAY['shared_fields_contacts','shared_fields_leads','shared_fields_deals','shared_fields_ats_candidates','shared_fields_ats_offers','shared_fields_ats_interviews','shared_fields_deal_line_items'] LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_roles r ON r.oid=c.relowner WHERE n.nspname='public' AND c.relname=v AND c.relkind='v' AND r.rolname='techerp_shared_fields' AND c.reloptions @> ARRAY['security_barrier=true']) THEN
   RAISE EXCEPTION 'Unexpected protected field view: %',v;
  END IF;
  body:=pg_get_viewdef(format('public.%I',v)::regclass,true);
  IF right(rtrim(body),length(old_tail)) IS DISTINCT FROM old_tail THEN RAISE EXCEPTION 'Unexpected field-context expression: %',v;END IF;
  replacement:='WITH field_policy AS MATERIALIZED (SELECT public.shared_field_context()->''rules'' AS rules) '||replace(body,old_tail,'CROSS JOIN field_policy m;');
  EXECUTE format('CREATE OR REPLACE VIEW public.%I WITH(security_barrier=true) AS %s',v,replacement);
 END LOOP;
END $migration$;
