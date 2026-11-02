-- Held audience snapshots, never an executable queue. Only the server can prepare them.
CREATE TABLE public.prospecting_sequence_cohorts(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
 version_id uuid NOT NULL REFERENCES public.prospecting_sequence_versions(id), owner_id uuid NOT NULL REFERENCES auth.users(id),
 created_by uuid NOT NULL REFERENCES auth.users(id), request_id uuid NOT NULL, consent_evidence text NOT NULL CHECK(length(btrim(consent_evidence)) BETWEEN 10 AND 2000),
 requested integer NOT NULL CHECK(requested BETWEEN 0 AND 5000), state text NOT NULL DEFAULT 'held' CHECK(state='held'), created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,request_id),UNIQUE(id,workspace_id)
);
CREATE INDEX prospecting_sequence_cohorts_version ON public.prospecting_sequence_cohorts(workspace_id,version_id,created_at DESC);
CREATE TABLE public.prospecting_sequence_cohort_people(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), cohort_id uuid NOT NULL,workspace_id uuid NOT NULL,
 entity text NOT NULL CHECK(entity IN('lead','contact')), source_id uuid NOT NULL,
 channels jsonb NOT NULL CHECK(jsonb_typeof(channels)='object'), identity_keys text[] NOT NULL,
 block_reason text CHECK(block_reason IN('opt_out','customer','open_deal','duplicate','other_sequence','missing_channel')),
 UNIQUE(cohort_id,entity,source_id),FOREIGN KEY(cohort_id,workspace_id) REFERENCES public.prospecting_sequence_cohorts(id,workspace_id)
);
CREATE INDEX prospecting_sequence_cohort_people_run ON public.prospecting_sequence_cohort_people(cohort_id);
CREATE INDEX prospecting_sequence_cohort_people_keys ON public.prospecting_sequence_cohort_people USING gin(identity_keys) WHERE block_reason IS NULL OR block_reason='duplicate';
ALTER TABLE public.prospecting_sequence_cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospecting_sequence_cohort_people ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.prospecting_sequence_cohorts,public.prospecting_sequence_cohort_people FROM PUBLIC,anon,authenticated;
GRANT SELECT(id,workspace_id,version_id,owner_id,created_by,request_id,requested,state,created_at) ON public.prospecting_sequence_cohorts TO authenticated;
GRANT SELECT(id,cohort_id,workspace_id,entity,source_id,channels,block_reason) ON public.prospecting_sequence_cohort_people TO authenticated;
GRANT SELECT,DELETE ON public.prospecting_sequence_cohorts,public.prospecting_sequence_cohort_people TO service_role;
CREATE POLICY sequence_cohorts_read ON public.prospecting_sequence_cohorts FOR SELECT TO authenticated
 USING(public.sales_context_access((SELECT public.sales_access_context()),workspace_id,'system.automation.sequences','view',ARRAY[owner_id]));
CREATE POLICY sequence_cohort_people_read ON public.prospecting_sequence_cohort_people FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.prospecting_sequence_cohorts c WHERE c.id=cohort_id AND c.workspace_id=prospecting_sequence_cohort_people.workspace_id)
 AND CASE entity WHEN 'contact' THEN EXISTS(SELECT 1 FROM public.contacts c WHERE c.id=prospecting_sequence_cohort_people.source_id AND c.workspace_id=prospecting_sequence_cohort_people.workspace_id AND c.deleted_at IS NULL)
 ELSE EXISTS(SELECT 1 FROM public.leads l WHERE l.id=prospecting_sequence_cohort_people.source_id AND l.workspace_id=prospecting_sequence_cohort_people.workspace_id AND l.deleted_at IS NULL) END);
CREATE TRIGGER sequence_cohorts_immutable BEFORE UPDATE ON public.prospecting_sequence_cohorts FOR EACH ROW EXECUTE FUNCTION public.prospecting_sequence_version_immutable();
CREATE TRIGGER sequence_cohort_people_immutable BEFORE UPDATE ON public.prospecting_sequence_cohort_people FOR EACH ROW EXECUTE FUNCTION public.prospecting_sequence_version_immutable();
-- Re-enter the requesting actor through the existing non-bypass API role. This is
-- a private capability: no authenticated, anonymous or service-role direct calls.
SET ROLE techerp_api_subject;
CREATE FUNCTION techerp_api.sequence_audience_source(p_workspace uuid,p_actor uuid,p_candidates jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result jsonb;BEGIN
 IF current_setting('app.api_subject',true)='on' THEN RAISE EXCEPTION 'Nested audience context forbidden' USING ERRCODE='42501';END IF;
 INSERT INTO techerp_api.subject_sessions(txid,user_id,workspace_id,api_key_id,prev_claims) VALUES(txid_current(),p_actor,p_workspace,gen_random_uuid(),current_setting('request.jwt.claims',true));
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',p_actor,'role','authenticated','aud','authenticated')::text,true);
 PERFORM set_config('request.jwt.claim.sub',p_actor::text,true);PERFORM set_config('request.jwt.claim.role','authenticated',true);PERFORM set_config('app.api_subject','on',true);
 SELECT coalesce(jsonb_object_agg(a.entity||':'||a.id,jsonb_build_object('email',a.email,'phones',jsonb_build_array(a.whatsapp_e164,a.mobile_phone,a.phone))),'{}') INTO result FROM(
  SELECT 'contact' entity,c.id,c.email,c.phone,c.mobile_phone,c.whatsapp_e164 FROM public.shared_fields_contacts c WHERE c.workspace_id=p_workspace AND c.deleted_at IS NULL AND c.id IN(SELECT (x->>'id')::uuid FROM jsonb_array_elements(p_candidates) x WHERE x->>'entity'='contact')
  UNION ALL SELECT 'lead',l.id,l.email,l.phone,l.mobile_phone,l.whatsapp_e164 FROM public.shared_fields_leads l WHERE l.workspace_id=p_workspace AND l.deleted_at IS NULL AND l.id IN(SELECT (x->>'id')::uuid FROM jsonb_array_elements(p_candidates) x WHERE x->>'entity'='lead')) a;
 PERFORM techerp_api.leave();RETURN result;
END $$;
REVOKE ALL ON FUNCTION techerp_api.sequence_audience_source(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION techerp_api.sequence_audience_source(uuid,uuid,jsonb) TO postgres;
RESET ROLE;
CREATE FUNCTION public.prospecting_sequence_cohort_list(p_workspace uuid,p_version uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE c jsonb:=public.sales_access_context(); result jsonb; BEGIN
 IF c->>'workspace' IS DISTINCT FROM p_workspace::text OR c->>'actor' IS NULL OR NOT EXISTS(SELECT 1 FROM public.prospecting_sequence_versions WHERE id=p_version AND workspace_id=p_workspace) THEN RAISE EXCEPTION 'Versão indisponível.' USING ERRCODE='42501'; END IF;
 SELECT coalesce(jsonb_agg(j ORDER BY j->>'created_at' DESC),'[]'::jsonb) INTO result FROM (
 SELECT jsonb_build_object('id',r.id,'version_id',r.version_id,'created_at',r.created_at,'requested',r.requested,
 'held',(SELECT count(*) FROM public.prospecting_sequence_cohort_people p WHERE p.cohort_id=r.id AND p.block_reason IS NULL),
 'blocked',(SELECT count(*) FROM public.prospecting_sequence_cohort_people p WHERE p.cohort_id=r.id AND p.block_reason IS NOT NULL),
 'reasons',coalesce((SELECT jsonb_object_agg(k.reason,k.n) FROM(SELECT p.block_reason reason,count(*) n FROM public.prospecting_sequence_cohort_people p WHERE p.cohort_id=r.id AND p.block_reason IS NOT NULL GROUP BY p.block_reason) k),'{}'::jsonb)) j
 FROM (SELECT id,version_id,created_at,requested FROM public.prospecting_sequence_cohorts WHERE workspace_id=p_workspace AND version_id=p_version ORDER BY created_at DESC LIMIT 25) r) t;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.prospecting_sequence_cohort_list(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.prospecting_sequence_cohort_list(uuid,uuid) TO authenticated;
CREATE FUNCTION public.prospecting_sequence_cohort_prepare(p_workspace uuid,p_actor uuid,p_version uuid,p_request uuid,p_consent text,p_candidates jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE visible_sources jsonb;visible_row jsonb;ctx jsonb;v public.prospecting_sequence_versions;r public.prospecting_sequence_cohorts;x jsonb;j jsonb;
 query_keys text[];ids uuid[];contacts_ids uuid[];companies_ids uuid[];leads_ids uuid[];canonical uuid;canonical_company uuid;reason text;keys text[];seen jsonb:='{}';others jsonb:='{}';suppressed_records jsonb;suppressed_emails jsonb; suppressed_phones jsonb;flags jsonb;identity_flags jsonb;
 f integer;nheld integer;nblocked integer;out_reasons jsonb;is_customer boolean;is_open boolean;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Somente o servidor pode preparar inscrições.' USING ERRCODE='42501';END IF;
 ctx:=public.work_subject_context(p_workspace,p_actor);
 SELECT * INTO v FROM public.prospecting_sequence_versions WHERE id=p_version AND workspace_id=p_workspace;
 IF NOT FOUND OR NOT public.sales_context_access(ctx,p_workspace,'system.automation.sequences','view',ARRAY[v.owner_id]) OR NOT public.sales_context_access(ctx,p_workspace,'system.automation.sequences','assign',ARRAY[v.owner_id]) THEN RAISE EXCEPTION 'Sem permissão para inscrever nesta versão.' USING ERRCODE='42501';END IF;
 IF p_request IS NULL OR p_consent IS NULL OR length(btrim(p_consent)) NOT BETWEEN 10 AND 2000 OR jsonb_typeof(p_candidates) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Inscrição inválida.' USING ERRCODE='22023'; END IF;
 IF jsonb_array_length(p_candidates)>5000 OR octet_length(p_candidates::text)>4000000 THEN RAISE EXCEPTION 'Público excede o limite técnico.' USING ERRCODE='22023';END IF;
 -- One transaction owns the workspace audience reservation, including retries/concurrent versions.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_workspace::text,294));
 SELECT * INTO r FROM public.prospecting_sequence_cohorts WHERE workspace_id=p_workspace AND request_id=p_request;
 IF FOUND THEN
  IF r.created_by<>p_actor OR r.version_id<>p_version OR r.consent_evidence<>btrim(p_consent) THEN RAISE EXCEPTION 'Chave de inscrição já utilizada para outra solicitação.' USING ERRCODE='40001';END IF;
 ELSE
  INSERT INTO public.prospecting_sequence_cohorts(workspace_id,version_id,owner_id,created_by,request_id,consent_evidence,requested)
  VALUES(p_workspace,v.id,v.owner_id,p_actor,p_request,btrim(p_consent),jsonb_array_length(p_candidates)) RETURNING * INTO r;
  visible_sources:=techerp_api.sequence_audience_source(p_workspace,p_actor,p_candidates);
  SELECT array_agg((a->>'id')::uuid) INTO ids FROM jsonb_array_elements(p_candidates) a;
  SELECT array_agg(id) INTO leads_ids FROM public.leads WHERE workspace_id=p_workspace AND deleted_at IS NULL AND (id=ANY(ids)
   OR lower(btrim(email)) IN(SELECT e FROM jsonb_array_elements(p_candidates) candidate CROSS JOIN LATERAL jsonb_array_elements_text(candidate->'email_aliases') e)
   OR EXISTS(SELECT 1 FROM unnest(ARRAY[whatsapp_e164,mobile_phone,phone]) p WHERE regexp_replace(p,'\D','','g') IN(SELECT regexp_replace(n,'\D','','g') FROM jsonb_array_elements(p_candidates) candidate CROSS JOIN LATERAL jsonb_array_elements_text(candidate->'phones') n)));
  SELECT array_agg(id) INTO contacts_ids FROM public.contacts WHERE workspace_id=p_workspace AND deleted_at IS NULL AND (id=ANY(ids) OR id IN(SELECT converted_contact_id FROM public.leads WHERE workspace_id=p_workspace AND id=ANY(leads_ids))
   OR lower(btrim(email)) IN(SELECT e FROM jsonb_array_elements(p_candidates) candidate CROSS JOIN LATERAL jsonb_array_elements_text(candidate->'email_aliases') e)
   OR EXISTS(SELECT 1 FROM unnest(ARRAY[whatsapp_e164,mobile_phone,phone]) p WHERE regexp_replace(p,'\D','','g') IN(SELECT regexp_replace(n,'\D','','g') FROM jsonb_array_elements(p_candidates) candidate CROSS JOIN LATERAL jsonb_array_elements_text(candidate->'phones') n)));
  SELECT array_agg(company_id) INTO companies_ids FROM (SELECT company_id FROM public.contacts WHERE workspace_id=p_workspace AND id=ANY(contacts_ids) UNION SELECT company_id FROM public.leads WHERE workspace_id=p_workspace AND id=ANY(leads_ids)) a;
  -- Failures remain failures; never substitute zero for inaccessible or missing exclusion sources.
  SELECT coalesce(jsonb_object_agg(lower(btrim(email)),true),'{}') INTO suppressed_emails FROM public.email_unsubscribes WHERE workspace_id=p_workspace;
  SELECT coalesce(jsonb_object_agg(regexp_replace(contact_phone,'\D','','g'),true),'{}') INTO suppressed_phones FROM public.sdr_enrollments WHERE workspace_id=p_workspace AND opted_out_at IS NOT NULL AND contact_phone IS NOT NULL;
  SELECT coalesce(jsonb_object_agg(k,true),'{}') INTO suppressed_records FROM public.sdr_enrollments e CROSS JOIN LATERAL (VALUES(to_jsonb(e)->>'lead_id'),(to_jsonb(e)->>'contact_id')) a(k) WHERE e.workspace_id=p_workspace AND e.opted_out_at IS NOT NULL AND k IS NOT NULL;
  WITH d AS(SELECT id,company_id,primary_contact_id,lead_id,CASE WHEN lower(coalesce(stage::text,'')) IN('won','closedwon','ganho') THEN 1 WHEN lower(coalesce(stage::text,'')) IN('lost','closedlost','perdido') THEN 0 ELSE 2 END flag FROM public.deals WHERE workspace_id=p_workspace AND deleted_at IS NULL),
  all_flags AS(
   SELECT 'company:'||company_id k,flag FROM d WHERE company_id=ANY(companies_ids)
   UNION ALL SELECT 'contact:'||primary_contact_id,flag FROM d WHERE primary_contact_id=ANY(contacts_ids)
   UNION ALL SELECT 'lead:'||lead_id,flag FROM d WHERE lead_id=ANY(leads_ids)
   UNION ALL SELECT 'contact:'||dc.contact_id,d.flag FROM public.deal_contacts dc JOIN d ON d.id=dc.deal_id WHERE dc.contact_id=ANY(contacts_ids)
   UNION ALL SELECT 'company:'||counterparty_company_id,1 FROM public.contracts WHERE workspace_id=p_workspace AND status='active' AND counterparty_company_id=ANY(companies_ids))
  SELECT coalesce(jsonb_object_agg(k,flag),'{}') INTO flags FROM(SELECT k,bit_or(flag) flag FROM all_flags GROUP BY k) a;
  WITH related AS(
   SELECT to_jsonb(c) j,'contact' entity FROM public.contacts c WHERE c.workspace_id=p_workspace AND c.id=ANY(contacts_ids)
   UNION ALL SELECT to_jsonb(l),'lead' FROM public.leads l WHERE l.workspace_id=p_workspace AND l.id=ANY(leads_ids)),
  related_flags AS(SELECT rr.j,rr.entity,coalesce((flags->>('company:'||(rr.j->>'company_id')))::integer,0) | coalesce((flags->>(rr.entity||':'||(rr.j->>'id')))::integer,0) | coalesce((flags->>('contact:'||(rr.j->>'converted_contact_id')))::integer,0) f FROM related rr),
  identity_rows AS(SELECT encode(sha256(convert_to(a.k,'UTF8')),'hex') k,rf.f FROM related_flags rf CROSS JOIN LATERAL(
   SELECT 'record:'||(rf.j->>'id') k UNION ALL SELECT 'contact:'||(rf.j->>'id') WHERE rf.entity='contact'
   UNION ALL SELECT 'contact:'||(rf.j->>'converted_contact_id') WHERE rf.entity='lead' AND rf.j->>'converted_contact_id' IS NOT NULL
   UNION ALL SELECT 'email:'||lower(btrim(rf.j->>'email')) WHERE nullif(btrim(rf.j->>'email'),'') IS NOT NULL
   UNION ALL SELECT 'phone:+'||regexp_replace(p,'\D','','g') FROM unnest(ARRAY[rf.j->>'whatsapp_e164',rf.j->>'mobile_phone',rf.j->>'phone']) p WHERE nullif(p,'') IS NOT NULL) a)
  SELECT coalesce(jsonb_object_agg(a.k,a.f),'{}') INTO identity_flags FROM(SELECT ir.k,bit_or(ir.f) f FROM identity_rows ir GROUP BY ir.k) a;
  SELECT array_agg(DISTINCT encode(sha256(convert_to(k,'UTF8')),'hex')) INTO query_keys FROM (
   SELECT 'record:'||(a->>'id') k FROM jsonb_array_elements(p_candidates) a
   UNION ALL SELECT 'contact:'||id FROM unnest(contacts_ids) id
   UNION ALL SELECT 'email:'||e FROM jsonb_array_elements(p_candidates) a CROSS JOIN LATERAL jsonb_array_elements_text(a->'email_aliases') e
   UNION ALL SELECT 'phone:'||p FROM jsonb_array_elements(p_candidates) a CROSS JOIN LATERAL jsonb_array_elements_text(a->'phones') p) hashes;
  SELECT coalesce(jsonb_object_agg(k,true) FILTER(WHERE q.version_id=p_version),'{}'),coalesce(jsonb_object_agg(k,true) FILTER(WHERE q.version_id<>p_version),'{}') INTO seen,others
  FROM public.prospecting_sequence_cohort_people p JOIN public.prospecting_sequence_cohorts q ON q.id=p.cohort_id CROSS JOIN LATERAL unnest(p.identity_keys) k WHERE q.workspace_id=p_workspace AND (p.block_reason IS NULL OR p.block_reason='duplicate') AND p.identity_keys && query_keys;
  FOR x IN SELECT value FROM jsonb_array_elements(p_candidates) LOOP
   IF x->>'entity' NOT IN('lead','contact') OR x->>'entity' IS NULL THEN RAISE EXCEPTION 'Destinatário inválido.' USING ERRCODE='22023';END IF;
   IF x->>'entity'='lead' THEN SELECT to_jsonb(l) INTO j FROM public.leads l WHERE id=(x->>'id')::uuid AND workspace_id=p_workspace AND deleted_at IS NULL;
   ELSE SELECT to_jsonb(c) INTO j FROM public.contacts c WHERE id=(x->>'id')::uuid AND workspace_id=p_workspace AND deleted_at IS NULL;END IF;
   IF j IS NULL OR NOT public.sales_context_access(ctx,p_workspace,CASE WHEN x->>'entity'='lead' THEN 'techsales.leads' ELSE 'techsales.contacts' END,'view',ARRAY[coalesce(nullif(j->>'assigned_to',''),j->>'owner_id')::uuid]) THEN RAISE EXCEPTION 'O acesso ao público mudou. Recalcule a inscrição.' USING ERRCODE='42501';END IF;
   visible_row:=visible_sources->((x->>'entity')||':'||(x->>'id'));
   IF visible_row IS NULL THEN RAISE EXCEPTION 'O acesso ao público mudou. Recalcule a inscrição.' USING ERRCODE='42501';END IF;
   IF coalesce(visible_row->>'email','') IS DISTINCT FROM coalesce(x->>'raw_email','') OR visible_row->'phones' IS DISTINCT FROM x->'raw_phones' THEN RAISE EXCEPTION 'Dados do público alterados. Recalcule a inscrição.' USING ERRCODE='40001';END IF;
   canonical:=CASE WHEN x->>'entity'='contact' THEN (x->>'id')::uuid ELSE nullif(j->>'converted_contact_id','')::uuid END;
   IF canonical IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.contacts WHERE id=canonical AND workspace_id=p_workspace AND deleted_at IS NULL) THEN canonical:=NULL;END IF;
   SELECT company_id INTO canonical_company FROM public.contacts WHERE id=canonical AND workspace_id=p_workspace AND deleted_at IS NULL;
   SELECT array_agg(DISTINCT encode(sha256(convert_to(k,'UTF8')),'hex')) INTO keys FROM (
    SELECT 'record:'||(x->>'id') k UNION ALL SELECT 'contact:'||canonical WHERE canonical IS NOT NULL
    UNION ALL SELECT 'email:'||e FROM jsonb_array_elements_text(x->'email_aliases') e
    UNION ALL SELECT 'phone:'||p FROM jsonb_array_elements_text(x->'phones') p) a;
   f:=coalesce((flags->>('company:'||canonical_company))::integer,0) | coalesce((flags->>('company:'||(j->>'company_id')))::integer,0) | coalesce((flags->>((x->>'entity')||':'||(x->>'id')))::integer,0) | coalesce((flags->>('contact:'||canonical))::integer,0);
   SELECT f | coalesce(bit_or((identity_flags->>k)::integer),0) INTO f FROM unnest(keys) k;
   is_customer:=(f & 1)=1;is_open:=(f & 2)=2;
   reason:=NULL;
   IF suppressed_records ? (x->>'id') OR suppressed_records ? coalesce(canonical::text,'') OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(x->'email_aliases') e WHERE suppressed_emails ? e) OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(x->'phones') p WHERE suppressed_phones ? regexp_replace(p,'\D','','g')) THEN reason:='opt_out';
   ELSIF coalesce((v.definition#>>'{audience,excludeCustomers}')::boolean,true) AND is_customer THEN reason:='customer';
   ELSIF coalesce((v.definition#>>'{audience,excludeOpenDeals}')::boolean,true) AND is_open THEN reason:='open_deal';
   ELSIF NOT coalesce((x#>>'{channels,email}')::boolean,false) AND NOT coalesce((x#>>'{channels,whatsapp}')::boolean,false) AND NOT coalesce((x#>>'{channels,call}')::boolean,false) THEN reason:='missing_channel';
   ELSIF seen ?| keys THEN reason:='duplicate';
   ELSIF coalesce((v.definition#>>'{audience,excludeOtherSequences}')::boolean,true) AND (others ?| keys OR EXISTS(SELECT 1 FROM public.sequence_enrollments e WHERE e.workspace_id=p_workspace AND e.status='active' AND e.entity_id=ANY(ARRAY[(x->>'id')::uuid,canonical])) OR EXISTS(SELECT 1 FROM public.sdr_enrollments e WHERE e.workspace_id=p_workspace AND e.status='active' AND e.opted_out_at IS NULL AND EXISTS(SELECT 1 FROM jsonb_array_elements_text(x->'phones') p WHERE regexp_replace(e.contact_phone,'\D','','g')=regexp_replace(p,'\D','','g')))) THEN reason:='other_sequence';END IF;
   INSERT INTO public.prospecting_sequence_cohort_people(cohort_id,workspace_id,entity,source_id,channels,identity_keys,block_reason) VALUES(r.id,p_workspace,x->>'entity',(x->>'id')::uuid,x->'channels',keys,reason);
   
   IF reason IS NULL OR reason='duplicate' THEN SELECT seen||coalesce(jsonb_object_agg(k,true),'{}') INTO seen FROM unnest(keys) k;END IF;
  END LOOP;
 END IF;
 SELECT count(*) FILTER(WHERE block_reason IS NULL),count(*) FILTER(WHERE block_reason IS NOT NULL) INTO nheld,nblocked FROM public.prospecting_sequence_cohort_people WHERE cohort_id=r.id;
 SELECT coalesce(jsonb_object_agg(block_reason,n),'{}') INTO out_reasons FROM(SELECT block_reason,count(*) n FROM public.prospecting_sequence_cohort_people WHERE cohort_id=r.id AND block_reason IS NOT NULL GROUP BY block_reason) a;
 RETURN jsonb_build_object('id',r.id,'version_id',r.version_id,'created_at',r.created_at,'requested',r.requested,'held',nheld,'blocked',nblocked,'reasons',out_reasons);
END $$;
REVOKE ALL ON FUNCTION public.prospecting_sequence_cohort_prepare(uuid,uuid,uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prospecting_sequence_cohort_prepare(uuid,uuid,uuid,uuid,text,jsonb) TO service_role;
