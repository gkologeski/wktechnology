"""Disposable SQL integration checks; identity/CRM permissions are explicitly synthetic.
New migrations, tables, row locks, receipt projection and runtime functions are real.
"""
from pathlib import Path
import json,re

def check(sql,context,base,A,U,W,passed):
 def mark(label):passed.append(label)
 def ddl(file,table):
  s=Path('drizzle/migrations/'+file+'.sql').read_text();m=re.search(r'CREATE TABLE public\.'+table+r'\s*\(.*?\n\);',s,re.S)
  assert m,table
  sql(m[0])
 context(base)
 sql('''CREATE TABLE permissions(key text PRIMARY KEY,module text,resource text,action text,scope text,label_pt text,description text,is_system boolean);
 CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$SELECT coalesce(nullif(current_setting('request.jwt.claim.role',true),''),'service_role')$$;
 CREATE SCHEMA sales_private;
 CREATE FUNCTION sales_context_access(c jsonb,w uuid,r text,a text,responsibles uuid[]) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT coalesce(c->>'workspace'=w::text AND (c->'keys'->>('techsales.'||r||'.'||a))::boolean,false)
$$;
 CREATE FUNCTION sales_record_access(t text,i uuid,a text) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$DECLARE c jsonb:=work_access_context();j jsonb;BEGIN CASE t WHEN 'contacts','leads','companies','deals' THEN EXECUTE format('SELECT to_jsonb(x) FROM public.%I x WHERE id=$1',t) INTO j USING i;RETURN j->>'workspace_id'=c->>'workspace';ELSE RETURN false;END CASE;END$$;
 CREATE FUNCTION sales_private.record_access_ctx(c jsonb,t text,i uuid,a text) RETURNS boolean LANGUAGE plpgsql STABLE AS $$BEGIN CASE t WHEN 'contacts' THEN RETURN true;ELSE RETURN false;END CASE;END$$;
 CREATE FUNCTION sales_access_context() RETURNS jsonb LANGUAGE sql STABLE AS $$SELECT work_access_context()$$;
 CREATE TABLE contacts(id uuid PRIMARY KEY,workspace_id uuid,owner_id uuid,assigned_to uuid,first_name text,last_name text,company_name text,email text,phone text,mobile_phone text,whatsapp_e164 text,linkedin_url text,deleted_at timestamptz,company_id uuid);
 CREATE TABLE leads(LIKE contacts INCLUDING ALL);ALTER TABLE leads ADD COLUMN converted_contact_id uuid;
 CREATE TABLE companies(id uuid PRIMARY KEY,workspace_id uuid);
 CREATE TABLE deals(id uuid PRIMARY KEY,workspace_id uuid);
 GRANT USAGE ON SCHEMA public,auth TO authenticated; GRANT SELECT ON contacts,leads,companies,deals TO authenticated;
 ''')
 sql(Path('drizzle/migrations/0342_linkedin_inbox.sql').read_text())
 keys={**base['keys'],**{f'techsales.inbox.linkedin.{a}.own':True for a in ['view','create','manage']}}
 allowed={**base,'keys':keys};context(allowed)
 sql(f"INSERT INTO unipile_inbound_messages(account_id,provider_message_id,chat_id,sender_id,body) VALUES('{A}','in-qa','chat-qa','person-qa','Olá');")
 cid=sql("SELECT id FROM linkedin_conversations WHERE provider_chat_id='chat-qa';")
 assert sql("SELECT count(*) FROM linkedin_messages WHERE provider_message_id='in-qa'")=='1';mark('signed journal projects one private Inbox message')
 assert sql(f"SET ROLE authenticated;SET qa.actor='{U}';SELECT count(*) FROM linkedin_conversations WHERE provider_chat_id='chat-qa';")=='1';mark('Inbox owner permitted')
 for label,c in [('missing Inbox key',base),('explicit deny',{**allowed,'keys':{**keys,'techsales.inbox.linkedin.view.own':False}}),('foreign workspace',{**allowed,'workspace':'aaaaaaaa-0000-4000-8000-00000000000b'}),('inactive',{})]:
  context(c);assert sql(f"SET ROLE authenticated;SET qa.actor='{U}';SELECT count(*) FROM linkedin_conversations WHERE provider_chat_id='chat-qa';")=='0';mark('Inbox denies '+label)
 context(allowed)
 sql(f"SET ROLE authenticated;INSERT INTO linkedin_messages(workspace_id,conversation_id,account_id,provider_message_id,direction) VALUES('{W}','{cid}','{A}','forged','outbound');",fail=True);mark('Inbox direct message forgery denied')
 contact='70000000-0000-4000-8000-000000000001';foreign='70000000-0000-4000-8000-000000000002'
 sql(f"INSERT INTO contacts(id,workspace_id) VALUES('{contact}','{W}'),('{foreign}','aaaaaaaa-0000-4000-8000-00000000000b');")
 sql(f"SET ROLE authenticated;SELECT linkedin_conversation_edit('{cid}',NULL,'contact','{foreign}');",fail=True);mark('Inbox foreign CRM link denied')
 sql(f"SET ROLE authenticated;SELECT linkedin_conversation_edit('{cid}',NULL,'contact','{contact}');");mark('Inbox same workspace CRM link allowed')
 for _ in range(2):sql(f"SELECT linkedin_outbound_commit('{cid}','{W}','{U}','out-qa','Teste');")
 assert sql("SELECT count(*) FROM linkedin_messages WHERE provider_message_id='out-qa'")=='1';mark('Inbox receipt replay does not duplicate')
 sql('''CREATE TABLE sdr_playbooks(id uuid PRIMARY KEY,workspace_id uuid,owner_id uuid,assigned_to uuid,enabled boolean,guardrails jsonb,UNIQUE(id,workspace_id));
 CREATE TABLE sdr_agent_versions(id uuid PRIMARY KEY,workspace_id uuid,playbook_id uuid,status text,published_by uuid);
 CREATE TABLE sdr_enrollments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid,playbook_id uuid,status text,conversation_id uuid,opted_out_at timestamptz,messages_sent int DEFAULT 0,last_action_at timestamptz,contact_id uuid,lead_id uuid,company_id uuid,deal_id uuid,qualification_id uuid,UNIQUE(id,workspace_id));
 CREATE TABLE sdr_workspace_settings(workspace_id uuid,enabled boolean,tech_breaker_open_at timestamptz);
 CREATE TABLE whatsapp_conversations(id uuid PRIMARY KEY,workspace_id uuid);
 CREATE TABLE email_threads(id uuid PRIMARY KEY,workspace_id uuid,account_id uuid);
 CREATE TABLE live_chat_sessions(id uuid PRIMARY KEY,workspace_id uuid);
 CREATE TABLE prospecting_qualifications(id uuid PRIMARY KEY);
 SET check_function_bodies=false;
 ''')
 for file,table in [('0256_service_channel_registry','service_channel_accounts'),('0256_service_channel_registry','service_channel_bindings'),('0258_service_agent_queue','service_agent_sessions'),('0258_service_agent_queue','service_agent_jobs'),('0258_service_agent_queue','service_agent_inbound_events')]:ddl(file,table)
 sql("ALTER TABLE service_channel_accounts ADD COLUMN routing_configured boolean DEFAULT true;ALTER TABLE service_agent_jobs ADD COLUMN send_token uuid;ALTER TABLE service_agent_sessions ENABLE ROW LEVEL SECURITY;CREATE POLICY service_agent_session_read ON service_agent_sessions USING(false);")
 sql(Path('drizzle/migrations/0343_linkedin_service_runtime.sql').read_text())
 mark('shared LinkedIn runtime migration installs against real queue DDL')
 sql(f"SELECT linkedin_record_access_ctx(work_access_context(),'linkedin_conversations','{cid}','update');")
 assert sql(f"SELECT sales_record_access('linkedin_conversations','{cid}','view')")=='t';mark('shared record boundary resolves LinkedIn owner')
 for file,table in [('0292_prospecting_sequence_drafts','prospecting_sequence_drafts'),('0292_prospecting_sequence_drafts','prospecting_sequence_draft_revisions'),('0293_prospecting_sequence_versions','prospecting_sequence_versions'),('0294_prospecting_sequence_cohorts','prospecting_sequence_cohorts'),('0294_prospecting_sequence_cohorts','prospecting_sequence_cohort_people'),('0295_prospecting_sequence_runtime','prospecting_sequence_runs'),('0295_prospecting_sequence_runtime','prospecting_sequence_effects')]:ddl(file,table)
 sql('''ALTER TABLE prospecting_sequence_effects ADD COLUMN target jsonb,ADD COLUMN account_id uuid,ADD COLUMN sender jsonb,ADD COLUMN provider_receipt jsonb,ADD COLUMN projection_state text;
 ALTER TABLE prospecting_sequence_runs ADD COLUMN step_entered_at timestamptz,ADD COLUMN handoff_effect_id uuid;
 CREATE TABLE prospecting_sequence_reply_wakes(run_id uuid PRIMARY KEY,workspace_id uuid,occurred_at timestamptz);
 CREATE ROLE techerp_api_subject;CREATE SCHEMA techerp_api AUTHORIZATION techerp_api_subject;GRANT USAGE ON SCHEMA public TO techerp_api_subject;
 ''')
 sql(Path('drizzle/migrations/0344_linkedin_commercial_sequences.sql').read_text())
 mark('LinkedIn sequences migration installs with immutable-version queue tables')
 # Compile PLpgSQL declarations now that every runtime row type exists; SQL statements are checked by executed cases below.
 for file in ['0343_linkedin_service_runtime','0344_linkedin_commercial_sequences']:
  s=Path('drizzle/migrations/'+file+'.sql').read_text()
  for m in re.finditer(r'CREATE(?: OR REPLACE)? FUNCTION ([\w.]+)\(',s):
   d=re.search(r'AS\s+(\$\w*\$)',s[m.end():],re.I);begin=m.end()+d.end();end=s.index(d[1]+';',begin);definition=s[m.start():end+len(d[1])+1].replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION',1)
   # The audience impersonation helper has its own non-bypass owner.
   prefix='SET ROLE techerp_api_subject;' if m[1].startswith('techerp_api.') else ''
   sql('SET check_function_bodies=true;'+prefix+definition)
 mark('all new runtime function declarations compile with body checks enabled')
 sql('''CREATE TABLE workspace_members(workspace_id uuid,user_id uuid,is_test_user boolean);
 CREATE TABLE activities(id uuid PRIMARY KEY,workspace_id uuid,completed boolean);
 CREATE TABLE email_messages(id uuid PRIMARY KEY,workspace_id uuid,thread_id uuid,account_id uuid,direction text,received_at timestamptz,created_at timestamptz,from_email text,to_emails text[],message_id_header text,in_reply_to text,headers jsonb);
 CREATE TABLE email_accounts(id uuid PRIMARY KEY,workspace_id uuid,email text);
 CREATE TABLE whatsapp_messages(id uuid PRIMARY KEY,workspace_id uuid,conversation_id uuid,direction text,created_at timestamptz,from_number text,to_number text);
 ''')
 auto=Path('drizzle/migrations/0258_service_agent_queue.sql').read_text();start=auto.index('CREATE FUNCTION public.service_agent_email_is_automatic');end=auto.index('$$;',auto.index('AS $$',start)+5)+3;sql(auto[start:end])
 runtime=Path('drizzle/migrations/0297_prospecting_sequence_operations.sql').read_text();start=runtime.index('CREATE OR REPLACE FUNCTION public.prospecting_sequence_runtime_allowed');end=runtime.index('$$;',runtime.index('AS $$',start)+5)+3;sql(runtime[start:end])
 # Run the actual inbound trigger -> shared SDR queue, then confirmed outbound projection.
 sql('''ALTER TABLE sdr_playbooks ADD COLUMN name text;
 ALTER TABLE sdr_enrollments ADD COLUMN owner_id uuid,ADD COLUMN commercial_stage text,ADD COLUMN cancel_reason text,ADD COLUMN follow_up_at timestamptz,ADD COLUMN channel_identity jsonb DEFAULT '{}';
 CREATE TABLE service_agent_ingest_errors(workspace_id uuid,channel text,message_id uuid,error text,UNIQUE(channel,message_id));
 CREATE UNIQUE INDEX service_agent_jobs_one_queued ON service_agent_jobs(session_id) WHERE status='queued';
 CREATE FUNCTION is_workspace_member(uuid,uuid) RETURNS boolean LANGUAGE sql STABLE AS $$SELECT coalesce(work_access_context()->>'actor'=$2::text,false)$$;
 ''')
 pb='80000000-0000-4000-8000-000000000001';av='80000000-0000-4000-8000-000000000002';ca='80000000-0000-4000-8000-000000000003'
 sql(f"INSERT INTO sdr_playbooks(id,workspace_id,owner_id,enabled,guardrails,name) VALUES('{pb}','{W}','{U}',true,'{{}}','QA SDR');INSERT INTO sdr_agent_versions VALUES('{av}','{W}','{pb}','published','{U}');INSERT INTO sdr_workspace_settings VALUES('{W}',true,NULL);INSERT INTO service_channel_accounts(id,workspace_id,channel,source_key,label,enabled) VALUES('{ca}','{W}','linkedin','{A}','Meu LinkedIn',true);INSERT INTO service_channel_bindings(account_id,workspace_id,agent_id,inbound,campaigns,enabled,updated_at) VALUES('{ca}','{W}','{pb}',true,true,true,now()-interval '1 minute');")
 sql(f"INSERT INTO unipile_inbound_messages(account_id,provider_message_id,chat_id,sender_id,body) VALUES('{A}','in-agent','chat-qa','person-qa','Pode agendar?');")
 assert sql('SELECT coalesce(string_agg(error,E\'\\n\'),\'\') FROM service_agent_ingest_errors')=='',sql('SELECT error FROM service_agent_ingest_errors')
 assert sql("SELECT count(*) FROM service_agent_jobs WHERE status='queued'")=='1';mark('signed inbound enqueues published SDR in the shared runtime')
 session=sql(f"SELECT id FROM service_agent_sessions WHERE source_id='{cid}';")
 enrollment=sql(f"SELECT enrollment_id FROM service_agent_sessions WHERE id='{session}';")
 assert json.loads(sql(f"SELECT service_agent_source_context('{enrollment}');"))['actor']==U;mark('SDR transport uses personal account owner authorization')
 job=sql("SELECT id FROM service_agent_jobs LIMIT 1;")
 token='90000000-0000-4000-8000-000000000001'
 sql(f"UPDATE service_agent_jobs SET send_token='{token}',send_started_at=now(),status='running',draft_text='Vamos conversar.' WHERE id='{job}';")
 for _ in range(2):sql(f"SELECT service_agent_complete_linkedin('{job}','{token}','agent-out-qa');")
 assert sql("SELECT count(*) FROM linkedin_messages WHERE provider_message_id='agent-out-qa'")=='1'
 assert sql(f"SELECT ai_owner FROM service_agent_sessions WHERE id='{session}'")=='ai';mark('confirmed SDR send is idempotent and does not trigger human takeover')
 sql(f"SET ROLE authenticated;SET qa.actor='{U}';SELECT service_agent_set_owner('linkedin','{cid}','human');")
 assert sql(f"SELECT service_agent_source_context('{enrollment}') IS NULL")=='t';mark('human takeover blocks subsequent SDR delivery')
 sql(f"SELECT service_agent_complete_linkedin('{job}','00000000-0000-4000-8000-000000000000','forged');",fail=True);mark('forged SDR delivery proof denied')
 # A confirmed sequence effect projects once and its subsequent inbound wakes the same run.
 definition={'schemaVersion':1,'steps':[{'id':'a0000000-0000-4000-8000-000000000001','type':'linkedin','accountId':ca,'body':'Teste','title':'LinkedIn','agentId':pb}], 'settings':{'stopOnReply':True,'agentId':pb}}
 d='a0000000-0000-4000-8000-000000000002';v='a0000000-0000-4000-8000-000000000003';cohort='a0000000-0000-4000-8000-000000000004';person='a0000000-0000-4000-8000-000000000005';run='a0000000-0000-4000-8000-000000000006';effect='a0000000-0000-4000-8000-000000000007';lease='a0000000-0000-4000-8000-000000000008';step=definition['steps'][0]['id']
 encoded=json.dumps(definition);payload={'messageId':'sequence-out-qa','chatId':'sequence-chat-qa','targetId':'sequence-person-qa','body':'Teste de sequência'};receipt=json.dumps(payload)
 sql(f"INSERT INTO prospecting_sequence_drafts(id,workspace_id,owner_id,name,revision,definition,updated_by) VALUES('{d}','{W}','{U}','QA',1,'{encoded}','{U}');INSERT INTO prospecting_sequence_draft_revisions VALUES('{d}','{W}',1,'QA','{encoded}','{U}',now());INSERT INTO prospecting_sequence_versions(id,draft_id,workspace_id,owner_id,draft_revision,name,definition,created_by) VALUES('{v}','{d}','{W}','{U}',1,'QA','{encoded}','{U}');INSERT INTO prospecting_sequence_cohorts(id,workspace_id,version_id,owner_id,created_by,request_id,consent_evidence,requested) VALUES('{cohort}','{W}','{v}','{U}','{U}',gen_random_uuid(),'QA autorizado',1);INSERT INTO prospecting_sequence_cohort_people(id,cohort_id,workspace_id,entity,source_id,channels,identity_keys) VALUES('{person}','{cohort}','{W}','contact','{contact}','{{\"linkedin\":true}}',ARRAY['identity-qa']);INSERT INTO prospecting_sequence_runs(id,workspace_id,cohort_person_id,version_id,owner_id,lease_token,lease_until) VALUES('{run}','{W}','{person}','{v}','{U}','{lease}',now()+interval '10 minutes');INSERT INTO prospecting_sequence_effects(id,workspace_id,run_id,step_id,kind,status,token,provider_id,provider_receipt,projection_state,target,account_id,sender,finished_at) VALUES('{effect}','{W}','{run}','{step}','linkedin','succeeded','{token}','sequence-out-qa','{receipt}','pending','{{\"first_name\":\"Pessoa QA\"}}','{ca}','{{\"sourceKey\":\"{A}\"}}',now()-interval '10 seconds');")
 source=Path('drizzle/migrations/0302_prospecting_sequence_conversation_identity.sql').read_text();start=source.index('CREATE FUNCTION public.prospecting_sequence_person_matches');end=source.index('END $$;',start)+7;sql(source[start:end])
 start=source.index('CREATE FUNCTION public.prospecting_sequence_whatsapp_identity');end=source.index('END $$;',start)+7;sql(source[start:end])
 for _ in range(2):assert sql(f"SELECT prospecting_sequence_message_commit_0302('{effect}','{token}','{receipt}');")==effect
 assert sql("SELECT count(*) FROM linkedin_messages WHERE provider_message_id='sequence-out-qa'")=='1';mark('sequence receipt creates Inbox thread and outbound once')
 sql(f"INSERT INTO unipile_inbound_messages(account_id,provider_message_id,chat_id,sender_id,body) VALUES('{A}','sequence-in-qa','sequence-chat-qa','sequence-person-qa','Vamos agendar');")
 assert sql(f"SELECT count(*) FROM prospecting_sequence_reply_wakes WHERE run_id='{run}'")=='1';mark('LinkedIn inbound wakes the originating sequence without locking its run')
 info=json.loads(sql(f"SELECT prospecting_sequence_reply_signals('{run}','{step}');"));assert info['replied'] and info['previousReplied'] and info['responseAgentId']==pb;mark('sequence response keeps its selected agent and stops followup')
 # Backpressure clears a safe lease without moving the cursor; uncertain effects cannot be deferred.
 sql(f"UPDATE prospecting_sequence_effects SET status='sending',provider_id=NULL,provider_receipt=NULL WHERE id='{effect}';DELETE FROM unipile_delivery_receipts;")
 sql(f"SELECT prospecting_sequence_defer_delivery('{run}','{lease}','{effect}','{token}',now()+interval '1 hour');")
 assert sql(f"SELECT cursor||':'||state||':'||(lease_token IS NULL)::text FROM prospecting_sequence_runs WHERE id='{run}'")=='0:active:true';mark('provider backpressure defers safely without advancing the sequence')
 sql(f"UPDATE prospecting_sequence_runs SET lease_token='{lease}',lease_until=now()+interval '10 minutes' WHERE id='{run}';UPDATE prospecting_sequence_effects SET status='sending' WHERE id='{effect}';INSERT INTO unipile_delivery_receipts(account_id,request_key,status) VALUES('{A}','uncertain-test','uncertain');")
 sql(f"SELECT prospecting_sequence_defer_delivery('{run}','{lease}','{effect}','{token}',now()+interval '1 hour');",fail=True);mark('uncertain LinkedIn result cannot be reclassified as safe backpressure')

 assert json.loads(sql(f"SELECT unipile_delivery_begin('{A}','{'f'*64}','message.send',50,60,false);"))['reason']=='delivery_uncertain';mark('new nonce cannot bypass unresolved personal account delivery')
