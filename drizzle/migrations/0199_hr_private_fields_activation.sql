-- Phase 2. Apply only after 0198-aware frontend/server code is published.
-- Authenticated writes are guarded even when made outside the UI; SELECT of
-- private columns is only through the caller-bound whitelist RPC.
CREATE TRIGGER zz_hr_private_write BEFORE INSERT OR UPDATE ON public.people FOR EACH ROW EXECUTE FUNCTION public.hr_private_write_guard();
CREATE TRIGGER zz_hr_private_write BEFORE INSERT OR UPDATE ON public.people_one_on_ones FOR EACH ROW EXECUTE FUNCTION public.hr_private_write_guard();
CREATE TRIGGER zz_hr_private_write BEFORE INSERT OR UPDATE ON public.people_allocations FOR EACH ROW EXECUTE FUNCTION public.hr_private_write_guard();

CREATE OR REPLACE FUNCTION public.can_view_person_sensitive(_person_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT COALESCE((SELECT public.hr_private_row_allowed('people_sensitive','view',to_jsonb(p),false) FROM public.people p WHERE id=_person_id),false)
$$;
REVOKE ALL ON FUNCTION public.can_view_person_sensitive(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_view_person_sensitive(uuid) TO authenticated;

DO $acl$
DECLARE t text; all_cols text; public_cols text; private_cols text[];
BEGIN
 FOREACH t IN ARRAY ARRAY['people','people_one_on_ones','people_allocations'] LOOP
   private_cols:=CASE t WHEN 'people' THEN ARRAY['cost_hour','monthly_cost','personal_doc','bank','bank_agency','bank_account','pix_key','address']
     WHEN 'people_one_on_ones' THEN ARRAY['private_notes'] ELSE ARRAY['billable_rate','cost_rate'] END;
   SELECT string_agg(format('%I',a.attname),',' ORDER BY a.attnum),
     string_agg(format('%I',a.attname),',' ORDER BY a.attnum) FILTER(WHERE NOT a.attname=ANY(private_cols))
     INTO all_cols,public_cols FROM pg_attribute a WHERE a.attrelid=('public.'||t)::regclass AND a.attnum>0 AND NOT a.attisdropped;
   EXECUTE format('REVOKE SELECT ON public.%I FROM PUBLIC,anon,authenticated',t);
   EXECUTE format('REVOKE SELECT(%s) ON public.%I FROM PUBLIC,anon,authenticated',all_cols,t);
   EXECUTE format('GRANT SELECT(%s) ON public.%I TO authenticated',public_cols,t);
 END LOOP;
END $acl$;
-- Deprecated view directly references salary columns and cannot enforce the
-- separate private-field permission. Application consumers now compose RLS reads
-- with hr_private_fields. Preserve service access; remove the unsafe client path.
DO $$ BEGIN
 IF to_regclass('public.people_total_cost') IS NOT NULL THEN
   REVOKE SELECT ON public.people_total_cost FROM PUBLIC,anon,authenticated;
 END IF;
END $$;

NOTIFY pgrst, 'reload schema';
