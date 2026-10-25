-- Column ACLs are authoritative. No role/rule assignment is changed.
REVOKE SELECT ON public.contacts FROM PUBLIC,anon,authenticated;
REVOKE SELECT("email","phone","mobile_phone","hs_raw","phone_digits","mobile_phone_digits","whatsapp_e164","whatsapp_digits") ON public.contacts FROM PUBLIC,anon,authenticated;
GRANT SELECT("id","owner_id","company_id","first_name","last_name","job_title","notes","created_at","updated_at","score","label","marketing_status","legal_basis","consent_date","external_ids","country","address","cep","city","state","website","company_name","lifecyclestage","hs_lead_status","hubspot_owner_id","hs_object_id","hs_createdate","hs_lastmodifieddate","linkedin_url","twitter_handle","custom_fields","portal_enabled","workspace_id","deleted_at","assigned_user_id","assigned_to","cargo_resumido","area_atuacao","nivel_hierarquico","cargo_catalog_version","photo_url","photo_source","photo_updated_at","phone_ext") ON public.contacts TO authenticated;
CREATE TRIGGER zzzzz_shared_field_write BEFORE INSERT OR UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.shared_field_write_guard();
REVOKE SELECT ON public.leads FROM PUBLIC,anon,authenticated;
REVOKE SELECT("score","hs_raw") ON public.leads FROM PUBLIC,anon,authenticated;
GRANT SELECT("id","owner_id","first_name","last_name","email","phone","company_name","source","status","notes","converted_at","converted_contact_id","converted_deal_id","created_at","updated_at","pipeline_id","label","external_ids","stage_id","hubspot_owner_id","hs_object_id","hs_createdate","hs_lastmodifieddate","hs_lead_source_detail","custom_fields","workspace_id","deleted_at","assigned_user_id","company_id","nurture_started_at","assigned_to","mobile_phone","stage_substatus_id","linkedin_url","last_form_submission_at","whatsapp_e164","job_title","job_title_source","cargo_resumido","area_atuacao","nivel_hierarquico","cargo_catalog_version","photo_url","photo_source","photo_updated_at","phone_ext","phone_digits","mobile_phone_digits","whatsapp_digits") ON public.leads TO authenticated;
CREATE TRIGGER zzzzz_shared_field_write BEFORE INSERT OR UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.shared_field_write_guard();
REVOKE SELECT ON public.deals FROM PUBLIC,anon,authenticated;
REVOKE SELECT("value","hs_raw") ON public.deals FROM PUBLIC,anon,authenticated;
GRANT SELECT("id","owner_id","name","currency","stage","company_id","primary_contact_id","expected_close_date","notes","created_at","updated_at","pipeline_id","external_ids","stage_id","description","dealtype","hs_priority","hs_deal_stage_probability","hubspot_owner_id","hs_object_id","hs_createdate","hs_lastmodifieddate","closed_lost_reason","closed_won_reason","num_associated_contacts","custom_fields","workspace_id","deleted_at","assigned_user_id","assigned_to","closed_at","lost_at","stage_substatus_id","lead_id","source","service_line") ON public.deals TO authenticated;
CREATE TRIGGER zzzzz_shared_field_write BEFORE INSERT OR UPDATE ON public.deals FOR EACH ROW EXECUTE FUNCTION public.shared_field_write_guard();
REVOKE SELECT ON public.ats_candidates FROM PUBLIC,anon,authenticated;
REVOKE SELECT("email","phone","cv_parsed") ON public.ats_candidates FROM PUBLIC,anon,authenticated;
GRANT SELECT("id","owner_id","full_name","linkedin_url","location","current_position","current_company","cv_url","skills","tags","source","score","notes","created_by","created_at","updated_at","dei_gender","dei_race","dei_disability","dei_lgbtqia","relationship_status","last_touch_at","next_action_at","relationship_owner_id","retention_until","lgpd_redacted_at","archived","headline","about","photo_url","experiences","education","certifications","languages","skills_detailed","projects","publications","volunteering","open_to_work","connection_degree","available_actions","external_links","current_company_data","recent_activity","recommendations","captured_at","capture_version","assigned_to","workspace_id") ON public.ats_candidates TO authenticated;
CREATE TRIGGER zzzzz_shared_field_write BEFORE INSERT OR UPDATE ON public.ats_candidates FOR EACH ROW EXECUTE FUNCTION public.shared_field_write_guard();
REVOKE SELECT ON public.ats_offers FROM PUBLIC,anon,authenticated;
REVOKE SELECT("salary_amount","body") ON public.ats_offers FROM PUBLIC,anon,authenticated;
GRANT SELECT("id","owner_id","application_id","candidate_id","job_id","title","start_date","status","esign_document_id","promote_to_stage","sent_at","signed_at","declined_at","decline_reason","created_at","updated_at","viewed_at","assigned_to","workspace_id","approval_status","revision","approved_revision","approved_by","approved_at") ON public.ats_offers TO authenticated;
CREATE TRIGGER zzzzz_shared_field_write BEFORE INSERT OR UPDATE ON public.ats_offers FOR EACH ROW EXECUTE FUNCTION public.shared_field_write_guard();
REVOKE SELECT ON public.ats_interviews FROM PUBLIC,anon,authenticated;
REVOKE SELECT("notes") ON public.ats_interviews FROM PUBLIC,anon,authenticated;
GRANT SELECT("id","owner_id","application_id","job_id","candidate_id","interviewer_id","stage_value","kind","status","scheduled_at","duration_min","meet_url","location","self_schedule_token","self_schedule_expires_at","slots","reminder_d1_sent_at","reminder_1h_sent_at","created_at","updated_at","interview_kit_id","async_questions_snapshot","offered_slots","self_scheduled_at","transcript","ai_summary","ai_strengths","ai_concerns","ai_followups","ai_recommendation","ai_score","ai_generated_at","ai_model","pool_id","panel_interviewer_ids","auto_rescheduled_from","meeting_id","assigned_to","workspace_id") ON public.ats_interviews TO authenticated;
CREATE TRIGGER zzzzz_shared_field_write BEFORE INSERT OR UPDATE ON public.ats_interviews FOR EACH ROW EXECUTE FUNCTION public.shared_field_write_guard();
REVOKE SELECT ON public.deal_line_items FROM PUBLIC,anon,authenticated;
REVOKE SELECT("unit_price","discount_pct","tax_rate","discount_amount","percent","percent_base_amount") ON public.deal_line_items FROM PUBLIC,anon,authenticated;
GRANT SELECT("id","owner_id","deal_id","name","description","quantity","position","created_at","updated_at","workspace_id","discount_type","service_catalog_id","contracting_preset_id","job_profile_id","seniority","unit","billing_model","cadence") ON public.deal_line_items TO authenticated;
CREATE TRIGGER zzzzz_shared_field_write BEFORE INSERT OR UPDATE ON public.deal_line_items FOR EACH ROW EXECUTE FUNCTION public.shared_field_write_guard();
CREATE TRIGGER zzzz_shared_field_rule BEFORE INSERT OR UPDATE ON public.field_permission_rules FOR EACH ROW EXECUTE FUNCTION public.shared_field_rule_guard();

-- Existing indexed search must query the masked read view, including its predicates.
DO $f$DECLARE body text;BEGIN
 SELECT pg_get_functiondef('public.global_search_candidate_ids(text,text,integer)'::regprocedure) INTO body;
 IF position('FROM contacts c' IN body)=0 THEN RAISE EXCEPTION 'Unexpected search function definition';END IF;
 EXECUTE replace(body,'FROM contacts c','FROM public.shared_fields_contacts c');
END $f$;
-- Actor, tenant, scopes and version proofs are unchanged. Protected fields use
-- read views for predicates and responses, never raw RETURNING columns.
CREATE OR REPLACE FUNCTION techerp_api.sales_query(p_key uuid,p_user uuid,p_ws uuid,p_table text,p_query jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE field_ids uuid[];before_rows jsonb;returning_selection text;op text:=coalesce(p_query->>'operation','select');filters jsonb:=coalesce(p_query->'filters','[]');payload jsonb:=p_query->'payload';f jsonb;columns text[];selections text[];key text;predicate text:='true';ordering text:='';selected text;sql text;source text;resource text;rows jsonb;n bigint;lim integer:=least(greatest(coalesce((p_query->>'limit')::integer,200),0),1000);off integer:=greatest(coalesce((p_query->>'offset')::integer,0),0);BEGIN
 IF p_table NOT IN('leads','contacts','companies','deals','activities','meetings','pipelines','deal_line_items','deal_contacts') OR op NOT IN('select','insert','update','delete') THEN RAISE EXCEPTION 'Operação da API indisponível.' USING ERRCODE='42501';END IF;
 PERFORM techerp_api.enter(p_key,p_user,p_ws);
 source:=CASE WHEN p_table='pipelines' AND op='select' THEN 'public.sales_pipeline_references()' ELSE 'public.'||quote_ident(p_table) END;
 resource:=CASE p_table WHEN 'leads' THEN 'techsales.leads' WHEN 'contacts' THEN 'techsales.contacts' WHEN 'companies' THEN 'techsales.companies' WHEN 'deals' THEN 'techsales.deals' WHEN 'deal_contacts' THEN 'techsales.deals' WHEN 'deal_line_items' THEN 'techsales.deals' WHEN 'meetings' THEN 'techsales.meetings' WHEN 'activities' THEN CASE WHEN payload->>'type'='note' THEN 'techsales.notes' WHEN payload->>'type'='task' THEN 'techsales.tasks' ELSE 'techsales.activities' END ELSE 'system.pipelines' END;
 IF NOT(p_table='pipelines' AND op='select') THEN PERFORM sales_area_authorize(resource,CASE op WHEN 'select' THEN 'view' WHEN 'authorize_export' THEN 'view' WHEN 'insert' THEN 'create' WHEN 'delete' THEN 'delete' ELSE 'update' END);END IF;
 IF NOT EXISTS(SELECT 1 FROM api_keys WHERE id=p_key AND (scopes @> ARRAY['write']::text[] OR (op='select' AND scopes @> ARRAY['read']::text[]))) THEN RAISE EXCEPTION 'Escopo da chave insuficiente.' USING ERRCODE='42501';END IF;
 IF jsonb_typeof(filters)<>'array' OR jsonb_array_length(filters)>100 THEN RAISE EXCEPTION 'Filtros inválidos.';END IF;
 FOR f IN SELECT * FROM jsonb_array_elements(filters) LOOP predicate:=predicate||' AND ('||techerp_api.sales_filter(p_table,f)||')';END LOOP;
 IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=p_table AND column_name='workspace_id') THEN predicate:=predicate||format(' AND workspace_id=%L::uuid',p_ws);END IF;
 selected:=coalesce(nullif(p_query->>'select',''),'*');
 IF p_table='pipelines' AND op='select' AND selected='*' THEN selected:='id,owner_id,workspace_id,entity,name,is_default,stages,default_view,created_at,updated_at';END IF;
 IF selected='*' THEN SELECT array_agg(column_name::text ORDER BY ordinal_position) INTO selections FROM information_schema.columns WHERE table_schema='public' AND table_name=p_table AND column_name NOT IN('portal_token','access_token','refresh_token','oauth_tokens','credentials_secret_ref','secret') AND NOT(column_name='public_token' AND p_table IN('quotes','proposals'));ELSE selections:=string_to_array(selected,',');END IF;
 FOREACH key IN ARRAY selections LOOP
  key:=trim(key);
  IF p_table='pipelines' AND op='select' AND key='config' THEN RAISE EXCEPTION 'Configuração privada desta porta.' USING ERRCODE='42501';END IF;
  IF (key IN('portal_token','access_token','refresh_token','oauth_tokens','credentials_secret_ref','secret') OR (key='public_token' AND p_table IN('quotes','proposals'))) OR NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=p_table AND column_name=key) THEN RAISE EXCEPTION 'Projeção da API inválida.' USING ERRCODE='42501';END IF;
  columns:=array_append(columns,quote_ident(key));
 END LOOP;
 selected:=array_to_string(columns,',');columns:=NULL;
 returning_selection:=CASE WHEN p_table IN('leads','contacts','deals','deal_line_items') THEN 'id' ELSE selected END;
 IF p_table IN('leads','contacts','deals','deal_line_items') THEN
  source:='public.'||quote_ident('shared_fields_'||p_table);
  IF op='delete' THEN
   EXECUTE format('SELECT coalesce(jsonb_agg(jsonb_build_object(''key'',x._techid,''row'',to_jsonb(x)-''_techid'')),''[]'') FROM(SELECT id _techid,%s FROM %s WHERE %s)x',selected,source,predicate) INTO before_rows;
  END IF;
  IF op<>'select' THEN predicate:=format('id IN(SELECT id FROM %s WHERE %s)',source,predicate);END IF;
 END IF;
 IF op='select' THEN
  FOR f IN SELECT * FROM jsonb_array_elements(coalesce(p_query->'order','[]')) LOOP
   key:=f->>'column';IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=p_table AND column_name=key) OR key IN('portal_token','public_token') THEN RAISE EXCEPTION 'Ordenação inválida.';END IF;
   ordering:=ordering||CASE WHEN ordering='' THEN ' ORDER BY ' ELSE ',' END||quote_ident(key)||CASE WHEN coalesce((f->>'ascending')::boolean,true) THEN ' ASC' ELSE ' DESC' END||CASE WHEN coalesce((f->>'nullsFirst')::boolean,false) THEN ' NULLS FIRST' ELSE ' NULLS LAST' END;
  END LOOP;
  EXECUTE format('SELECT count(*) FROM %s WHERE %s',source,predicate) INTO n;
  EXECUTE format('SELECT coalesce(jsonb_agg(to_jsonb(x)),''[]''::jsonb) FROM(SELECT %s FROM %s WHERE %s%s LIMIT %s OFFSET %s)x',selected,source,predicate,ordering,lim,off) INTO rows;
 ELSE
  IF op IN('insert','update') THEN
   IF jsonb_typeof(payload)<>'object' THEN RAISE EXCEPTION 'Payload inválido.';END IF;
   IF op='insert' THEN
    IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=p_table AND column_name='owner_id') THEN payload:=payload||jsonb_build_object('owner_id',CASE WHEN p_table='meetings' THEN p_ws ELSE p_user END);END IF;
    IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=p_table AND column_name='workspace_id') THEN payload:=payload||jsonb_build_object('workspace_id',p_ws);END IF;
   END IF;
   FOR key IN SELECT jsonb_object_keys(payload) LOOP
    IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=p_table AND column_name=key) THEN RAISE EXCEPTION 'Campo da API inválido.';END IF;
    columns:=array_append(columns,quote_ident(key));
   END LOOP;
  END IF;
  IF op='insert' THEN
   SELECT array_agg('(jsonb_populate_record(NULL::public.'||quote_ident(p_table)||',$1)).'||x) INTO selections FROM unnest(columns)x;
   sql:=format('INSERT INTO public.%I(%s) SELECT %s RETURNING %s',p_table,array_to_string(columns,','),array_to_string(selections,','),returning_selection);
  ELSIF op='update' THEN
   SELECT array_agg(x||'=(jsonb_populate_record(NULL::public.'||quote_ident(p_table)||',$1)).'||x) INTO selections FROM unnest(columns)x;
   sql:=format('UPDATE public.%I SET %s WHERE %s RETURNING %s',p_table,array_to_string(selections,','),predicate,returning_selection);
  ELSE sql:=format('DELETE FROM public.%I WHERE %s RETURNING %s',p_table,predicate,returning_selection);END IF;
  EXECUTE 'WITH changed AS ('||sql||') SELECT coalesce(jsonb_agg(to_jsonb(x)),''[]''::jsonb),count(*) FROM changed x' INTO rows,n USING payload;
  IF p_table IN('leads','contacts','deals','deal_line_items') THEN
   SELECT array_agg((x->>'id')::uuid) INTO field_ids FROM jsonb_array_elements(rows)x;
   IF op='delete' THEN
    SELECT coalesce(jsonb_agg(x->'row'),'[]') INTO rows FROM jsonb_array_elements(before_rows)x WHERE (x->>'key')::uuid=ANY(field_ids);
   ELSE
    EXECUTE format('SELECT coalesce(jsonb_agg(to_jsonb(x)),''[]'') FROM(SELECT %s FROM %s WHERE id=ANY($1))x',selected,source) INTO rows USING field_ids;
   END IF;
  END IF;
 END IF;
 rows:=public.shared_field_mask_rows(p_table,rows); PERFORM techerp_api.leave();RETURN jsonb_build_object('data',rows,'count',n);
EXCEPTION WHEN OTHERS THEN
 -- enter/leave state lives inside this transaction; failed calls roll back.
 RAISE;
END $$;
CREATE OR REPLACE FUNCTION techerp_api.sales_source_query(p_source text,p_key uuid,p_user uuid,p_ws uuid,p_table text,p_query jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE field_ids uuid[];before_rows jsonb;returning_selection text;op text:=coalesce(p_query->>'operation','select');filters jsonb:=coalesce(p_query->'filters','[]');payload jsonb:=p_query->'payload';f jsonb;columns text[];selections text[];key text;predicate text:='true';ordering text:='';selected text;sql text;source text;resource text;rows jsonb;n bigint;denied boolean;lim integer:=least(greatest(coalesce((p_query->>'limit')::integer,200),0),1000);off integer:=greatest(coalesce((p_query->>'offset')::integer,0),0);BEGIN
 IF p_table NOT IN('leads','contacts','companies','deals','tickets','activities','pipelines','deal_contacts','enrichment_jobs','enrichment_job_items','hubspot_sync_state','custom_reports','subscriptions') OR op NOT IN('select','insert','update','delete','authorize','authorize_export') THEN RAISE EXCEPTION 'Operação da API indisponível.' USING ERRCODE='42501';END IF;
 IF current_setting('app.api_subject',true)='on' THEN RAISE EXCEPTION 'Contexto aninhado.' USING ERRCODE='42501';END IF;
 INSERT INTO techerp_api.subject_sessions(txid,user_id,workspace_id,api_key_id,prev_claims) VALUES(txid_current(),p_user,p_ws,p_key,current_setting('request.jwt.claims',true));
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',p_user,'role','authenticated','aud','authenticated')::text,true);
 PERFORM set_config('request.jwt.claim.sub',p_user::text,true);PERFORM set_config('request.jwt.claim.role','authenticated',true);PERFORM set_config('app.api_subject','on',true);
 IF p_source='report_schedules' THEN
  IF p_table NOT IN('leads','contacts','deals','tickets','activities','custom_reports','subscriptions') OR op NOT IN('select','authorize_export') OR NOT sales_record_access('report_schedules',p_key,'view') OR NOT sales_record_access('report_schedules',p_key,'update') OR NOT EXISTS(SELECT 1 FROM report_schedules rs WHERE rs.id=p_key AND sales_record_access('custom_reports',rs.report_id,'export')) THEN RAISE EXCEPTION 'Exportação sem autorização atual.' USING ERRCODE='42501';END IF;
 ELSIF p_table IN('custom_reports','subscriptions') OR op='authorize_export' THEN RAISE EXCEPTION 'Operação restrita a exportação autorizada.' USING ERRCODE='42501';
 ELSIF p_source='workflow_subscriptions' THEN
  IF p_table NOT IN('tickets','pipelines') OR NOT sales_record_access('workflow_subscriptions',p_key,'manage') OR NOT sales_record_access('workflow_subscriptions',p_key,'update') THEN RAISE EXCEPTION 'Automação sem autorização atual.' USING ERRCODE='42501';END IF;
 ELSIF p_source='sdr_enrollments' THEN
  IF p_table NOT IN('leads','contacts','companies','deals','activities') OR NOT sales_record_access('sdr_enrollments',p_key,'view') OR NOT sales_record_access('sdr_enrollments',p_key,'update') THEN RAISE EXCEPTION 'Ferramenta SDR indisponível para este responsável.' USING ERRCODE='42501';END IF;
 ELSE PERFORM sales_area_authorize('system.hubspot_sync','manage');END IF;
 IF p_source='integrations' AND NOT sales_record_access('integrations',p_key,'view') THEN RAISE EXCEPTION 'Integração indisponível.' USING ERRCODE='42501';END IF;
 source:='public.'||quote_ident(p_table);
 SELECT sc.resource INTO resource FROM public.sales_resource_catalog sc WHERE sc.table_name=p_table;
 IF p_table='activities' THEN resource:=CASE WHEN payload->>'type'='note' THEN 'techsales.notes' WHEN payload->>'type'='task' THEN 'techsales.tasks' ELSE 'techsales.activities' END;END IF;
 IF p_table IN('enrichment_jobs','enrichment_job_items','hubspot_sync_state') THEN resource:='system.hubspot_sync';END IF;
 IF p_table='subscriptions' THEN resource:='system.billing';END IF;
 IF resource IS NULL THEN RAISE EXCEPTION 'Tabela indisponível.' USING ERRCODE='42501';END IF;
 IF p_table='subscriptions' THEN
  IF NOT sales_context_access(sales_access_context(),p_ws,'system.billing','view',ARRAY[p_user]) OR NOT sales_context_access(sales_access_context(),p_ws,'system.billing','export',ARRAY[p_user]) THEN RAISE EXCEPTION 'Leitura/exportação de faturamento não autorizada.' USING ERRCODE='42501';END IF;
 ELSIF op<>'authorize' THEN PERFORM sales_area_authorize(resource,CASE WHEN p_table IN('enrichment_jobs','enrichment_job_items','hubspot_sync_state') THEN 'manage' ELSE CASE op WHEN 'select' THEN 'view' WHEN 'authorize_export' THEN 'view' WHEN 'insert' THEN 'create' WHEN 'delete' THEN 'delete' ELSE 'update' END END);END IF;
 IF op='authorize' THEN
  IF p_query->>'action' NOT IN('view','create','update','delete','assign','export','manage') THEN RAISE EXCEPTION 'Ação inválida.';END IF;
  IF p_query->>'record_id' IS NOT NULL THEN n:=CASE WHEN sales_record_access(p_table,(p_query->>'record_id')::uuid,p_query->>'action') THEN 1 ELSE 0 END;
  ELSE n:=CASE WHEN sales_area_authorize(resource,p_query->>'action') THEN 1 ELSE 0 END;END IF;
  PERFORM techerp_api.leave();RETURN jsonb_build_object('data',jsonb_build_array(jsonb_build_object('allowed',n=1)),'count',1);
 END IF;
 IF op='authorize_export' THEN
  IF jsonb_typeof(p_query->'record_ids')<>'array' OR jsonb_array_length(p_query->'record_ids')>5000 THEN RAISE EXCEPTION 'Prova de exportação inválida.';END IF;
  IF p_table<>'subscriptions' THEN PERFORM sales_area_authorize(resource,'export');END IF;
  sql:=format('SELECT count(*) FROM public.%I WHERE workspace_id=$1 AND id=ANY(ARRAY(SELECT value::uuid FROM jsonb_array_elements_text($2)))%s',p_table,CASE WHEN p_table='subscriptions' THEN '' ELSE format(' AND sales_record_access(%L,id,''export'')',p_table) END);
  EXECUTE sql INTO n USING p_ws,p_query->'record_ids';
  IF n<>(SELECT count(DISTINCT value) FROM jsonb_array_elements_text(p_query->'record_ids')) THEN RAISE EXCEPTION 'Permissões dos registros alteradas antes do envio.' USING ERRCODE='42501';END IF;
  PERFORM techerp_api.leave();RETURN jsonb_build_object('data',jsonb_build_array(jsonb_build_object('allowed',true)),'count',1);
 END IF;
 IF jsonb_typeof(filters)<>'array' OR jsonb_array_length(filters)>100 THEN RAISE EXCEPTION 'Filtros inválidos.';END IF;
 FOR f IN SELECT * FROM jsonb_array_elements(filters) LOOP predicate:=predicate||' AND ('||techerp_api.sales_filter(p_table,f)||')';END LOOP;
 IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=p_table AND column_name='workspace_id') THEN predicate:=predicate||format(' AND workspace_id=%L::uuid',p_ws);END IF;
 IF p_source='report_schedules' AND p_table NOT IN('custom_reports','subscriptions') THEN
  PERFORM sales_area_authorize(resource,'export');
  EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I WHERE %s AND NOT sales_record_access(%L,id,''export''))',p_table,predicate,p_table) INTO denied;
  IF denied THEN RAISE EXCEPTION 'Há registros visíveis sem autorização de exportação.' USING ERRCODE='42501';END IF;
 END IF;
 selected:=coalesce(nullif(p_query->>'select',''),'*');

 IF selected='*' THEN SELECT array_agg(column_name::text ORDER BY ordinal_position) INTO selections FROM information_schema.columns WHERE table_schema='public' AND table_name=p_table AND column_name NOT IN('portal_token','access_token','refresh_token','oauth_tokens','credentials_secret_ref','secret') AND NOT(column_name='public_token' AND p_table IN('quotes','proposals'));ELSE selections:=string_to_array(selected,',');END IF;
 FOREACH key IN ARRAY selections LOOP
  key:=trim(key);

  IF (key IN('portal_token','access_token','refresh_token','oauth_tokens','credentials_secret_ref','secret') OR (key='public_token' AND p_table IN('quotes','proposals'))) OR NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=p_table AND column_name=key) THEN RAISE EXCEPTION 'Projeção da API inválida.' USING ERRCODE='42501';END IF;
  columns:=array_append(columns,quote_ident(key));
 END LOOP;
 selected:=array_to_string(columns,',');columns:=NULL;
 returning_selection:=CASE WHEN p_table IN('leads','contacts','deals','deal_line_items') THEN 'id' ELSE selected END;
 IF p_table IN('leads','contacts','deals','deal_line_items') THEN
  source:='public.'||quote_ident('shared_fields_'||p_table);
  IF op='delete' THEN
   EXECUTE format('SELECT coalesce(jsonb_agg(jsonb_build_object(''key'',x._techid,''row'',to_jsonb(x)-''_techid'')),''[]'') FROM(SELECT id _techid,%s FROM %s WHERE %s)x',selected,source,predicate) INTO before_rows;
  END IF;
  IF op<>'select' THEN predicate:=format('id IN(SELECT id FROM %s WHERE %s)',source,predicate);END IF;
 END IF;
 IF op='select' THEN
  FOR f IN SELECT * FROM jsonb_array_elements(coalesce(p_query->'order','[]')) LOOP
   key:=f->>'column';IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=p_table AND column_name=key) OR key IN('portal_token','public_token') THEN RAISE EXCEPTION 'Ordenação inválida.';END IF;
   ordering:=ordering||CASE WHEN ordering='' THEN ' ORDER BY ' ELSE ',' END||quote_ident(key)||CASE WHEN coalesce((f->>'ascending')::boolean,true) THEN ' ASC' ELSE ' DESC' END||CASE WHEN coalesce((f->>'nullsFirst')::boolean,false) THEN ' NULLS FIRST' ELSE ' NULLS LAST' END;
  END LOOP;
  EXECUTE format('SELECT count(*) FROM %s WHERE %s',source,predicate) INTO n;
  EXECUTE format('SELECT coalesce(jsonb_agg(to_jsonb(x)),''[]''::jsonb) FROM(SELECT %s FROM %s WHERE %s%s LIMIT %s OFFSET %s)x',selected,source,predicate,ordering,lim,off) INTO rows;
 ELSE
  IF op IN('insert','update') THEN
   IF jsonb_typeof(payload)<>'object' THEN RAISE EXCEPTION 'Payload inválido.';END IF;
   IF payload?'workspace_id' AND payload->>'workspace_id' IS DISTINCT FROM p_ws::text THEN RAISE EXCEPTION 'Workspace de destino inválido.' USING ERRCODE='42501';END IF;
   IF op='insert' THEN
    IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=p_table AND column_name='owner_id') THEN payload:=payload||jsonb_build_object('owner_id',CASE WHEN p_table='meetings' THEN p_ws ELSE p_user END);END IF;
    IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=p_table AND column_name='workspace_id') THEN payload:=payload||jsonb_build_object('workspace_id',p_ws);END IF;
   END IF;
   IF op='update' AND payload ?| ARRAY['id','workspace_id','owner_id'] THEN RAISE EXCEPTION 'Autoria e origem imutáveis.' USING ERRCODE='42501';END IF;
   FOR key IN SELECT jsonb_object_keys(payload) LOOP
    IF key IN('portal_token','public_token','access_token','refresh_token','oauth_tokens','credentials_secret_ref','secret') THEN RAISE EXCEPTION 'Campo privado.' USING ERRCODE='42501';END IF;
    IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=p_table AND column_name=key) THEN RAISE EXCEPTION 'Campo da API inválido.';END IF;
    columns:=array_append(columns,quote_ident(key));
   END LOOP;
  END IF;
  IF op='insert' THEN
   SELECT array_agg('(jsonb_populate_record(NULL::public.'||quote_ident(p_table)||',$1)).'||x) INTO selections FROM unnest(columns)x;
   sql:=format('INSERT INTO public.%I(%s) SELECT %s RETURNING %s',p_table,array_to_string(columns,','),array_to_string(selections,','),returning_selection);
  ELSIF op='update' THEN
   SELECT array_agg(x||'=(jsonb_populate_record(NULL::public.'||quote_ident(p_table)||',$1)).'||x) INTO selections FROM unnest(columns)x;
   sql:=format('UPDATE public.%I SET %s WHERE %s RETURNING %s',p_table,array_to_string(selections,','),predicate,returning_selection);
  ELSE sql:=format('DELETE FROM public.%I WHERE %s RETURNING %s',p_table,predicate,returning_selection);END IF;
  EXECUTE 'WITH changed AS ('||sql||') SELECT coalesce(jsonb_agg(to_jsonb(x)),''[]''::jsonb),count(*) FROM changed x' INTO rows,n USING payload;
  IF p_table IN('leads','contacts','deals','deal_line_items') THEN
   SELECT array_agg((x->>'id')::uuid) INTO field_ids FROM jsonb_array_elements(rows)x;
   IF op='delete' THEN
    SELECT coalesce(jsonb_agg(x->'row'),'[]') INTO rows FROM jsonb_array_elements(before_rows)x WHERE (x->>'key')::uuid=ANY(field_ids);
   ELSE
    EXECUTE format('SELECT coalesce(jsonb_agg(to_jsonb(x)),''[]'') FROM(SELECT %s FROM %s WHERE id=ANY($1))x',selected,source) INTO rows USING field_ids;
   END IF;
  END IF;
 END IF;
 IF op IN('update','delete') AND n=0 THEN RAISE EXCEPTION 'Registro indisponível ou sem permissão para a ação.' USING ERRCODE='42501';END IF;
 rows:=public.shared_field_mask_rows(p_table,rows); PERFORM techerp_api.leave();RETURN jsonb_build_object('data',rows,'count',n);
EXCEPTION WHEN OTHERS THEN
 -- enter/leave state lives inside this transaction; failed calls roll back.
 RAISE;
END $$;

-- Existing ATS financial-term permissions remain mandatory; field restrictions can
-- additionally reduce access, never grant private terms or publication authority.
DO $patch$DECLARE body text;BEGIN
 SELECT pg_get_functiondef('public.ats_offer_action_access(jsonb,text)'::regprocedure) INTO body;
 IF position($needle$ IF _action IN('terms_view','terms_update') THEN$needle$ IN body)=0 THEN RAISE EXCEPTION 'Unexpected ATS terms guard';END IF;
 body:=replace(body,$old$ IF _action IN('terms_view','terms_update') THEN$old$,$new$ IF _action IN('terms_view','terms_update') THEN
  IF (public.shared_field_context()->'rules'->'techhire.offers'->>'salary_amount') IN('hidden','masked') OR (_action='terms_update' AND public.shared_field_context()->'rules'->'techhire.offers'->>'salary_amount'='readonly') THEN RETURN false;END IF;$new$);
 EXECUTE body;
 SELECT pg_get_functiondef('public.ats_offer_projection(uuid,uuid)'::regprocedure) INTO body;
 IF position('RETURN NEXT out_row;' IN body)=0 THEN RAISE EXCEPTION 'Unexpected ATS projection';END IF;
 body:=replace(body,'RETURN NEXT out_row;',$new$RETURN NEXT public.shared_field_mask_row('ats_offers',out_row);$new$);
 body:=replace(body,'FROM ats_candidates c WHERE','FROM public.shared_fields_ats_candidates c WHERE');
 EXECUTE body;
END $patch$;
CREATE OR REPLACE FUNCTION public.sales_portal_contacts()
RETURNS TABLE(id uuid,first_name text,last_name text,email text,portal_enabled boolean,portal_token text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb:=sales_access_context();BEGIN
 IF coalesce((c->>'read_only')::boolean,true) OR NOT(c->'keys'?'system.portal.manage.workspace') THEN RAISE EXCEPTION 'Sem permissão para gerenciar o portal.' USING ERRCODE='42501';END IF;
 RETURN QUERY SELECT x.id,x.first_name,x.last_name,x.email,t.portal_enabled,t.portal_token FROM public.shared_fields_contacts x JOIN public.contacts t ON t.id=x.id WHERE x.workspace_id=(c->>'workspace')::uuid ORDER BY x.first_name,x.id LIMIT 1000;
END $$;
CREATE TRIGGER zzz_shared_field_rule_admin BEFORE INSERT OR UPDATE OR DELETE ON public.field_permission_rules FOR EACH ROW EXECUTE FUNCTION public.shared_field_rule_admin_guard();
