-- Run after service-agent-queue-isolated.sql, within the same rollback transaction.
SELECT set_config('request.jwt.claim.role','service_role',true);
UPDATE public.sdr_playbooks SET assigned_to='10000000-0000-4000-8000-000000000002' WHERE id='79000000-0000-4000-8000-000000000001';
UPDATE public.service_agent_sessions SET ai_owner='ai',ai_version=ai_version+1 WHERE channel='chat';
UPDATE public.service_agent_jobs SET status='skipped',lease_token=NULL WHERE session_id=(SELECT id FROM public.service_agent_sessions WHERE channel='chat') AND status='running';
UPDATE public.live_chat_sessions SET assignee_id=NULL WHERE id='79000000-0000-4000-8000-000000000005';
INSERT INTO public.live_chat_messages(id,workspace_id,owner_id,session_id,direction,body) VALUES
 ('79000000-0000-4000-8000-000000000014','aaaaaaaa-0000-4000-8000-00000000000a','aaaaaaaa-0000-4000-8000-00000000000a','79000000-0000-4000-8000-000000000005','inbound','Quero falar com uma pessoa');
CREATE TEMP TABLE service_handoff_claim AS SELECT * FROM public.service_agent_claim(10);
DO $$ DECLARE j record;r text;BEGIN
 SELECT * INTO j FROM service_handoff_claim WHERE inbound_message_id='79000000-0000-4000-8000-000000000014';
 IF j.id IS NULL THEN RAISE EXCEPTION 'Handoff source was not queued';END IF;
 r:=public.service_agent_commit_turn(j.id,j.lease_token,'[]',NULL,jsonb_build_object('status','paused','handoff_at',now(),'handoff_reason','Pedido do cliente'),
 '{"status":"drafted","draft_text":"Conversa encaminhada para atendimento humano.","draft_payload":{"intent":"handoff"}}');
 IF r<>'ok' THEN RAISE EXCEPTION 'Handoff commit failed: %',r;END IF;
 IF (SELECT assignee_id FROM public.live_chat_sessions WHERE id='79000000-0000-4000-8000-000000000005') IS DISTINCT FROM '10000000-0000-4000-8000-000000000002'::uuid THEN RAISE EXCEPTION 'Configured recipient not assigned';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.service_agent_sessions s JOIN public.sdr_enrollments e ON e.id=s.enrollment_id WHERE s.channel='chat' AND s.ai_owner='human' AND e.status='paused' AND e.handoff_reason='Pedido do cliente' AND e.handoff_at IS NOT NULL) THEN RAISE EXCEPTION 'Handoff state missing';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.notifications WHERE entity='service_agent_session' AND user_id='10000000-0000-4000-8000-000000000002') THEN RAISE EXCEPTION 'Recipient was not notified';END IF;
 IF (SELECT draft_payload->>'handoff_assignment' FROM public.service_agent_jobs WHERE id=j.id)<>'assigned' THEN RAISE EXCEPTION 'Assignment proof missing';END IF;
 RAISE NOTICE 'PASS configured human recipient, persisted reason, paused AI and notification';
END $$;
SELECT set_config('request.jwt.claim.role','',true);
-- Inactive configured recipient must not replace the existing active operator.
SELECT set_config('request.jwt.claim.role','service_role',true);
UPDATE public.sdr_playbooks SET assigned_to='10000000-0000-4000-8000-000000000005' WHERE id='79000000-0000-4000-8000-000000000001';
UPDATE public.service_agent_sessions SET ai_owner='ai',ai_version=ai_version+1 WHERE channel='chat';
UPDATE public.sdr_enrollments SET status='active',cancel_reason=NULL WHERE id=(SELECT enrollment_id FROM public.service_agent_sessions WHERE channel='chat');
INSERT INTO public.live_chat_messages(id,workspace_id,owner_id,session_id,direction,body) VALUES
 ('79000000-0000-4000-8000-000000000015','aaaaaaaa-0000-4000-8000-00000000000a','aaaaaaaa-0000-4000-8000-00000000000a','79000000-0000-4000-8000-000000000005','inbound','Preciso de ajuda humana novamente');
DO $$ DECLARE j record;r text;BEGIN
 SELECT * INTO j FROM public.service_agent_claim(10) WHERE inbound_message_id='79000000-0000-4000-8000-000000000015';
 IF j.id IS NULL THEN RAISE EXCEPTION 'Second handoff not queued';END IF;
 r:=public.service_agent_commit_turn(j.id,j.lease_token,'[]',NULL,'{"status":"paused"}','{"status":"drafted","draft_payload":{"intent":"handoff"}}');
 IF r<>'ok' THEN RAISE EXCEPTION 'Inactive target handoff failed: %',r;END IF;
 IF (SELECT assignee_id FROM public.live_chat_sessions WHERE id='79000000-0000-4000-8000-000000000005') IS DISTINCT FROM '10000000-0000-4000-8000-000000000002'::uuid THEN RAISE EXCEPTION 'Inactive target replaced active operator';END IF;
 IF (SELECT draft_payload->>'handoff_assignment' FROM public.service_agent_jobs WHERE id=j.id)<>'unavailable' THEN RAISE EXCEPTION 'Inactive target should be marked unavailable';END IF;
 RAISE NOTICE 'PASS inactive recipient preserves current active operator';
END $$;
SELECT set_config('request.jwt.claim.role','',true);
-- Releasing an obsolete run keeps a newer queued inbound intact and triggers recovery.
SELECT set_config('request.jwt.claim.role','service_role',true);
INSERT INTO public.service_agent_jobs(id,workspace_id,session_id,inbound_message_id,conversation_version,status,lease_token,lease_until,available_at)
SELECT '79000000-0000-4000-8000-000000000016',workspace_id,id,'79000000-0000-4000-8000-000000000015',ai_version,'running',gen_random_uuid(),now()+interval '2 minutes',now() FROM public.service_agent_sessions WHERE channel='chat';
INSERT INTO public.service_agent_jobs(id,workspace_id,session_id,inbound_message_id,conversation_version,status,available_at)
SELECT '79000000-0000-4000-8000-000000000017',workspace_id,id,'79000000-0000-4000-8000-000000000015',ai_version,'queued',now()+interval '5 minutes' FROM public.service_agent_sessions WHERE channel='chat';
UPDATE public.service_agent_jobs SET status='skipped',lease_token=NULL WHERE id='79000000-0000-4000-8000-000000000016';
DO $$ BEGIN
 IF (SELECT status FROM public.service_agent_jobs WHERE id='79000000-0000-4000-8000-000000000017')<>'queued' THEN RAISE EXCEPTION 'Wake modified the pending inbound';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.service_agent_jobs'::regclass AND tgname='service_agent_running_finished' AND tgenabled<>'D') THEN RAISE EXCEPTION 'Pending wake trigger missing';END IF;
 RAISE NOTICE 'PASS obsolete run release preserves queued inbound and invokes recovery trigger';
END $$;
SELECT set_config('request.jwt.claim.role','',true);
