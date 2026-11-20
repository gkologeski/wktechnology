-- NOTIFICA-CENTRAL P10. Hire/People occurrences reuse the existing proof,
-- Workflow queue, temporal tick and delivery ledger. No automatic rule/grant/send.
ALTER TABLE public.notification_business_event_proofs ADD COLUMN occurred_at timestamptz;
ALTER TABLE public.notification_business_event_proofs DROP CONSTRAINT notification_business_event_proofs_source_table_check;
ALTER TABLE public.notification_business_event_proofs ADD CONSTRAINT notification_business_event_proofs_source_table_check
 CHECK(source_table IN('deals','proposals','contracts','projects','project_tasks','project_milestones',
  'ats_applications','ats_interviews','ats_offers','people','people_documents','hiring_preparation_requests'));
CREATE TABLE public.notification_business_occurrence_receipts(
 workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,event_key text NOT NULL,occurrence_key text NOT NULL,event_id uuid NOT NULL,
 source_table text NOT NULL,source_id uuid NOT NULL,producer_table text NOT NULL,producer_id uuid NOT NULL,
 reference_id uuid,source_revision text,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(workspace_id,event_key,occurrence_key)
);
ALTER TABLE public.notification_business_occurrence_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notification_business_occurrence_receipts FROM PUBLIC,anon,authenticated,service_role;
CREATE INDEX notification_people_document_window ON public.people_documents(workspace_id,expires_at,id) WHERE expires_at IS NOT NULL;

-- Extend existing entity checks without narrowing legacy entities. These three
-- sources are read-only: generic mutations are not added to any write allowlist.
DO $extend$ DECLARE relation text;constraint_name text;definition text;BEGIN
 FOREACH relation IN ARRAY ARRAY['workflows','workflow_events'] LOOP
  constraint_name:=relation||'_entity_check';
  SELECT pg_get_constraintdef(c.oid) INTO definition FROM pg_constraint c
   WHERE c.conrelid=('public.'||relation)::regclass AND c.conname=constraint_name;
  IF definition IS NULL THEN CONTINUE;END IF;
  EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I',relation,constraint_name);
  EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (%s OR entity IN(''ats_offers'',''people_documents'',''hiring_preparation_requests''))',
   relation,constraint_name,substr(definition,7));
 END LOOP;
END $extend$;

-- Only operational identity/state reaches named HR snapshots. Public signing
-- capabilities, private conditions, notes, documents and assessments stay out.
CREATE FUNCTION techerp_api.notification_hr_snapshot(p_entity text,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path=public,pg_temp AS $$
DECLARE allowed text[];result jsonb;controls jsonb;BEGIN
 IF p_payload IS NULL THEN RETURN NULL;END IF;
 IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN RETURN '{}'::jsonb;END IF;
 allowed:=CASE p_entity
  WHEN 'ats_applications' THEN ARRAY['id','workspace_id','owner_id','assigned_to','candidate_id','job_id','status','stage_value','stage_id','applied_at','created_at','updated_at']
  WHEN 'ats_interviews' THEN ARRAY['id','workspace_id','owner_id','assigned_to','application_id','candidate_id','job_id','interviewer_id','status','stage_value','scheduled_at','created_at','updated_at']
  WHEN 'ats_offers' THEN ARRAY['id','workspace_id','owner_id','assigned_to','application_id','candidate_id','job_id','status','revision','approved_revision','approval_status','start_date','sent_at','signed_at','created_at','updated_at'] END;
 SELECT coalesce(jsonb_object_agg(key,value),'{}') INTO controls FROM jsonb_each(p_payload)
  WHERE key IN('__wf_state','__wf_wait','__wf_path');
 IF allowed IS NOT NULL THEN
  SELECT coalesce(jsonb_object_agg(key,value),'{}') INTO result FROM jsonb_each(p_payload) WHERE key=ANY(allowed);
  RETURN result||controls;
 END IF;
 IF p_entity IN('people','people_documents','hiring_preparation_requests') THEN
  RETURN techerp_api.notification_people_snapshot(p_entity,p_payload)||controls;
 END IF;
 RETURN p_payload;
END $$;
REVOKE ALL ON FUNCTION techerp_api.notification_hr_snapshot(text,jsonb) FROM PUBLIC,anon,authenticated,service_role;

-- Prospectively close the same protected-column leaks in generic ATS events.
-- Named/resumed HR rows use their strict projection before the immutable proof
-- guard; existing events/proofs are never rewritten by this migration.
CREATE FUNCTION techerp_api.notification_hr_snapshot_capture() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$ BEGIN
 IF NEW.entity IN('ats_offers','people_documents','hiring_preparation_requests') AND NEW.notification_event_key IS NULL THEN
  RAISE EXCEPTION 'Origem de leitura exige ocorrência comprovada.' USING ERRCODE='42501';END IF;
 IF NEW.notification_event_key IN('ats.application.received','ats.interview.scheduled','ats.offer.accepted',
  'people.employment.started','people.document.expiring','people.approval.pending') THEN
  NEW.before:=techerp_api.notification_hr_snapshot(NEW.entity,NEW.before);
  NEW.after:=techerp_api.notification_hr_snapshot(NEW.entity,NEW.after);
 ELSIF NEW.entity='ats_applications' THEN
  NEW.before:=NEW.before-'hiring_details';NEW.after:=NEW.after-'hiring_details';
 ELSIF NEW.entity='people' THEN
  NEW.before:=NEW.before-ARRAY['cost_hour','monthly_cost','personal_doc','bank','bank_agency','bank_account','pix_key','address'];
  NEW.after:=NEW.after-ARRAY['cost_hour','monthly_cost','personal_doc','bank','bank_agency','bank_account','pix_key','address'];
 ELSIF NEW.entity='ats_interviews' THEN
  NEW.before:=NEW.before-ARRAY['notes','self_schedule_token'];NEW.after:=NEW.after-ARRAY['notes','self_schedule_token'];
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION techerp_api.notification_hr_snapshot_capture() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER notification_a_hr_snapshot BEFORE INSERT ON public.workflow_events
 FOR EACH ROW EXECUTE FUNCTION techerp_api.notification_hr_snapshot_capture();

CREATE FUNCTION techerp_api.notification_hr_href(p_workspace uuid,p_table text,p_id uuid) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE parent uuid;BEGIN
 IF p_workspace IS NULL OR p_id IS NULL THEN RETURN NULL;END IF;
 CASE p_table
 WHEN 'ats_applications' THEN
  SELECT a.job_id INTO parent FROM public.ats_applications a JOIN public.ats_jobs j ON j.id=a.job_id AND j.workspace_id=a.workspace_id
   JOIN public.ats_candidates c ON c.id=a.candidate_id AND c.workspace_id=a.workspace_id WHERE a.id=p_id AND a.workspace_id=p_workspace;
  IF parent IS NOT NULL THEN RETURN '/jobs/'||parent||'?tab=pipeline&applicationId='||p_id;END IF;
 WHEN 'ats_interviews' THEN
  SELECT i.job_id INTO parent FROM public.ats_interviews i JOIN public.ats_applications a ON a.id=i.application_id AND a.workspace_id=i.workspace_id
   AND a.job_id=i.job_id AND a.candidate_id=i.candidate_id JOIN public.ats_jobs j ON j.id=i.job_id AND j.workspace_id=i.workspace_id
   JOIN public.ats_candidates c ON c.id=i.candidate_id AND c.workspace_id=i.workspace_id WHERE i.id=p_id AND i.workspace_id=p_workspace;
  IF parent IS NOT NULL THEN RETURN '/jobs/'||parent||'?tab=interviews&interviewId='||p_id;END IF;
 WHEN 'ats_offers' THEN
  IF EXISTS(SELECT 1 FROM public.ats_offers o JOIN public.ats_candidates c ON c.id=o.candidate_id AND c.workspace_id=o.workspace_id
   WHERE o.id=p_id AND o.workspace_id=p_workspace) THEN RETURN '/offers?offerId='||p_id;END IF;
 WHEN 'people_documents' THEN
  SELECT d.person_id INTO parent FROM public.people_documents d JOIN public.people p ON p.id=d.person_id AND p.workspace_id=d.workspace_id
   WHERE d.id=p_id AND d.workspace_id=p_workspace;
  IF parent IS NOT NULL THEN RETURN '/people/'||parent||'?tab=documents&documentId='||p_id;END IF;
 WHEN 'hiring_preparation_requests' THEN
  IF EXISTS(SELECT 1 FROM public.hiring_preparation_requests WHERE id=p_id AND workspace_id=p_workspace AND kind='professional') THEN
   RETURN '/people/hiring-requests?request='||p_id;END IF;
 WHEN 'people' THEN
  IF EXISTS(SELECT 1 FROM public.people WHERE id=p_id AND workspace_id=p_workspace) THEN RETURN '/people/'||p_id;END IF;
 ELSE RETURN NULL;END CASE;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION techerp_api.notification_hr_href(uuid,text,uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION techerp_api.notification_ats_offer_valid(p_workspace uuid,p_offer uuid,p_document uuid,p_revision text) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE o public.ats_offers;d public.esign_documents;BEGIN
 SELECT * INTO o FROM public.ats_offers WHERE id=p_offer AND workspace_id=p_workspace;
 SELECT * INTO d FROM public.esign_documents WHERE id=o.esign_document_id AND workspace_id=p_workspace;
 IF o.id IS NULL OR o.status IS DISTINCT FROM 'signed' OR o.signed_at IS NULL OR o.sent_at IS NULL OR o.approval_status IS DISTINCT FROM 'approved'
  OR o.approved_revision IS DISTINCT FROM o.revision OR o.approved_at IS NULL OR o.approved_by IS NULL
  OR o.esign_document_id IS DISTINCT FROM p_document OR d.id IS NULL OR d.status::text IS DISTINCT FROM 'completed' OR d.completed_at IS NULL
  OR(d.expires_at IS NOT NULL AND d.completed_at>d.expires_at)
  OR p_revision IS DISTINCT FROM o.revision::text||':'||encode(sha256(convert_to(d.body,'UTF8')),'hex') THEN RETURN false;END IF;
 IF NOT EXISTS(SELECT 1 FROM public.ats_candidates WHERE id=o.candidate_id AND workspace_id=p_workspace)
  OR(o.job_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.ats_jobs WHERE id=o.job_id AND workspace_id=p_workspace AND status NOT IN('closed','filled')))
  OR(o.application_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.ats_applications WHERE id=o.application_id AND workspace_id=p_workspace
    AND candidate_id=o.candidate_id AND job_id IS NOT DISTINCT FROM o.job_id AND status NOT IN('rejected','withdrawn','canceled','cancelled'))) THEN RETURN false;END IF;
 RETURN EXISTS(SELECT 1 FROM public.esign_signers WHERE document_id=d.id AND workspace_id=p_workspace)
  AND NOT EXISTS(SELECT 1 FROM public.esign_signers WHERE document_id=d.id
   AND(workspace_id IS DISTINCT FROM p_workspace OR status::text IS DISTINCT FROM 'signed' OR signed_at IS NULL));
END $$;
REVOKE ALL ON FUNCTION techerp_api.notification_ats_offer_valid(uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION techerp_api.notification_ats_capture() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE revision text;BEGIN
 IF public.is_read_only_view() OR public.is_test_record(NEW.id) OR NEW.workspace_id IS NULL THEN RETURN NEW;END IF;
 IF TG_TABLE_NAME='ats_applications' THEN
  IF TG_OP<>'INSERT' OR NEW.status IS DISTINCT FROM 'active' OR NEW.applied_at IS NULL THEN RETURN NEW;END IF;
  IF NOT EXISTS(SELECT 1 FROM public.ats_candidates WHERE id=NEW.candidate_id AND workspace_id=NEW.workspace_id)
   OR NOT EXISTS(SELECT 1 FROM public.ats_jobs WHERE id=NEW.job_id AND workspace_id=NEW.workspace_id AND status NOT IN('closed','filled')) THEN RETURN NEW;END IF;
  PERFORM techerp_api.notification_business_emit(NEW.workspace_id,'ats.application.received','ats_applications',NEW.id,
   'ats_applications',NEW.id,NEW.id::text,NULL,NEW.job_id,NEW.candidate_id::text);
 ELSIF TG_TABLE_NAME='ats_interviews' THEN
  IF NEW.status IS DISTINCT FROM 'scheduled' OR NEW.scheduled_at IS NULL OR NEW.scheduled_at<=clock_timestamp() OR NEW.duration_min IS NULL OR NEW.duration_min NOT BETWEEN 5 AND 480 THEN RETURN NEW;END IF;
  IF TG_OP='UPDATE' AND OLD.status='scheduled' AND OLD.scheduled_at IS NOT DISTINCT FROM NEW.scheduled_at THEN RETURN NEW;END IF;
  IF NOT EXISTS(SELECT 1 FROM public.ats_applications a JOIN public.ats_jobs j ON j.id=a.job_id AND j.workspace_id=a.workspace_id
   JOIN public.ats_candidates c ON c.id=a.candidate_id AND c.workspace_id=a.workspace_id WHERE a.id=NEW.application_id AND a.workspace_id=NEW.workspace_id
   AND a.job_id=NEW.job_id AND a.candidate_id=NEW.candidate_id AND a.status='active' AND j.status NOT IN('closed','filled')) THEN RETURN NEW;END IF;
  revision:=extract(epoch FROM NEW.scheduled_at)::text||':'||NEW.job_id||':'||NEW.candidate_id;
  PERFORM techerp_api.notification_business_emit(NEW.workspace_id,'ats.interview.scheduled','ats_interviews',NEW.id,
   'ats_interviews',NEW.id,NEW.id||':'||extract(epoch FROM NEW.scheduled_at)::text,CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) END,NEW.application_id,revision);
 ELSE
  IF TG_OP<>'UPDATE' OR OLD.status<>'sent' OR NEW.status<>'signed' OR NOT EXISTS(SELECT 1 FROM techerp_offers.sessions
   WHERE txid=txid_current() AND offer_id=NEW.id AND operation='sign' AND actor IS NOT DISTINCT FROM auth.uid()) THEN RETURN NEW;END IF;
  SELECT NEW.revision::text||':'||encode(sha256(convert_to(d.body,'UTF8')),'hex') INTO revision FROM public.esign_documents d
   WHERE d.id=NEW.esign_document_id AND d.workspace_id=NEW.workspace_id;
  IF NOT techerp_api.notification_ats_offer_valid(NEW.workspace_id,NEW.id,NEW.esign_document_id,revision) THEN RETURN NEW;END IF;
  PERFORM techerp_api.notification_business_emit(NEW.workspace_id,'ats.offer.accepted','ats_offers',NEW.id,
   'ats_offers',NEW.id,NEW.id||':'||NEW.revision,to_jsonb(OLD),NEW.esign_document_id,revision);
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION techerp_api.notification_ats_capture() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER notification_ats_application_received AFTER INSERT ON public.ats_applications FOR EACH ROW EXECUTE FUNCTION techerp_api.notification_ats_capture();
CREATE TRIGGER notification_ats_interview_scheduled AFTER INSERT OR UPDATE OF status,scheduled_at ON public.ats_interviews FOR EACH ROW EXECUTE FUNCTION techerp_api.notification_ats_capture();
CREATE TRIGGER notification_ats_offer_accepted AFTER UPDATE OF status ON public.ats_offers FOR EACH ROW EXECUTE FUNCTION techerp_api.notification_ats_capture();

CREATE OR REPLACE FUNCTION techerp_api.notification_business_category(p_key text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$ SELECT CASE
 WHEN p_key IN('crm.deal.won','crm.deal.lost','crm.deal.stage_changed') THEN 'deal_stage'
 WHEN p_key IN('crm.proposal.accepted','contracts.signature.completed','projects.project.started') THEN 'workflow'
 WHEN p_key IN('contracts.draft.accepted','people.approval.pending') THEN 'approval'
 WHEN p_key IN('ats.application.received','ats.interview.scheduled','ats.offer.accepted','people.employment.started') THEN 'hiring'
 WHEN p_key IN('contracts.contract.expiring','contracts.contract.renewal_due','projects.project.overdue','projects.task.overdue','projects.milestone.due','people.document.expiring') THEN 'task' END $$;

CREATE OR REPLACE FUNCTION techerp_api.notification_source_visible(
  p_ws uuid,p_user uuid,p_table text,p_id uuid
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE allowed boolean;
BEGIN
  IF p_ws IS NULL OR p_user IS NULL OR p_id IS NULL
    OR p_table IS NULL OR p_table NOT IN(
      'leads','contacts','companies','deals','tickets','activities',
      'ats_jobs','ats_candidates','ats_applications','ats_interviews','ats_offers','people_documents','hiring_preparation_requests',
      'projects','project_tasks','project_milestones','contracts','financial_entries',
      'bank_payments','quotes','proposals','services','recurring_plans',
      'subscription_invoices','customer_invoices','people')
    OR current_setting('app.api_subject',true)='on'
    OR NOT public.is_workspace_member(p_ws,p_user) THEN RETURN false;
  END IF;
  INSERT INTO techerp_api.subject_sessions(txid,user_id,workspace_id,api_key_id,prev_claims)
    VALUES(txid_current(),p_user,p_ws,p_id,current_setting('request.jwt.claims',true));
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',p_user,'role','authenticated','aud','authenticated')::text,true);
  PERFORM set_config('request.jwt.claim.sub',p_user::text,true);
  PERFORM set_config('request.jwt.claim.role','authenticated',true);
  PERFORM set_config('app.api_subject','on',true);
  -- The subject inherits authenticated, not table-owner privileges. Every current
  -- permissive and restrictive SELECT policy participates in this existence test.
  EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I WHERE id=$1 AND workspace_id=$2)',p_table)
    INTO allowed USING p_id,p_ws;
  PERFORM techerp_api.leave();
  RETURN coalesce(allowed,false);
END $$;

CREATE OR REPLACE FUNCTION techerp_api.notification_center_source_visible(p_ws uuid,p_user uuid,p_table text,p_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE allowed boolean;BEGIN
 IF p_ws IS NULL OR p_user IS NULL OR p_id IS NULL OR p_table IS NULL
  OR p_user IS DISTINCT FROM auth.uid() OR coalesce(auth.role(),'')<>'authenticated'
  OR p_table NOT IN('leads','contacts','companies','deals','tickets','activities','ats_jobs','ats_candidates',
   'ats_applications','ats_interviews','ats_offers','people_documents','hiring_preparation_requests','projects','project_tasks','project_milestones','contracts',
   'financial_entries','bank_payments','quotes','proposals','services','recurring_plans',
   'subscription_invoices','customer_invoices','people','whatsapp_conversations','email_threads',
   'live_chat_sessions','linkedin_conversations','hiring_preparation_requests','contract_drafts','service_agent_sessions')
  OR current_setting('app.api_subject',true)='on' OR NOT public.is_workspace_member(p_ws,p_user)
  OR (public.work_access_context()->>'workspace') IS DISTINCT FROM p_ws::text THEN RETURN false;END IF;
 EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I WHERE id=$1 AND workspace_id=$2)',p_table)
  INTO allowed USING p_id,p_ws;
 RETURN coalesce(allowed,false);
END $$;

CREATE OR REPLACE FUNCTION techerp_api.notification_center_capture() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE t text;w uuid;candidate text;matches integer:=0;BEGIN
 IF NEW.workspace_id IS NULL OR NEW.entity_id IS NULL THEN RETURN NEW;END IF;
 t:=CASE NEW.entity
  WHEN 'lead' THEN 'leads' WHEN 'contact' THEN 'contacts' WHEN 'company' THEN 'companies'
  WHEN 'deal' THEN 'deals' WHEN 'ticket' THEN 'tickets' WHEN 'activity' THEN 'activities'
  WHEN 'person' THEN 'people' WHEN 'project' THEN 'projects' WHEN 'contract' THEN 'contracts'
  WHEN 'ats_job' THEN 'ats_jobs' WHEN 'ats_candidate' THEN 'ats_candidates'
  WHEN 'ats_application' THEN 'ats_applications' WHEN 'ats_interview' THEN 'ats_interviews'
  WHEN 'ats_offer' THEN 'ats_offers' WHEN 'people_document' THEN 'people_documents' WHEN 'person_document' THEN 'people_documents'
  WHEN 'project_task' THEN 'project_tasks' WHEN 'project_milestone' THEN 'project_milestones'
  WHEN 'contract_draft' THEN 'contract_drafts' WHEN 'service_agent_session' THEN 'service_agent_sessions'
  WHEN 'hiring_preparation_request' THEN 'hiring_preparation_requests' ELSE NEW.entity END;
 IF t='inbox_conversation' THEN
  FOREACH candidate IN ARRAY ARRAY['whatsapp_conversations','email_threads','live_chat_sessions','linkedin_conversations'] LOOP
   EXECUTE format('SELECT workspace_id FROM public.%I WHERE id=$1',candidate) INTO w USING NEW.entity_id;
   IF w=NEW.workspace_id THEN matches:=matches+1;t:=candidate;END IF;
  END LOOP;
  IF matches<>1 THEN RETURN NEW;END IF;
 ELSIF t IN('leads','contacts','companies','deals','tickets','activities','ats_jobs','ats_candidates',
  'ats_applications','ats_interviews','ats_offers','people_documents','hiring_preparation_requests','projects','project_tasks','project_milestones','contracts',
  'financial_entries','bank_payments','quotes','proposals','services','recurring_plans',
  'subscription_invoices','customer_invoices','people','hiring_preparation_requests',
  'whatsapp_conversations','email_threads','live_chat_sessions','linkedin_conversations','contract_drafts','service_agent_sessions') THEN
  EXECUTE format('SELECT workspace_id FROM public.%I WHERE id=$1',t) INTO w USING NEW.entity_id;
  IF w IS DISTINCT FROM NEW.workspace_id THEN RETURN NEW;END IF;
 ELSE RETURN NEW;END IF;
 INSERT INTO public.notification_workspace_context(notification_id,workspace_id,source_table,source_id)
  VALUES(NEW.id,NEW.workspace_id,t,NEW.entity_id);
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION techerp_api.notification_center_module(p_table text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$ SELECT CASE
 WHEN p_table IN('leads','contacts','companies','deals','tickets','activities','quotes','proposals',
  'whatsapp_conversations','email_threads','live_chat_sessions','linkedin_conversations','service_agent_sessions') THEN 'crm'
 WHEN p_table IN('ats_jobs','ats_candidates','ats_applications','ats_interviews','ats_offers') THEN 'ats'
 WHEN p_table IN('people','people_documents') THEN 'people' WHEN p_table IN('projects','project_tasks','project_milestones') THEN 'projects'
 WHEN p_table IN('contracts','contract_drafts','services') THEN 'contracts'
 WHEN p_table IN('financial_entries','bank_payments','recurring_plans','subscription_invoices','customer_invoices') THEN 'finance'
 ELSE NULL END $$;

CREATE OR REPLACE FUNCTION public.sales_event_reference_access(e text,i uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE t text;allowed boolean;w uuid:=(sales_access_context()->>'workspace')::uuid;BEGIN
 IF e='proposals' THEN RETURN sales_record_access('proposals',i,'view');END IF;
 IF e IN('lead','leads','contact','contacts','company','companies','deal','deals','ticket','tickets') THEN
  t:=CASE e WHEN 'lead' THEN 'leads' WHEN 'contact' THEN 'contacts' WHEN 'company' THEN 'companies' WHEN 'deal' THEN 'deals' WHEN 'ticket' THEN 'tickets' ELSE e END;
  RETURN sales_record_access(t,i,'view');
 END IF;
 IF e NOT IN('ats_jobs','ats_candidates','ats_applications','ats_interviews','ats_offers','people_documents','hiring_preparation_requests','people','projects','project_tasks','project_milestones','contracts','financial_entries','bank_payments','financial_recurrences','legal_entities','customer_invoices','subscription_invoices') OR i IS NULL OR w IS NULL THEN RETURN false;END IF;
 EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I WHERE id=$1 AND workspace_id=$2)',e) INTO allowed USING i,w;
 RETURN coalesce(allowed,false);
END$$;

CREATE OR REPLACE FUNCTION techerp_api.sales_worker_check(p_source text,p_id uuid,p_user uuid,p_ws uuid,p_refs jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE prev text:=current_setting('request.jwt.claims',true);c jsonb;ref jsonb;allowed boolean:=false;r text;action text;subject uuid;visible boolean;BEGIN
 IF current_setting('app.api_subject',true)='on' OR jsonb_typeof(p_refs)<>'array' OR jsonb_array_length(p_refs)>100 THEN RAISE EXCEPTION 'Contexto de execução inválido.' USING ERRCODE='42501';END IF;
 INSERT INTO techerp_api.subject_sessions(txid,user_id,workspace_id,api_key_id,prev_claims) VALUES(txid_current(),p_user,p_ws,p_id,prev);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',p_user,'role','authenticated','aud','authenticated')::text,true);
 PERFORM set_config('request.jwt.claim.sub',p_user::text,true);PERFORM set_config('request.jwt.claim.role','authenticated',true);PERFORM set_config('app.api_subject','on',true);
 c:=sales_access_context();
 allowed:=c->>'actor'=p_user::text AND c->>'workspace'=p_ws::text AND sales_record_access(p_source,p_id,'view') AND sales_record_access(p_source,p_id,CASE WHEN p_source IN('workflows','prospecting_campaigns','workflow_subscriptions','scoring_rules') THEN 'manage' ELSE 'update' END);
 IF p_source IN('whatsapp_campaigns','email_broadcasts') THEN
  allowed:=allowed AND sales_context_access(c,p_ws,'techsales.campaign_dispatch','manage',ARRAY[p_user]);
 END IF;
 IF p_source='workflows' AND EXISTS(SELECT 1 FROM public.workflows w WHERE w.id=p_id
  AND w.entity IN('ats_offers','people_documents','hiring_preparation_requests')
  AND(w.trigger?'time_based' OR w.trigger#>>'{notification_event,key}' IS DISTINCT FROM CASE w.entity
   WHEN 'ats_offers' THEN 'ats.offer.accepted' WHEN 'people_documents' THEN 'people.document.expiring' WHEN 'hiring_preparation_requests' THEN 'people.approval.pending' END)) THEN allowed:=false;END IF;
 IF p_source='workflows' AND EXISTS(SELECT 1 FROM public.workflows w WHERE w.id=p_id
  AND w.trigger#>>'{notification_event,key}'='people.approval.pending' AND NOT techerp_api.notification_hr_actions_valid(w.actions)) THEN allowed:=false;END IF;
 FOR ref IN SELECT * FROM jsonb_array_elements(p_refs) LOOP
  action:=coalesce(ref->>'action','view');
  IF action NOT IN('view','create','update','delete','assign','approve','export','manage') THEN allowed:=false;EXIT;END IF;
  IF ref?'workflow_version' THEN
   IF p_source<>'workflows' OR NOT EXISTS(SELECT 1 FROM workflows WHERE id=p_id AND published_version=(ref->>'workflow_version')::integer) THEN allowed:=false;EXIT;END IF;
  ELSIF ref?'agent_version_id' THEN
   IF p_source<>'sdr_enrollments' OR NOT EXISTS(SELECT 1 FROM sdr_enrollments e JOIN sdr_agent_versions v ON v.playbook_id=e.playbook_id AND v.workspace_id=e.workspace_id WHERE e.id=p_id AND v.id=(ref->>'agent_version_id')::uuid AND v.status='published') THEN allowed:=false;EXIT;END IF;
  ELSIF ref->>'member_id' IS NOT NULL THEN
   IF NOT EXISTS(SELECT 1 FROM workspace_members WHERE workspace_id=p_ws AND user_id=(ref->>'member_id')::uuid AND status='active') THEN allowed:=false;EXIT;END IF;
  ELSIF ref->>'record_table' IS NOT NULL THEN
   -- Read-only cross-module references execute with the source owner's actual RLS.
   r:=ref->>'record_table';
   IF r NOT IN('ats_jobs','ats_candidates','ats_applications','ats_interviews','ats_offers','people_documents','hiring_preparation_requests','projects','project_tasks','project_milestones','contracts','financial_entries','bank_payments','services','recurring_plans','subscription_invoices','customer_invoices','people','legal_entities','financial_cost_centers','financial_categories','financial_bank_accounts','subscriptions','profiles') OR ref->>'id' IS NULL THEN allowed:=false;EXIT;END IF;
   IF r IN('ats_offers','people_documents','hiring_preparation_requests') AND action<>'view' THEN allowed:=false;EXIT;END IF;
   IF r='profiles' THEN
    IF NOT EXISTS(SELECT 1 FROM workspace_members WHERE workspace_id=p_ws AND user_id=(ref->>'id')::uuid AND status='active') THEN allowed:=false;EXIT;END IF;
    SELECT EXISTS(SELECT 1 FROM profiles WHERE id=(ref->>'id')::uuid) INTO visible;
   ELSE EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I WHERE id=$1 AND workspace_id=$2)',r) INTO visible USING (ref->>'id')::uuid,p_ws;END IF;
   IF NOT coalesce(visible,false) THEN allowed:=false;EXIT;END IF;
  ELSIF ref->>'resource' IS NOT NULL THEN
   subject:=coalesce(nullif(ref->>'subject_id','')::uuid,p_user);
   IF NOT EXISTS(SELECT 1 FROM workspace_members WHERE workspace_id=p_ws AND user_id=subject AND status='active') OR NOT sales_context_access(c,p_ws,ref->>'resource',action,ARRAY[subject]) THEN allowed:=false;EXIT;END IF;
  ELSIF ref->>'table' IS NULL OR ref->>'id' IS NULL OR NOT sales_record_access(ref->>'table',(ref->>'id')::uuid,action) THEN allowed:=false;EXIT;
  END IF;
 END LOOP;
 PERFORM techerp_api.leave();RETURN coalesce(allowed,false);
END $$;


-- P10 People fragment for integration into 0399 by the migration owner.
-- Depends on canonical 0195/0198/0311/0373/0375/0381 functions/tables,
-- notification_business_emit extended for People and proof.occurred_at.
-- No data, policy, permission grant, queue or schedule is created here.

-- Use this for named People sources (and always for the two new read-only
-- sources). Existing generic people rows only lose the eight private 0198
-- fields; their public aliases remain compatible. Durable controls are not
-- source fields and are retained on resumes before the immutable proof hash.
CREATE FUNCTION techerp_api.notification_people_snapshot(p_entity text,p_payload jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
 SELECT CASE WHEN p_payload IS NULL THEN NULL WHEN jsonb_typeof(p_payload)<>'object' THEN '{}'::jsonb ELSE
  coalesce((SELECT jsonb_object_agg(k,p_payload->k) FROM unnest(CASE p_entity
   WHEN 'people' THEN ARRAY['id','workspace_id','owner_id','assigned_to','profile_id','candidate_id','manager_id','status','hire_date','termination_date','created_at','updated_at']
   WHEN 'people_documents' THEN ARRAY['id','workspace_id','owner_id','assigned_to','person_id','status','expires_at','created_at','updated_at']
   WHEN 'hiring_preparation_requests' THEN ARRAY['id','workspace_id','kind','status','revision','created_by','created_at','updated_at']
   ELSE ARRAY[]::text[] END||ARRAY['__wf_wait','__wf_state','__wf_path']) k WHERE p_payload?k),'{}'::jsonb) END
$$;
REVOKE ALL ON FUNCTION techerp_api.notification_people_snapshot(text,jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION techerp_api.notification_people_proof_current(p public.notification_business_event_proofs) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE e public.hiring_engagements;he public.hiring_employment_events;s public.hiring_execution_starts;
 pe public.people;d public.people_documents;r public.hiring_preparation_requests;a public.hiring_preparation_approvals;
 policy public.hiring_area_policies;n public.notifications;ref integer;stage text;u uuid;m uuid;c uuid;
 today date:=(now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
 IF p.event_id IS NULL OR p.workspace_id IS NULL OR p.source_id IS NULL OR public.is_test_record(p.source_id) THEN RETURN false;END IF;
 IF p.event_key='people.employment.started' THEN
  IF p.source_table<>'people' OR p.reference_id IS NULL THEN RETURN false;END IF;
  SELECT * INTO e FROM public.hiring_engagements WHERE id=p.reference_id AND workspace_id=p.workspace_id AND person_id=p.source_id;
  SELECT * INTO pe FROM public.people WHERE id=p.source_id AND workspace_id=p.workspace_id;
  IF e.id IS NULL OR e.status IS DISTINCT FROM 'active' OR e.revision::text IS DISTINCT FROM p.source_revision
   OR pe.id IS NULL OR coalesce(pe.archived,false) OR pe.status::text='terminated' THEN RETURN false;END IF;
  IF p.producer_table='hiring_employment_events' THEN
   SELECT * INTO he FROM public.hiring_employment_events WHERE id=p.producer_id AND workspace_id=p.workspace_id AND engagement_id=e.id AND kind='admitted';
   RETURN he.id IS NOT NULL AND e.application_id IS NOT NULL AND e.hiring_request_id IS NULL;
  ELSIF p.producer_table='hiring_execution_starts' THEN
   SELECT * INTO s FROM public.hiring_execution_starts WHERE id=p.producer_id AND workspace_id=p.workspace_id AND kind='professional' AND engagement_id=e.id AND request_id=e.hiring_request_id;
   RETURN coalesce(s.id IS NOT NULL AND e.purchase_contract_id=s.contract_id AND public.hiring_execution_activation_ok(p.workspace_id,s.contract_id),false);
  END IF;
  RETURN false;
 ELSIF p.event_key='people.document.expiring' THEN
  IF p.source_table<>'people_documents' OR p.producer_table<>'people_documents' OR p.producer_id IS DISTINCT FROM p.source_id THEN RETURN false;END IF;
  SELECT * INTO d FROM public.people_documents WHERE id=p.source_id AND workspace_id=p.workspace_id;
  SELECT * INTO pe FROM public.people WHERE id=d.person_id AND workspace_id=p.workspace_id;
  -- status is materialized on writes and can be stale as the clock advances.
  RETURN coalesce(d.id IS NOT NULL AND pe.id IS NOT NULL AND NOT pe.archived AND d.status::text<>'missing'
   AND d.person_id=p.reference_id AND d.expires_at=p.due_date AND p.days_before BETWEEN 1 AND 365
   AND today BETWEEN d.expires_at-p.days_before AND d.expires_at,false);
 ELSIF p.event_key='people.approval.pending' THEN
  IF p.source_table<>'hiring_preparation_requests' OR p.producer_table<>'notifications' THEN RETURN false;END IF;
  SELECT * INTO r FROM public.hiring_preparation_requests WHERE id=p.source_id AND workspace_id=p.workspace_id AND kind='professional' AND status='ready';
  SELECT * INTO a FROM public.hiring_preparation_approvals WHERE id=p.reference_id AND workspace_id=p.workspace_id AND request_id=r.id AND status='pending';
  SELECT * INTO policy FROM public.hiring_area_policies WHERE area_id=r.area_id AND workspace_id=p.workspace_id;
  SELECT revision INTO ref FROM public.hiring_preparation_reference_values WHERE request_id=r.id AND workspace_id=p.workspace_id;
  IF r.id IS NULL OR a.id IS NULL OR policy.area_id IS NULL OR a.revision<>r.revision OR a.reference_revision<>coalesce(ref,0)
   OR a.policy_revision<>policy.revision OR a.policy_snapshot IS DISTINCT FROM to_jsonb(policy) THEN RETURN false;END IF;
  m:=CASE WHEN policy.manager_id IN(r.created_by,a.requested_by) THEN policy.manager_delegate_id ELSE policy.manager_id END;
  c:=CASE WHEN policy.ceo_id IN(r.created_by,a.requested_by) THEN policy.ceo_delegate_id ELSE policy.ceo_id END;
  IF m IS DISTINCT FROM a.manager_id OR c IS DISTINCT FROM a.ceo_id THEN RETURN false;END IF;
  -- Match the canonical ordered decision: a CEO notice is current only after
  -- an actual manager approval, never merely because both IDs are configured.
  stage:=CASE WHEN EXISTS(SELECT 1 FROM public.hiring_preparation_approval_events ae WHERE ae.approval_id=a.id AND ae.workspace_id=p.workspace_id AND ae.stage='manager' AND ae.kind='approved') THEN 'ceo' ELSE 'manager' END;
  u:=CASE stage WHEN 'manager' THEN a.manager_id ELSE a.ceo_id END;
  IF EXISTS(SELECT 1 FROM unnest(ARRAY[a.manager_id,a.ceo_id]) approver WHERE approver IS NULL OR approver IN(r.created_by,a.requested_by)
   OR NOT public.hiring_preparation_approval_subject(p.workspace_id,approver,'professional','view')
   OR NOT public.hiring_preparation_approval_subject(p.workspace_id,approver,'professional','approve')
   OR NOT public.hiring_preparation_approval_subject(p.workspace_id,approver,'professional','reference_view')) THEN RETURN false;END IF;
  SELECT * INTO n FROM public.notifications WHERE id=p.producer_id AND workspace_id=p.workspace_id
   AND user_id=u AND owner_id=u AND type='hiring_preparation_approval' AND entity='hiring_preparation_request' AND entity_id=r.id
   AND dedupe_key='preparation-approval:'||a.id::text||':'||stage;
  RETURN n.id IS NOT NULL AND p.source_revision IS NOT DISTINCT FROM a.revision::text||':'||a.reference_revision::text||':'||a.policy_revision::text||':'||stage||':'||u::text;
 END IF;
 RETURN false;
END $$;
REVOKE ALL ON FUNCTION techerp_api.notification_people_proof_current(public.notification_business_event_proofs) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION techerp_api.notification_people_recipient(p_event uuid,p_user uuid) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE p public.notification_business_event_proofs;root public.notification_business_event_proofs;n public.notifications;
BEGIN
 SELECT * INTO p FROM public.notification_business_event_proofs WHERE event_id=p_event;
 IF p.event_key IS DISTINCT FROM 'people.approval.pending' THEN RETURN true;END IF;
 SELECT * INTO root FROM public.notification_business_event_proofs WHERE event_id=p.root_event_id;
 IF p_user IS NULL OR root.event_id IS NULL OR NOT public.is_workspace_member(root.workspace_id,p_user)
  OR NOT techerp_api.notification_people_proof_current(root) THEN RETURN false;END IF;
 SELECT * INTO n FROM public.notifications WHERE id=root.producer_id AND workspace_id=root.workspace_id AND user_id=p_user;
 RETURN n.id IS NOT NULL;
END $$;
REVOKE ALL ON FUNCTION techerp_api.notification_people_recipient(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION techerp_api.notification_people_existing_inapp(p_event uuid,p_user uuid) RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE p public.notification_business_event_proofs;BEGIN
 SELECT root.* INTO p FROM public.notification_business_event_proofs child JOIN public.notification_business_event_proofs root ON root.event_id=child.root_event_id
  WHERE child.event_id=p_event AND child.event_key='people.approval.pending';
 IF p.event_id IS NULL OR NOT techerp_api.notification_people_recipient(p_event,p_user) THEN RETURN NULL;END IF;
 RETURN p.producer_id;
END $$;
REVOKE ALL ON FUNCTION techerp_api.notification_people_existing_inapp(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION techerp_api.notification_people_employment_capture() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE e public.hiring_engagements;event uuid;occurred timestamptz;producer text;
BEGIN
 IF TG_TABLE_NAME='hiring_employment_events' THEN
  IF NEW.kind<>'admitted' THEN RETURN NEW;END IF;
  SELECT * INTO e FROM public.hiring_engagements WHERE id=NEW.engagement_id AND workspace_id=NEW.workspace_id AND application_id IS NOT NULL AND hiring_request_id IS NULL;
  occurred:=NEW.created_at;producer:='hiring_employment_events';
 ELSE
  IF NEW.kind<>'professional' OR NEW.engagement_id IS NULL THEN RETURN NEW;END IF;
  SELECT * INTO e FROM public.hiring_engagements WHERE id=NEW.engagement_id AND workspace_id=NEW.workspace_id AND hiring_request_id=NEW.request_id;
  occurred:=NEW.authorized_at;producer:='hiring_execution_starts';
 END IF;
 IF e.id IS NULL THEN RETURN NEW;END IF;
 event:=techerp_api.notification_business_emit(e.workspace_id,'people.employment.started','people',e.person_id,
  producer,NEW.id,e.id::text,NULL,e.id,e.revision::text);
 IF event IS NOT NULL THEN UPDATE public.notification_business_event_proofs SET occurred_at=occurred WHERE event_id=event AND root_event_id=event;END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION techerp_api.notification_people_employment_capture() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER notification_people_admitted AFTER INSERT ON public.hiring_employment_events FOR EACH ROW EXECUTE FUNCTION techerp_api.notification_people_employment_capture();
CREATE TRIGGER notification_people_direct_started AFTER INSERT ON public.hiring_execution_starts FOR EACH ROW EXECUTE FUNCTION techerp_api.notification_people_employment_capture();

-- Called only by the private canonical notifier below, not by an INSERT trigger
-- on the general notifications table. A caller-supplied notification cannot
-- independently mint a business occurrence or choose an approval recipient.
CREATE FUNCTION techerp_api.notification_people_approval_capture(p_notification uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE n public.notifications;r public.hiring_preparation_requests;a public.hiring_preparation_approvals;
 proof public.notification_business_event_proofs;stage text;event uuid;
BEGIN
 SELECT * INTO n FROM public.notifications WHERE id=p_notification AND type='hiring_preparation_approval' AND entity='hiring_preparation_request';
 IF n.id IS NULL THEN RETURN;END IF;
 SELECT * INTO r FROM public.hiring_preparation_requests WHERE id=n.entity_id AND workspace_id=n.workspace_id AND kind='professional';
 SELECT * INTO a FROM public.hiring_preparation_approvals WHERE request_id=r.id AND workspace_id=r.workspace_id AND status='pending' AND revision=r.revision;
 IF a.id IS NULL THEN RETURN;END IF;
 stage:=CASE WHEN EXISTS(SELECT 1 FROM public.hiring_preparation_approval_events ae WHERE ae.approval_id=a.id AND ae.workspace_id=n.workspace_id AND ae.stage='manager' AND ae.kind='approved') THEN 'ceo' ELSE 'manager' END;
 proof.event_id:=n.id;proof.workspace_id:=n.workspace_id;proof.event_key:='people.approval.pending';proof.source_table:='hiring_preparation_requests';proof.source_id:=r.id;
 proof.producer_table:='notifications';proof.producer_id:=n.id;proof.reference_id:=a.id;
 proof.source_revision:=a.revision::text||':'||a.reference_revision::text||':'||a.policy_revision::text||':'||stage||':'||n.user_id::text;
 IF NOT techerp_api.notification_people_proof_current(proof) THEN RETURN;END IF;
 event:=techerp_api.notification_business_emit(n.workspace_id,proof.event_key,proof.source_table,proof.source_id,
  proof.producer_table,proof.producer_id,a.id::text||':'||stage,NULL,proof.reference_id,proof.source_revision);
 IF event IS NOT NULL THEN
  UPDATE public.notification_business_event_proofs SET occurred_at=n.created_at WHERE event_id=event AND root_event_id=event;
  UPDATE public.notification_workspace_context SET event_key=proof.event_key WHERE notification_id=n.id AND workspace_id=n.workspace_id;
 END IF;
END $$;
REVOKE ALL ON FUNCTION techerp_api.notification_people_approval_capture(uuid) FROM PUBLIC,anon,authenticated,service_role;

-- Preserve the canonical notifier's current signature/OID/ACL and its supplier
-- behavior. Only a newly created professional notice invokes the private hook.
CREATE OR REPLACE FUNCTION public.hiring_preparation_approval_notify(p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
#variable_conflict use_column
DECLARE a public.hiring_preparation_approvals;r public.hiring_preparation_requests;stage text;u uuid;notice uuid;
BEGIN
 SELECT * INTO a FROM public.hiring_preparation_approvals WHERE id=p_id AND status='pending';IF NOT FOUND THEN RETURN;END IF;
 SELECT * INTO r FROM public.hiring_preparation_requests WHERE id=a.request_id AND workspace_id=a.workspace_id;
 stage:=CASE WHEN EXISTS(SELECT 1 FROM public.hiring_preparation_approval_events WHERE approval_id=a.id AND stage='manager' AND kind='approved') THEN 'ceo' ELSE 'manager' END;
 u:=CASE stage WHEN 'manager' THEN a.manager_id ELSE a.ceo_id END;
 IF NOT public.hiring_preparation_approval_subject(a.workspace_id,u,r.kind,'view') OR NOT public.hiring_preparation_approval_subject(a.workspace_id,u,r.kind,'approve') OR NOT public.hiring_preparation_approval_subject(a.workspace_id,u,r.kind,'reference_view') THEN RETURN;END IF;
 INSERT INTO public.notifications(workspace_id,owner_id,user_id,type,title,body,link,entity,entity_id,dedupe_key)
 VALUES(a.workspace_id,u,u,'hiring_preparation_approval','Solicitação de contratação para aprovação','Abra a solicitação para revisar e registrar sua decisão.',
 CASE r.kind WHEN 'professional' THEN '/people/hiring-requests' ELSE '/contracts/supplier-requests' END||'?request='||r.id::text,
 'hiring_preparation_request',r.id,'preparation-approval:'||a.id::text||':'||stage)
 ON CONFLICT(dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING RETURNING id INTO notice;
 IF notice IS NOT NULL AND r.kind='professional' THEN PERFORM techerp_api.notification_people_approval_capture(notice);END IF;
END $$;

-- Integration requirements outside this fragment:
-- * due_tick uses source docs + producer docs, reference=person_id, due=expires_at.
-- * current proof must include reference/producer/source_revision on all resumes.
-- * approval recipient gate intersects every configured selector before logging,
--   enqueue, personal claim/preflight, Slack send and central/history visibility.
-- * reuse existing_inapp instead of inserting a second Workflow notification;
--   reuse that notification_id in the same canonical delivery ledger.
-- * context event_key alone cannot prove stage ownership in central readers:
--   locate the root proof by canonical notification producer_id, check current
--   proof/recipient, and hide obsolete manager notices after CEO release.
-- * generic project/P8 rows retain their existing proof and projection behavior.


CREATE FUNCTION techerp_api.notification_hr_actions_valid(p_actions jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path=public,pg_temp AS $$
DECLARE a jsonb;b jsonb;k text;BEGIN
 IF jsonb_typeof(p_actions) IS DISTINCT FROM 'array' THEN RETURN false;END IF;
 FOR a IN SELECT value FROM jsonb_array_elements(p_actions) LOOP
  IF jsonb_typeof(a) IS DISTINCT FROM 'object' THEN RETURN false;END IF;
  IF a->>'type' IN('send_email','send_whatsapp','send_slack','send_teams','webhook','add_to_sequence','email_sequence','enroll_sequence',
   'handoff','sdr_agent','share_material','share_booking_link') THEN RETURN false;END IF;
  IF a->>'type'='send_notification' AND(a->'recipients' IS DISTINCT FROM '[{"kind":"pending_approvers"}]'::jsonb
   OR nullif(a->>'user_id','') IS NOT NULL) THEN RETURN false;END IF;
  FOREACH k IN ARRAY ARRAY['then','else','default','actions'] LOOP
   IF a?k AND NOT techerp_api.notification_hr_actions_valid(a->k) THEN RETURN false;END IF;
  END LOOP;
  FOREACH k IN ARRAY ARRAY['branches','cases'] LOOP
   IF a?k THEN
    IF jsonb_typeof(a->k) IS DISTINCT FROM 'array' THEN RETURN false;END IF;
    FOR b IN SELECT value FROM jsonb_array_elements(a->k) LOOP
     IF b?'actions' AND NOT techerp_api.notification_hr_actions_valid(b->'actions') THEN RETURN false;END IF;
    END LOOP;
   END IF;
  END LOOP;
 END LOOP;RETURN true;
END $$;
-- The non-bypass worker owner needs only this pure configuration predicate.
ALTER FUNCTION techerp_api.notification_hr_actions_valid(jsonb) OWNER TO techerp_api_subject;
REVOKE ALL ON FUNCTION techerp_api.notification_hr_actions_valid(jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION techerp_api.notification_hr_actions_valid(jsonb) TO postgres;

CREATE FUNCTION techerp_api.notification_hr_pending_approvers(p_event uuid) RETURNS uuid[]
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE recipient uuid;BEGIN
 SELECT n.user_id INTO recipient FROM public.notification_business_event_proofs child
 JOIN public.notification_business_event_proofs root ON root.event_id=child.root_event_id
 JOIN public.notifications n ON n.id=root.producer_id AND n.workspace_id=root.workspace_id
 WHERE child.event_id=p_event AND child.event_key='people.approval.pending';
 IF recipient IS NULL OR NOT techerp_api.notification_people_recipient(p_event,recipient) THEN RETURN '{}'::uuid[];END IF;
 RETURN ARRAY[recipient];
END $$;
REVOKE ALL ON FUNCTION techerp_api.notification_hr_pending_approvers(uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION techerp_api.notification_business_emit(p_workspace uuid,p_key text,p_entity text,p_source uuid,
 p_producer_table text,p_producer uuid,p_occurrence text,p_before jsonb DEFAULT NULL,
 p_reference uuid DEFAULT NULL,p_revision text DEFAULT NULL,p_workflow uuid DEFAULT NULL,p_version integer DEFAULT NULL,
 p_due date DEFAULT NULL,p_days integer DEFAULT NULL) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE source jsonb;event public.workflow_events;existing uuid;owner uuid;occurred timestamptz;hr boolean;BEGIN
 IF techerp_api.notification_business_category(p_key) IS NULL OR p_entity NOT IN('deals','proposals','contracts','projects','project_tasks','project_milestones','ats_applications','ats_interviews','ats_offers','people','people_documents','hiring_preparation_requests')
 OR p_workspace IS NULL OR p_source IS NULL OR p_producer IS NULL OR p_occurrence IS NULL
 OR public.is_read_only_view() OR public.is_test_record(p_source) THEN RETURN NULL;END IF;
 EXECUTE format('SELECT to_jsonb(s) FROM public.%I s WHERE id=$1 AND workspace_id=$2',p_entity) INTO source USING p_source,p_workspace;
 IF source IS NULL OR nullif(source->>'deleted_at','') IS NOT NULL THEN RETURN NULL;END IF;
 -- Project cost is separately projected by work_cost_projection. It cannot
 -- enter a shared event snapshot, including the old row, even for a cost reader.
 IF p_entity='projects' THEN source:=source-'planned_cost';p_before:=p_before-'planned_cost';END IF;
 hr:=p_key IN('ats.application.received','ats.interview.scheduled','ats.offer.accepted','people.employment.started','people.document.expiring','people.approval.pending');
 IF hr THEN source:=techerp_api.notification_hr_snapshot(p_entity,source);p_before:=techerp_api.notification_hr_snapshot(p_entity,p_before);END IF;
 occurred:=CASE p_key WHEN 'ats.application.received' THEN (source->>'applied_at')::timestamptz WHEN 'ats.offer.accepted' THEN (source->>'signed_at')::timestamptz ELSE clock_timestamp() END;
 owner:=coalesce(nullif(source->>'owner_id','')::uuid,(SELECT created_by FROM public.workspaces WHERE id=p_workspace));
 IF owner IS NULL THEN RETURN NULL;END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('notification-business:'||p_workspace||':'||p_key||':'||p_occurrence,0));
 IF hr AND p_due IS NULL AND EXISTS(SELECT 1 FROM public.notification_business_occurrence_receipts WHERE workspace_id=p_workspace AND event_key=p_key AND occurrence_key=p_occurrence) THEN RETURN NULL;END IF;
 SELECT event_id INTO existing FROM public.notification_business_event_proofs WHERE workspace_id=p_workspace AND event_key=p_key AND occurrence_key=p_occurrence;
 IF existing IS NOT NULL THEN RETURN CASE WHEN p_due IS NULL THEN existing END;END IF;
 IF p_due IS NOT NULL THEN
  IF EXISTS(SELECT 1 FROM public.notification_business_due_cursors WHERE workflow_id=p_workflow AND contract_id=p_source
   AND event_key=p_key AND due_date=p_due AND days_before=p_days) THEN RETURN NULL;END IF;
 END IF;
 event.id:=gen_random_uuid();event.workspace_id:=p_workspace;event.owner_id:=owner;event.entity:=p_entity;event.entity_id:=p_source;
 event.event_type:='updated';event.before:=p_before;event.after:=source;event.notification_event_key:=p_key;
 INSERT INTO public.notification_business_event_proofs(event_id,root_event_id,workspace_id,event_key,source_table,source_id,producer_table,producer_id,
 reference_id,source_revision,occurrence_key,payload_hash,workflow_id,workflow_version,due_date,days_before,occurred_at)
 VALUES(event.id,event.id,p_workspace,p_key,p_entity,p_source,p_producer_table,p_producer,p_reference,p_revision,p_occurrence,
 techerp_api.notification_business_event_hash(event),p_workflow,p_version,p_due,p_days,CASE WHEN hr THEN occurred END);
 INSERT INTO public.workflow_events(id,workspace_id,owner_id,entity,entity_id,event_type,before,after,notification_event_key)
 VALUES(event.id,p_workspace,owner,p_entity,p_source,'updated',p_before,source,p_key) RETURNING * INTO event;
 IF event.id IS NULL THEN DELETE FROM public.notification_business_event_proofs WHERE workspace_id=p_workspace AND event_key=p_key AND occurrence_key=p_occurrence;RETURN NULL;END IF;
 IF p_due IS NOT NULL THEN INSERT INTO public.notification_business_due_cursors(workflow_id,contract_id,event_key,due_date,days_before,event_id)
  VALUES(p_workflow,p_source,p_key,p_due,p_days,event.id) ON CONFLICT DO NOTHING;END IF;
 IF hr AND p_due IS NULL THEN INSERT INTO public.notification_business_occurrence_receipts(workspace_id,event_key,occurrence_key,event_id,source_table,source_id,producer_table,producer_id,reference_id,source_revision)
  VALUES(p_workspace,p_key,p_occurrence,event.id,p_entity,p_source,p_producer_table,p_producer,p_reference,p_revision);END IF;
 RETURN event.id;
END $$;

CREATE OR REPLACE FUNCTION techerp_api.notification_business_proof_current(p public.notification_business_event_proofs)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE draft public.contract_drafts;contract public.contracts;project public.projects;task public.project_tasks;
 milestone public.project_milestones;application public.ats_applications;interview public.ats_interviews;deadline date;today date:=(now() AT TIME ZONE 'America/Sao_Paulo')::date;BEGIN
 IF p.event_id IS NULL OR public.is_test_record(p.source_id) THEN RETURN false;END IF;
 IF p.event_key IN('people.employment.started','people.document.expiring','people.approval.pending') THEN
  RETURN techerp_api.notification_people_proof_current(p);
 ELSIF p.event_key='ats.application.received' THEN
  SELECT * INTO application FROM public.ats_applications WHERE id=p.source_id AND workspace_id=p.workspace_id;
  RETURN coalesce(application.status='active' AND application.job_id=p.reference_id AND application.candidate_id::text=p.source_revision
   AND EXISTS(SELECT 1 FROM public.ats_candidates WHERE id=application.candidate_id AND workspace_id=p.workspace_id)
   AND EXISTS(SELECT 1 FROM public.ats_jobs WHERE id=application.job_id AND workspace_id=p.workspace_id AND status NOT IN('closed','filled')),false);
 ELSIF p.event_key='ats.interview.scheduled' THEN
  SELECT * INTO interview FROM public.ats_interviews WHERE id=p.source_id AND workspace_id=p.workspace_id;
  RETURN coalesce(interview.status='scheduled' AND interview.scheduled_at>now() AND interview.application_id=p.reference_id
   AND (extract(epoch FROM interview.scheduled_at)::text||':'||interview.job_id||':'||interview.candidate_id)=p.source_revision
   AND EXISTS(SELECT 1 FROM public.ats_applications a JOIN public.ats_jobs j ON j.id=a.job_id AND j.workspace_id=a.workspace_id
    JOIN public.ats_candidates c ON c.id=a.candidate_id AND c.workspace_id=a.workspace_id WHERE a.id=interview.application_id AND a.workspace_id=p.workspace_id
    AND a.job_id=interview.job_id AND a.candidate_id=interview.candidate_id AND a.status='active' AND j.status NOT IN('closed','filled')),false);
 ELSIF p.event_key='ats.offer.accepted' THEN
  RETURN techerp_api.notification_ats_offer_valid(p.workspace_id,p.source_id,p.reference_id,p.source_revision);
 ELSIF p.event_key IN('projects.project.started','projects.project.overdue') THEN
  SELECT * INTO project FROM public.projects WHERE id=p.source_id AND workspace_id=p.workspace_id;
  IF project.id IS NULL THEN RETURN false;END IF;
  IF p.event_key='projects.project.started' THEN RETURN project.status::text='active';END IF;
  RETURN coalesce(project.status::text IN('planning','active') AND p.days_before=-1
   AND project.due_at=p.due_date AND project.due_at<today,false);
 ELSIF p.event_key='projects.task.overdue' THEN
  SELECT * INTO task FROM public.project_tasks WHERE id=p.source_id AND workspace_id=p.workspace_id;
  SELECT * INTO project FROM public.projects WHERE id=task.project_id AND workspace_id=p.workspace_id;
  RETURN coalesce(task.project_id=p.reference_id AND project.id IS NOT NULL
   AND project.status::text IN('planning','active','on_hold') AND techerp_api.notification_project_task_open(task)
   AND p.days_before=-1 AND task.due_at=p.due_date AND task.due_at<today,false);
 ELSIF p.event_key='projects.milestone.due' THEN
  SELECT * INTO milestone FROM public.project_milestones WHERE id=p.source_id AND workspace_id=p.workspace_id;
  SELECT * INTO project FROM public.projects WHERE id=milestone.project_id AND workspace_id=p.workspace_id;
  RETURN coalesce(milestone.project_id=p.reference_id AND project.id IS NOT NULL
   AND project.status::text IN('planning','active','on_hold') AND milestone.status::text IN('pending','in_progress')
   AND milestone.completed_at IS NULL AND milestone.due_at=p.due_date AND p.days_before BETWEEN 1 AND 365
   AND today BETWEEN milestone.due_at-p.days_before AND milestone.due_at,false);
 ELSIF p.event_key='contracts.draft.accepted' THEN
  SELECT * INTO draft FROM public.contract_drafts WHERE id=p.producer_id AND workspace_id=p.workspace_id AND deal_id=p.source_id;
  RETURN coalesce(draft.status='accepted' AND draft.client_decided_at IS NOT NULL AND draft.decided_at IS NOT NULL
   AND draft.client_acceptance_bypassed_at IS NULL AND draft.revision::text=p.source_revision
   AND EXISTS(SELECT 1 FROM public.proposals WHERE id=draft.proposal_id AND workspace_id=p.workspace_id AND deal_id=p.source_id
    AND status::text='accepted' AND locked AND decided_at IS NOT NULL),false);
 ELSIF p.event_key='contracts.signature.completed' THEN
  RETURN techerp_api.notification_business_signature_valid(p.workspace_id,p.source_id,p.reference_id,
   CASE WHEN p.producer_table='esign_documents' THEN p.producer_id END);
 ELSIF p.event_key IN('contracts.contract.expiring','contracts.contract.renewal_due') THEN
  SELECT * INTO contract FROM public.contracts WHERE id=p.source_id AND workspace_id=p.workspace_id AND status::text IN('active','renewing');
  IF contract.id IS NULL OR contract.ends_at IS NULL OR p.days_before NOT BETWEEN 1 AND 365 THEN RETURN false;END IF;
  deadline:=contract.ends_at;
  IF p.event_key='contracts.contract.renewal_due' THEN
   IF NOT coalesce(contract.auto_renew,false) OR contract.notice_days IS NULL OR contract.notice_days NOT BETWEEN 0 AND 3650 THEN RETURN false;END IF;
   deadline:=deadline-contract.notice_days;
  END IF;
  RETURN deadline=p.due_date AND (now() AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN deadline-p.days_before AND deadline;
 END IF;
 RETURN p.event_key IN('crm.deal.won','crm.deal.lost','crm.deal.stage_changed','crm.proposal.accepted');
END $$;

CREATE OR REPLACE FUNCTION public.notification_business_event_check(p_event uuid,p_workflow uuid,p_version integer) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE event public.workflow_events;proof public.notification_business_event_proofs;root_event public.workflow_events;
 root_proof public.notification_business_event_proofs;wf public.workflows;executor uuid;config jsonb;BEGIN
 PERFORM techerp_api.notification_service();
 SELECT * INTO event FROM public.workflow_events WHERE id=p_event;
 SELECT * INTO proof FROM public.notification_business_event_proofs WHERE event_id=p_event;
 SELECT * INTO root_proof FROM public.notification_business_event_proofs WHERE event_id=proof.root_event_id;
 SELECT * INTO root_event FROM public.workflow_events WHERE id=root_proof.event_id;
 SELECT * INTO wf FROM public.workflows WHERE id=p_workflow AND workspace_id=event.workspace_id AND entity=event.entity
  AND enabled AND status='published' AND published_version=p_version;
 config:=wf.trigger->'notification_event';
 IF wf.id IS NULL OR wf.last_published_at IS NULL OR proof.event_id IS NULL OR root_proof.event_id IS NULL OR root_event.id IS NULL
 OR techerp_api.notification_business_category(event.notification_event_key) IS NULL
 OR wf.trigger?'time_based' OR jsonb_typeof(config) IS DISTINCT FROM 'object' OR config->>'key' IS DISTINCT FROM proof.event_key
 OR EXISTS(SELECT 1 FROM jsonb_object_keys(config) k WHERE k NOT IN('key','days_before'))
 OR proof.workspace_id IS DISTINCT FROM event.workspace_id OR proof.source_table IS DISTINCT FROM event.entity
 OR proof.source_id IS DISTINCT FROM event.entity_id OR proof.event_key IS DISTINCT FROM event.notification_event_key
 OR proof.payload_hash IS DISTINCT FROM techerp_api.notification_business_event_hash(event)
 OR root_proof.root_event_id IS DISTINCT FROM root_proof.event_id OR root_proof.parent_event_id IS NOT NULL
 OR root_event.notification_parent_event_id IS NOT NULL
 OR root_proof.payload_hash IS DISTINCT FROM techerp_api.notification_business_event_hash(root_event)
 OR root_proof.workspace_id IS DISTINCT FROM root_event.workspace_id OR root_proof.source_table IS DISTINCT FROM root_event.entity
 OR root_proof.source_id IS DISTINCT FROM root_event.entity_id OR root_proof.event_key IS DISTINCT FROM root_event.notification_event_key
 OR ROW(proof.workspace_id,proof.event_key,proof.source_table,proof.source_id,proof.producer_table,proof.producer_id,
  proof.reference_id,proof.source_revision,proof.due_date,proof.days_before) IS DISTINCT FROM
  ROW(root_proof.workspace_id,root_proof.event_key,root_proof.source_table,root_proof.source_id,root_proof.producer_table,root_proof.producer_id,
  root_proof.reference_id,root_proof.source_revision,root_proof.due_date,root_proof.days_before)
 OR(proof.workflow_id IS NOT NULL AND(proof.workflow_id IS DISTINCT FROM wf.id OR proof.workflow_version IS DISTINCT FROM p_version))
 OR(root_proof.workflow_id IS NOT NULL AND(root_proof.workflow_id IS DISTINCT FROM wf.id OR root_proof.workflow_version IS DISTINCT FROM p_version))
 OR(event.workflow_version IS NOT NULL AND event.workflow_version IS DISTINCT FROM p_version)
 OR(event.resume_workflow_id IS NOT NULL AND event.resume_workflow_id IS DISTINCT FROM wf.id)
 OR NOT techerp_api.notification_business_proof_current(root_proof) THEN RETURN false;END IF;
 IF proof.event_key IN('contracts.contract.expiring','contracts.contract.renewal_due','projects.milestone.due','people.document.expiring') THEN
  IF jsonb_typeof(config->'days_before') IS DISTINCT FROM 'number' OR coalesce(config->>'days_before','') !~ '^[0-9]{1,3}$'
   OR(config->>'days_before')::integer NOT BETWEEN 1 AND 365 OR (config->>'days_before')::integer IS DISTINCT FROM proof.days_before THEN RETURN false;END IF;
 ELSIF proof.event_key IN('projects.project.overdue','projects.task.overdue') THEN
  IF config?'days_before' OR proof.days_before IS DISTINCT FROM -1 OR proof.due_date IS NULL
   OR ((proof.due_date+1)::timestamp AT TIME ZONE 'America/Sao_Paulo')<wf.last_published_at THEN RETURN false;END IF;
 ELSIF config?'days_before' THEN RETURN false;END IF;
 -- Each resume captured its immutable immediate parent and inherited this
 -- private root. Recheck the occurrence once, without limiting wait/poll depth.
 IF coalesce(root_proof.occurred_at,root_proof.created_at)<wf.last_published_at THEN RETURN false;END IF;
 IF proof.event_key='people.approval.pending' AND NOT techerp_api.notification_hr_actions_valid(wf.actions) THEN RETURN false;END IF;
 executor:=coalesce(wf.execution_user_id,wf.owner_id);
 RETURN public.is_workspace_member(wf.workspace_id,executor)
  AND techerp_api.notification_source_visible(wf.workspace_id,executor,wf.entity,event.entity_id)
  AND public.sales_worker_authorize('workflows',wf.id,jsonb_build_array(jsonb_build_object('workflow_version',p_version),
   CASE WHEN wf.entity IN('deals','proposals') THEN jsonb_build_object('table',wf.entity,'id',event.entity_id,'action','view')
   ELSE jsonb_build_object('record_table',wf.entity,'id',event.entity_id) END));
END $$;

CREATE OR REPLACE FUNCTION techerp_api.notification_business_run_key(p_workflow uuid,p_run uuid,p_version integer) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE wf public.workflows;run public.workflow_runs;event public.workflow_events;BEGIN
 PERFORM techerp_api.notification_service();
 SELECT * INTO wf FROM public.workflows WHERE id=p_workflow AND enabled AND status='published' AND published_version=p_version;
 SELECT * INTO run FROM public.workflow_runs WHERE id=p_run AND workflow_id=wf.id AND workspace_id=wf.workspace_id
  AND owner_id=wf.owner_id AND entity=wf.entity AND NOT is_test;
 SELECT * INTO event FROM public.workflow_events WHERE id=run.event_id AND workspace_id=wf.workspace_id AND entity=wf.entity AND entity_id=run.entity_id;
 IF wf.id IS NULL OR run.id IS NULL OR event.id IS NULL THEN RETURN NULL;END IF;
 IF event.notification_event_key IS NULL THEN
  RETURN CASE WHEN wf.entity IN('ats_offers','people_documents','hiring_preparation_requests') OR wf.trigger?'notification_event' THEN NULL ELSE 'legacy.workflow' END;
 END IF;
 IF NOT public.notification_business_event_check(event.id,wf.id,p_version) THEN RETURN NULL;END IF;
 RETURN event.notification_event_key;
END $$;

CREATE OR REPLACE FUNCTION public.notification_business_due_tick(p_limit integer DEFAULT 100) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE wf public.workflows;candidate record;config jsonb;key text;entity text;query text;offset_days integer;
 today date:=(now() AT TIME ZONE 'America/Sao_Paulo')::date;occurrence text;event uuid;enqueued integer:=0;candidates integer:=0;BEGIN
 PERFORM techerp_api.notification_service();
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Limite de eventos inválido.' USING ERRCODE='22023';END IF;
 FOR wf IN SELECT w.* FROM public.workflows w WHERE w.enabled AND w.status='published' AND w.last_published_at IS NOT NULL
  AND NOT(w.trigger?'time_based') AND w.entity IN('contracts','projects','project_tasks','project_milestones','people_documents')
  AND w.trigger#>>'{notification_event,key}' IN('contracts.contract.expiring','contracts.contract.renewal_due',
   'projects.project.overdue','projects.task.overdue','projects.milestone.due','people.document.expiring')
  ORDER BY md5(w.id::text||date_trunc('minute',now())::text) LIMIT 200 LOOP
  IF candidates>=p_limit THEN RETURN jsonb_build_object('enqueued',enqueued);END IF;
  config:=wf.trigger->'notification_event';key:=config->>'key';
  entity:=CASE WHEN key IN('contracts.contract.expiring','contracts.contract.renewal_due') THEN 'contracts'
   WHEN key='projects.project.overdue' THEN 'projects' WHEN key='projects.task.overdue' THEN 'project_tasks'
   WHEN key='projects.milestone.due' THEN 'project_milestones' WHEN key='people.document.expiring' THEN 'people_documents' END;
  IF wf.entity IS DISTINCT FROM entity OR jsonb_typeof(config) IS DISTINCT FROM 'object'
   OR EXISTS(SELECT 1 FROM jsonb_object_keys(config) k WHERE k NOT IN('key','days_before')) THEN CONTINUE;END IF;
  IF key IN('projects.project.overdue','projects.task.overdue') THEN
   IF config?'days_before' THEN CONTINUE;END IF;offset_days:=-1;
  ELSE
   IF jsonb_typeof(config->'days_before') IS DISTINCT FROM 'number' OR coalesce(config->>'days_before','') !~ '^[0-9]{1,3}$' THEN CONTINUE;END IF;
   offset_days:=(config->>'days_before')::integer;IF offset_days NOT BETWEEN 1 AND 365 THEN CONTINUE;END IF;
  END IF;
  IF NOT public.is_workspace_member(wf.workspace_id,coalesce(wf.execution_user_id,wf.owner_id))
   OR NOT public.sales_worker_authorize('workflows',wf.id,jsonb_build_array(jsonb_build_object('workflow_version',wf.published_version))) THEN CONTINUE;END IF;
  query:=CASE entity
   WHEN 'contracts' THEN $query$
    SELECT c.id,CASE WHEN $2='contracts.contract.renewal_due' THEN c.ends_at-c.notice_days ELSE c.ends_at END AS due_date,NULL::uuid AS reference_id
    FROM public.contracts c WHERE c.workspace_id=$1 AND c.status IN('active','renewing') AND c.ends_at IS NOT NULL
     AND (($2='contracts.contract.expiring' AND c.ends_at BETWEEN $4 AND $4+$3)
      OR ($2='contracts.contract.renewal_due' AND c.auto_renew AND c.notice_days BETWEEN 0 AND 3650 AND c.ends_at-c.notice_days BETWEEN $4 AND $4+$3))
     AND NOT EXISTS(SELECT 1 FROM public.notification_business_due_cursors d WHERE d.workflow_id=$6 AND d.contract_id=c.id
      AND d.event_key=$2 AND d.days_before=$3 AND d.due_date=CASE WHEN $2='contracts.contract.renewal_due' THEN c.ends_at-c.notice_days ELSE c.ends_at END)
    ORDER BY md5(c.id::text||date_trunc('minute',now())::text) LIMIT $5 $query$
   WHEN 'projects' THEN $query$
    SELECT p.id,p.due_at AS due_date,NULL::uuid AS reference_id FROM public.projects p
    WHERE p.workspace_id=$1 AND p.status IN('planning','active') AND p.due_at<$4
     AND ((p.due_at+1)::timestamp AT TIME ZONE 'America/Sao_Paulo')>=$7
     AND NOT EXISTS(SELECT 1 FROM public.notification_business_due_cursors d WHERE d.workflow_id=$6 AND d.contract_id=p.id
      AND d.event_key=$2 AND d.days_before=$3 AND d.due_date=p.due_at)
    ORDER BY md5(p.id::text||date_trunc('minute',now())::text) LIMIT $5 $query$
   WHEN 'project_tasks' THEN $query$
    SELECT t.id,t.due_at AS due_date,t.project_id AS reference_id FROM public.project_tasks t
    JOIN public.projects p ON p.id=t.project_id AND p.workspace_id=t.workspace_id
    LEFT JOIN public.project_task_statuses s ON s.id=t.custom_status_id AND s.workspace_id=t.workspace_id AND s.list_id=t.list_id
    WHERE t.workspace_id=$1 AND p.status IN('planning','active','on_hold') AND t.status IN('todo','doing','review') AND t.due_at<$4
     AND (t.custom_status_id IS NULL OR s.category IN('todo','doing'))
     AND ((t.due_at+1)::timestamp AT TIME ZONE 'America/Sao_Paulo')>=$7
     AND NOT EXISTS(SELECT 1 FROM public.notification_business_due_cursors d WHERE d.workflow_id=$6 AND d.contract_id=t.id
      AND d.event_key=$2 AND d.days_before=$3 AND d.due_date=t.due_at)
    ORDER BY md5(t.id::text||date_trunc('minute',now())::text) LIMIT $5 $query$
   WHEN 'project_milestones' THEN $query$
    SELECT m.id,m.due_at AS due_date,m.project_id AS reference_id FROM public.project_milestones m
    JOIN public.projects p ON p.id=m.project_id AND p.workspace_id=m.workspace_id
    WHERE m.workspace_id=$1 AND p.status IN('planning','active','on_hold') AND m.status IN('pending','in_progress')
     AND m.completed_at IS NULL AND m.due_at BETWEEN $4 AND $4+$3
     AND NOT EXISTS(SELECT 1 FROM public.notification_business_due_cursors d WHERE d.workflow_id=$6 AND d.contract_id=m.id
      AND d.event_key=$2 AND d.days_before=$3 AND d.due_date=m.due_at)
    ORDER BY md5(m.id::text||date_trunc('minute',now())::text) LIMIT $5 $query$
   WHEN 'people_documents' THEN $query$
    SELECT d.id,d.expires_at AS due_date,d.person_id AS reference_id FROM public.people_documents d
    JOIN public.people p ON p.id=d.person_id AND p.workspace_id=d.workspace_id
    WHERE d.workspace_id=$1 AND NOT coalesce(p.archived,false) AND d.status::text<>'missing' AND d.expires_at BETWEEN $4 AND $4+$3
     AND NOT EXISTS(SELECT 1 FROM public.notification_business_due_cursors c WHERE c.workflow_id=$6 AND c.contract_id=d.id
      AND c.event_key=$2 AND c.days_before=$3 AND c.due_date=d.expires_at)
    ORDER BY md5(d.id::text||date_trunc('minute',now())::text) LIMIT $5 $query$ END;
  FOR candidate IN EXECUTE query USING wf.workspace_id,key,offset_days,today,p_limit-candidates,wf.id,wf.last_published_at LOOP
   candidates:=candidates+1;
   IF public.is_test_record(candidate.id) OR NOT public.sales_worker_authorize('workflows',wf.id,
    jsonb_build_array(jsonb_build_object('workflow_version',wf.published_version),jsonb_build_object('record_table',entity,'id',candidate.id)))
    OR NOT techerp_api.notification_source_visible(wf.workspace_id,coalesce(wf.execution_user_id,wf.owner_id),entity,candidate.id) THEN CONTINUE;END IF;
   occurrence:=wf.id||':'||candidate.id||':'||candidate.due_date||':'||offset_days;
   event:=techerp_api.notification_business_emit(wf.workspace_id,key,entity,candidate.id,entity,candidate.id,occurrence,NULL,
    candidate.reference_id,candidate.due_date::text,wf.id,wf.published_version,candidate.due_date,offset_days);
   IF event IS NOT NULL THEN enqueued:=enqueued+1;END IF;
   IF candidates>=p_limit THEN RETURN jsonb_build_object('enqueued',enqueued);END IF;
  END LOOP;
 END LOOP;
 RETURN jsonb_build_object('enqueued',enqueued);
END $$;

CREATE OR REPLACE FUNCTION public.notification_workflow_dispatch(
  p_workflow uuid,p_run uuid,p_version integer,p_entity text,p_record uuid,
  p_rules jsonb,p_title text,p_body text,p_step text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE wf public.workflows;run public.workflow_runs;ev public.workflow_events;
  w uuid;executor uuid;source jsonb;rule jsonb;kind text;rule_id uuid;
  recipients uuid[]:='{}';selected uuid[];recipient uuid;source_project uuid;
  manager uuid;leader jsonb;policy public.hiring_area_policies;
  issues text[]:='{}';candidate_count integer:=0;sent_count integer:=0;
  excluded_count integer:=0;duplicate_count integer:=0;created uuid;
  prefs jsonb;inapp boolean;title text;body text;href text;dedupe text;
 resolved_event text;
BEGIN
  IF coalesce(auth.role(),'')<>'service_role' OR auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Execução reservada ao motor de Workflows.' USING ERRCODE='42501';
  END IF;
  -- Check the ORIGINAL request before any private subject context drops session_id.
  IF public.is_read_only_view() THEN
    RAISE EXCEPTION 'Execução de teste não pode emitir notificações.' USING ERRCODE='42501';
  END IF;
  IF p_workflow IS NULL OR p_run IS NULL OR p_version IS NULL OR p_version<1
    OR p_record IS NULL OR p_entity IS NULL OR p_step IS NULL
    OR length(p_step) NOT BETWEEN 1 AND 300 OR btrim(p_step)=''
    OR p_title IS NULL OR btrim(p_title)='' OR length(p_title)>200
    OR length(coalesce(p_body,''))>2000 OR jsonb_typeof(p_rules) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Configuração de notificação inválida.' USING ERRCODE='22023';
  END IF;
  IF jsonb_array_length(p_rules) NOT BETWEEN 1 AND 10 THEN
    RAISE EXCEPTION 'Informe de um a dez seletores de destinatários.' USING ERRCODE='22023';
  END IF;
  SELECT * INTO wf FROM public.workflows
    WHERE id=p_workflow AND enabled AND status='published' AND published_version=p_version
      AND entity=p_entity FOR SHARE;
  IF wf.id IS NULL THEN
    RAISE EXCEPTION 'Workflow indisponível ou versão desatualizada.' USING ERRCODE='42501';
  END IF;
  w:=wf.workspace_id;executor:=coalesce(wf.execution_user_id,wf.owner_id);
  SELECT * INTO run FROM public.workflow_runs
    WHERE id=p_run AND workflow_id=p_workflow AND workspace_id=w
      AND entity=p_entity AND entity_id=p_record AND status='running' AND NOT is_test
      AND owner_id=wf.owner_id FOR UPDATE;
  IF run.id IS NULL OR NOT public.is_workspace_member(w,executor) THEN
    RAISE EXCEPTION 'Execução de notificação indisponível.' USING ERRCODE='42501';
  END IF;
  SELECT * INTO ev FROM public.workflow_events
    WHERE id=run.event_id AND workspace_id=w AND entity=p_entity AND entity_id=p_record;
  IF ev.id IS NULL OR (ev.workflow_version IS NOT NULL AND ev.workflow_version<>p_version)
    OR NOT public.sales_worker_authorize('workflows',p_workflow,
      jsonb_build_array(jsonb_build_object('workflow_version',p_version),
        CASE WHEN p_entity IN('leads','contacts','companies','deals','tickets','quotes','proposals','activities')
          THEN jsonb_build_object('table',p_entity,'id',p_record,'action','view')
          ELSE jsonb_build_object('record_table',p_entity,'id',p_record) END))
    OR NOT techerp_api.notification_source_visible(w,executor,p_entity,p_record) THEN
    RAISE EXCEPTION 'Origem de notificação indisponível.' USING ERRCODE='42501';
  END IF;
  resolved_event:=techerp_api.notification_business_run_key(p_workflow,p_run,p_version);
  IF resolved_event IS NULL THEN RAISE EXCEPTION 'Ocorrência de notificação sem prova válida.' USING ERRCODE='42501';END IF;
  IF resolved_event='people.approval.pending' AND p_rules IS DISTINCT FROM '[{"kind":"pending_approvers"}]'::jsonb THEN
   RAISE EXCEPTION 'A aprovação exige seu aprovador vigente.' USING ERRCODE='42501';END IF;
  -- p_entity has passed the exact table allowlist in the private source bridge.
  EXECUTE format('SELECT to_jsonb(r) FROM public.%I r WHERE id=$1 AND workspace_id=$2',p_entity)
    INTO source USING p_record,w;
  IF source IS NULL THEN
    RAISE EXCEPTION 'Origem de notificação indisponível.' USING ERRCODE='42501';
  END IF;

  FOR rule IN SELECT value FROM jsonb_array_elements(p_rules) LOOP
    IF jsonb_typeof(rule) IS DISTINCT FROM 'object'
      OR EXISTS(SELECT 1 FROM jsonb_object_keys(rule) k WHERE k NOT IN('kind','id')) THEN
      RAISE EXCEPTION 'Seletor de destinatário inválido.' USING ERRCODE='22023';
    END IF;
    kind:=rule->>'kind';rule_id:=NULL;selected:='{}';
    IF kind IS NULL OR kind NOT IN('workflow_owner','user','source_responsible','source_creator',
      'area_manager','pending_approvers','project_members','team','job_role','followers') THEN
      RAISE EXCEPTION 'Seletor de destinatário inválido.' USING ERRCODE='22023';
    END IF;
    IF kind IN('user','team','job_role') THEN
      IF coalesce(rule->>'id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        RAISE EXCEPTION 'Identificador de destinatário inválido.' USING ERRCODE='22023';
      END IF;
      rule_id:=(rule->>'id')::uuid;
    ELSIF rule?'id' THEN
      RAISE EXCEPTION 'Seletor não aceita identificador manual.' USING ERRCODE='22023';
    END IF;
    CASE kind
      WHEN 'workflow_owner' THEN selected:=ARRAY[executor];
      WHEN 'user' THEN selected:=ARRAY[rule_id];
      WHEN 'source_creator' THEN
        -- owner_id is not universally a creator; never infer it when provenance is absent.
        selected:=ARRAY[nullif(source->>'created_by','')::uuid];
      WHEN 'source_responsible' THEN
        CASE p_entity
          WHEN 'tickets' THEN selected:=ARRAY[coalesce(nullif(source->>'assignee_id','')::uuid,nullif(source->>'owner_id','')::uuid)];
          WHEN 'ats_jobs' THEN selected:=ARRAY[coalesce(nullif(source->>'recruiter_id','')::uuid,nullif(source->>'assigned_to','')::uuid,nullif(source->>'owner_id','')::uuid)];
          WHEN 'ats_interviews' THEN selected:=ARRAY[coalesce(nullif(source->>'interviewer_id','')::uuid,nullif(source->>'assigned_to','')::uuid,nullif(source->>'owner_id','')::uuid)];
          WHEN 'project_tasks' THEN
            SELECT coalesce(array_agg(DISTINCT x),'{}') INTO selected FROM (
              SELECT DISTINCT x FROM (
              SELECT nullif(source->>'assignee_id','')::uuid x
              UNION SELECT value::uuid FROM jsonb_array_elements_text(
                CASE WHEN jsonb_typeof(source->'assignee_ids')='array' THEN source->'assignee_ids' ELSE '[]'::jsonb END)
              ) ids WHERE x IS NOT NULL ORDER BY x LIMIT 201
            ) s;
          ELSE selected:=ARRAY[coalesce(nullif(source->>'assigned_to','')::uuid,nullif(source->>'owner_id','')::uuid)];
        END CASE;
      WHEN 'area_manager' THEN
        manager:=NULL;
        IF p_entity='people' THEN
          SELECT profile_id INTO manager FROM public.people m
            WHERE m.id=nullif(source->>'manager_id','')::uuid AND m.workspace_id=w
              AND NOT coalesce((to_jsonb(m)->>'archived')::boolean,false);
        ELSIF p_entity='deals' THEN
          leader:=techerp_api.notification_deal_leader(w,executor,p_record);
          IF leader->>'status'='ok' THEN manager:=nullif(leader->>'leader_id','')::uuid;
          ELSIF leader->>'status'='ambiguous' THEN issues:=array_append(issues,'recipient_source_ambiguous');
          END IF;
        ELSIF p_entity='ats_jobs' THEN
          SELECT * INTO policy FROM public.hiring_area_policies
            WHERE workspace_id=w AND area_id=nullif(source->>'hiring_area_id','')::uuid;
          IF EXISTS(SELECT 1 FROM public.hiring_demand_requests r
            WHERE r.workspace_id=w AND r.job_id=p_record AND r.revision=nullif(source->>'hiring_revision','')::integer) THEN
            -- Only the canonical request records who asked and which substitute was
            -- selected. The job creator is not necessarily that requester.
            SELECT s.approver_id INTO manager FROM public.hiring_demand_requests r
              JOIN public.hiring_demand_steps s ON s.request_id=r.id AND s.workspace_id=r.workspace_id
              WHERE r.workspace_id=w AND r.job_id=p_record
                AND r.revision=nullif(source->>'hiring_revision','')::integer
                AND r.policy_revision=policy.revision AND r.status IN('pending','approved')
                AND s.stage='manager' AND s.status IN('pending','approved');
          ELSE manager:=policy.manager_id;END IF;
        END IF;
        selected:=ARRAY[manager];
      WHEN 'pending_approvers' THEN
        IF resolved_event='people.approval.pending' THEN selected:=techerp_api.notification_hr_pending_approvers(ev.id);
        ELSIF p_entity='contracts' THEN
          SELECT coalesce(array_agg(DISTINCT approver_id),'{}') INTO selected FROM (
            SELECT DISTINCT a.approver_id FROM public.contract_approvals a WHERE a.workspace_id=w AND a.contract_id=p_record
              AND source->>'status'='in_review'
              AND a.status='pending' AND a.superseded_at IS NULL AND a.approver_id IS NOT NULL
              AND techerp_api.notification_contract_approver(w,a.approver_id,a.id)
              AND a.sort_order=(SELECT min(b.sort_order) FROM public.contract_approvals b
                WHERE b.workspace_id=w AND b.contract_id=p_record AND b.status='pending' AND b.superseded_at IS NULL)
              AND NOT EXISTS(SELECT 1 FROM public.contract_approvals prior
                WHERE prior.workspace_id=w AND prior.contract_id=p_record AND prior.superseded_at IS NULL
                  AND prior.sort_order<a.sort_order AND prior.status<>'approved')
            ORDER BY a.approver_id LIMIT 201
          ) pending;
        ELSE
          SELECT coalesce(array_agg(DISTINCT approver_user_id),'{}') INTO selected FROM (
            SELECT DISTINCT a.approver_user_id FROM public.workflow_approvals a
              JOIN public.workflow_runs pending_run ON pending_run.id=a.run_id
                AND pending_run.workflow_id=a.workflow_id AND pending_run.workspace_id=a.workspace_id
                AND pending_run.entity=a.entity AND pending_run.entity_id=a.entity_id
                AND pending_run.status='waiting_approval' AND NOT pending_run.is_test
              WHERE a.workspace_id=w AND a.workflow_id=p_workflow
              AND a.workflow_version=p_version AND a.entity=p_entity AND a.entity_id=p_record
              AND a.status='pending' AND a.approver_user_id IS NOT NULL
              AND public.sales_workflow_approval_recipient(p_workflow,a.approver_user_id,p_entity,p_record,p_version)
            ORDER BY a.approver_user_id LIMIT 201
          ) pending;
        END IF;
      WHEN 'project_members' THEN
        source_project:=CASE WHEN p_entity='projects' THEN p_record
          WHEN p_entity IN('project_tasks','project_milestones') THEN nullif(source->>'project_id','')::uuid END;
        SELECT coalesce(array_agg(user_id),'{}') INTO selected FROM (
          SELECT DISTINCT m.user_id FROM public.project_members m JOIN public.projects p
            ON p.id=m.project_id AND p.workspace_id=m.workspace_id
            WHERE m.workspace_id=w AND p.id=source_project AND p.workspace_id=w
            ORDER BY m.user_id LIMIT 201
        ) s;
      WHEN 'team' THEN
        SELECT coalesce(array_agg(user_id),'{}') INTO selected FROM (
          SELECT DISTINCT m.user_id FROM public.user_group_members m JOIN public.user_groups g ON g.id=m.group_id
            WHERE g.id=rule_id AND g.workspace_id=w ORDER BY m.user_id LIMIT 201
        ) s;
      WHEN 'job_role' THEN
        SELECT coalesce(array_agg(user_id),'{}') INTO selected FROM (
          SELECT DISTINCT m.user_id FROM public.user_job_roles m JOIN public.job_roles r ON r.id=m.role_id
            WHERE r.id=rule_id AND m.workspace_id=w AND (r.workspace_id IS NULL OR r.workspace_id=w)
            ORDER BY m.user_id LIMIT 201
        ) s;
      WHEN 'followers' THEN issues:=array_append(issues,'followers_unavailable');
    END CASE;
    SELECT coalesce(array_agg(DISTINCT x),'{}') INTO selected FROM unnest(selected) x WHERE x IS NOT NULL;
    IF cardinality(selected)=0 AND kind<>'followers' THEN
      issues:=array_append(issues,'recipient_source_unavailable');
    END IF;
    recipients:=recipients||selected;
  END LOOP;
  SELECT coalesce(array_agg(DISTINCT x ORDER BY x),'{}') INTO recipients FROM unnest(recipients) x WHERE x IS NOT NULL;
  candidate_count:=cardinality(recipients);
  IF candidate_count>200 THEN
    RETURN jsonb_build_object('sent',0,'candidates',candidate_count,'excluded',candidate_count,
      'issues',jsonb_build_array('recipient_limit_exceeded'),'duplicate',0);
  END IF;

  -- Never render the executor's snapshot into a different user's notification.
  IF strpos(p_title,'{{')>0 OR strpos(coalesce(p_body,''),'{{')>0 THEN
    title:='Atualização no TechERP';body:='Acesse o registro para consultar os detalhes.';
  ELSE title:=p_title;body:=p_body;
  END IF;
  href:=CASE p_entity
    WHEN 'leads' THEN '/leads/'||p_record WHEN 'contacts' THEN '/contacts/'||p_record
    WHEN 'companies' THEN '/companies/'||p_record WHEN 'deals' THEN '/deals/'||p_record
    WHEN 'tickets' THEN '/tickets/'||p_record WHEN 'ats_jobs' THEN '/ats/jobs/'||p_record
    WHEN 'ats_candidates' THEN '/candidates/'||p_record
    WHEN 'ats_applications' THEN techerp_api.notification_hr_href(w,p_entity,p_record)
    WHEN 'ats_interviews' THEN techerp_api.notification_hr_href(w,p_entity,p_record)
    WHEN 'ats_offers' THEN techerp_api.notification_hr_href(w,p_entity,p_record)
    WHEN 'people_documents' THEN techerp_api.notification_hr_href(w,p_entity,p_record)
    WHEN 'hiring_preparation_requests' THEN techerp_api.notification_hr_href(w,p_entity,p_record)
    WHEN 'people' THEN techerp_api.notification_hr_href(w,p_entity,p_record)
    WHEN 'projects' THEN '/projects/'||p_record
    WHEN 'project_tasks' THEN '/projects/tasks?taskId='||p_record
    WHEN 'project_milestones' THEN techerp_api.notification_project_milestone_href(w,p_record)
    WHEN 'contracts' THEN '/contracts/'||p_record
    WHEN 'financial_entries' THEN '/finance/entries/'||p_record WHEN 'services' THEN '/services/'||p_record
    WHEN 'proposals' THEN '/proposals/'||p_record ELSE NULL END;
  FOREACH recipient IN ARRAY recipients LOOP
    IF NOT public.is_workspace_member(w,recipient)
      OR NOT techerp_api.notification_source_visible(w,recipient,p_entity,p_record)
      OR NOT techerp_api.notification_people_recipient(ev.id,recipient) THEN
      excluded_count:=excluded_count+1;issues:=array_append(issues,'recipient_unavailable');CONTINUE;
    END IF;
    SELECT notification_preferences INTO prefs FROM public.profiles WHERE id=recipient;
    IF NOT FOUND THEN
      excluded_count:=excluded_count+1;issues:=array_append(issues,'recipient_unavailable');CONTINUE;
    END IF;
    inapp:=public.notification_event_inapp(w,recipient,resolved_event);
    IF NOT coalesce(inapp,false) THEN
      excluded_count:=excluded_count+1;issues:=array_append(issues,'preferences_disabled');CONTINUE;
    END IF;
    IF resolved_event='people.approval.pending' THEN
     created:=techerp_api.notification_people_existing_inapp(ev.id,recipient);
     IF created IS NOT NULL THEN duplicate_count:=duplicate_count+1;
     ELSE excluded_count:=excluded_count+1;issues:=array_append(issues,'recipient_unavailable');END IF;
     CONTINUE;
    END IF;
    dedupe:='workflow-notification:'||p_run||':'||p_step||':'||recipient;
    created:=NULL;
    INSERT INTO public.notifications(workspace_id,owner_id,user_id,type,title,body,link,entity,entity_id,dedupe_key)
      VALUES(w,executor,recipient,'workflow',title,body,href,p_entity,p_record,dedupe)
      ON CONFLICT(dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING RETURNING id INTO created;
    IF created IS NOT NULL THEN UPDATE public.notification_workspace_context SET event_key=resolved_event WHERE notification_id=created AND workspace_id=w;sent_count:=sent_count+1;
    ELSIF EXISTS(SELECT 1 FROM public.notifications WHERE dedupe_key=dedupe) THEN duplicate_count:=duplicate_count+1;
    ELSE excluded_count:=excluded_count+1;issues:=array_append(issues,'notification_not_created');
    END IF;
  END LOOP;
  IF sent_count=0 AND duplicate_count=0 AND cardinality(issues)=0 THEN
    issues:=ARRAY['no_eligible_recipients'];
  END IF;
  SELECT coalesce(array_agg(DISTINCT x ORDER BY x),'{}') INTO issues FROM unnest(issues) x;
  RETURN jsonb_build_object('sent',sent_count,'candidates',candidate_count,'excluded',excluded_count,
    'issues',to_jsonb(issues),'duplicate',duplicate_count);
END $$;

CREATE OR REPLACE FUNCTION public.notification_workflow_dispatch_v2(
  p_workflow uuid,p_run uuid,p_version integer,p_entity text,p_record uuid,
  p_rules jsonb,p_title text,p_body text,p_step text,p_delivery jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE wf public.workflows;run public.workflow_runs;ev public.workflow_events;
  w uuid;executor uuid;source jsonb;rule jsonb;kind text;rule_id uuid;
  recipients uuid[]:='{}';selected uuid[];recipient uuid;source_project uuid;
  manager uuid;leader jsonb;policy public.hiring_area_policies;
  issues text[]:='{}';candidate_count integer:=0;sent_count integer:=0;
  excluded_count integer:=0;duplicate_count integer:=0;created uuid;
  prefs jsonb;inapp boolean;title text;body text;href text;dedupe text;
  config jsonb;channels jsonb;fallback text;intent_id uuid;intent_existed boolean;job_id uuid;
  queued_count integer:=0;requested_channel text;
 resolved_event text;
BEGIN
  IF coalesce(auth.role(),'')<>'service_role' OR auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Execução reservada ao motor de Workflows.' USING ERRCODE='42501';
  END IF;
  IF jsonb_typeof(p_delivery) IS DISTINCT FROM 'object' OR
   EXISTS(SELECT 1 FROM jsonb_object_keys(p_delivery) k WHERE k NOT IN('channels','fallback'))
   OR jsonb_typeof(p_delivery->'channels') IS DISTINCT FROM 'array' THEN
   RAISE EXCEPTION 'Canais de notificação inválidos.' USING ERRCODE='22023';END IF;
  channels:=p_delivery->'channels';fallback:=coalesce(p_delivery->>'fallback','none');
  IF jsonb_array_length(channels) NOT BETWEEN 1 AND 3 OR fallback NOT IN('none','email')
   OR EXISTS(SELECT 1 FROM jsonb_array_elements(channels)c WHERE jsonb_typeof(c)<>'string' OR c#>>'{}' NOT IN('inapp','email','whatsapp'))
   OR(SELECT count(DISTINCT c) FROM jsonb_array_elements(channels)c)<>jsonb_array_length(channels)
   OR(fallback='email' AND(NOT channels?'whatsapp' OR channels?'email')) THEN
   RAISE EXCEPTION 'Canais ou fallback inválidos.' USING ERRCODE='22023';END IF;
  SELECT jsonb_agg(c ORDER BY c) INTO channels FROM jsonb_array_elements(channels)c;
  config:=jsonb_build_object('channels',channels,'fallback',fallback);
  -- Check the ORIGINAL request before any private subject context drops session_id.
  IF public.is_read_only_view() THEN
    RAISE EXCEPTION 'Execução de teste não pode emitir notificações.' USING ERRCODE='42501';
  END IF;
  IF p_workflow IS NULL OR p_run IS NULL OR p_version IS NULL OR p_version<1
    OR p_record IS NULL OR p_entity IS NULL OR p_step IS NULL
    OR length(p_step) NOT BETWEEN 1 AND 300 OR btrim(p_step)=''
    OR p_title IS NULL OR btrim(p_title)='' OR length(p_title)>200
    OR length(coalesce(p_body,''))>2000 OR jsonb_typeof(p_rules) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Configuração de notificação inválida.' USING ERRCODE='22023';
  END IF;
  IF jsonb_array_length(p_rules) NOT BETWEEN 1 AND 10 THEN
    RAISE EXCEPTION 'Informe de um a dez seletores de destinatários.' USING ERRCODE='22023';
  END IF;
  SELECT * INTO wf FROM public.workflows
    WHERE id=p_workflow AND enabled AND status='published' AND published_version=p_version
      AND entity=p_entity FOR SHARE;
  IF wf.id IS NULL THEN
    RAISE EXCEPTION 'Workflow indisponível ou versão desatualizada.' USING ERRCODE='42501';
  END IF;
  w:=wf.workspace_id;executor:=coalesce(wf.execution_user_id,wf.owner_id);
  SELECT * INTO run FROM public.workflow_runs
    WHERE id=p_run AND workflow_id=p_workflow AND workspace_id=w
      AND entity=p_entity AND entity_id=p_record AND status='running' AND NOT is_test
      AND owner_id=wf.owner_id FOR UPDATE;
  IF run.id IS NULL OR NOT public.is_workspace_member(w,executor) THEN
    RAISE EXCEPTION 'Execução de notificação indisponível.' USING ERRCODE='42501';
  END IF;
  SELECT * INTO ev FROM public.workflow_events
    WHERE id=run.event_id AND workspace_id=w AND entity=p_entity AND entity_id=p_record;
  IF ev.id IS NULL OR (ev.workflow_version IS NOT NULL AND ev.workflow_version<>p_version)
    OR NOT public.sales_worker_authorize('workflows',p_workflow,
      jsonb_build_array(jsonb_build_object('workflow_version',p_version),
        CASE WHEN p_entity IN('leads','contacts','companies','deals','tickets','quotes','proposals','activities')
          THEN jsonb_build_object('table',p_entity,'id',p_record,'action','view')
          ELSE jsonb_build_object('record_table',p_entity,'id',p_record) END))
    OR NOT techerp_api.notification_source_visible(w,executor,p_entity,p_record) THEN
    RAISE EXCEPTION 'Origem de notificação indisponível.' USING ERRCODE='42501';
  END IF;
  IF(channels?'email' OR fallback='email') AND NOT techerp_api.notification_transport_allowed(w,executor,'email')
   OR channels?'whatsapp' AND NOT techerp_api.notification_transport_allowed(w,executor,'whatsapp') THEN
   RAISE EXCEPTION 'Executor sem permissão atual para o canal externo.' USING ERRCODE='42501';END IF;
  resolved_event:=techerp_api.notification_business_run_key(p_workflow,p_run,p_version);
  IF resolved_event IS NULL THEN RAISE EXCEPTION 'Ocorrência de notificação sem prova válida.' USING ERRCODE='42501';END IF;
  IF resolved_event='people.approval.pending' AND p_rules IS DISTINCT FROM '[{"kind":"pending_approvers"}]'::jsonb THEN
   RAISE EXCEPTION 'A aprovação exige seu aprovador vigente.' USING ERRCODE='42501';END IF;
  -- p_entity has passed the exact table allowlist in the private source bridge.
  EXECUTE format('SELECT to_jsonb(r) FROM public.%I r WHERE id=$1 AND workspace_id=$2',p_entity)
    INTO source USING p_record,w;
  IF source IS NULL THEN
    RAISE EXCEPTION 'Origem de notificação indisponível.' USING ERRCODE='42501';
  END IF;

  FOR rule IN SELECT value FROM jsonb_array_elements(p_rules) LOOP
    IF jsonb_typeof(rule) IS DISTINCT FROM 'object'
      OR EXISTS(SELECT 1 FROM jsonb_object_keys(rule) k WHERE k NOT IN('kind','id')) THEN
      RAISE EXCEPTION 'Seletor de destinatário inválido.' USING ERRCODE='22023';
    END IF;
    kind:=rule->>'kind';rule_id:=NULL;selected:='{}';
    IF kind IS NULL OR kind NOT IN('workflow_owner','user','source_responsible','source_creator',
      'area_manager','pending_approvers','project_members','team','job_role','followers') THEN
      RAISE EXCEPTION 'Seletor de destinatário inválido.' USING ERRCODE='22023';
    END IF;
    IF kind IN('user','team','job_role') THEN
      IF coalesce(rule->>'id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        RAISE EXCEPTION 'Identificador de destinatário inválido.' USING ERRCODE='22023';
      END IF;
      rule_id:=(rule->>'id')::uuid;
    ELSIF rule?'id' THEN
      RAISE EXCEPTION 'Seletor não aceita identificador manual.' USING ERRCODE='22023';
    END IF;
    CASE kind
      WHEN 'workflow_owner' THEN selected:=ARRAY[executor];
      WHEN 'user' THEN selected:=ARRAY[rule_id];
      WHEN 'source_creator' THEN
        -- owner_id is not universally a creator; never infer it when provenance is absent.
        selected:=ARRAY[nullif(source->>'created_by','')::uuid];
      WHEN 'source_responsible' THEN
        CASE p_entity
          WHEN 'tickets' THEN selected:=ARRAY[coalesce(nullif(source->>'assignee_id','')::uuid,nullif(source->>'owner_id','')::uuid)];
          WHEN 'ats_jobs' THEN selected:=ARRAY[coalesce(nullif(source->>'recruiter_id','')::uuid,nullif(source->>'assigned_to','')::uuid,nullif(source->>'owner_id','')::uuid)];
          WHEN 'ats_interviews' THEN selected:=ARRAY[coalesce(nullif(source->>'interviewer_id','')::uuid,nullif(source->>'assigned_to','')::uuid,nullif(source->>'owner_id','')::uuid)];
          WHEN 'project_tasks' THEN
            SELECT coalesce(array_agg(DISTINCT x),'{}') INTO selected FROM (
              SELECT DISTINCT x FROM (
              SELECT nullif(source->>'assignee_id','')::uuid x
              UNION SELECT value::uuid FROM jsonb_array_elements_text(
                CASE WHEN jsonb_typeof(source->'assignee_ids')='array' THEN source->'assignee_ids' ELSE '[]'::jsonb END)
              ) ids WHERE x IS NOT NULL ORDER BY x LIMIT 201
            ) s;
          ELSE selected:=ARRAY[coalesce(nullif(source->>'assigned_to','')::uuid,nullif(source->>'owner_id','')::uuid)];
        END CASE;
      WHEN 'area_manager' THEN
        manager:=NULL;
        IF p_entity='people' THEN
          SELECT profile_id INTO manager FROM public.people m
            WHERE m.id=nullif(source->>'manager_id','')::uuid AND m.workspace_id=w
              AND NOT coalesce((to_jsonb(m)->>'archived')::boolean,false);
        ELSIF p_entity='deals' THEN
          leader:=techerp_api.notification_deal_leader(w,executor,p_record);
          IF leader->>'status'='ok' THEN manager:=nullif(leader->>'leader_id','')::uuid;
          ELSIF leader->>'status'='ambiguous' THEN issues:=array_append(issues,'recipient_source_ambiguous');
          END IF;
        ELSIF p_entity='ats_jobs' THEN
          SELECT * INTO policy FROM public.hiring_area_policies
            WHERE workspace_id=w AND area_id=nullif(source->>'hiring_area_id','')::uuid;
          IF EXISTS(SELECT 1 FROM public.hiring_demand_requests r
            WHERE r.workspace_id=w AND r.job_id=p_record AND r.revision=nullif(source->>'hiring_revision','')::integer) THEN
            -- Only the canonical request records who asked and which substitute was
            -- selected. The job creator is not necessarily that requester.
            SELECT s.approver_id INTO manager FROM public.hiring_demand_requests r
              JOIN public.hiring_demand_steps s ON s.request_id=r.id AND s.workspace_id=r.workspace_id
              WHERE r.workspace_id=w AND r.job_id=p_record
                AND r.revision=nullif(source->>'hiring_revision','')::integer
                AND r.policy_revision=policy.revision AND r.status IN('pending','approved')
                AND s.stage='manager' AND s.status IN('pending','approved');
          ELSE manager:=policy.manager_id;END IF;
        END IF;
        selected:=ARRAY[manager];
      WHEN 'pending_approvers' THEN
        IF resolved_event='people.approval.pending' THEN selected:=techerp_api.notification_hr_pending_approvers(ev.id);
        ELSIF p_entity='contracts' THEN
          SELECT coalesce(array_agg(DISTINCT approver_id),'{}') INTO selected FROM (
            SELECT DISTINCT a.approver_id FROM public.contract_approvals a WHERE a.workspace_id=w AND a.contract_id=p_record
              AND source->>'status'='in_review'
              AND a.status='pending' AND a.superseded_at IS NULL AND a.approver_id IS NOT NULL
              AND techerp_api.notification_contract_approver(w,a.approver_id,a.id)
              AND a.sort_order=(SELECT min(b.sort_order) FROM public.contract_approvals b
                WHERE b.workspace_id=w AND b.contract_id=p_record AND b.status='pending' AND b.superseded_at IS NULL)
              AND NOT EXISTS(SELECT 1 FROM public.contract_approvals prior
                WHERE prior.workspace_id=w AND prior.contract_id=p_record AND prior.superseded_at IS NULL
                  AND prior.sort_order<a.sort_order AND prior.status<>'approved')
            ORDER BY a.approver_id LIMIT 201
          ) pending;
        ELSE
          SELECT coalesce(array_agg(DISTINCT approver_user_id),'{}') INTO selected FROM (
            SELECT DISTINCT a.approver_user_id FROM public.workflow_approvals a
              JOIN public.workflow_runs pending_run ON pending_run.id=a.run_id
                AND pending_run.workflow_id=a.workflow_id AND pending_run.workspace_id=a.workspace_id
                AND pending_run.entity=a.entity AND pending_run.entity_id=a.entity_id
                AND pending_run.status='waiting_approval' AND NOT pending_run.is_test
              WHERE a.workspace_id=w AND a.workflow_id=p_workflow
              AND a.workflow_version=p_version AND a.entity=p_entity AND a.entity_id=p_record
              AND a.status='pending' AND a.approver_user_id IS NOT NULL
              AND public.sales_workflow_approval_recipient(p_workflow,a.approver_user_id,p_entity,p_record,p_version)
            ORDER BY a.approver_user_id LIMIT 201
          ) pending;
        END IF;
      WHEN 'project_members' THEN
        source_project:=CASE WHEN p_entity='projects' THEN p_record
          WHEN p_entity IN('project_tasks','project_milestones') THEN nullif(source->>'project_id','')::uuid END;
        SELECT coalesce(array_agg(user_id),'{}') INTO selected FROM (
          SELECT DISTINCT m.user_id FROM public.project_members m JOIN public.projects p
            ON p.id=m.project_id AND p.workspace_id=m.workspace_id
            WHERE m.workspace_id=w AND p.id=source_project AND p.workspace_id=w
            ORDER BY m.user_id LIMIT 201
        ) s;
      WHEN 'team' THEN
        SELECT coalesce(array_agg(user_id),'{}') INTO selected FROM (
          SELECT DISTINCT m.user_id FROM public.user_group_members m JOIN public.user_groups g ON g.id=m.group_id
            WHERE g.id=rule_id AND g.workspace_id=w ORDER BY m.user_id LIMIT 201
        ) s;
      WHEN 'job_role' THEN
        SELECT coalesce(array_agg(user_id),'{}') INTO selected FROM (
          SELECT DISTINCT m.user_id FROM public.user_job_roles m JOIN public.job_roles r ON r.id=m.role_id
            WHERE r.id=rule_id AND m.workspace_id=w AND (r.workspace_id IS NULL OR r.workspace_id=w)
            ORDER BY m.user_id LIMIT 201
        ) s;
      WHEN 'followers' THEN issues:=array_append(issues,'followers_unavailable');
    END CASE;
    SELECT coalesce(array_agg(DISTINCT x),'{}') INTO selected FROM unnest(selected) x WHERE x IS NOT NULL;
    IF cardinality(selected)=0 AND kind<>'followers' THEN
      issues:=array_append(issues,'recipient_source_unavailable');
    END IF;
    recipients:=recipients||selected;
  END LOOP;
  SELECT coalesce(array_agg(DISTINCT x ORDER BY x),'{}') INTO recipients FROM unnest(recipients) x WHERE x IS NOT NULL;
  candidate_count:=cardinality(recipients);
  IF candidate_count>200 THEN
    RETURN jsonb_build_object('sent',0,'candidates',candidate_count,'excluded',candidate_count,
      'issues',jsonb_build_array('recipient_limit_exceeded'),'duplicate',0);
  END IF;

  -- Never render the executor's snapshot into a different user's notification.
  IF strpos(p_title,'{{')>0 OR strpos(coalesce(p_body,''),'{{')>0 THEN
    title:='Atualização no TechERP';body:='Acesse o registro para consultar os detalhes.';
  ELSE title:=p_title;body:=p_body;
  END IF;
  href:=CASE p_entity
    WHEN 'leads' THEN '/leads/'||p_record WHEN 'contacts' THEN '/contacts/'||p_record
    WHEN 'companies' THEN '/companies/'||p_record WHEN 'deals' THEN '/deals/'||p_record
    WHEN 'tickets' THEN '/tickets/'||p_record WHEN 'ats_jobs' THEN '/ats/jobs/'||p_record
    WHEN 'ats_candidates' THEN '/candidates/'||p_record
    WHEN 'ats_applications' THEN techerp_api.notification_hr_href(w,p_entity,p_record)
    WHEN 'ats_interviews' THEN techerp_api.notification_hr_href(w,p_entity,p_record)
    WHEN 'ats_offers' THEN techerp_api.notification_hr_href(w,p_entity,p_record)
    WHEN 'people_documents' THEN techerp_api.notification_hr_href(w,p_entity,p_record)
    WHEN 'hiring_preparation_requests' THEN techerp_api.notification_hr_href(w,p_entity,p_record)
    WHEN 'people' THEN techerp_api.notification_hr_href(w,p_entity,p_record)
    WHEN 'projects' THEN '/projects/'||p_record
    WHEN 'project_tasks' THEN '/projects/tasks?taskId='||p_record
    WHEN 'project_milestones' THEN techerp_api.notification_project_milestone_href(w,p_record)
    WHEN 'contracts' THEN '/contracts/'||p_record
    WHEN 'financial_entries' THEN '/finance/entries/'||p_record WHEN 'services' THEN '/services/'||p_record
    WHEN 'proposals' THEN '/proposals/'||p_record ELSE NULL END;
  FOREACH recipient IN ARRAY recipients LOOP
    IF NOT public.is_workspace_member(w,recipient)
      OR NOT techerp_api.notification_source_visible(w,recipient,p_entity,p_record)
      OR NOT techerp_api.notification_people_recipient(ev.id,recipient) THEN
      excluded_count:=excluded_count+1;issues:=array_append(issues,'recipient_unavailable');CONTINUE;
    END IF;
    SELECT notification_preferences INTO prefs FROM public.profiles WHERE id=recipient;
    IF NOT FOUND THEN
      excluded_count:=excluded_count+1;issues:=array_append(issues,'recipient_unavailable');CONTINUE;
    END IF;
    intent_id:=NULL;
    INSERT INTO public.notification_delivery_intents(workspace_id,workflow_id,run_id,workflow_version,step_path,
     source_table,source_id,recipient_user_id,event_key,delivery_config,payload_content_neutral)
    VALUES(w,p_workflow,p_run,p_version,p_step,p_entity,p_record,recipient,resolved_event,config,
     jsonb_build_object('title','Atualização no TechERP','body','Consulte a central de notificações do TechERP.','href',href))
    ON CONFLICT(workspace_id,run_id,step_path,recipient_user_id) DO NOTHING RETURNING id INTO intent_id;
    intent_existed:=intent_id IS NULL;
    IF intent_existed THEN
     SELECT id INTO intent_id FROM public.notification_delivery_intents WHERE workspace_id=w AND run_id=p_run AND step_path=p_step
      AND recipient_user_id=recipient AND workflow_id=p_workflow AND workflow_version=p_version AND source_table=p_entity AND source_id=p_record
      AND delivery_config=config AND event_key=resolved_event;
     IF intent_id IS NULL THEN RAISE EXCEPTION 'A ocorrência já possui outra configuração.' USING ERRCODE='22023';END IF;
    END IF;
    IF resolved_event='people.approval.pending' THEN
     created:=techerp_api.notification_people_existing_inapp(ev.id,recipient);
     IF created IS NULL THEN RAISE EXCEPTION 'A aprovação mudou antes da entrega.' USING ERRCODE='42501';END IF;
     UPDATE public.notification_delivery_intents SET notification_id=created WHERE id=intent_id AND notification_id IS NULL;
    END IF;
    FOR requested_channel IN SELECT value#>>'{}' FROM jsonb_array_elements(channels) LOOP
     IF requested_channel='inapp' THEN CONTINUE;END IF;
     job_id:=NULL;
     INSERT INTO public.workflow_deliveries(workspace_id,workflow_id,idempotency_key,step_path,channel,recipient,status,attempts,
      next_attempt_at,notification_intent_id)
     VALUES(w,p_workflow,'nfd:'||intent_id||':'||requested_channel,p_step,requested_channel,'user:'||recipient,'queued',0,now(),intent_id)
     ON CONFLICT(notification_intent_id,channel) WHERE notification_intent_id IS NOT NULL DO NOTHING RETURNING id INTO job_id;
     IF job_id IS NOT NULL THEN queued_count:=queued_count+1;END IF;
    END LOOP;
    inapp:=channels?'inapp' AND public.notification_event_inapp(w,recipient,resolved_event);
    IF inapp THEN
     IF resolved_event='people.approval.pending' THEN
      created:=techerp_api.notification_people_existing_inapp(ev.id,recipient);
      IF created IS NOT NULL THEN duplicate_count:=duplicate_count+1;
       UPDATE public.notification_delivery_intents SET notification_id=created WHERE id=intent_id AND notification_id IS NULL;
      ELSE excluded_count:=excluded_count+1;issues:=array_append(issues,'recipient_unavailable');END IF;
     ELSE
     dedupe:='workflow-notification:'||p_run||':'||p_step||':'||recipient;created:=NULL;
     INSERT INTO public.notifications(workspace_id,owner_id,user_id,type,title,body,link,entity,entity_id,dedupe_key)
      VALUES(w,executor,recipient,'workflow',title,body,href,p_entity,p_record,dedupe)
      ON CONFLICT(dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING RETURNING id INTO created;
     IF created IS NOT NULL THEN UPDATE public.notification_workspace_context SET event_key=resolved_event WHERE notification_id=created AND workspace_id=w;sent_count:=sent_count+1;
     ELSE SELECT id INTO created FROM public.notifications WHERE dedupe_key=dedupe;
      IF created IS NOT NULL THEN duplicate_count:=duplicate_count+1;
      ELSE excluded_count:=excluded_count+1;issues:=array_append(issues,'notification_not_created');END IF;
     END IF;
     IF created IS NOT NULL THEN UPDATE public.notification_delivery_intents SET notification_id=created WHERE id=intent_id AND notification_id IS NULL;END IF;
     END IF;
    ELSE
     IF channels?'inapp' THEN excluded_count:=excluded_count+1;issues:=array_append(issues,'preferences_disabled');END IF;
     IF intent_existed THEN duplicate_count:=duplicate_count+1;END IF;
    END IF;
  END LOOP;
  IF sent_count=0 AND duplicate_count=0 AND queued_count=0 AND cardinality(issues)=0 THEN
    issues:=ARRAY['no_eligible_recipients'];
  END IF;
  SELECT coalesce(array_agg(DISTINCT x ORDER BY x),'{}') INTO issues FROM unnest(issues) x;
  RETURN jsonb_build_object('sent',sent_count,'candidates',candidate_count,'excluded',excluded_count,
    'issues',to_jsonb(issues),'duplicate',duplicate_count,'queued',queued_count,'suppressed',0);
END $$;

CREATE OR REPLACE FUNCTION techerp_api.notification_intent_context(p_intent uuid,p_channel text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE i public.notification_delivery_intents;wf public.workflows;r public.workflow_runs;executor uuid;
 p public.notification_delivery_policies;c public.notification_delivery_consents;email text;phone text;quiet timestamptz;
 href text; resolved_event text;
BEGIN
 SELECT * INTO i FROM public.notification_delivery_intents WHERE id=p_intent;
 IF i.id IS NULL THEN RETURN jsonb_build_object('allowed',false,'reason','invalid_configuration');END IF;
 SELECT * INTO wf FROM public.workflows WHERE id=i.workflow_id AND workspace_id=i.workspace_id
  AND status='published' AND enabled AND published_version=i.workflow_version AND entity=i.source_table;
 IF wf.id IS NULL THEN RETURN jsonb_build_object('allowed',false,'reason','workflow_changed');END IF;
 SELECT * INTO r FROM public.workflow_runs WHERE id=i.run_id AND workflow_id=wf.id AND workspace_id=i.workspace_id
  AND entity=i.source_table AND entity_id=i.source_id AND owner_id=wf.owner_id AND NOT is_test
  AND status NOT IN('failed','cancelled','canceled','error');
 IF r.id IS NULL THEN RETURN jsonb_build_object('allowed',false,'reason','run_unavailable');END IF;
 resolved_event:=techerp_api.notification_business_run_key(i.workflow_id,i.run_id,i.workflow_version);
 IF resolved_event IS NULL OR i.event_key IS DISTINCT FROM resolved_event THEN RETURN jsonb_build_object('allowed',false,'reason','workflow_changed');END IF;
 IF NOT techerp_api.notification_people_recipient(r.event_id,i.recipient_user_id) THEN
  RETURN jsonb_build_object('allowed',false,'reason','recipient_unavailable');END IF;
 executor:=coalesce(wf.execution_user_id,wf.owner_id);
 IF NOT public.is_workspace_member(i.workspace_id,executor) OR NOT public.is_workspace_member(i.workspace_id,i.recipient_user_id)
 OR NOT techerp_api.notification_source_visible(i.workspace_id,executor,i.source_table,i.source_id)
 OR NOT techerp_api.notification_source_visible(i.workspace_id,i.recipient_user_id,i.source_table,i.source_id)
 OR NOT public.sales_worker_authorize('workflows',wf.id,jsonb_build_array(jsonb_build_object('workflow_version',i.workflow_version),
 CASE WHEN i.source_table IN('leads','contacts','companies','deals','tickets','quotes','proposals','activities')
 THEN jsonb_build_object('table',i.source_table,'id',i.source_id,'action','view')
 ELSE jsonb_build_object('record_table',i.source_table,'id',i.source_id)END)) THEN
  RETURN jsonb_build_object('allowed',false,'reason','recipient_unavailable');END IF;
 IF NOT techerp_api.notification_transport_allowed(i.workspace_id,executor,p_channel) THEN
  RETURN jsonb_build_object('allowed',false,'reason','executor_transport_forbidden');END IF;
 SELECT * INTO p FROM public.notification_delivery_policies WHERE workspace_id=i.workspace_id;
 IF p_channel='whatsapp' AND EXISTS(SELECT 1 FROM public.notification_whatsapp_health h WHERE h.workspace_id=i.workspace_id
  AND h.paused_until='infinity'::timestamptz AND(NOT coalesce(p.whatsapp_enabled,false) OR h.connection_id IN(
   SELECT n.connection_id FROM public.wa_cloud_numbers n WHERE n.workspace_id=i.workspace_id AND n.phone_number_id=p.wa_sender_id))) THEN
  RETURN jsonb_build_object('allowed',false,'reason','provider_rate_limited');END IF;
 IF p.workspace_id IS NULL OR(p_channel='email' AND NOT p.email_enabled) OR(p_channel='whatsapp' AND NOT p.whatsapp_enabled) THEN
  RETURN jsonb_build_object('allowed',false,'reason','policy_disabled');END IF;
 IF p_channel='email' THEN
  IF NOT techerp_api.notification_external_event_preference(i.workspace_id,i.recipient_user_id,'email',i.event_key) THEN
   RETURN jsonb_build_object('allowed',false,'reason','preferences_disabled');END IF;
  SELECT u.email INTO email FROM auth.users u WHERE u.id=i.recipient_user_id AND u.email_confirmed_at IS NOT NULL
    AND u.email IS NOT NULL AND length(u.email)<=320 AND strpos(u.email,'@')>1;
  IF email IS NULL THEN RETURN jsonb_build_object('allowed',false,'reason','email_unconfirmed');END IF;
 ELSIF p_channel='whatsapp' THEN
  SELECT p2.phone INTO phone FROM public.profiles p2 WHERE id=i.recipient_user_id;
  SELECT * INTO c FROM public.notification_delivery_consents WHERE workspace_id=i.workspace_id AND user_id=i.recipient_user_id;
  IF c.user_id IS NULL THEN RETURN jsonb_build_object('allowed',false,'reason','consent_missing');END IF;
  IF c.revoked_at IS NOT NULL OR c.granted_at IS NULL THEN RETURN jsonb_build_object('allowed',false,'reason','consent_revoked');END IF;
  IF phone IS NULL OR phone !~ '^\+[1-9][0-9]{7,14}$' OR phone IS DISTINCT FROM c.phone THEN
   RETURN jsonb_build_object('allowed',false,'reason','endpoint_changed');END IF;
  IF p.wa_sender_id IS NULL OR p.wa_template_name IS NULL OR p.wa_template_language IS NULL
   OR p.wa_estimated_unit_micros<=0 OR p.wa_daily_budget_micros<p.wa_estimated_unit_micros THEN
   RETURN jsonb_build_object('allowed',false,'reason','invalid_configuration');END IF;
  IF NOT EXISTS(SELECT 1 FROM public.wa_cloud_numbers n JOIN public.wa_cloud_connections connection ON connection.id=n.connection_id AND connection.workspace_id=n.workspace_id
    WHERE n.workspace_id=i.workspace_id AND n.phone_number_id=p.wa_sender_id AND n.available AND n.status='CONNECTED'
     AND connection.enabled AND connection.webhook_verified_at IS NOT NULL) THEN
   RETURN jsonb_build_object('allowed',false,'reason','sender_unavailable');END IF;
  IF NOT EXISTS(SELECT 1 FROM public.wa_cloud_numbers n WHERE n.workspace_id=i.workspace_id AND n.phone_number_id=p.wa_sender_id
    AND upper(coalesce(n.quality_rating,'')) IN('GREEN','HIGH')) THEN
   RETURN jsonb_build_object('allowed',false,'reason','provider_rate_limited');END IF;
  IF EXISTS(SELECT 1 FROM public.whatsapp_number_suppressions s WHERE s.workspace_id=i.workspace_id
   AND s.phone_key=public.wa_phone_key(phone) AND s.released_at IS NULL AND s.expires_at>now()) THEN
   RETURN jsonb_build_object('allowed',false,'reason','recipient_suppressed');END IF;
  IF NOT techerp_api.notification_whatsapp_event_preference(i.workspace_id,i.recipient_user_id,i.event_key) THEN
   RETURN jsonb_build_object('allowed',false,'reason','preferences_disabled');END IF;
 ELSE RETURN jsonb_build_object('allowed',false,'reason','invalid_configuration');END IF;
 quiet:=techerp_api.notification_quiet_until(i.workspace_id,i.recipient_user_id);
 IF quiet='infinity'::timestamptz THEN RETURN jsonb_build_object('allowed',false,'reason','invalid_preferences');END IF;
 IF quiet IS NOT NULL THEN RETURN jsonb_build_object('allowed',false,'reason','quiet_hours','nextAttemptAt',quiet);END IF;
 href:=i.payload_content_neutral->>'href';
 RETURN jsonb_build_object('allowed',true,'workspaceId',i.workspace_id,'workflowId',i.workflow_id,'runId',i.run_id,
  'recipientId',i.recipient_user_id,'email',email,'phone',phone,'senderPhoneNumberId',CASE WHEN p_channel='whatsapp' THEN p.wa_sender_id END,
  'templateName',CASE WHEN p_channel='whatsapp' THEN p.wa_template_name END,'templateLanguage',CASE WHEN p_channel='whatsapp' THEN p.wa_template_language END,
  'policyRevision',p.revision,'consentRevision',CASE WHEN p_channel='whatsapp' THEN c.revision END,
  'endpointHash',encode(sha256(convert_to(p_channel||':'||coalesce(email,phone),'UTF8')),'hex'),
  'source',jsonb_build_object('table',i.source_table,'id',i.source_id,'href',href));
END $$;

CREATE OR REPLACE FUNCTION public.notification_workflow_slack_dispatch(p_workspace uuid,p_workflow uuid,p_run uuid,p_step_path text,p_version integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE wf public.workflows;r public.workflow_runs;p public.notification_slack_policies;s public.slack_integrations;i uuid;created uuid;c jsonb; resolved_event text;
BEGIN
 PERFORM techerp_api.notification_service();
 IF p_version IS NULL OR p_version<1 OR p_step_path IS NULL OR length(p_step_path) NOT BETWEEN 1 AND 300 OR btrim(p_step_path)='' THEN
 RAISE EXCEPTION 'Etapa Slack inválida.' USING ERRCODE='22023';END IF;
 SELECT * INTO wf FROM public.workflows WHERE id=p_workflow AND workspace_id=p_workspace AND status='published' AND enabled AND published_version=p_version FOR SHARE;
 SELECT * INTO r FROM public.workflow_runs WHERE id=p_run AND workflow_id=p_workflow AND workspace_id=p_workspace
 AND entity=wf.entity AND owner_id=wf.owner_id AND status='running' AND NOT is_test FOR UPDATE;
 IF wf.id IS NULL OR r.id IS NULL THEN RAISE EXCEPTION 'Execução Slack indisponível.' USING ERRCODE='42501';END IF;
 resolved_event:=techerp_api.notification_business_run_key(wf.id,r.id,p_version);
 IF resolved_event='people.approval.pending' THEN RAISE EXCEPTION 'Aprovação não admite canal compartilhado.' USING ERRCODE='42501';END IF;
 IF resolved_event IS NULL THEN RAISE EXCEPTION 'Ocorrência Slack sem prova válida.' USING ERRCODE='42501';END IF;
 SELECT * INTO p FROM public.notification_slack_policies WHERE workspace_id=p_workspace;
 IF p.workspace_id IS NULL OR NOT p.enabled OR p.integration_id IS NULL THEN RETURN jsonb_build_object('result','suppressed','reason','policy_disabled');END IF;
 SELECT * INTO s FROM public.slack_integrations WHERE id=p.integration_id AND workspace_id=p_workspace;
 IF s.id IS NULL THEN RAISE EXCEPTION 'Integração Slack indisponível.' USING ERRCODE='42501';END IF;
 INSERT INTO public.notification_slack_intents(workspace_id,workflow_id,run_id,workflow_version,step_path,source_table,source_id,integration_id,endpoint_revision,endpoint_hash,policy_revision,event_key)
 VALUES(p_workspace,wf.id,r.id,wf.published_version,p_step_path,r.entity,r.entity_id,p.integration_id,s.notification_endpoint_revision,encode(sha256(convert_to(s.access_token,'UTF8')),'hex'),p.revision,resolved_event)
 ON CONFLICT(workspace_id,run_id,workflow_version,step_path,integration_id) DO NOTHING RETURNING id INTO i;
 IF i IS NULL THEN SELECT id INTO i FROM public.notification_slack_intents WHERE workspace_id=p_workspace AND run_id=r.id
 AND workflow_version=wf.published_version AND step_path=p_step_path AND integration_id=p.integration_id;END IF;
 c:=techerp_api.notification_slack_context(i);
 IF NOT coalesce((c->>'allowed')::boolean,false) THEN RAISE EXCEPTION 'Canal ou origem Slack indisponível: %.',c->>'reason' USING ERRCODE='42501';END IF;
 INSERT INTO public.workflow_deliveries(workspace_id,workflow_id,idempotency_key,step_path,channel,status,attempts,notification_slack_intent_id)
 VALUES(p_workspace,wf.id,'notification-slack:'||p_workspace||':'||r.id||':'||wf.published_version||':'||p_step_path||':'||p.integration_id,p_step_path,'slack','queued',0,i)
 ON CONFLICT(notification_slack_intent_id,channel) WHERE notification_slack_intent_id IS NOT NULL DO NOTHING RETURNING id INTO created;
 RETURN jsonb_build_object('result',CASE WHEN created IS NULL THEN 'duplicate' ELSE 'queued' END,'deliveryId',coalesce(created,(SELECT id FROM public.workflow_deliveries WHERE notification_slack_intent_id=i AND channel='slack')));
END $$;

CREATE OR REPLACE FUNCTION techerp_api.notification_slack_context(p_intent uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE i public.notification_slack_intents;wf public.workflows;r public.workflow_runs;ev public.workflow_events;
 p public.notification_slack_policies;s public.slack_integrations;executor uuid;matches integer; resolved_event text;
BEGIN
 SELECT * INTO i FROM public.notification_slack_intents WHERE id=p_intent;
 IF i.id IS NULL THEN RETURN jsonb_build_object('allowed',false,'reason','invalid_configuration');END IF;
 SELECT * INTO wf FROM public.workflows WHERE id=i.workflow_id AND workspace_id=i.workspace_id AND enabled AND status='published'
 AND published_version=i.workflow_version AND entity=i.source_table;
 IF wf.id IS NULL THEN RETURN jsonb_build_object('allowed',false,'reason','workflow_changed');END IF;
 SELECT * INTO r FROM public.workflow_runs WHERE id=i.run_id AND workflow_id=wf.id AND workspace_id=i.workspace_id
 AND entity=i.source_table AND entity_id=i.source_id AND owner_id=wf.owner_id AND NOT is_test AND status NOT IN('failed','cancelled','canceled','error');
 SELECT * INTO ev FROM public.workflow_events WHERE id=r.event_id AND workspace_id=i.workspace_id AND entity=i.source_table AND entity_id=i.source_id
 AND(workflow_version IS NULL OR workflow_version=i.workflow_version);
 executor:=coalesce(wf.execution_user_id,wf.owner_id);
 IF r.id IS NULL OR ev.id IS NULL OR NOT public.is_workspace_member(i.workspace_id,executor)
 OR NOT techerp_api.notification_source_visible(i.workspace_id,executor,i.source_table,i.source_id)
 OR NOT public.sales_worker_authorize('workflows',wf.id,jsonb_build_array(jsonb_build_object('workflow_version',i.workflow_version),
 CASE WHEN i.source_table IN('leads','contacts','companies','deals','tickets','quotes','proposals','activities') THEN jsonb_build_object('table',i.source_table,'id',i.source_id,'action','view')
 ELSE jsonb_build_object('record_table',i.source_table,'id',i.source_id) END)) THEN
 RETURN jsonb_build_object('allowed',false,'reason','executor_unavailable');END IF;
 resolved_event:=techerp_api.notification_business_run_key(wf.id,r.id,i.workflow_version);
 IF resolved_event='people.approval.pending' THEN RETURN jsonb_build_object('allowed',false,'reason','invalid_configuration');END IF;
 IF resolved_event IS NULL OR i.event_key IS DISTINCT FROM resolved_event THEN RETURN jsonb_build_object('allowed',false,'reason','workflow_changed');END IF;
 SELECT count(*) INTO matches FROM techerp_api.notification_slack_actions(wf.actions) a WHERE a.step_path=i.step_path
 AND a.action->>'type'='send_slack' AND nullif(btrim(a.action->>'channel'),'') IS NULL;
 IF matches=0 THEN RETURN jsonb_build_object('allowed',false,'reason','invalid_configuration');END IF;
 SELECT * INTO p FROM public.notification_slack_policies WHERE workspace_id=i.workspace_id;
 IF p.workspace_id IS NULL OR NOT p.enabled OR p.integration_id IS DISTINCT FROM i.integration_id THEN
 RETURN jsonb_build_object('allowed',false,'reason','policy_disabled');END IF;
 SELECT * INTO s FROM public.slack_integrations WHERE id=i.integration_id AND workspace_id=i.workspace_id;
 IF p.revision IS DISTINCT FROM i.policy_revision OR s.notification_endpoint_revision IS DISTINCT FROM i.endpoint_revision
 OR encode(sha256(convert_to(s.access_token,'UTF8')),'hex') IS DISTINCT FROM i.endpoint_hash THEN
 RETURN jsonb_build_object('allowed',false,'reason','endpoint_changed');END IF;
 IF s.id IS NULL OR nullif(btrim(s.access_token),'') IS NULL OR NOT techerp_api.notification_slack_integration_access(i.workspace_id,executor,s.id,true) THEN
 RETURN jsonb_build_object('allowed',false,'reason','executor_transport_forbidden');END IF;
 RETURN jsonb_build_object('allowed',true,'workspaceId',i.workspace_id,'workflowId',i.workflow_id,'runId',i.run_id,
 'integrationId',s.id,'endpointRevision',s.notification_endpoint_revision,
 'endpointHash',encode(sha256(convert_to(s.access_token,'UTF8')),'hex'),'policyRevision',p.revision,'templateVersion',p.template_version);
END $$;

-- A canonical preparation notice is retagged only when newly proven. Its
-- visibility follows the current approval stage, not a caller-supplied context.
CREATE FUNCTION techerp_api.notification_hr_notice_visible(p_notice uuid,p_user uuid) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE proof public.notification_business_event_proofs;tag text;BEGIN
 IF p_notice IS NULL OR p_user IS NULL THEN RETURN false;END IF;
 SELECT root.* INTO proof FROM public.notification_business_event_proofs root
 WHERE root.producer_table='notifications' AND root.producer_id=p_notice AND root.event_key='people.approval.pending'
 AND root.root_event_id=root.event_id;
 SELECT event_key INTO tag FROM public.notification_workspace_context WHERE notification_id=p_notice;
 IF proof.event_id IS NULL THEN
  -- The canonical notice outlives Workflow queue retention. Its private receipt
  -- preserves only the literal producer identity/revision, never a queued effect.
  SELECT r.event_id,r.workspace_id,r.event_key,r.source_table,r.source_id,r.producer_table,r.producer_id,r.reference_id,r.source_revision
   INTO proof.event_id,proof.workspace_id,proof.event_key,proof.source_table,proof.source_id,proof.producer_table,proof.producer_id,proof.reference_id,proof.source_revision
   FROM public.notification_business_occurrence_receipts r WHERE r.event_key='people.approval.pending' AND r.producer_table='notifications' AND r.producer_id=p_notice;
  IF proof.event_id IS NULL THEN RETURN tag IS DISTINCT FROM 'people.approval.pending';END IF;
 END IF;
 RETURN public.is_workspace_member(proof.workspace_id,p_user)
  AND EXISTS(SELECT 1 FROM public.notifications n WHERE n.id=p_notice AND n.workspace_id=proof.workspace_id AND n.user_id=p_user)
  AND techerp_api.notification_people_proof_current(proof);
END $$;
REVOKE ALL ON FUNCTION techerp_api.notification_hr_notice_visible(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE INDEX notification_people_receipt_notice ON public.notification_business_occurrence_receipts(producer_id)
 WHERE producer_table='notifications' AND event_key='people.approval.pending';
CREATE INDEX notification_people_producer_proof ON public.notification_business_event_proofs(producer_id)
 WHERE producer_table='notifications' AND event_key='people.approval.pending' AND root_event_id=event_id;

CREATE FUNCTION techerp_api.notification_hr_history_visible(p_intent uuid,p_user uuid) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE notice uuid;key text;BEGIN
 SELECT i.notification_id,i.event_key INTO notice,key FROM public.notification_delivery_intents i WHERE i.id=p_intent;
 IF key IS DISTINCT FROM 'people.approval.pending' THEN RETURN true;END IF;
 RETURN techerp_api.notification_hr_notice_visible(notice,p_user);
END $$;
REVOKE ALL ON FUNCTION techerp_api.notification_hr_history_visible(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.notification_center_list(p_workspace uuid,p_scope text DEFAULT 'workspace',
 p_status text DEFAULT 'all',p_category text DEFAULT NULL,p_q text DEFAULT '',p_cursor jsonb DEFAULT NULL,
 p_cutoff timestamptz DEFAULT NULL,p_module text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE u uuid:=techerp_api.notification_center_actor(p_workspace);cutoff timestamptz:=coalesce(p_cutoff,statement_timestamp());
 cursor_at timestamptz;cursor_id uuid;pattern text;result jsonb;BEGIN
 IF p_scope IS NULL OR p_scope NOT IN('workspace','legacy') OR p_status IS NULL
  OR p_status NOT IN('all','unread','read','snoozed') OR p_q IS NULL OR length(p_q)>120
  OR (p_category IS NOT NULL AND p_category NOT IN('mention','assignment','deal_stage','ticket','task','sla','message',
   'workflow','approval','hiring','form','portfolio','platform')) OR cutoff>statement_timestamp()+interval '1 second' THEN
  RAISE EXCEPTION 'Filtro de notificações inválido.' USING ERRCODE='22023';END IF;
 IF p_module IS NOT NULL AND p_module NOT IN('crm','ats','people','contracts','projects','finance') THEN
  RAISE EXCEPTION 'Módulo de notificações inválido.' USING ERRCODE='22023';END IF;
 IF p_cursor IS NOT NULL AND p_cursor<>'null'::jsonb THEN
  IF p_cutoff IS NULL OR jsonb_typeof(p_cursor)<>'object'
   OR NOT p_cursor?'createdAt' OR NOT p_cursor?'id'
   OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_cursor)k WHERE k NOT IN('createdAt','id')) THEN
   RAISE EXCEPTION 'Cursor de notificações inválido.' USING ERRCODE='22023';END IF;
  BEGIN cursor_at:=(p_cursor->>'createdAt')::timestamptz;cursor_id:=(p_cursor->>'id')::uuid;
  EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'Cursor de notificações inválido.' USING ERRCODE='22023';END;
  IF cursor_at IS NULL OR cursor_id IS NULL OR cursor_at>cutoff THEN
   RAISE EXCEPTION 'Cursor de notificações inválido.' USING ERRCODE='22023';END IF;
 END IF;
 pattern:='%'||replace(replace(replace(btrim(p_q),'\','\\'),'%','\%'),'_','\_')||'%';
 WITH candidates AS NOT MATERIALIZED (
  SELECT n.*,c.source_table,c.source_id,c.event_key AS proven_event_key,c.workspace_id AS proven_workspace FROM public.notifications n
  LEFT JOIN public.notification_workspace_context c ON c.notification_id=n.id
  WHERE n.user_id=u AND n.created_at<=cutoff AND techerp_api.notification_hr_notice_visible(n.id,u)
   AND ((p_scope='workspace' AND c.workspace_id=p_workspace AND n.workspace_id=c.workspace_id AND n.entity_id=c.source_id)
    OR (p_scope='legacy' AND c.notification_id IS NULL))
   AND (p_category IS NULL OR coalesce(techerp_api.notification_business_category(c.event_key),techerp_api.notification_center_category(n.type))=p_category)
   AND (p_module IS NULL OR (p_scope='workspace' AND techerp_api.notification_business_module(c.event_key,p_workspace,u,c.source_table,c.source_id)=p_module))
   AND (btrim(p_q)='' OR (p_scope='workspace' AND (n.title ILIKE pattern ESCAPE '\' OR n.body ILIKE pattern ESCAPE '\')))
 ),page AS MATERIALIZED (
  SELECT * FROM candidates n WHERE
   (p_scope='legacy' OR techerp_api.notification_center_source_visible(p_workspace,u,n.source_table,n.source_id))
   AND (p_status='snoozed' AND n.snoozed_until>statement_timestamp()
    OR p_status<>'snoozed' AND (n.snoozed_until IS NULL OR n.snoozed_until<=statement_timestamp())
     AND (p_status='all' OR p_status='unread' AND n.read_at IS NULL OR p_status='read' AND n.read_at IS NOT NULL))
   AND (cursor_at IS NULL OR (n.created_at,n.id)<(cursor_at,cursor_id))
  ORDER BY created_at DESC,id DESC LIMIT 31
 ),unread AS (
  SELECT 1 FROM candidates n WHERE n.read_at IS NULL
   AND (n.snoozed_until IS NULL OR n.snoozed_until<=statement_timestamp())
   AND (p_scope='legacy' OR techerp_api.notification_center_source_visible(p_workspace,u,n.source_table,n.source_id)) LIMIT 100
 ),items AS (SELECT * FROM page ORDER BY created_at DESC,id DESC LIMIT 30),last_item AS (
  SELECT created_at,id FROM items ORDER BY created_at,id LIMIT 1
 ) SELECT jsonb_build_object('items',coalesce((SELECT jsonb_agg(jsonb_build_object(
   'id',id,'type',type,'eventKey',coalesce(proven_event_key,'legacy.'||type),'title',CASE WHEN p_scope='legacy' THEN 'Notificação do histórico pessoal' ELSE title END,
   'body',CASE WHEN p_scope='legacy' THEN 'Este aviso não possui origem de workspace comprovada. Consulte seus registros no TechERP.' ELSE body END,
   'link',CASE WHEN p_scope='legacy' THEN NULL WHEN source_table IN('ats_applications','ats_interviews','ats_offers','people_documents','hiring_preparation_requests') THEN techerp_api.notification_hr_href(p_workspace,source_table,source_id) WHEN source_table='project_milestones' THEN techerp_api.notification_project_milestone_href(p_workspace,source_id) ELSE link END,
   'entity',CASE WHEN p_scope='legacy' THEN NULL ELSE entity END,
   'entity_id',CASE WHEN p_scope='legacy' THEN NULL ELSE entity_id END,
   'moduleKey',CASE WHEN p_scope='legacy' THEN NULL ELSE techerp_api.notification_business_module(proven_event_key,p_workspace,u,source_table,source_id) END,
   'created_at',created_at,'read_at',read_at,'snoozed_until',snoozed_until
  ) ORDER BY created_at DESC,id DESC) FROM items),'[]'::jsonb),
  'unread',(SELECT count(*) FROM unread),'unreadCapped',(SELECT count(*)=100 FROM unread),
  'nextCursor',CASE WHEN (SELECT count(*) FROM page)>30 THEN
   (SELECT jsonb_build_object('createdAt',created_at,'id',id) FROM last_item) ELSE NULL END,'cutoff',cutoff) INTO result;
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.notification_center_lookup(p_workspace uuid,p_ids uuid[]) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE u uuid:=techerp_api.notification_center_actor(p_workspace);result jsonb;BEGIN
 IF p_ids IS NULL OR cardinality(p_ids) NOT BETWEEN 1 AND 30 OR coalesce(array_ndims(p_ids),0)<>1 THEN
  RAISE EXCEPTION 'Selecione de um a trinta avisos.' USING ERRCODE='22023';END IF;
 IF array_position(p_ids,NULL) IS NOT NULL THEN
  RAISE EXCEPTION 'Selecione de um a trinta avisos.' USING ERRCODE='22023';END IF;
 SELECT jsonb_build_object('items',coalesce(jsonb_agg(jsonb_build_object(
  'id',n.id,'type',n.type,'eventKey',coalesce(c.event_key,'legacy.'||n.type),'title',n.title,'body',n.body,'link',CASE WHEN c.source_table IN('ats_applications','ats_interviews','ats_offers','people_documents','hiring_preparation_requests') THEN techerp_api.notification_hr_href(p_workspace,c.source_table,c.source_id) WHEN c.source_table='project_milestones' THEN techerp_api.notification_project_milestone_href(p_workspace,c.source_id) ELSE n.link END,'entity',n.entity,'entity_id',n.entity_id,
  'moduleKey',techerp_api.notification_business_module(c.event_key,p_workspace,u,c.source_table,c.source_id),
  'created_at',n.created_at,'read_at',n.read_at,'snoozed_until',n.snoozed_until
 ) ORDER BY n.created_at DESC,n.id DESC),'[]'::jsonb),'checkedAt',statement_timestamp()) INTO result
 FROM public.notifications n JOIN public.notification_workspace_context c ON c.notification_id=n.id
 WHERE n.id=ANY(p_ids) AND n.user_id=u AND n.workspace_id=p_workspace AND c.workspace_id=p_workspace
  AND n.entity_id=c.source_id AND n.created_at<=statement_timestamp() AND techerp_api.notification_hr_notice_visible(n.id,u)
  AND techerp_api.notification_center_source_visible(p_workspace,u,c.source_table,c.source_id);
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.notification_delivery_history_personal_v1(p_workspace uuid,p_cursor jsonb DEFAULT NULL,p_status text DEFAULT NULL,
 p_channel text DEFAULT NULL,p_scope text DEFAULT 'own') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE u uuid:=techerp_api.notification_center_actor(p_workspace);c jsonb:=public.work_access_context();at timestamptz;item uuid;result jsonb;BEGIN
 IF p_scope IS NULL OR p_scope NOT IN('own','workspace') OR (p_scope='workspace' AND NOT(c->'keys'?'system.notification_deliveries.view.workspace')) THEN
  RAISE EXCEPTION 'Sem permissão para este histórico.' USING ERRCODE='42501';END IF;
 IF p_channel IS NOT NULL AND p_channel NOT IN('inapp','email','whatsapp') OR p_status IS NOT NULL AND p_status NOT IN('available','queued','in_flight','sent','retry_scheduled','failed','uncertain','deduped','accepted','delivered','read','suppressed') THEN
  RAISE EXCEPTION 'Filtro inválido.' USING ERRCODE='22023';END IF;
 IF p_cursor IS NOT NULL AND p_cursor<>'null'::jsonb THEN
  IF jsonb_typeof(p_cursor)<>'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_cursor) k WHERE k NOT IN('createdAt','id')) THEN
   RAISE EXCEPTION 'Cursor inválido.' USING ERRCODE='22023';END IF;
  BEGIN at:=(p_cursor->>'createdAt')::timestamptz;item:=(p_cursor->>'id')::uuid;
  EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'Cursor inválido.' USING ERRCODE='22023';END;
  IF at IS NULL OR item IS NULL THEN RAISE EXCEPTION 'Cursor inválido.' USING ERRCODE='22023';END IF;
 END IF;
 WITH matched AS NOT MATERIALIZED(
  SELECT d.id,d.channel,d.status,d.reason_code,d.attempts,d.created_at,d.updated_at,i.recipient_user_id,i.workflow_id,d.provider_id,i.event_key
  FROM public.workflow_deliveries d JOIN public.notification_delivery_intents i ON i.id=d.notification_intent_id
  WHERE i.workspace_id=p_workspace AND(p_scope='workspace' OR i.recipient_user_id=u)
   AND techerp_api.notification_center_source_visible(i.workspace_id,u,i.source_table,i.source_id)
   AND techerp_api.notification_hr_history_visible(i.id,u)
  UNION ALL
  SELECT n.id,'inapp',CASE WHEN n.read_at IS NULL THEN 'available' ELSE 'read' END,NULL::text,0,
   n.created_at,coalesce(n.read_at,n.created_at),i.recipient_user_id,i.workflow_id,NULL::text,i.event_key
  FROM public.notification_delivery_intents i JOIN public.notifications n ON n.id=i.notification_id AND n.user_id=i.recipient_user_id
  WHERE i.workspace_id=p_workspace AND(p_scope='workspace' OR i.recipient_user_id=u)
   AND(i.event_key<>'people.approval.pending' OR i.delivery_config->'channels'?'inapp')
   AND techerp_api.notification_center_source_visible(i.workspace_id,u,i.source_table,i.source_id)
   AND techerp_api.notification_hr_history_visible(i.id,u)
 ),page AS MATERIALIZED(SELECT * FROM matched WHERE(p_channel IS NULL OR channel=p_channel)
 AND(p_status IS NULL OR status=p_status) AND(at IS NULL OR(created_at,id)<(at,item))
 ORDER BY created_at DESC,id DESC LIMIT 51),items AS(SELECT * FROM page ORDER BY created_at DESC,id DESC LIMIT 50)
 SELECT jsonb_build_object('items',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'channel',channel,'status',status,'eventKey',event_key,
 'reason_code',reason_code,'attempts',attempts,'created_at',created_at,'updated_at',updated_at,'workflow_id',workflow_id,'provider_id',provider_id,
 'recipient_user_id',CASE WHEN recipient_user_id=u OR p_scope='workspace' THEN recipient_user_id END,
 'recipient_name',CASE WHEN recipient_user_id=u THEN 'Você' ELSE 'Destinatário do workflow' END)
 ORDER BY created_at DESC,id DESC) FROM items),'[]'::jsonb),
 'nextCursor',CASE WHEN(SELECT count(*) FROM page)>50 THEN(SELECT jsonb_build_object('createdAt',created_at,'id',id)
 FROM items ORDER BY created_at,id LIMIT 1)ELSE NULL END) INTO result;RETURN result;
END $$;


CREATE OR REPLACE FUNCTION public.notification_center_visible(p_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE n public.notifications;c public.notification_workspace_context;ctx jsonb;u uuid:=auth.uid();BEGIN
 IF u IS NULL OR auth.role()<>'authenticated' OR current_setting('app.api_subject',true)='on' THEN RETURN false;END IF;
 ctx:=public.work_access_context();
 IF ctx->>'actor' IS DISTINCT FROM u::text OR ctx->>'workspace' IS NULL THEN RETURN false;END IF;
 SELECT * INTO n FROM public.notifications WHERE id=p_id AND user_id=u;
 IF NOT FOUND THEN RETURN false;END IF;
 SELECT * INTO c FROM public.notification_workspace_context WHERE notification_id=n.id;
 RETURN coalesce(c.workspace_id::text=ctx->>'workspace' AND n.workspace_id=c.workspace_id AND n.entity_id=c.source_id
  AND public.is_workspace_member(c.workspace_id,u)
  AND techerp_api.notification_hr_notice_visible(n.id,u)
  AND techerp_api.notification_center_source_visible(c.workspace_id,u,c.source_table,c.source_id),false);
END $$;

CREATE OR REPLACE FUNCTION techerp_api.notification_center_item(p_workspace uuid,p_user uuid,p_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c public.notification_workspace_context;BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.notifications WHERE id=p_id AND user_id=p_user)
  OR NOT techerp_api.notification_hr_notice_visible(p_id,p_user) THEN RETURN false;END IF;
 SELECT * INTO c FROM public.notification_workspace_context WHERE notification_id=p_id;
 IF NOT FOUND THEN RETURN true;END IF;
 RETURN c.workspace_id=p_workspace AND EXISTS(SELECT 1 FROM public.notifications n
  WHERE n.id=p_id AND n.workspace_id=c.workspace_id AND n.entity_id=c.source_id)
  AND techerp_api.notification_center_source_visible(p_workspace,p_user,c.source_table,c.source_id);
END $$;

CREATE OR REPLACE FUNCTION techerp_api.notification_fallback(p_intent uuid,p_reason text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE i public.notification_delivery_intents;BEGIN
 IF p_reason IS NULL OR p_reason NOT IN('policy_disabled','sender_unavailable','invalid_template','invalid_configuration','provider_rejected',
 'recipient_suppressed','consent_missing','executor_transport_forbidden','quota_exceeded','budget_exceeded','budget_currency_changed','provider_permanent','preferences_disabled') THEN RETURN;END IF;
 SELECT * INTO i FROM public.notification_delivery_intents WHERE id=p_intent;
 IF i.delivery_config->>'fallback'<>'email' THEN RETURN;END IF;
 -- Approval stages can change between POST and its result. Never enqueue a
 -- fallback for the old approver, even though the email claim also rechecks it.
 IF i.event_key='people.approval.pending' AND(
  techerp_api.notification_business_run_key(i.workflow_id,i.run_id,i.workflow_version) IS DISTINCT FROM i.event_key
  OR NOT techerp_api.notification_people_recipient((SELECT event_id FROM public.workflow_runs WHERE id=i.run_id),i.recipient_user_id)) THEN RETURN;END IF;
 -- Eligibility is checked again on the email claim; no endpoint is copied.
 INSERT INTO public.workflow_deliveries(workspace_id,workflow_id,idempotency_key,step_path,channel,recipient,status,attempts,next_attempt_at,notification_intent_id,reason_code)
 VALUES(i.workspace_id,i.workflow_id,'nfd:'||i.id||':email',i.step_path,'email','user:'||i.recipient_user_id,'queued',0,now(),i.id,'fallback_pending')
 ON CONFLICT(notification_intent_id,channel) WHERE notification_intent_id IS NOT NULL DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION public.notification_center_badge(p_workspace uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE u uuid:=techerp_api.notification_center_actor(p_workspace);unread_count integer;BEGIN
 SELECT count(*)::integer INTO unread_count FROM(
  SELECT 1 FROM public.notifications n
  JOIN public.notification_workspace_context c ON c.notification_id=n.id
  WHERE n.user_id=u AND n.workspace_id=p_workspace AND c.workspace_id=p_workspace
   AND n.entity_id=c.source_id AND n.created_at<=statement_timestamp() AND n.read_at IS NULL
   AND techerp_api.notification_hr_notice_visible(n.id,u)
   AND(n.snoozed_until IS NULL OR n.snoozed_until<=statement_timestamp())
   AND techerp_api.notification_center_source_visible(p_workspace,u,c.source_table,c.source_id)
  ORDER BY n.created_at DESC,n.id DESC LIMIT 100
 ) eligible;
 RETURN jsonb_build_object('unread',unread_count,'unreadCapped',unread_count=100,'checkedAt',statement_timestamp());
END $$;

NOTIFY pgrst,'reload schema';
