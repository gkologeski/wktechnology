-- Shared triggers must not bind a People-only field on Candidates/Onboarding.
CREATE OR REPLACE FUNCTION public.hiring_shared_record_guard_repair()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('public.hr_record_links_guard()'::regprocedure) INTO definition;
 IF position('TG_OP=''UPDATE'' AND NEW.profile_id=auth.uid()' IN definition)=0 THEN RAISE EXCEPTION 'Expected shared People shortcut not found; review migration.';END IF;
 definition:=replace(definition,'TG_OP=''UPDATE'' AND NEW.profile_id=auth.uid()','TG_OP=''UPDATE'' AND (v_new->>''profile_id'')::uuid=auth.uid()');
 EXECUTE definition;
END $$;
REVOKE ALL ON FUNCTION public.hiring_shared_record_guard_repair() FROM PUBLIC,anon,authenticated,service_role;
SELECT public.hiring_shared_record_guard_repair();
