-- Child tables (sales_resource_catalog.parent_table set) return before the
-- access context is used; computing it first cost ~20 ms per inserted row.
-- Only the position of the context computation changes; every check and
-- exception keeps the same order and outcome.
CREATE OR REPLACE FUNCTION public.sales_row_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE n jsonb:=to_jsonb(NEW);o jsonb;c jsonb;w uuid:=nullif(n->>'workspace_id','')::uuid;m sales_resource_catalog;f jsonb;rw uuid;target uuid;rr text;responsible text;BEGIN
 IF TG_OP='UPDATE' THEN
  o:=to_jsonb(OLD);
  IF n->'workspace_id' IS DISTINCT FROM o->'workspace_id' THEN RAISE EXCEPTION 'Workspace imutável.' USING ERRCODE='42501';END IF;
 END IF;
 SELECT * INTO m FROM sales_resource_catalog WHERE table_name=TG_TABLE_NAME;
 IF w IS NULL AND m.parent_table IS NOT NULL THEN
  EXECUTE format('SELECT workspace_id FROM public.%I WHERE id=$1',m.parent_table) INTO w USING nullif(n->>m.parent_column::text,'')::uuid;
 END IF;
 -- Foreign-key tenant boundaries remain mandatory even for trusted workers.
 FOR f IN SELECT * FROM jsonb_array_elements(TG_ARGV[0]::jsonb) LOOP
  target:=nullif(n->>(f->>'column'),'')::uuid;
  IF target IS NULL THEN CONTINUE;END IF;
  EXECUTE format('SELECT workspace_id FROM public.%I WHERE %I=$1',f->>'table',f->>'reference') INTO rw USING target;
  IF rw IS NOT NULL AND w IS DISTINCT FROM rw THEN RAISE EXCEPTION 'Vínculo pertence a outro workspace.' USING ERRCODE='42501';END IF;
 END LOOP;
 IF auth.uid() IS NULL OR auth.role()='service_role' THEN RETURN NEW;END IF;
 SELECT * INTO m FROM sales_resource_catalog WHERE table_name=TG_TABLE_NAME;
 IF NOT FOUND THEN RETURN NEW;END IF;
 IF TG_OP='UPDATE' AND n->'owner_id' IS DISTINCT FROM o->'owner_id' THEN RAISE EXCEPTION 'Autor imutável.' USING ERRCODE='42501';END IF;
 IF m.parent_table IS NOT NULL THEN RETURN NEW;END IF;
 c:=sales_access_context();
 rr:=CASE WHEN TG_TABLE_NAME='activities' AND coalesce(o->>'type',n->>'type')='note' THEN 'techsales.notes' WHEN TG_TABLE_NAME='activities' AND coalesce(o->>'type',n->>'type')='task' THEN 'techsales.tasks' ELSE m.resource END;
 IF TG_OP='UPDATE' AND n->'owner_id' IS DISTINCT FROM o->'owner_id' THEN RAISE EXCEPTION 'Autor imutável.' USING ERRCODE='42501';END IF;
 FOREACH responsible IN ARRAY m.responsibles LOOP
  IF responsible='owner_id' THEN CONTINUE;END IF;
  IF TG_OP='UPDATE' AND n->responsible IS DISTINCT FROM o->responsible THEN
   IF NOT sales_record_context_access(c,TG_TABLE_NAME,(o->>'id')::uuid,'assign') THEN RAISE EXCEPTION 'Sem permissão de atribuição.' USING ERRCODE='42501';END IF;
  END IF;
  target:=nullif(n->>responsible,'')::uuid;
  IF TG_OP='INSERT' AND target IS NOT NULL AND target IS DISTINCT FROM auth.uid() AND NOT sales_context_access(c,w,rr,'assign',ARRAY[target]) THEN RAISE EXCEPTION 'Atribuição inicial não autorizada.' USING ERRCODE='42501';END IF;
  IF target IS NOT NULL AND (TG_OP='INSERT' OR n->responsible IS DISTINCT FROM o->responsible)
    AND NOT EXISTS(SELECT 1 FROM workspace_members WHERE workspace_id=w AND user_id=target AND status='active') THEN RAISE EXCEPTION 'Responsável deve ser membro ativo do workspace.' USING ERRCODE='42501';END IF;
 END LOOP;
 IF TG_OP='INSERT' AND n?'owner_id' AND nullif(n->>'owner_id','')::uuid IS DISTINCT FROM auth.uid() AND NOT(TG_TABLE_NAME IN('meetings','live_chat_sessions') AND nullif(n->>'owner_id','')::uuid=w) THEN RAISE EXCEPTION 'Autor deve ser o usuário autenticado.' USING ERRCODE='42501';END IF;
 RETURN NEW;
END $function$;