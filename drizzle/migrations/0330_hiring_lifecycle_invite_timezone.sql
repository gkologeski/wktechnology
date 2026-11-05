-- Inclusive end date uses the same operational timezone as effective access.
CREATE OR REPLACE FUNCTION public.hiring_lifecycle_end_boundary(day date)
RETURNS timestamptz LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,pg_temp AS $$
 SELECT (day+1)::timestamp AT TIME ZONE 'America/Sao_Paulo'
$$;
REVOKE ALL ON FUNCTION public.hiring_lifecycle_end_boundary(date) FROM PUBLIC,anon,authenticated,service_role;
DO $patch$ DECLARE definition text;BEGIN
 SELECT pg_get_functiondef('public.hiring_lifecycle_apply(uuid,uuid)'::regprocedure) INTO definition;
 IF position('(cutoff+1)::timestamptz' IN definition)=0 THEN RAISE EXCEPTION 'Expected lifecycle invite boundary not found; review before migration.';END IF;
 definition:=replace(definition,'(cutoff+1)::timestamptz','public.hiring_lifecycle_end_boundary(cutoff)');EXECUTE definition;
END $patch$;
