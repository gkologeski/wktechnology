-- Association tables with a composite key have no single UUID row id.
-- Their RLS remains tied to the parent records; UUID capability calls deny cleanly.
DO $composite$
DECLARE definition text;
 needle text:='DECLARE c jsonb:=sales_access_context();BEGIN';
 marker text:='-- order4 composite association capability guard';
BEGIN
 IF (SELECT prosecdef FROM pg_proc WHERE oid='public.sales_record_access(text,uuid,text)'::regprocedure) THEN
  RAISE EXCEPTION 'Expected caller-scoped sales_record_access implementation';
 END IF;
 UPDATE public.sales_resource_catalog SET id_column=NULL
 WHERE table_name IN('deal_contacts','proposal_template_services','segment_members');
 definition:=pg_get_functiondef('public.sales_record_access(text,uuid,text)'::regprocedure);
 IF position(marker IN definition)=0 THEN
  IF position(needle IN definition)=0 OR position('WHEN ''deal_contacts''' IN definition)=0 OR position('WHEN ''proposal_template_services''' IN definition)=0 OR position('WHEN ''segment_members''' IN definition)=0 THEN
   RAISE EXCEPTION 'Unexpected sales_record_access body; review before applying';
  END IF;
  definition:=replace(definition,needle,needle||E'\n '||marker||E'\n IF t IN(''deal_contacts'',''proposal_template_services'',''segment_members'') THEN RETURN false;END IF;');
  EXECUTE definition;
 END IF;
END $composite$;
