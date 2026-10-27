-- Synthetic runtime acceptance; run after 0256/0257 and service-channel-isolated.sql in one rollback transaction.
SELECT set_config('request.jwt.claim.sub','',true);
INSERT INTO public.sdr_playbooks(id,workspace_id,owner_id,name) VALUES
 ('77000000-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-00000000000a','10000000-0000-4000-8000-000000000001','[ISO] Bruna');
INSERT INTO public.sdr_workspace_settings(workspace_id,enabled) VALUES('aaaaaaaa-0000-4000-8000-00000000000a',true)
ON CONFLICT(workspace_id) DO UPDATE SET enabled=true;
INSERT INTO public.whatsapp_conversations(id,workspace_id,owner_id,contact_phone,twilio_number,wa_phone_number_id,ai_owner) VALUES
 ('78000000-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-00000000000a','10000000-0000-4000-8000-000000000001','+5548999990001','+554861365335','test-number-a',NULL),
 ('78000000-0000-4000-8000-000000000002','aaaaaaaa-0000-4000-8000-00000000000a','10000000-0000-4000-8000-000000000001','+5548999990002','+554861365335','test-number-a','human'),
 ('78000000-0000-4000-8000-000000000003','aaaaaaaa-0000-4000-8000-00000000000a','10000000-0000-4000-8000-000000000001','+5548999990003','+554861365335','test-number-a','paused');
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
SET LOCAL ROLE authenticated;
SELECT public.service_channel_save('76000000-0000-4000-8000-000000000001','[ISO] Bruna','Bruna',true,'77000000-0000-4000-8000-000000000001','Bruna',true,false,true);
DO $$ BEGIN
 IF NOT (SELECT routing_configured FROM public.service_channel_accounts WHERE id='76000000-0000-4000-8000-000000000001') THEN RAISE EXCEPTION 'Explicit save did not opt account in'; END IF;
 BEGIN
  PERFORM public.sdr_bind_inbound_channel('aaaaaaaa-0000-4000-8000-00000000000a','78000000-0000-4000-8000-000000000001','test-number-a');
  RAISE EXCEPTION 'Authenticated caller invoked provider-only ingest';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 RAISE NOTICE 'PASS explicit account opt-in and provider-only RPC';
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',true);
SET LOCAL ROLE service_role;
DO $$ DECLARE e uuid;e2 uuid;BEGIN
 e:=public.sdr_bind_inbound_channel('aaaaaaaa-0000-4000-8000-00000000000a','78000000-0000-4000-8000-000000000001','test-number-a');
 e2:=public.sdr_bind_inbound_channel('aaaaaaaa-0000-4000-8000-00000000000a','78000000-0000-4000-8000-000000000001','test-number-a');
 IF e IS NULL OR e IS DISTINCT FROM e2 THEN RAISE EXCEPTION 'Receptive routing not idempotent'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.sdr_enrollments WHERE id=e AND playbook_id='77000000-0000-4000-8000-000000000001' AND follow_up_at IS NULL) THEN RAISE EXCEPTION 'Wrong agent or unsolicited follow-up'; END IF;
 IF public.sdr_bind_inbound_channel('aaaaaaaa-0000-4000-8000-00000000000b','78000000-0000-4000-8000-000000000001','test-number-a') IS NOT NULL THEN RAISE EXCEPTION 'Foreign workspace bound'; END IF;
 IF public.sdr_bind_inbound_channel('aaaaaaaa-0000-4000-8000-00000000000a','78000000-0000-4000-8000-000000000001','other-phone') IS NOT NULL THEN RAISE EXCEPTION 'Wrong provider phone bound'; END IF;
 IF public.sdr_bind_inbound_channel('aaaaaaaa-0000-4000-8000-00000000000a','78000000-0000-4000-8000-000000000002','test-number-a') IS NOT NULL THEN RAISE EXCEPTION 'Human ownership overridden'; END IF;
 IF public.sdr_bind_inbound_channel('aaaaaaaa-0000-4000-8000-00000000000a','78000000-0000-4000-8000-000000000003','test-number-a') IS NOT NULL THEN RAISE EXCEPTION 'Paused ownership overridden'; END IF;
 RAISE NOTICE 'PASS receptive idempotency, sender/workspace isolation and human handoff';
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE blocked boolean:=false;BEGIN
 BEGIN UPDATE public.sdr_enrollments SET channel_identity='{"displayName":"Fake"}'::jsonb WHERE conversation_id='78000000-0000-4000-8000-000000000001';
 EXCEPTION WHEN insufficient_privilege THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Client forged channel snapshot'; END IF;
 RAISE NOTICE 'PASS snapshot cannot be supplied by the browser';
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',true);
