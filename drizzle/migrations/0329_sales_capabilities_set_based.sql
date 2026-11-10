-- Set-based path for the main TechSales tables: one statement per call, so RLS
-- InitPlans and the caller context run once instead of 7x per record.
-- Expressions mirror public.sales_record_access exactly; other tables keep the loop.
CREATE OR REPLACE FUNCTION public.sales_capabilities(t text, ids uuid[])
 RETURNS TABLE(id uuid, can_view boolean, can_update boolean, can_delete boolean, can_assign boolean, can_approve boolean, can_export boolean, can_manage boolean)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE i uuid; c jsonb; res text; tbl text;BEGIN
 IF coalesce(cardinality(ids),0)>500 THEN RAISE EXCEPTION 'Limite excedido.';END IF;
 IF coalesce(cardinality(ids),0)=0 THEN RETURN;END IF;
 c := sales_access_context();
 res := CASE t WHEN 'quotes' THEN 'techsales.quotes' WHEN 'deals' THEN 'techsales.deals' WHEN 'proposals' THEN 'techsales.proposals'
   WHEN 'leads' THEN 'techsales.leads' WHEN 'contacts' THEN 'techsales.contacts' WHEN 'companies' THEN 'techsales.companies' END;
 IF res IS NOT NULL THEN
   tbl := t;
   RETURN QUERY EXECUTE format($q$
     SELECT x.id, true,
       public.sales_context_access($1,x.workspace_id,$2,'update',x.o), public.sales_context_access($1,x.workspace_id,$2,'delete',x.o),
       public.sales_context_access($1,x.workspace_id,$2,'assign',x.o), public.sales_context_access($1,x.workspace_id,$2,'approve',x.o),
       public.sales_context_access($1,x.workspace_id,$2,'export',x.o), public.sales_context_access($1,x.workspace_id,$2,'manage',x.o)
     FROM (SELECT r.id, r.workspace_id, ARRAY[coalesce(r.assigned_to,r.owner_id)]::uuid[] o FROM public.%I r WHERE r.id = ANY($3)) x
     WHERE public.sales_context_access($1,x.workspace_id,$2,'view',x.o)$q$, tbl)
   USING c, res, ids;
   RETURN;
 END IF;
 FOREACH i IN ARRAY ids LOOP
 IF sales_private.record_access_ctx(c,t,i,'view') THEN RETURN QUERY SELECT i,true,
   sales_private.record_access_ctx(c,t,i,'update'),sales_private.record_access_ctx(c,t,i,'delete'),
   sales_private.record_access_ctx(c,t,i,'assign'),sales_private.record_access_ctx(c,t,i,'approve'),
   sales_private.record_access_ctx(c,t,i,'export'),sales_private.record_access_ctx(c,t,i,'manage');END IF;
 END LOOP;END $function$;