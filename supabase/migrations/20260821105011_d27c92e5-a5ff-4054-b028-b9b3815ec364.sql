CREATE OR REPLACE FUNCTION public.get_entity_field_catalog(p_table text, p_owner_id uuid)
 RETURNS TABLE(column_name text, data_type text, distinct_values text[], distinct_count integer, is_nullable text, has_default boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r record;
  vals text[];
  cnt int;
BEGIN
  IF p_table NOT IN (
    'leads','contacts','companies','deals','tickets','activities',
    'ats_jobs','ats_candidates','ats_applications','ats_interviews','ats_offers',
    'projects','project_tasks','project_milestones',
    'contracts','financial_entries','bank_payments',
    'quotes','proposals','products','services',
    'recurring_plans','subscription_invoices','customer_invoices'
  ) THEN
    RAISE EXCEPTION 'invalid table: %', p_table;
  END IF;

  FOR r IN
    SELECT c.column_name, c.data_type, c.is_nullable, (c.column_default IS NOT NULL) AS has_default
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = p_table
    ORDER BY c.ordinal_position
  LOOP
    column_name := r.column_name;
    data_type := r.data_type;
    is_nullable := r.is_nullable;
    has_default := r.has_default;
    distinct_values := NULL;
    distinct_count := NULL;

    IF r.data_type IN ('text','character varying','USER-DEFINED','boolean','uuid')
       AND r.column_name NOT IN ('id','owner_id','workspace_id','portal_token','hs_object_id')
    THEN
      BEGIN
        EXECUTE format(
          'SELECT array_agg(v ORDER BY c DESC), COUNT(*)::int
             FROM (
               SELECT %I::text AS v, COUNT(*) AS c
               FROM public.%I
               WHERE owner_id = $1 AND %I IS NOT NULL
               GROUP BY %I
               ORDER BY COUNT(*) DESC
               LIMIT 21
             ) t',
          r.column_name, p_table, r.column_name, r.column_name
        ) USING p_owner_id INTO vals, cnt;
        distinct_values := vals;
        distinct_count := cnt;
      EXCEPTION WHEN OTHERS THEN
        distinct_values := NULL;
        distinct_count := NULL;
      END;
    END IF;

    RETURN NEXT;
  END LOOP;
END
$function$;