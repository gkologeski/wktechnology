-- Synthetic queue acceptance; all fixture writes and DDL are rolled back by the runner.
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
SELECT set_config('request.jwt.claim.sub','',true);
SELECT set_config('request.jwt.claim.role','service_role',true);
INSERT INTO public.sdr_playbooks(id,workspace_id,owner_id,name,guardrails) VALUES
 ('79000000-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-00000000000a','10000000-0000-4000-8000-000000000001','[ISO] Multicanal','{"customer_wait_seconds":0}');
INSERT INTO public.sdr_agent_versions(id,workspace_id,playbook_id,version,status,persona,created_by,published_by) VALUES
 ('79000000-0000-4000-8000-000000000002','aaaaaaaa-0000-4000-8000-00000000000a','79000000-0000-4000-8000-000000000001',1,'published','{"assistant_name":"Bruna"}','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001');
INSERT INTO public.sdr_workspace_settings(workspace_id,enabled) VALUES('aaaaaaaa-0000-4000-8000-00000000000a',true) ON CONFLICT(workspace_id) DO UPDATE SET enabled=true;
INSERT INTO public.email_accounts(id,workspace_id,owner_id,provider,email,status) VALUES
 ('79000000-0000-4000-8000-000000000003','aaaaaaaa-0000-4000-8000-00000000000a','10000000-0000-4000-8000-000000000001','gmail','sdr@techerp-test.invalid','connected');
INSERT INTO public.email_threads(id,workspace_id,owner_id,account_id,provider_thread_id,subject) VALUES
 ('79000000-0000-4000-8000-000000000004','aaaaaaaa-0000-4000-8000-00000000000a','10000000-0000-4000-8000-000000000001','79000000-0000-4000-8000-000000000003','isolated-service-thread','[ISO] Atendimento');
INSERT INTO public.live_chat_sessions(id,workspace_id,owner_id,visitor_id,status) VALUES
 ('79000000-0000-4000-8000-000000000005','aaaaaaaa-0000-4000-8000-00000000000a','aaaaaaaa-0000-4000-8000-00000000000a','isolated-visitor-multichannel','open');
INSERT INTO public.service_channel_accounts(id,workspace_id,channel,source_key,label,display_name,enabled,routing_configured) VALUES
 ('79000000-0000-4000-8000-000000000006','aaaaaaaa-0000-4000-8000-00000000000a','email','79000000-0000-4000-8000-000000000003','[ISO] E-mail','Bruna',true,true),
 ('79000000-0000-4000-8000-000000000007','aaaaaaaa-0000-4000-8000-00000000000a','chat','aaaaaaaa-0000-4000-8000-00000000000a','[ISO] Chat','Lia',true,true);
INSERT INTO public.service_channel_bindings(account_id,workspace_id,agent_id,enabled,inbound) VALUES
 ('79000000-0000-4000-8000-000000000006','aaaaaaaa-0000-4000-8000-00000000000a','79000000-0000-4000-8000-000000000001',true,true),
 ('79000000-0000-4000-8000-000000000007','aaaaaaaa-0000-4000-8000-00000000000a','79000000-0000-4000-8000-000000000001',true,true);
CREATE TEMP TABLE service_test_before AS SELECT count(*) AS n FROM public.whatsapp_conversations;
SELECT set_config('request.jwt.claim.role','service_role',true);
INSERT INTO public.email_messages(id,workspace_id,owner_id,account_id,thread_id,provider_message_id,direction,from_email,body_text,received_at,headers) VALUES
 ('79000000-0000-4000-8000-000000000008','aaaaaaaa-0000-4000-8000-00000000000a','10000000-0000-4000-8000-000000000001','79000000-0000-4000-8000-000000000003','79000000-0000-4000-8000-000000000004','service-automatic','inbound','customer@techerp-test.invalid','Resposta automática',now(),'{"Auto-Submitted":"auto-replied"}'),
 ('79000000-0000-4000-8000-000000000009','aaaaaaaa-0000-4000-8000-00000000000a','10000000-0000-4000-8000-000000000001','79000000-0000-4000-8000-000000000003','79000000-0000-4000-8000-000000000004','service-historical','inbound','customer@techerp-test.invalid','Histórico','2020-01-01','{}');
DO $$ BEGIN IF EXISTS(SELECT 1 FROM public.service_agent_jobs) THEN RAISE EXCEPTION 'Historical/automatic email queued';END IF;RAISE NOTICE 'PASS historical imports and automatic email excluded'; END $$;
INSERT INTO public.email_messages(id,workspace_id,owner_id,account_id,thread_id,provider_message_id,direction,from_email,body_text,received_at) VALUES
 ('79000000-0000-4000-8000-000000000010','aaaaaaaa-0000-4000-8000-00000000000a','10000000-0000-4000-8000-000000000001','79000000-0000-4000-8000-000000000003','79000000-0000-4000-8000-000000000004','service-email-1','inbound','customer@techerp-test.invalid','Preciso de uma equipe',now()),
 ('79000000-0000-4000-8000-000000000011','aaaaaaaa-0000-4000-8000-00000000000a','10000000-0000-4000-8000-000000000001','79000000-0000-4000-8000-000000000003','79000000-0000-4000-8000-000000000004','service-email-2','inbound','customer@techerp-test.invalid','Podemos conversar amanhã?',now());
INSERT INTO public.live_chat_messages(id,workspace_id,owner_id,session_id,direction,body) VALUES
 ('79000000-0000-4000-8000-000000000012','aaaaaaaa-0000-4000-8000-00000000000a','aaaaaaaa-0000-4000-8000-00000000000a','79000000-0000-4000-8000-000000000005','inbound','Gostaria de conhecer os serviços');
DO $$ DECLARE j uuid;BEGIN
 IF EXISTS(SELECT 1 FROM public.service_agent_ingest_errors) THEN RAISE EXCEPTION 'Ingest error: %',(SELECT error FROM public.service_agent_ingest_errors LIMIT 1);END IF;
 IF (SELECT count(*) FROM public.service_agent_sessions)<>2 OR (SELECT count(*) FROM public.service_agent_jobs)<>2 THEN RAISE EXCEPTION 'Expected email/chat sessions and coalesced jobs';END IF;
 IF (SELECT count(*) FROM public.whatsapp_conversations)<>(SELECT n FROM service_test_before) THEN RAISE EXCEPTION 'Synthetic WhatsApp conversation created';END IF;
 j:=public.service_agent_enqueue('email','79000000-0000-4000-8000-000000000011');
 IF j IS NOT NULL OR (SELECT count(*) FROM public.service_agent_jobs)<>2 THEN RAISE EXCEPTION 'Duplicate event queued';END IF;
 RAISE NOTICE 'PASS real-source sessions, burst coalescence and idempotency';
END $$;
CREATE TEMP TABLE service_claimed AS SELECT * FROM public.service_agent_claim(10);
DO $$ DECLARE j record;s public.service_agent_sessions;r text;BEGIN
 IF (SELECT count(*) FROM service_claimed)<>2 THEN RAISE EXCEPTION 'Claim count';END IF;
 FOR j IN SELECT * FROM service_claimed LOOP
  r:=public.service_agent_guard(j.id,j.lease_token);IF r<>'ok' THEN RAISE EXCEPTION 'Authorized guard refused: %',r;END IF;
 END LOOP;
 SELECT * INTO s FROM public.service_agent_sessions WHERE channel='email';
 IF NOT public.sales_worker_authorize('sdr_enrollments',s.enrollment_id,'[]') THEN RAISE EXCEPTION 'Authorized source denied';END IF;
 RAISE NOTICE 'PASS authorized queue guards and canonical enrollment permissions';
END $$;
-- A human response immediately invalidates in-flight AI work.
SELECT set_config('request.jwt.claim.role','authenticated',true);
INSERT INTO public.live_chat_messages(workspace_id,owner_id,session_id,direction,body) VALUES
 ('aaaaaaaa-0000-4000-8000-00000000000a','aaaaaaaa-0000-4000-8000-00000000000a','79000000-0000-4000-8000-000000000005','outbound','[ISO] Humano assumiu');
SELECT set_config('request.jwt.claim.role','service_role',true);
DO $$ DECLARE j record;r text;BEGIN
 SELECT j0.* INTO j FROM service_claimed j0 JOIN public.service_agent_sessions s ON s.id=j0.session_id WHERE s.channel='chat';
 r:=public.service_agent_guard(j.id,j.lease_token);IF r<>'owner_not_ai' THEN RAISE EXCEPTION 'Human takeover failed: %',r;END IF;
 SELECT j0.* INTO j FROM service_claimed j0 JOIN public.service_agent_sessions s ON s.id=j0.session_id WHERE s.channel='email';
 r:=public.service_agent_commit_turn(j.id,j.lease_token,
 '[{"field":"necessidade","value":"equipe","message_id":"79000000-0000-4000-8000-000000000010","excerpt":"Preciso de uma equipe"}]',NULL,
 '{"conversation_state":{"name_confirmed":true},"expected_state_version":0}',
 '{"status":"drafted","draft_text":"Podemos dimensionar a equipe.","draft_payload":{"intent":"continue"}}');
 IF r<>'ok' OR (SELECT count(*) FROM public.service_agent_evidence)<>1 THEN RAISE EXCEPTION 'Canonical commit/evidence failed: %',r;END IF;
 RAISE NOTICE 'PASS handoff invalidation, CAS and actual email evidence';
END $$;
SELECT set_config('request.jwt.claim.role','',true);
-- Merely supplying an identity on a public chat does not authorize CRM context.
SELECT set_config('request.jwt.claim.role','service_role',true);
INSERT INTO public.contacts(id,workspace_id,owner_id,first_name,email) VALUES
 ('79000000-0000-4000-8000-000000000013','aaaaaaaa-0000-4000-8000-00000000000a','10000000-0000-4000-8000-000000000001','[ISO] Cliente','customer@techerp-test.invalid');
UPDATE public.live_chat_sessions SET contact_id='79000000-0000-4000-8000-000000000013' WHERE id='79000000-0000-4000-8000-000000000005';
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.service_agent_sessions s JOIN public.sdr_enrollments e ON e.id=s.enrollment_id WHERE s.channel='chat' AND (s.identity_verified OR s.context_approved OR e.contact_id IS NOT NULL)) THEN RAISE EXCEPTION 'Unverified public identity exposed CRM';END IF;
 RAISE NOTICE 'PASS public identity claim does not authorize private CRM';
END $$;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claim.role','authenticated',true);
SET LOCAL ROLE authenticated;
SELECT public.service_agent_verify_identity('chat','79000000-0000-4000-8000-000000000005');
RESET ROLE;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.service_agent_sessions s JOIN public.sdr_enrollments e ON e.id=s.enrollment_id WHERE s.channel='chat' AND s.context_approved AND s.identity_verified AND e.contact_id='79000000-0000-4000-8000-000000000013') THEN RAISE EXCEPTION 'Authorized identity approval failed';END IF;
 RAISE NOTICE 'PASS authorized identity approval';
END $$;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE blocked boolean:=false;BEGIN
 BEGIN PERFORM public.service_agent_verify_identity('chat','79000000-0000-4000-8000-000000000005');EXCEPTION WHEN insufficient_privilege THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Missing permission accepted';END IF;
 RAISE NOTICE 'PASS identity approval requires explicit access';
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',true);
SELECT set_config('request.jwt.claim.role','service_role',true);
UPDATE public.live_chat_sessions SET contact_id=NULL WHERE id='79000000-0000-4000-8000-000000000005';
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.service_agent_sessions s JOIN public.sdr_enrollments e ON e.id=s.enrollment_id WHERE s.channel='chat' AND (s.context_approved OR s.identity_verified OR e.contact_id IS NOT NULL)) THEN RAISE EXCEPTION 'Identity approval survived a changed association';END IF;
 RAISE NOTICE 'PASS identity change revokes old approval';
END $$;
SELECT set_config('request.jwt.claim.role','',true);
-- Scoped approval matrix: active grant, explicit deny, foreign workspace and inactive.
INSERT INTO public.job_role_permission_overrides(workspace_id,role_id,permission_key,effect,created_by)
SELECT 'aaaaaaaa-0000-4000-8000-00000000000a',r::uuid,k,'grant','10000000-0000-4000-8000-000000000001'
FROM unnest(ARRAY['30000000-0000-4000-8000-0000000000a8','30000000-0000-4000-8000-0000000000a3'])r
CROSS JOIN unnest(ARRAY['system.channels.approve.workspace','techsales.inbox.chat.view.workspace','techsales.inbox.chat.update.workspace','techsales.contacts.view.workspace'])k
ON CONFLICT(workspace_id,role_id,permission_key) DO UPDATE SET effect='grant';
UPDATE public.live_chat_sessions SET contact_id='79000000-0000-4000-8000-000000000013' WHERE id='79000000-0000-4000-8000-000000000005';
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;
SELECT public.service_agent_verify_identity('chat','79000000-0000-4000-8000-000000000005');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',true);
UPDATE public.job_role_permission_overrides SET effect='deny' WHERE workspace_id='aaaaaaaa-0000-4000-8000-00000000000a' AND role_id='30000000-0000-4000-8000-0000000000a8' AND permission_key='system.channels.approve.workspace';
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE blocked boolean:=false;BEGIN
 BEGIN PERFORM public.service_agent_verify_identity('chat','79000000-0000-4000-8000-000000000005');EXCEPTION WHEN insufficient_privilege THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Explicit identity deny bypassed';END IF;RAISE NOTICE 'PASS explicit identity deny';
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000006',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE blocked boolean:=false;BEGIN
 BEGIN PERFORM public.service_agent_verify_identity('chat','79000000-0000-4000-8000-000000000005');EXCEPTION WHEN insufficient_privilege THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Foreign identity approval accepted';END IF;RAISE NOTICE 'PASS foreign workspace approval blocked';
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000005',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE blocked boolean:=false;BEGIN
 BEGIN PERFORM public.service_agent_verify_identity('chat','79000000-0000-4000-8000-000000000005');EXCEPTION WHEN insufficient_privilege THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Inactive identity approval accepted';END IF;RAISE NOTICE 'PASS inactive approval blocked';
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',true);
-- Simulated provider proof: one authorized attempt, then late acceptance after human takeover.
SELECT set_config('request.jwt.claim.role','service_role',true);
UPDATE public.sdr_playbooks SET mode='auto' WHERE id='79000000-0000-4000-8000-000000000001';
UPDATE public.sdr_workspace_settings SET auto_send_enabled=true WHERE workspace_id='aaaaaaaa-0000-4000-8000-00000000000a';
UPDATE public.sdr_enrollments e SET channel_identity=jsonb_build_object('workspaceId',e.workspace_id,'accountId',s.account_id,'channel','email','displayName','Bruna')
FROM public.service_agent_sessions s WHERE s.enrollment_id=e.id AND s.channel='email';
UPDATE public.service_agent_jobs j SET status='ready',agent_version_id='79000000-0000-4000-8000-000000000002',draft_payload=coalesce(draft_payload,'{}')||'{"delivery_header":"<isolated-service@techerp-test.invalid>"}'
FROM public.service_agent_sessions s WHERE s.id=j.session_id AND s.channel='email';
CREATE TEMP TABLE service_delivery_attempt AS SELECT result.* FROM public.service_agent_begin_send((SELECT j.id FROM public.service_agent_jobs j JOIN public.service_agent_sessions s ON s.id=j.session_id WHERE s.channel='email')) result;
DO $$ BEGIN IF (SELECT count(*) FROM service_delivery_attempt)<>1 THEN RAISE EXCEPTION 'Authorized send not claimed';END IF;END $$;
UPDATE public.service_agent_sessions SET ai_owner='human',ai_version=ai_version+1 WHERE channel='email';
DO $$ DECLARE j record;first_id uuid;second_id uuid;BEGIN
 SELECT * INTO j FROM service_delivery_attempt;
 first_id:=public.service_agent_complete_email(j.id,j.send_token,'isolated-accepted-provider-id','<isolated-service@techerp-test.invalid>');
 second_id:=public.service_agent_complete_email(j.id,j.send_token,'isolated-accepted-provider-id','<isolated-service@techerp-test.invalid>');
 IF first_id IS DISTINCT FROM second_id OR (SELECT count(*) FROM public.email_messages WHERE provider_message_id='isolated-accepted-provider-id')<>1 THEN RAISE EXCEPTION 'Delivery proof duplicated';END IF;
 IF (SELECT ai_owner FROM public.service_agent_sessions WHERE channel='email')<>'human' THEN RAISE EXCEPTION 'Late delivery stole human ownership';END IF;
 IF (SELECT messages_sent FROM public.sdr_enrollments WHERE id=(SELECT enrollment_id FROM public.service_agent_sessions WHERE channel='email'))<>1 THEN RAISE EXCEPTION 'Delivery counted twice';END IF;
 RAISE NOTICE 'PASS idempotent email proof and preserved human ownership after authorized send';
END $$;
SELECT set_config('request.jwt.claim.role','',true);
