CREATE SCHEMA IF NOT EXISTS sales_private;
REVOKE ALL ON SCHEMA sales_private FROM PUBLIC;
GRANT USAGE ON SCHEMA sales_private TO authenticated, service_role;

DO $mig$
DECLARE d text; n text;
BEGIN
  d := pg_get_functiondef('public.sales_record_access(text,uuid,text)'::regprocedure);
  n := replace(d, 'CREATE OR REPLACE FUNCTION public.sales_record_access(t text, i uuid, a text)',
                  'CREATE OR REPLACE FUNCTION sales_private.record_access_ctx(c jsonb, t text, i uuid, a text)');
  n := replace(n, 'DECLARE c jsonb:=sales_access_context();BEGIN', 'BEGIN');
  IF n = d OR position('sales_private.record_access_ctx' in n) = 0 OR position('DECLARE c jsonb' in n) > 0 THEN
    RAISE EXCEPTION 'sales_record_access definition changed; aborting';
  END IF;
  EXECUTE n;
END $mig$;

REVOKE ALL ON FUNCTION sales_private.record_access_ctx(jsonb,text,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sales_private.record_access_ctx(jsonb,text,uuid,text) TO authenticated, service_role;

-- Same result as before; caller context computed once per call instead of 7x per id.
CREATE OR REPLACE FUNCTION public.sales_capabilities(t text, ids uuid[])
 RETURNS TABLE(id uuid, can_view boolean, can_update boolean, can_delete boolean, can_assign boolean, can_approve boolean, can_export boolean, can_manage boolean)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE i uuid; c jsonb;BEGIN
 IF coalesce(cardinality(ids),0)>500 THEN RAISE EXCEPTION 'Limite excedido.';END IF;
 IF coalesce(cardinality(ids),0)=0 THEN RETURN;END IF;
 c := sales_access_context();
 FOREACH i IN ARRAY ids LOOP
 IF sales_private.record_access_ctx(c,t,i,'view') THEN RETURN QUERY SELECT i,true,
   sales_private.record_access_ctx(c,t,i,'update'),sales_private.record_access_ctx(c,t,i,'delete'),
   sales_private.record_access_ctx(c,t,i,'assign'),sales_private.record_access_ctx(c,t,i,'approve'),
   sales_private.record_access_ctx(c,t,i,'export'),sales_private.record_access_ctx(c,t,i,'manage');END IF;
 END LOOP;END $function$;