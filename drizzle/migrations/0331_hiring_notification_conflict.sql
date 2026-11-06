-- Infer the actual partial unique index, without widening access or changing events.
CREATE OR REPLACE FUNCTION public.hiring_notification_conflict_repair()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE signature text;definition text;
BEGIN
 FOREACH signature IN ARRAY ARRAY['public.hiring_demand_notify(uuid)','public.hiring_lifecycle_notify(uuid)'] LOOP
  SELECT pg_get_functiondef(signature::regprocedure) INTO definition;
  IF position('ON CONFLICT(dedupe_key) DO NOTHING' IN definition)=0 THEN RAISE EXCEPTION 'Expected notification conflict clause not found: %',signature;END IF;
  definition:=replace(definition,'ON CONFLICT(dedupe_key) DO NOTHING','ON CONFLICT(dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING');
  EXECUTE definition;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.hiring_notification_conflict_repair() FROM PUBLIC,anon,authenticated,service_role;
SELECT public.hiring_notification_conflict_repair();
