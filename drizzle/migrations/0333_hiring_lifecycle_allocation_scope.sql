-- Allocation IDs must use the child-record resolver, not the parent-person resolver.
CREATE OR REPLACE FUNCTION public.hiring_lifecycle_allocation_scope_repair()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE signature regprocedure; definition text;
BEGIN
 FOREACH signature IN ARRAY ARRAY['public.hiring_lifecycle_snapshot(uuid,uuid,text,jsonb)'::regprocedure,'public.hiring_lifecycle_apply(uuid,uuid)'::regprocedure] LOOP
  SELECT pg_get_functiondef(signature) INTO definition;
  IF position('public.hr_record_access(''person_allocations'',' IN definition)=0 THEN RAISE EXCEPTION 'Expected allocation resolver not found in %; review migration.',signature;END IF;
  definition:=replace(definition,'public.hr_record_access(''person_allocations'',','public.hr_record_access(''allocations'',');
  EXECUTE definition;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.hiring_lifecycle_allocation_scope_repair() FROM PUBLIC,anon,authenticated,service_role;
SELECT public.hiring_lifecycle_allocation_scope_repair();
