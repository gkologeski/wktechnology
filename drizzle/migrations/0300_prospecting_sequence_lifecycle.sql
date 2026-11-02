-- Catalog only: no default grants or changes to existing workspace overrides.
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,description,is_system) VALUES
('techsales.tasks.assign.own','techsales','tasks','assign','own','Atribuir tarefas (own)','Atribuir tarefas a outro responsável, sujeito ao escopo e às permissões atuais.',true),
('techsales.tasks.assign.team','techsales','tasks','assign','team','Atribuir tarefas (team)','Atribuir tarefas a outro responsável, sujeito ao escopo e às permissões atuais.',true),
('techsales.tasks.assign.workspace','techsales','tasks','assign','workspace','Atribuir tarefas (workspace)','Atribuir tarefas a outro responsável, sujeito ao escopo e às permissões atuais.',true)
ON CONFLICT(key) DO NOTHING;
ALTER TABLE public.prospecting_sequence_runs ADD COLUMN handoff_effect_id uuid REFERENCES public.prospecting_sequence_effects(id) ON DELETE SET NULL;
-- Lifecycle is separate from immutable enrollment/audience evidence.
CREATE TABLE public.prospecting_sequence_cohort_controls (
 cohort_id uuid PRIMARY KEY REFERENCES public.prospecting_sequence_cohorts(id) ON DELETE CASCADE,
 workspace_id uuid NOT NULL, cancelled_at timestamptz NOT NULL DEFAULT now(), cancelled_by uuid NOT NULL REFERENCES auth.users(id)
);
CREATE TABLE public.prospecting_sequence_identity_releases (
 person_id uuid PRIMARY KEY REFERENCES public.prospecting_sequence_cohort_people(id) ON DELETE CASCADE,
 workspace_id uuid NOT NULL,released_at timestamptz NOT NULL DEFAULT now(),reason text NOT NULL
);
ALTER TABLE public.prospecting_sequence_cohort_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospecting_sequence_identity_releases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.prospecting_sequence_cohort_controls,public.prospecting_sequence_identity_releases FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.prospecting_sequence_cohort_controls,public.prospecting_sequence_identity_releases TO authenticated;
GRANT SELECT,DELETE ON public.prospecting_sequence_cohort_controls,public.prospecting_sequence_identity_releases TO service_role;
CREATE POLICY sequence_cohort_controls_read ON public.prospecting_sequence_cohort_controls FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.prospecting_sequence_cohorts c WHERE c.id=cohort_id AND c.workspace_id=prospecting_sequence_cohort_controls.workspace_id));
CREATE POLICY sequence_identity_releases_read ON public.prospecting_sequence_identity_releases FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.prospecting_sequence_cohort_people p WHERE p.id=person_id AND p.workspace_id=prospecting_sequence_identity_releases.workspace_id));

CREATE FUNCTION public.prospecting_sequence_release_identities(p_limit integer DEFAULT 500)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE n integer;BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Serviço requerido.' USING ERRCODE='42501';END IF;
 -- A confirmed completed human activity or closed canonical agent enrollment ends the handoff.
 UPDATE public.prospecting_sequence_runs rr SET state='completed',reason='handoff_finished',updated_at=now() WHERE rr.id IN(
  SELECT r.id FROM public.prospecting_sequence_runs r WHERE
  (r.state='human' AND EXISTS(SELECT 1 FROM public.activities a WHERE a.id=r.id AND a.workspace_id=r.workspace_id AND a.completed AND a.external_ids->>'prospecting_sequence_run_id'=r.id::text)
   OR r.state='agent' AND EXISTS(SELECT 1 FROM public.prospecting_sequence_effects e WHERE e.run_id=r.id AND e.id=r.handoff_effect_id AND e.status='succeeded' AND e.projection_state='complete' AND (
    e.kind='whatsapp' AND EXISTS(SELECT 1 FROM public.whatsapp_messages m JOIN public.whatsapp_conversations c ON c.id=m.conversation_id AND c.workspace_id=m.workspace_id JOIN public.sdr_enrollments en ON en.id=c.sdr_enrollment_id AND en.workspace_id=c.workspace_id WHERE m.id=e.id AND m.workspace_id=r.workspace_id AND en.status<>'active')
    OR e.kind='email' AND EXISTS(SELECT 1 FROM public.email_messages m JOIN public.service_agent_sessions se ON se.source_id=m.thread_id AND se.workspace_id=m.workspace_id AND se.channel='email' JOIN public.sdr_enrollments en ON en.id=se.enrollment_id AND en.workspace_id=se.workspace_id WHERE m.id=e.id AND m.workspace_id=r.workspace_id AND en.status<>'active'))))
  AND NOT EXISTS(SELECT 1 FROM public.prospecting_sequence_effects e WHERE e.run_id=r.id AND (e.status IN('sending','uncertain') OR e.projection_state='pending'))
  ORDER BY r.updated_at,r.id LIMIT least(greatest(p_limit,1),5000) FOR UPDATE OF r SKIP LOCKED
 );
 INSERT INTO public.prospecting_sequence_identity_releases(person_id,workspace_id,reason)
 SELECT p.id,p.workspace_id,'execution_finished' FROM public.prospecting_sequence_cohort_people p JOIN public.prospecting_sequence_runs r ON r.cohort_person_id=p.id
 WHERE r.state IN('cancelled','completed') AND NOT EXISTS(SELECT 1 FROM public.prospecting_sequence_effects e WHERE e.run_id=r.id AND (e.status IN('sending','uncertain') OR e.projection_state='pending'))
 AND NOT EXISTS(SELECT 1 FROM public.prospecting_sequence_identity_releases rel WHERE rel.person_id=p.id)
 ORDER BY r.updated_at,r.id LIMIT least(greatest(p_limit,1),5000) ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS n=ROW_COUNT;
 -- Duplicate aliases retain their claim while any matching canonical enrollment is unresolved.
 INSERT INTO public.prospecting_sequence_identity_releases(person_id,workspace_id,reason)
 SELECT p.id,p.workspace_id,'alias_finished' FROM public.prospecting_sequence_cohort_people p WHERE p.block_reason='duplicate'
 AND NOT EXISTS(SELECT 1 FROM public.prospecting_sequence_identity_releases rel WHERE rel.person_id=p.id)
 AND EXISTS(SELECT 1 FROM public.prospecting_sequence_cohort_people c JOIN public.prospecting_sequence_identity_releases rel ON rel.person_id=c.id WHERE c.cohort_id=p.cohort_id AND c.block_reason IS NULL AND c.identity_keys&&p.identity_keys)
 AND NOT EXISTS(SELECT 1 FROM public.prospecting_sequence_cohort_people c WHERE c.cohort_id=p.cohort_id AND c.block_reason IS NULL AND c.identity_keys&&p.identity_keys AND NOT EXISTS(SELECT 1 FROM public.prospecting_sequence_identity_releases rel WHERE rel.person_id=c.id))
 LIMIT least(greatest(p_limit,1),5000) ON CONFLICT DO NOTHING;
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.prospecting_sequence_release_identities(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prospecting_sequence_release_identities(integer) TO service_role;

CREATE FUNCTION public.prospecting_sequence_discard_cohort(p_workspace uuid,p_cohort uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c public.prospecting_sequence_cohorts;ctx jsonb;people jsonb;visible jsonb;n integer;BEGIN
 ctx:=public.sales_access_context();
 SELECT * INTO c FROM public.prospecting_sequence_cohorts WHERE id=p_cohort AND workspace_id=p_workspace FOR UPDATE;
 IF c.id IS NULL OR ctx->>'workspace' IS DISTINCT FROM p_workspace::text OR coalesce((ctx->>'read_only')::boolean,false) OR NOT public.prospecting_sequence_runtime_allowed(p_workspace,auth.uid(),c.owner_id,'manage') THEN RAISE EXCEPTION 'Inscrição indisponível.' USING ERRCODE='42501';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_cohort::text,295));
 IF EXISTS(SELECT 1 FROM public.prospecting_sequence_runs r JOIN public.prospecting_sequence_cohort_people p ON p.id=r.cohort_person_id WHERE p.cohort_id=c.id AND NOT public.prospecting_sequence_runtime_allowed(p_workspace,auth.uid(),r.owner_id,'manage')) THEN RAISE EXCEPTION 'Inscrição indisponível.' USING ERRCODE='42501';END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('entity',entity,'id',source_id)),'[]') INTO people FROM public.prospecting_sequence_cohort_people WHERE cohort_id=c.id AND block_reason IS NULL;
 visible:=techerp_api.sequence_audience_source(p_workspace,auth.uid(),people);
 IF (SELECT count(*) FROM jsonb_object_keys(visible))<>jsonb_array_length(people) THEN RAISE EXCEPTION 'Inscrição indisponível.' USING ERRCODE='42501';END IF;
 INSERT INTO public.prospecting_sequence_cohort_controls(cohort_id,workspace_id,cancelled_by) VALUES(c.id,p_workspace,auth.uid()) ON CONFLICT DO NOTHING;
 UPDATE public.prospecting_sequence_runs r SET state='cancelled',reason='cohort_cancelled',updated_at=now() FROM public.prospecting_sequence_cohort_people p WHERE p.id=r.cohort_person_id AND p.cohort_id=c.id AND r.state NOT IN('completed','cancelled');
 GET DIAGNOSTICS n=ROW_COUNT;
 INSERT INTO public.prospecting_sequence_identity_releases(person_id,workspace_id,reason)
 SELECT p.id,p.workspace_id,'cohort_cancelled' FROM public.prospecting_sequence_cohort_people p WHERE p.cohort_id=c.id AND NOT EXISTS(SELECT 1 FROM public.prospecting_sequence_runs r JOIN public.prospecting_sequence_effects e ON e.run_id=r.id WHERE r.cohort_person_id=p.id AND (e.status IN('sending','uncertain') OR e.projection_state='pending')) ON CONFLICT DO NOTHING;
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.prospecting_sequence_discard_cohort(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.prospecting_sequence_discard_cohort(uuid,uuid) TO authenticated;

-- Internal boolean/code only: commercial exclusion sources may be hidden from
-- the execution actor and must never be returned as customer/deal details.
CREATE FUNCTION public.prospecting_sequence_commercial_block(p_run uuid,p_source jsonb)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r public.prospecting_sequence_runs;p public.prospecting_sequence_cohort_people;definition jsonb;customer boolean;open_deal boolean;BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Serviço requerido.' USING ERRCODE='42501';END IF;
 SELECT * INTO r FROM public.prospecting_sequence_runs WHERE id=p_run;
 SELECT * INTO p FROM public.prospecting_sequence_cohort_people WHERE id=r.cohort_person_id AND workspace_id=r.workspace_id;
 SELECT v.definition INTO definition FROM public.prospecting_sequence_versions v WHERE v.id=r.version_id AND v.workspace_id=r.workspace_id;
 IF p.id IS NULL OR definition IS NULL THEN RAISE EXCEPTION 'Origem indisponível.' USING ERRCODE='42501';END IF;
 WITH related_leads AS(
  SELECT l.id,l.company_id,l.converted_contact_id FROM public.leads l WHERE l.workspace_id=r.workspace_id AND l.deleted_at IS NULL AND (p.entity='lead' AND l.id=p.source_id OR lower(btrim(l.email))=lower(btrim(p_source->>'email')) OR EXISTS(SELECT 1 FROM unnest(ARRAY[l.whatsapp_e164,l.mobile_phone,l.phone]) n WHERE nullif(regexp_replace(n,'\D','','g'),'') IN(SELECT regexp_replace(v,'\D','','g') FROM jsonb_array_elements_text(p_source->'phones') v)))
 ),related_contacts AS(
  SELECT c.id,c.company_id FROM public.contacts c WHERE c.workspace_id=r.workspace_id AND c.deleted_at IS NULL AND (p.entity='contact' AND c.id=p.source_id OR c.id IN(SELECT converted_contact_id FROM related_leads) OR lower(btrim(c.email))=lower(btrim(p_source->>'email')) OR EXISTS(SELECT 1 FROM unnest(ARRAY[c.whatsapp_e164,c.mobile_phone,c.phone]) n WHERE nullif(regexp_replace(n,'\D','','g'),'') IN(SELECT regexp_replace(v,'\D','','g') FROM jsonb_array_elements_text(p_source->'phones') v)))
 ),companies AS(SELECT company_id id FROM related_contacts UNION SELECT company_id FROM related_leads),deals AS(
  SELECT d.stage FROM public.deals d WHERE d.workspace_id=r.workspace_id AND d.deleted_at IS NULL AND (d.company_id IN(SELECT id FROM companies) OR d.primary_contact_id IN(SELECT id FROM related_contacts) OR d.lead_id IN(SELECT id FROM related_leads) OR EXISTS(SELECT 1 FROM public.deal_contacts dc WHERE dc.deal_id=d.id AND dc.contact_id IN(SELECT id FROM related_contacts)))
 ) SELECT EXISTS(SELECT 1 FROM deals WHERE lower(coalesce(stage::text,'')) IN('won','closedwon','ganho')) OR EXISTS(SELECT 1 FROM public.contracts co WHERE co.workspace_id=r.workspace_id AND co.status='active' AND co.counterparty_company_id IN(SELECT id FROM companies)),EXISTS(SELECT 1 FROM deals WHERE lower(coalesce(stage::text,'')) NOT IN('won','closedwon','ganho','lost','closedlost','perdido')) INTO customer,open_deal;
 IF coalesce((definition#>>'{audience,excludeCustomers}')::boolean,true) AND customer THEN RETURN 'customer';END IF;
 IF coalesce((definition#>>'{audience,excludeOpenDeals}')::boolean,true) AND open_deal THEN RETURN 'open_deal';END IF;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.prospecting_sequence_commercial_block(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prospecting_sequence_commercial_block(uuid,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.prospecting_sequence_cohort_prepare(p_workspace uuid,p_actor uuid,p_version uuid,p_request uuid,p_consent text,p_candidates jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE visible_sources jsonb;unknown_keys text[];visible_row jsonb;ctx jsonb;v public.prospecting_sequence_versions;r public.prospecting_sequence_cohorts;x jsonb;j jsonb;
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
  SELECT coalesce(jsonb_object_agg(lower(btrim(email)),true),'{}') INTO suppressed_emails FROM public.email_unsubscribes unsub WHERE workspace_id=p_workspace AND unsub.reason IS DISTINCT FROM '__token__';
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
  unknown_keys:=public.prospecting_sequence_unknown_keys(p_workspace,query_keys);
  SELECT coalesce(jsonb_object_agg(k,true) FILTER(WHERE q.version_id=p_version),'{}'),coalesce(jsonb_object_agg(k,true) FILTER(WHERE q.version_id<>p_version AND NOT EXISTS(SELECT 1 FROM public.prospecting_sequence_identity_releases rel WHERE rel.person_id=p.id)),'{}') INTO seen,others
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
   ELSIF keys && unknown_keys THEN reason:='delivery_uncertain';
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

CREATE OR REPLACE FUNCTION public.prospecting_sequence_start(p_workspace uuid,p_cohort uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c public.prospecting_sequence_cohorts;ctx jsonb;n integer;source_rows jsonb;visible jsonb;BEGIN
 ctx:=public.sales_access_context();
 SELECT * INTO c FROM public.prospecting_sequence_cohorts WHERE id=p_cohort AND workspace_id=p_workspace FOR SHARE;
 IF c.id IS NULL OR ctx->>'workspace' IS DISTINCT FROM p_workspace::text OR coalesce((ctx->>'read_only')::boolean,false) OR NOT public.prospecting_sequence_runtime_allowed(p_workspace,auth.uid(),c.owner_id,'manage') OR NOT public.prospecting_sequence_runtime_allowed(p_workspace,auth.uid(),c.owner_id,'assign') THEN RAISE EXCEPTION 'Inscrição sem autorização atual.' USING ERRCODE='42501';END IF;
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

CREATE OR REPLACE FUNCTION public.prospecting_sequence_context(p_run uuid,p_lease uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r public.prospecting_sequence_runs;p public.prospecting_sequence_cohort_people;v public.prospecting_sequence_versions;
 sources jsonb;s jsonb;signals jsonb;email_reply boolean;wa_reply boolean;last_kind text;call_result text;previous_contact uuid;reply_info jsonb;BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Serviço requerido.' USING ERRCODE='42501';END IF;
 SELECT * INTO r FROM public.prospecting_sequence_runs WHERE id=p_run AND state='active' AND lease_token=p_lease AND lease_until>now();
 IF r.id IS NULL OR NOT public.prospecting_sequence_runtime_allowed(r.workspace_id,r.owner_id,r.owner_id,'manage') OR NOT public.prospecting_sequence_runtime_allowed(r.workspace_id,r.owner_id,r.owner_id,'assign') THEN RAISE EXCEPTION 'Execução sem autorização atual.' USING ERRCODE='42501';END IF;
 IF (SELECT definition->'steps'->r.cursor->>'type' FROM public.prospecting_sequence_versions WHERE id=r.version_id) IN('email','whatsapp') THEN
  IF NOT public.sales_context_access(public.work_subject_context(r.workspace_id,r.owner_id),r.workspace_id,'techsales.inbox.'||(SELECT definition->'steps'->r.cursor->>'type' FROM public.prospecting_sequence_versions WHERE id=r.version_id),'create',ARRAY[r.owner_id]) THEN RAISE EXCEPTION 'Envio sem autorização atual.' USING ERRCODE='42501';END IF;
 END IF;
 SELECT * INTO p FROM public.prospecting_sequence_cohort_people WHERE id=r.cohort_person_id AND workspace_id=r.workspace_id;
 SELECT * INTO v FROM public.prospecting_sequence_versions WHERE id=r.version_id AND workspace_id=r.workspace_id;
 IF p.id IS NULL OR v.id IS NULL OR NOT public.prospecting_sequence_runtime_allowed(r.workspace_id,r.owner_id,v.owner_id,'manage') OR NOT public.prospecting_sequence_runtime_allowed(r.workspace_id,r.owner_id,v.owner_id,'assign') THEN RAISE EXCEPTION 'Origem indisponível.' USING ERRCODE='42501';END IF;
 sources:=techerp_api.sequence_audience_source(r.workspace_id,r.owner_id,jsonb_build_array(jsonb_build_object('entity',p.entity,'id',p.source_id)));
 s:=sources->(p.entity||':'||p.source_id::text);
 IF s IS NULL THEN RAISE EXCEPTION 'Destinatário sem acesso atual.' USING ERRCODE='42501';END IF;
 SELECT a.outcome INTO call_result FROM public.prospecting_sequence_effects e JOIN public.activities a ON a.id=e.id WHERE e.run_id=r.id AND e.kind='call' AND e.status='succeeded' AND a.workspace_id=r.workspace_id AND a.completed ORDER BY e.created_at DESC,e.id DESC LIMIT 1;
 SELECT (x.value->>'id')::uuid INTO previous_contact FROM jsonb_array_elements(v.definition->'steps') WITH ORDINALITY x WHERE x.ordinality<=r.cursor AND x.value->>'type' IN('email','whatsapp','call') ORDER BY x.ordinality DESC LIMIT 1;
 reply_info:=public.prospecting_sequence_reply_signals(r.id,previous_contact);
 signals:=jsonb_build_object('previousContactExists',EXISTS(SELECT 1 FROM public.prospecting_sequence_effects WHERE run_id=r.id AND step_id=previous_contact AND status='succeeded'),'replied',(reply_info->>'replied')::boolean,'previousReplied',(reply_info->>'previousReplied')::boolean,'responseEffectId',reply_info->'responseEffectId','responseAgentId',reply_info->'responseAgentId',
 'commercialBlock',public.prospecting_sequence_commercial_block(r.id,s),
 'meetingBooked',EXISTS(SELECT 1 FROM public.meetings m WHERE m.workspace_id=r.workspace_id AND m.created_at>=r.created_at AND m.status NOT IN('cancelled','canceled') AND CASE p.entity WHEN 'contact' THEN m.related_contact_id=p.source_id ELSE m.related_lead_id=p.source_id END),
 'callAnswered',coalesce(call_result='answered',false),'callResultKnown',coalesce(call_result IN('answered','no_answer'),false),
 'optedOut',EXISTS(SELECT 1 FROM public.email_unsubscribes u WHERE u.workspace_id=r.workspace_id AND u.reason IS DISTINCT FROM '__token__' AND lower(btrim(u.email))=lower(btrim(s->>'email')))
 OR EXISTS(SELECT 1 FROM public.sdr_enrollments e WHERE e.workspace_id=r.workspace_id AND e.opted_out_at IS NOT NULL AND (to_jsonb(e)->>'contact_id'=p.source_id::text OR to_jsonb(e)->>'lead_id'=p.source_id::text OR regexp_replace(e.contact_phone,'\D','','g') IN(SELECT regexp_replace(phone,'\D','','g') FROM jsonb_array_elements_text(s->'phones') phone))));
 RETURN jsonb_build_object('run',to_jsonb(r),'person',jsonb_build_object('entity',p.entity,'id',p.source_id),'definition',v.definition,'source',s,'signals',signals);
END $$;
REVOKE ALL ON FUNCTION public.prospecting_sequence_context(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prospecting_sequence_context(uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.prospecting_sequence_effect_begin(p_run uuid,p_lease uuid,p_step uuid,p_prepared jsonb DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb;r public.prospecting_sequence_runs;e public.prospecting_sequence_effects;step jsonb;ctx jsonb;account public.service_channel_accounts;kind text;last_at timestamptz;oldest_at timestamptz;used integer;min_seconds integer;max_daily integer;BEGIN
 c:=public.prospecting_sequence_context(p_run,p_lease);
 SELECT * INTO r FROM public.prospecting_sequence_runs WHERE id=p_run FOR UPDATE;
 IF r.state<>'active' OR r.lease_token IS DISTINCT FROM p_lease OR r.lease_until<=now() THEN RAISE EXCEPTION 'Lease inválido.' USING ERRCODE='40001';END IF;
 step:=c->'definition'->'steps'->r.cursor;kind:=step->>'type';
 IF nullif(c#>>'{signals,commercialBlock}','') IS NOT NULL THEN RETURN jsonb_build_object('blockReason',c#>>'{signals,commercialBlock}');END IF;
 IF step->>'id' IS DISTINCT FROM p_step::text OR kind NOT IN('email','whatsapp','call','task') OR (c->'signals'->>'optedOut')::boolean THEN RAISE EXCEPTION 'Etapa bloqueada.' USING ERRCODE='42501';END IF;
 IF coalesce((c->'definition'->'settings'->>'stopOnReply')::boolean,true) AND (c->'signals'->>'replied')::boolean OR coalesce((c->'definition'->'settings'->>'stopOnMeeting')::boolean,true) AND (c->'signals'->>'meetingBooked')::boolean THEN RAISE EXCEPTION 'Contato já respondeu ou agendou.' USING ERRCODE='42501';END IF;
 ctx:=public.work_subject_context(r.workspace_id,r.owner_id);
 IF kind IN('email','whatsapp') THEN
  IF NOT (ctx->'keys' ? 'system.channels.view.workspace') OR NOT public.sales_context_access(ctx,r.workspace_id,'techsales.inbox.'||kind,'view',ARRAY[r.owner_id]) THEN RAISE EXCEPTION 'Canal sem acesso atual.' USING ERRCODE='42501';END IF;
  IF NOT public.sales_context_access(ctx,r.workspace_id,'techsales.inbox.'||kind,'create',ARRAY[r.owner_id]) THEN RAISE EXCEPTION 'Sem permissão de envio.' USING ERRCODE='42501';END IF;
  SELECT * INTO account FROM public.service_channel_accounts WHERE id=(step->>'accountId')::uuid AND workspace_id=r.workspace_id AND channel=kind AND enabled;
  IF account.id IS NULL THEN RAISE EXCEPTION 'Conta desativada.' USING ERRCODE='42501';END IF;
  IF kind='email' AND NOT EXISTS(SELECT 1 FROM public.email_accounts a WHERE a.id::text=account.source_key AND a.workspace_id=r.workspace_id AND a.owner_id=r.owner_id AND a.status='connected' AND a.provider='gmail') THEN RAISE EXCEPTION 'Conta de e-mail indisponível.' USING ERRCODE='42501';END IF;
  IF kind='whatsapp' AND EXISTS(SELECT 1 FROM public.whatsapp_conversations cv WHERE cv.workspace_id=r.workspace_id AND cv.wa_phone_number_id=account.source_key AND cv.contact_phone IN(SELECT ph FROM jsonb_array_elements_text(c->'source'->'phones') ph) AND NOT public.sales_context_access(ctx,r.workspace_id,'techsales.inbox.whatsapp','view',ARRAY[coalesce(cv.assigned_to,cv.owner_id)])) THEN RAISE EXCEPTION 'Conversa sem acesso atual.' USING ERRCODE='42501';END IF;
 ELSE
  IF NOT public.sales_context_access(ctx,r.workspace_id,CASE WHEN kind='task' THEN 'techsales.tasks' ELSE 'techsales.activities' END,'create',ARRAY[r.owner_id]) OR NOT EXISTS(SELECT 1 FROM public.workspace_members WHERE workspace_id=r.workspace_id AND user_id=(step->>'assigneeId')::uuid AND status='active') THEN RAISE EXCEPTION 'Tarefa sem autorização atual.' USING ERRCODE='42501';END IF;
 END IF;
 IF kind IN('call','task') AND (step->>'assigneeId')::uuid IS DISTINCT FROM r.owner_id AND NOT public.sales_context_access(ctx,r.workspace_id,CASE WHEN kind='task' THEN 'techsales.tasks' ELSE 'techsales.activities' END,'assign',ARRAY[r.owner_id]) THEN RAISE EXCEPTION 'Sem permissão para atribuir a outra pessoa.' USING ERRCODE='42501';END IF;
 IF kind IN('email','whatsapp') THEN
  IF cardinality(public.prospecting_sequence_unknown_keys(r.workspace_id,(SELECT identity_keys FROM public.prospecting_sequence_cohort_people WHERE id=r.cohort_person_id)))>0 THEN RETURN jsonb_build_object('blockReason','delivery_uncertain');END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(r.workspace_id::text||':'||account.id::text,297));
  min_seconds:=greatest(1,least(coalesce((c->'definition'->'settings'->>'minimumIntervalSeconds')::integer,60),3600));
  max_daily:=greatest(1,least(coalesce((c->'definition'->'settings'->>'dailyLimit')::integer,100),1000));
  SELECT max(b.created_at),min(b.created_at),count(*) INTO last_at,oldest_at,used FROM public.prospecting_sequence_effects b WHERE b.workspace_id=r.workspace_id AND b.account_id=account.id AND b.kind IN('email','whatsapp') AND b.created_at>now()-interval '24 hours' AND b.status IN('sending','succeeded','uncertain');
  IF used>=max_daily THEN RETURN jsonb_build_object('deferUntil',oldest_at+interval '24 hours','reason','daily_account_limit');END IF;
  IF last_at IS NOT NULL AND last_at+make_interval(secs=>min_seconds)>now() THEN RETURN jsonb_build_object('deferUntil',last_at+make_interval(secs=>min_seconds),'reason','account_pacing');END IF;
 END IF;
 INSERT INTO public.prospecting_sequence_effects(workspace_id,run_id,step_id,kind,status,target,account_id,sender) VALUES(r.workspace_id,r.id,p_step,kind,'sending',(c->'source')||CASE WHEN p_prepared->'source' IS NOT DISTINCT FROM c->'source' THEN jsonb_build_object('canonical_email',p_prepared->'email','canonical_phones',p_prepared->'phones','canonical_whatsapp',p_prepared->'whatsapp') ELSE '{}'::jsonb END,account.id,jsonb_build_object('sourceKey',account.source_key)) ON CONFLICT(run_id,step_id) DO UPDATE SET status='sending',token=gen_random_uuid(),target=excluded.target,account_id=excluded.account_id,sender=excluded.sender,created_at=now(),finished_at=NULL,error_code=NULL WHERE prospecting_sequence_effects.status='failed' AND prospecting_sequence_effects.provider_id IS NULL AND prospecting_sequence_effects.provider_receipt IS NULL RETURNING * INTO e;
 IF e.id IS NULL THEN RAISE EXCEPTION 'Efeito já reservado; concilie o resultado antes de tentar novamente.' USING ERRCODE='40001';END IF;
 RETURN jsonb_build_object('id',e.id,'token',e.token,'sourceKey',account.source_key,'source',c->'source');
END $$;
REVOKE ALL ON FUNCTION public.prospecting_sequence_effect_begin(uuid,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prospecting_sequence_effect_begin(uuid,uuid,uuid,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.prospecting_sequence_handoff(p_run uuid,p_lease uuid,p_mode text,p_agent uuid DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb;r public.prospecting_sequence_runs;e public.prospecting_sequence_effects;cv public.whatsapp_conversations;source uuid;channel_kind text;account public.service_channel_accounts;ctx jsonb;session uuid;enrollment uuid;person uuid;entity_kind text;actual text:=p_mode;BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' OR p_mode NOT IN('human','agent') THEN RAISE EXCEPTION 'Serviço requerido.' USING ERRCODE='42501';END IF;
 c:=public.prospecting_sequence_context(p_run,p_lease);
 SELECT * INTO r FROM public.prospecting_sequence_runs WHERE id=p_run AND lease_token=p_lease AND lease_until>now() AND state='active' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Execução indisponível.' USING ERRCODE='40001';END IF;
 ctx:=public.work_subject_context(r.workspace_id,r.owner_id);person:=(c#>>'{person,id}')::uuid;entity_kind:=c#>>'{person,entity}';
 SELECT * INTO e FROM public.prospecting_sequence_effects WHERE run_id=r.id AND kind IN('email','whatsapp') AND status='succeeded' AND projection_state='complete' AND (nullif(c#>>'{signals,responseEffectId}','') IS NULL OR id=(c#>>'{signals,responseEffectId}')::uuid) ORDER BY finished_at DESC,id DESC LIMIT 1;
 IF e.id IS NOT NULL THEN
  SELECT * INTO account FROM public.service_channel_accounts WHERE id=e.account_id AND workspace_id=r.workspace_id FOR SHARE;
  IF e.kind='whatsapp' THEN SELECT conversation_id INTO source FROM public.whatsapp_messages WHERE id=e.id AND workspace_id=r.workspace_id;
  ELSE SELECT thread_id INTO source FROM public.email_messages WHERE id=e.id AND workspace_id=r.workspace_id;END IF;
  channel_kind:=e.kind;
 END IF;
 IF p_mode='agent' THEN
  IF p_agent::text IS DISTINCT FROM coalesce(nullif(c#>>'{signals,responseAgentId}',''),CASE WHEN c->'definition'->'steps'->r.cursor->>'type'='agent' THEN nullif(c->'definition'->'steps'->r.cursor->>'agentId','') END,nullif(c#>>'{definition,settings,agentId}','')) THEN RAISE EXCEPTION 'Agente diferente da configuração da sequência.' USING ERRCODE='42501';END IF;
  IF source IS NULL OR p_agent IS NULL OR NOT account.enabled OR NOT account.routing_configured OR NOT EXISTS(SELECT 1 FROM public.service_channel_bindings b JOIN public.sdr_playbooks pb ON pb.id=b.agent_id AND pb.workspace_id=b.workspace_id WHERE b.account_id=account.id AND b.workspace_id=r.workspace_id AND b.agent_id=p_agent AND b.enabled AND b.inbound AND b.campaigns AND pb.enabled AND public.is_workspace_member(r.workspace_id,pb.owner_id) AND EXISTS(SELECT 1 FROM public.sdr_agent_versions av WHERE av.playbook_id=pb.id AND av.workspace_id=r.workspace_id AND av.status='published')) THEN RAISE EXCEPTION 'Agente/canal indisponível.' USING ERRCODE='42501';END IF;
  IF channel_kind='whatsapp' THEN
   SELECT * INTO cv FROM public.whatsapp_conversations WHERE id=source AND workspace_id=r.workspace_id FOR UPDATE;
   IF NOT public.sales_context_access(ctx,r.workspace_id,'techsales.inbox.whatsapp','view',ARRAY[coalesce(cv.assigned_to,cv.owner_id)]) OR NOT public.sales_context_access(ctx,r.workspace_id,'techsales.inbox.whatsapp','update',ARRAY[coalesce(cv.assigned_to,cv.owner_id)]) THEN RAISE EXCEPTION 'Conversa sem autorização atual.' USING ERRCODE='42501';END IF;
   IF cv.ai_owner IN('human','paused') THEN actual:='human';ELSE
    -- Existing router owns the enrollment and future inbound processing. Never send an unsolicited AI message here.
    enrollment:=public.sdr_bind_inbound_channel(r.workspace_id,source,account.source_key);
    IF enrollment IS NULL OR NOT EXISTS(SELECT 1 FROM public.sdr_enrollments WHERE id=enrollment AND workspace_id=r.workspace_id AND playbook_id=p_agent AND opted_out_at IS NULL) THEN RAISE EXCEPTION 'Agente não vinculado à conversa.' USING ERRCODE='42501';END IF;
   END IF;
  ELSE
   IF EXISTS(SELECT 1 FROM public.service_agent_sessions ss JOIN public.sdr_enrollments se ON se.id=ss.enrollment_id AND se.workspace_id=ss.workspace_id WHERE ss.workspace_id=r.workspace_id AND ss.channel='email' AND ss.source_id=source AND se.playbook_id IS DISTINCT FROM p_agent) THEN RAISE EXCEPTION 'Conversa vinculada a outro agente.' USING ERRCODE='42501';END IF;
   IF EXISTS(SELECT 1 FROM public.service_agent_sessions s WHERE s.workspace_id=r.workspace_id AND s.channel='email' AND s.source_id=source AND s.ai_owner IN('human','paused')) THEN actual:='human';END IF;
   -- The existing verified inbound trigger enqueues email. Configuration is checked above; no fabricated inbound job.
  END IF;
 END IF;
 IF actual='human' THEN
  IF NOT public.sales_context_access(ctx,r.workspace_id,'techsales.tasks','create',ARRAY[r.owner_id]) THEN RAISE EXCEPTION 'Atendimento sem autorização atual.' USING ERRCODE='42501';END IF;
  IF channel_kind='whatsapp' AND source IS NOT NULL THEN
   SELECT * INTO cv FROM public.whatsapp_conversations WHERE id=source AND workspace_id=r.workspace_id FOR UPDATE;
   IF NOT public.sales_context_access(ctx,r.workspace_id,'techsales.inbox.whatsapp','update',ARRAY[coalesce(cv.assigned_to,cv.owner_id)]) THEN RAISE EXCEPTION 'Conversa sem autorização atual.' USING ERRCODE='42501';END IF;
   UPDATE public.whatsapp_conversations SET ai_owner='human',ai_version=ai_version+1 WHERE id=source AND workspace_id=r.workspace_id AND ai_owner IS DISTINCT FROM 'human' AND ai_owner IS DISTINCT FROM 'paused';
  ELSIF channel_kind='email' AND source IS NOT NULL THEN
   IF NOT EXISTS(SELECT 1 FROM public.email_threads t WHERE t.id=source AND t.workspace_id=r.workspace_id AND public.sales_context_access(ctx,r.workspace_id,'techsales.inbox.email','update',ARRAY[coalesce(t.assigned_to,t.owner_id)])) THEN RAISE EXCEPTION 'Conversa sem autorização atual.' USING ERRCODE='42501';END IF;
   UPDATE public.service_agent_sessions SET ai_owner='human',ai_version=ai_version+1 WHERE workspace_id=r.workspace_id AND channel='email' AND source_id=source AND ai_owner='ai';
  END IF;
  INSERT INTO public.activities(id,workspace_id,owner_id,assigned_to,type,subject,body,due_date,related_contact_id,related_lead_id,external_ids)
  VALUES(r.id,r.workspace_id,r.owner_id,r.owner_id,'task','Atender contato da sequência','A cadência foi interrompida para atendimento humano. Confira a conversa na Inbox antes de entrar em contato.',now(),CASE WHEN entity_kind='contact' THEN person END,CASE WHEN entity_kind='lead' THEN person END,jsonb_build_object('prospecting_sequence_run_id',r.id,'sequence_handoff',true)) ON CONFLICT(id) DO NOTHING;
  IF NOT EXISTS(SELECT 1 FROM public.activities a WHERE a.id=r.id AND a.workspace_id=r.workspace_id AND a.owner_id=r.owner_id AND a.external_ids->>'prospecting_sequence_run_id'=r.id::text AND CASE entity_kind WHEN 'contact' THEN a.related_contact_id=person ELSE a.related_lead_id=person END) THEN RAISE EXCEPTION 'Conflito na atividade de atendimento.' USING ERRCODE='23505';END IF;
  INSERT INTO public.notifications(id,workspace_id,owner_id,user_id,type,title,body,link,entity,entity_id,dedupe_key)
  VALUES(r.id,r.workspace_id,r.owner_id,r.owner_id,'sequence_handoff','Contato aguardando atendimento','A sequência foi interrompida. Consulte a atividade vinculada e a Inbox.','/prospecting/sequences','activities',r.id,'sequence-handoff:'||r.id::text) ON CONFLICT(id) DO NOTHING;
 END IF;
 UPDATE public.prospecting_sequence_runs SET handoff_effect_id=e.id WHERE id=r.id;
 RETURN actual;
END $$;
REVOKE ALL ON FUNCTION public.prospecting_sequence_handoff(uuid,uuid,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prospecting_sequence_handoff(uuid,uuid,text,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.prospecting_sequence_task_effect(p_effect uuid,p_token uuid,p_lease uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE e public.prospecting_sequence_effects;c jsonb;r public.prospecting_sequence_runs;step jsonb;target uuid;activity uuid;BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Serviço requerido.' USING ERRCODE='42501';END IF;
 SELECT * INTO e FROM public.prospecting_sequence_effects WHERE id=p_effect AND token=p_token;
 IF e.id IS NULL THEN RAISE EXCEPTION 'Reserva indisponível.' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM public.prospecting_sequence_runs WHERE id=e.run_id FOR UPDATE;
 SELECT * INTO e FROM public.prospecting_sequence_effects WHERE id=p_effect AND token=p_token AND status='sending' AND kind IN('call','task') FOR UPDATE;
 IF e.id IS NULL THEN RAISE EXCEPTION 'Reserva indisponível.' USING ERRCODE='42501';END IF;
 c:=public.prospecting_sequence_context(e.run_id,p_lease);
 SELECT * INTO r FROM public.prospecting_sequence_runs WHERE id=e.run_id FOR UPDATE;
 step:=c->'definition'->'steps'->r.cursor;target:=(step->>'assigneeId')::uuid;
 IF step->>'id' IS DISTINCT FROM e.step_id::text OR (step->>'type'='call' AND step->>'mode'<>'human') OR NOT public.sales_context_access(public.work_subject_context(r.workspace_id,r.owner_id),r.workspace_id,CASE WHEN e.kind='task' THEN 'techsales.tasks' ELSE 'techsales.activities' END,'create',ARRAY[r.owner_id])
 OR NOT EXISTS(SELECT 1 FROM public.workspace_members WHERE workspace_id=r.workspace_id AND user_id=target AND status='active') THEN RAISE EXCEPTION 'Tarefa sem autorização atual.' USING ERRCODE='42501';END IF;
 IF target<>r.owner_id AND NOT public.sales_context_access(public.work_subject_context(r.workspace_id,r.owner_id),r.workspace_id,CASE WHEN e.kind='task' THEN 'techsales.tasks' ELSE 'techsales.activities' END,'assign',ARRAY[r.owner_id]) THEN RAISE EXCEPTION 'Sem permissão para atribuir a outra pessoa.' USING ERRCODE='42501';END IF;
 INSERT INTO public.activities(id,workspace_id,owner_id,assigned_to,type,subject,body,due_date,related_contact_id,related_lead_id,external_ids)
 VALUES(e.id,r.workspace_id,r.owner_id,target,CASE WHEN e.kind='call' THEN 'call'::public.activity_type ELSE 'task'::public.activity_type END,left(step->>'title',255),coalesce(step->>'notes','')||CASE WHEN e.kind='call' THEN E'\nTentativas planejadas: '||coalesce(step->>'attempts','1')||'. Conclua a tarefa após registrar o resultado.' ELSE '' END,((now() AT TIME ZONE (c->'definition'->'settings'->>'timezone'))+make_interval(days=>coalesce((step->>'dueDays')::integer,0))) AT TIME ZONE (c->'definition'->'settings'->>'timezone'),
 CASE WHEN c->'person'->>'entity'='contact' THEN (c->'person'->>'id')::uuid END,CASE WHEN c->'person'->>'entity'='lead' THEN (c->'person'->>'id')::uuid END,jsonb_build_object('prospecting_sequence_effect',e.id)) RETURNING id INTO activity;
 IF NOT public.prospecting_sequence_effect_finish(e.id,e.token,activity::text,NULL) THEN RAISE EXCEPTION 'Resultado da tarefa não gravado.';END IF;
 UPDATE public.prospecting_sequence_runs SET state='waiting_task',reason='waiting_for_activity',task_completed_at=NULL,updated_at=now() WHERE id=r.id AND state='active';
 RETURN activity;
END $$;
REVOKE ALL ON FUNCTION public.prospecting_sequence_task_effect(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prospecting_sequence_task_effect(uuid,uuid,uuid) TO service_role;
