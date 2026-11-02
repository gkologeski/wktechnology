-- Dynamic audiences are subscriptions to an immutable version, never to an edited draft.
CREATE TABLE public.prospecting_sequence_subscriptions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
 version_id uuid NOT NULL UNIQUE REFERENCES public.prospecting_sequence_versions(id),owner_id uuid NOT NULL REFERENCES auth.users(id),
 enabled boolean NOT NULL DEFAULT false,consent_evidence text NOT NULL CHECK(length(btrim(consent_evidence)) BETWEEN 10 AND 2000),
 next_scan_at timestamptz NOT NULL DEFAULT now(),lease_token uuid,lease_until timestamptz,request_id uuid,
 fingerprint text,last_scan_at timestamptz,last_count integer NOT NULL DEFAULT 0,last_held integer NOT NULL DEFAULT 0,last_reasons jsonb NOT NULL DEFAULT '{}',
 error_code text,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sequence_subscriptions_due ON public.prospecting_sequence_subscriptions(next_scan_at) WHERE enabled;
ALTER TABLE public.prospecting_sequence_subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.prospecting_sequence_subscriptions FROM PUBLIC,anon,authenticated;
GRANT SELECT(id,workspace_id,version_id,owner_id,enabled,next_scan_at,last_scan_at,error_code,created_at,updated_at) ON public.prospecting_sequence_subscriptions TO authenticated;
GRANT SELECT,DELETE ON public.prospecting_sequence_subscriptions TO service_role;
CREATE POLICY sequence_subscriptions_read ON public.prospecting_sequence_subscriptions FOR SELECT TO authenticated USING(public.sales_context_access((SELECT public.sales_access_context()),workspace_id,'system.automation.sequences','view',ARRAY[owner_id]) AND EXISTS(SELECT 1 FROM public.prospecting_sequence_versions v WHERE v.id=version_id));
CREATE FUNCTION public.prospecting_sequence_subscription_set(p_workspace uuid,p_version uuid,p_enabled boolean,p_consent text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v public.prospecting_sequence_versions;s public.prospecting_sequence_subscriptions;ctx jsonb;result uuid;BEGIN
 ctx:=public.sales_access_context();
 IF p_enabled IS NULL THEN RAISE EXCEPTION 'Situação inválida.' USING ERRCODE='22023';END IF;
 SELECT * INTO v FROM public.prospecting_sequence_versions WHERE id=p_version AND workspace_id=p_workspace FOR SHARE;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_version::text,301));
 SELECT * INTO s FROM public.prospecting_sequence_subscriptions WHERE version_id=p_version FOR UPDATE;
 IF v.id IS NULL OR ctx->>'workspace' IS DISTINCT FROM p_workspace::text OR coalesce((ctx->>'read_only')::boolean,false) OR NOT public.prospecting_sequence_runtime_allowed(p_workspace,auth.uid(),v.owner_id,'manage') OR (p_enabled AND (NOT public.prospecting_sequence_runtime_allowed(p_workspace,auth.uid(),v.owner_id,'assign') OR NOT public.prospecting_sequence_runtime_allowed(p_workspace,auth.uid(),auth.uid(),'manage') OR NOT public.prospecting_sequence_runtime_allowed(p_workspace,auth.uid(),auth.uid(),'assign'))) OR (s.id IS NOT NULL AND NOT public.prospecting_sequence_runtime_allowed(p_workspace,auth.uid(),s.owner_id,'manage')) THEN RAISE EXCEPTION 'Entrada dinâmica indisponível.' USING ERRCODE='42501';END IF;
 IF p_enabled AND (v.definition#>>'{audience,entry}' IS DISTINCT FROM 'dynamic' OR length(btrim(p_consent)) NOT BETWEEN 10 AND 2000 OR p_consent IS NULL) THEN RAISE EXCEPTION 'Versão ou autorização de contato inválida.' USING ERRCODE='22023';END IF;
 IF NOT p_enabled THEN UPDATE public.prospecting_sequence_subscriptions SET enabled=false,lease_token=NULL,lease_until=NULL,error_code=NULL,updated_at=now() WHERE id=s.id;RETURN s.id;END IF;
 INSERT INTO public.prospecting_sequence_subscriptions(workspace_id,version_id,owner_id,enabled,consent_evidence) VALUES(p_workspace,p_version,auth.uid(),true,btrim(p_consent))
 ON CONFLICT(version_id) DO UPDATE SET enabled=true,owner_id=auth.uid(),consent_evidence=excluded.consent_evidence,next_scan_at=now(),lease_token=NULL,lease_until=NULL,error_code=NULL,updated_at=now() RETURNING id INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.prospecting_sequence_subscription_set(uuid,uuid,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.prospecting_sequence_subscription_set(uuid,uuid,boolean,text) TO authenticated;

SET ROLE techerp_api_subject;
CREATE FUNCTION techerp_api.sequence_dynamic_ids(p_workspace uuid,p_actor uuid,p_base text,p_groups jsonb,p_logic text)
RETURNS uuid[] LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result uuid[];g jsonb;f jsonb;BEGIN
 IF current_setting('app.api_subject',true)='on' OR p_base NOT IN('leads','contacts') OR jsonb_typeof(p_groups) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Contexto do público inválido.' USING ERRCODE='42501';END IF;
 INSERT INTO techerp_api.subject_sessions(txid,user_id,workspace_id,api_key_id,prev_claims) VALUES(txid_current(),p_actor,p_workspace,gen_random_uuid(),current_setting('request.jwt.claims',true));
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',p_actor,'role','authenticated','aud','authenticated')::text,true);
 PERFORM set_config('request.jwt.claim.sub',p_actor::text,true);PERFORM set_config('request.jwt.claim.role','authenticated',true);PERFORM set_config('app.api_subject','on',true);
 PERFORM public.sales_area_authorize('techsales.'||p_base,'view',NULL,NULL);
 FOR g IN SELECT value FROM jsonb_array_elements(p_groups) LOOP
  FOR f IN SELECT value FROM jsonb_array_elements(g->'filters') LOOP
   IF nullif(f->>'custom_key','') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.custom_properties p WHERE p.workspace_id=p_workspace AND p.entity=coalesce(f->>'entity',p_base) AND p.key=f->>'custom_key' AND p.enabled) THEN RAISE EXCEPTION 'Campo personalizado indisponível.' USING ERRCODE='42501';END IF;
  END LOOP;
 END LOOP;
 IF jsonb_array_length(p_groups)=0 THEN
  IF p_base='contacts' THEN SELECT coalesce(array_agg(id),'{}'::uuid[]) INTO result FROM(SELECT id FROM public.contacts WHERE workspace_id=p_workspace AND deleted_at IS NULL ORDER BY id LIMIT 5001) a;
  ELSE SELECT coalesce(array_agg(id),'{}'::uuid[]) INTO result FROM(SELECT id FROM public.leads WHERE workspace_id=p_workspace AND deleted_at IS NULL ORDER BY id LIMIT 5001) a;END IF;
 ELSE result:=public.wa_campaign_audience_ids(p_workspace,p_base,p_groups,p_logic,5001);END IF;
 PERFORM techerp_api.leave();RETURN coalesce(result,'{}'::uuid[]);
END $$;
REVOKE ALL ON FUNCTION techerp_api.sequence_dynamic_ids(uuid,uuid,text,jsonb,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION techerp_api.sequence_dynamic_ids(uuid,uuid,text,jsonb,text) TO postgres;
RESET ROLE;

CREATE FUNCTION public.prospecting_sequence_subscription_claim(p_limit integer DEFAULT 1)
RETURNS SETOF public.prospecting_sequence_subscriptions LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE s public.prospecting_sequence_subscriptions;v public.prospecting_sequence_versions;BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Serviço requerido.' USING ERRCODE='42501';END IF;
 FOR s IN SELECT * FROM public.prospecting_sequence_subscriptions WHERE enabled AND next_scan_at<=now() AND (lease_until IS NULL OR lease_until<now()) ORDER BY next_scan_at,id LIMIT least(greatest(p_limit,1),5) FOR UPDATE SKIP LOCKED LOOP
  SELECT * INTO v FROM public.prospecting_sequence_versions WHERE id=s.version_id AND workspace_id=s.workspace_id;
  IF v.id IS NULL OR NOT public.prospecting_sequence_runtime_allowed(s.workspace_id,s.owner_id,v.owner_id,'manage') OR NOT public.prospecting_sequence_runtime_allowed(s.workspace_id,s.owner_id,v.owner_id,'assign') OR NOT public.prospecting_sequence_runtime_allowed(s.workspace_id,s.owner_id,s.owner_id,'manage') OR NOT public.prospecting_sequence_runtime_allowed(s.workspace_id,s.owner_id,s.owner_id,'assign') THEN
   UPDATE public.prospecting_sequence_subscriptions SET enabled=false,error_code='authorization_unavailable',lease_token=NULL,lease_until=NULL,updated_at=now() WHERE id=s.id;CONTINUE;
  END IF;
  UPDATE public.prospecting_sequence_subscriptions SET lease_token=gen_random_uuid(),lease_until=now()+interval '5 minutes',request_id=gen_random_uuid(),updated_at=now() WHERE id=s.id RETURNING * INTO s;
  RETURN NEXT s;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.prospecting_sequence_subscription_claim(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prospecting_sequence_subscription_claim(integer) TO service_role;

CREATE FUNCTION public.prospecting_sequence_subscription_candidates(p_subscription uuid,p_lease uuid,p_groups jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE s public.prospecting_sequence_subscriptions;v public.prospecting_sequence_versions;ids uuid[];unseen uuid[];refs jsonb;sources jsonb;epoch timestamptz;BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Serviço requerido.' USING ERRCODE='42501';END IF;
 SELECT * INTO s FROM public.prospecting_sequence_subscriptions WHERE id=p_subscription AND enabled AND lease_token=p_lease AND lease_until>now();
 SELECT * INTO v FROM public.prospecting_sequence_versions WHERE id=s.version_id AND workspace_id=s.workspace_id;
 IF s.id IS NULL OR v.id IS NULL OR NOT public.prospecting_sequence_runtime_allowed(s.workspace_id,s.owner_id,v.owner_id,'manage') OR NOT public.prospecting_sequence_runtime_allowed(s.workspace_id,s.owner_id,v.owner_id,'assign') THEN RAISE EXCEPTION 'Entrada dinâmica indisponível.' USING ERRCODE='42501';END IF;
 ids:=techerp_api.sequence_dynamic_ids(s.workspace_id,s.owner_id,v.definition#>>'{audience,base}',p_groups,v.definition#>>'{audience,groupsLogic}');
 IF cardinality(ids)>5000 THEN RAISE EXCEPTION 'O público dinâmico excede 5.000 registros. Refine os filtros; nenhum lote parcial foi iniciado.' USING ERRCODE='22023';END IF;
 SELECT coalesce(array_agg(candidate.id),'{}'::uuid[]) INTO unseen FROM unnest(ids) candidate(id) WHERE NOT EXISTS(SELECT 1 FROM public.prospecting_sequence_cohort_people p JOIN public.prospecting_sequence_cohorts c ON c.id=p.cohort_id WHERE c.version_id=v.id AND p.source_id=candidate.id AND p.entity=CASE v.definition#>>'{audience,base}' WHEN 'contacts' THEN 'contact' ELSE 'lead' END AND (p.block_reason IS NULL OR p.block_reason='duplicate'));
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'entity',CASE v.definition#>>'{audience,base}' WHEN 'contacts' THEN 'contact' ELSE 'lead' END)),'[]') INTO refs FROM unnest(unseen) id;
 sources:=techerp_api.sequence_audience_source(s.workspace_id,s.owner_id,refs);
 IF (SELECT count(*) FROM jsonb_object_keys(sources))<>cardinality(unseen) THEN RAISE EXCEPTION 'A visibilidade do público mudou. Nenhum lote parcial foi iniciado.' USING ERRCODE='42501';END IF;
 -- Eligibility is re-evaluated on every scan; a timestamp cache may miss opt-in/deletion changes.
 epoch:=NULL;
 RETURN jsonb_build_object('definition',v.definition,'sources',sources,'matchedCount',cardinality(ids),'policyClock',epoch);
END $$;
REVOKE ALL ON FUNCTION public.prospecting_sequence_subscription_candidates(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prospecting_sequence_subscription_candidates(uuid,uuid,jsonb) TO service_role;

CREATE FUNCTION public.prospecting_sequence_subscription_commit(p_subscription uuid,p_lease uuid,p_fingerprint text,p_matched integer,p_candidates jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE s public.prospecting_sequence_subscriptions;v public.prospecting_sequence_versions;batch jsonb;started integer:=0;BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Serviço requerido.' USING ERRCODE='42501';END IF;
 SELECT * INTO s FROM public.prospecting_sequence_subscriptions WHERE id=p_subscription AND enabled AND lease_token=p_lease AND lease_until>now() FOR UPDATE;
 SELECT * INTO v FROM public.prospecting_sequence_versions WHERE id=s.version_id AND workspace_id=s.workspace_id;
 IF s.id IS NULL OR v.id IS NULL OR NOT public.prospecting_sequence_runtime_allowed(s.workspace_id,s.owner_id,v.owner_id,'manage') OR NOT public.prospecting_sequence_runtime_allowed(s.workspace_id,s.owner_id,v.owner_id,'assign') OR NOT public.prospecting_sequence_runtime_allowed(s.workspace_id,s.owner_id,s.owner_id,'manage') OR NOT public.prospecting_sequence_runtime_allowed(s.workspace_id,s.owner_id,s.owner_id,'assign') THEN RAISE EXCEPTION 'Entrada dinâmica indisponível.' USING ERRCODE='42501';END IF;
 IF p_fingerprint IS NULL OR p_fingerprint!~'^[0-9a-f]{64}$' OR p_matched IS NULL OR p_matched NOT BETWEEN 0 AND 5000 OR jsonb_typeof(p_candidates) IS DISTINCT FROM 'array' OR jsonb_array_length(p_candidates)>5000 THEN RAISE EXCEPTION 'Lote inválido.' USING ERRCODE='22023';END IF;
 IF jsonb_array_length(p_candidates)>0 THEN
  BEGIN
   batch:=public.prospecting_sequence_cohort_prepare(s.workspace_id,s.owner_id,s.version_id,s.request_id,s.consent_evidence,p_candidates);
   IF coalesce((batch->>'held')::integer,0)=0 THEN RAISE EXCEPTION 'eligibility_preview_only' USING ERRCODE='P0301';END IF;
   INSERT INTO public.prospecting_sequence_runs(workspace_id,cohort_person_id,version_id,owner_id)
   SELECT s.workspace_id,p.id,s.version_id,s.owner_id FROM public.prospecting_sequence_cohort_people p WHERE p.cohort_id=(batch->>'id')::uuid AND p.workspace_id=s.workspace_id AND p.block_reason IS NULL ON CONFLICT(cohort_person_id) DO NOTHING;
   GET DIAGNOSTICS started=ROW_COUNT;
  EXCEPTION WHEN SQLSTATE 'P0301' THEN
   -- Roll back the preview subtransaction instead of retaining identical fully-blocked snapshots.
   -- No external effect exists here; the common writer remains authoritative for all exclusions.
   started:=0;
  END;
 END IF;
 UPDATE public.prospecting_sequence_subscriptions SET fingerprint=p_fingerprint,last_scan_at=now(),next_scan_at=now()+interval '15 minutes',last_count=p_matched,last_held=started,last_reasons=coalesce(batch->'reasons','{}'::jsonb),error_code=NULL,lease_token=NULL,lease_until=NULL,updated_at=now() WHERE id=s.id;
 RETURN jsonb_build_object('started',started,'matched',p_matched);
END $$;
REVOKE ALL ON FUNCTION public.prospecting_sequence_subscription_commit(uuid,uuid,text,integer,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prospecting_sequence_subscription_commit(uuid,uuid,text,integer,jsonb) TO service_role;
CREATE FUNCTION public.prospecting_sequence_subscription_error(p_subscription uuid,p_lease uuid,p_error text DEFAULT 'scan_unavailable')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Serviço requerido.' USING ERRCODE='42501';END IF;
 UPDATE public.prospecting_sequence_subscriptions SET error_code=CASE WHEN p_error='audience_limit' THEN p_error ELSE 'scan_unavailable' END,enabled=CASE WHEN p_error='audience_limit' THEN false ELSE enabled END,next_scan_at=now()+interval '15 minutes',lease_token=NULL,lease_until=NULL,updated_at=now() WHERE id=p_subscription AND lease_token=p_lease;
END $$;
REVOKE ALL ON FUNCTION public.prospecting_sequence_subscription_error(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prospecting_sequence_subscription_error(uuid,uuid,text) TO service_role;

-- Counts describe the execution actor's historical scan, and are private to that actor.
CREATE FUNCTION public.prospecting_sequence_subscription_status(p_workspace uuid,p_version uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE s public.prospecting_sequence_subscriptions;v public.prospecting_sequence_versions;ctx jsonb;BEGIN
 ctx:=public.sales_access_context();
 SELECT * INTO s FROM public.prospecting_sequence_subscriptions WHERE workspace_id=p_workspace AND version_id=p_version;
 SELECT * INTO v FROM public.prospecting_sequence_versions WHERE id=p_version AND workspace_id=p_workspace;
 IF auth.uid() IS NULL OR ctx->>'workspace' IS DISTINCT FROM p_workspace::text OR s.id IS NULL OR v.id IS NULL OR NOT public.sales_context_access(ctx,p_workspace,'system.automation.sequences','view',ARRAY[s.owner_id]) OR NOT public.sales_context_access(ctx,p_workspace,'system.automation.sequences','view',ARRAY[v.owner_id]) THEN RETURN NULL;END IF;
 RETURN jsonb_build_object('id',s.id,'ownerId',s.owner_id,'enabled',s.enabled,'lastScanAt',s.last_scan_at,'nextScanAt',s.next_scan_at,'errorCode',s.error_code,'matched',CASE WHEN s.last_scan_at IS NOT NULL AND (auth.uid()=s.owner_id OR public.is_workspace_admin(p_workspace,auth.uid())) THEN s.last_count END,'started',CASE WHEN s.last_scan_at IS NOT NULL AND (auth.uid()=s.owner_id OR public.is_workspace_admin(p_workspace,auth.uid())) THEN s.last_held END,'reasons',CASE WHEN s.last_scan_at IS NOT NULL AND (auth.uid()=s.owner_id OR public.is_workspace_admin(p_workspace,auth.uid())) THEN s.last_reasons END);
END $$;
REVOKE ALL ON FUNCTION public.prospecting_sequence_subscription_status(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.prospecting_sequence_subscription_status(uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.prospecting_sequence_start(p_workspace uuid,p_cohort uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c public.prospecting_sequence_cohorts;ctx jsonb;n integer;source_rows jsonb;visible jsonb;BEGIN
 ctx:=public.sales_access_context();
 SELECT * INTO c FROM public.prospecting_sequence_cohorts WHERE id=p_cohort AND workspace_id=p_workspace FOR SHARE;
 IF c.id IS NULL OR ctx->>'workspace' IS DISTINCT FROM p_workspace::text OR coalesce((ctx->>'read_only')::boolean,false) OR NOT public.prospecting_sequence_runtime_allowed(p_workspace,auth.uid(),c.owner_id,'manage') OR NOT public.prospecting_sequence_runtime_allowed(p_workspace,auth.uid(),c.owner_id,'assign') OR NOT public.prospecting_sequence_runtime_allowed(p_workspace,auth.uid(),auth.uid(),'manage') OR NOT public.prospecting_sequence_runtime_allowed(p_workspace,auth.uid(),auth.uid(),'assign') THEN RAISE EXCEPTION 'Inscrição sem autorização atual.' USING ERRCODE='42501';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_cohort::text,295));
 IF EXISTS(SELECT 1 FROM public.prospecting_sequence_cohort_controls WHERE cohort_id=c.id AND workspace_id=p_workspace) THEN RAISE EXCEPTION 'Inscrição cancelada.' USING ERRCODE='22023';END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',source_id,'entity',entity)),'[]') INTO source_rows FROM public.prospecting_sequence_cohort_people WHERE cohort_id=c.id AND block_reason IS NULL;
 visible:=techerp_api.sequence_audience_source(p_workspace,auth.uid(),source_rows);
 IF (SELECT count(*) FROM jsonb_object_keys(visible))<>jsonb_array_length(source_rows) THEN RAISE EXCEPTION 'Acesso ao público alterado; não foi iniciada execução parcial.' USING ERRCODE='42501';END IF;
 INSERT INTO public.prospecting_sequence_runs(workspace_id,cohort_person_id,version_id,owner_id)
 SELECT p_workspace,p.id,c.version_id,auth.uid() FROM public.prospecting_sequence_cohort_people p WHERE p.cohort_id=c.id AND p.block_reason IS NULL ON CONFLICT(cohort_person_id) DO NOTHING;
 GET DIAGNOSTICS n=ROW_COUNT;RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.prospecting_sequence_start(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.prospecting_sequence_start(uuid,uuid) TO authenticated;
-- Only schema/property metadata is granted to the NOBYPASSRLS subject reader.
GRANT SELECT(entity,key,label,workspace_id,enabled) ON public.custom_properties TO techerp_api_subject;
SET ROLE techerp_api_subject;
CREATE FUNCTION techerp_api.sequence_dynamic_catalog(p_workspace uuid,p_actor uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE columns jsonb:='{}';custom jsonb;entity text;rows jsonb;BEGIN
 IF current_setting('app.api_subject',true)='on' THEN RAISE EXCEPTION 'Nested audience context forbidden' USING ERRCODE='42501';END IF;
 INSERT INTO techerp_api.subject_sessions(txid,user_id,workspace_id,api_key_id,prev_claims) VALUES(txid_current(),p_actor,p_workspace,gen_random_uuid(),current_setting('request.jwt.claims',true));
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',p_actor,'role','authenticated','aud','authenticated')::text,true);
 PERFORM set_config('request.jwt.claim.sub',p_actor::text,true);PERFORM set_config('request.jwt.claim.role','authenticated',true);PERFORM set_config('app.api_subject','on',true);
 FOREACH entity IN ARRAY ARRAY['leads','contacts','companies','deals'] LOOP
  SELECT coalesce(jsonb_agg(to_jsonb(field)),'[]') INTO rows FROM public.get_entity_field_catalog(entity,p_actor) field;
  columns:=columns||jsonb_build_object(entity,rows);
 END LOOP;
 SELECT coalesce(jsonb_agg(jsonb_build_object('entity',p.entity,'key',p.key,'label',p.label)),'[]') INTO custom FROM public.custom_properties p WHERE p.workspace_id=p_workspace AND p.enabled AND p.entity IN('leads','contacts','companies','deals');
 PERFORM techerp_api.leave();RETURN jsonb_build_object('columns',columns,'custom',custom);
END $$;
REVOKE ALL ON FUNCTION techerp_api.sequence_dynamic_catalog(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION techerp_api.sequence_dynamic_catalog(uuid,uuid) TO postgres;
RESET ROLE;
CREATE FUNCTION public.prospecting_sequence_subscription_catalog(p_subscription uuid,p_lease uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE s public.prospecting_sequence_subscriptions;v public.prospecting_sequence_versions;BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Serviço requerido.' USING ERRCODE='42501';END IF;
 SELECT * INTO s FROM public.prospecting_sequence_subscriptions WHERE id=p_subscription AND enabled AND lease_token=p_lease AND lease_until>now();
 SELECT * INTO v FROM public.prospecting_sequence_versions WHERE id=s.version_id AND workspace_id=s.workspace_id;
 IF s.id IS NULL OR v.id IS NULL OR NOT public.prospecting_sequence_runtime_allowed(s.workspace_id,s.owner_id,v.owner_id,'manage') OR NOT public.prospecting_sequence_runtime_allowed(s.workspace_id,s.owner_id,v.owner_id,'assign') THEN RAISE EXCEPTION 'Entrada dinâmica indisponível.' USING ERRCODE='42501';END IF;
 RETURN techerp_api.sequence_dynamic_catalog(s.workspace_id,s.owner_id);
END $$;
REVOKE ALL ON FUNCTION public.prospecting_sequence_subscription_catalog(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prospecting_sequence_subscription_catalog(uuid,uuid) TO service_role;
