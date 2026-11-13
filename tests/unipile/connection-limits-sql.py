"""Real migrations in disposable PostgreSQL; identity context is a synthetic fixture."""
import concurrent.futures,json,pathlib,subprocess,time,uuid,os,shutil
import sys
sys.dont_write_bytecode=True
D=os.environ.get('DOCKER_BIN') or shutil.which('docker') or '/Applications/Docker.app/Contents/Resources/bin/docker'
name='techerp-linkedin-limits-'+str(uuid.uuid4())
U='10000000-0000-4000-8000-000000000001';W='aaaaaaaa-0000-4000-8000-00000000000a';A='50000000-0000-4000-8000-000000000001';F='60000000-0000-4000-8000-000000000001'
base={'actor':U,'workspace':W,'keys':{'system.linkedin.view.own':True,'system.linkedin.manage.own':True},'read_only':False}
passed=[]
def run(*args,input=None,check=True):
 r=subprocess.run([D,*args],input=input,text=True,capture_output=True)
 if check and r.returncode:raise RuntimeError(r.stderr)
 return r

def sql(s,fail=False):
 r=run('exec','-i',name,'psql','-U','postgres','-qAt','-v','ON_ERROR_STOP=1',input=s,check=not fail)
 if fail:assert r.returncode!=0,(s,r.stdout)
 return r.stdout.strip()

def context(c):sql("UPDATE qa_context SET context='"+json.dumps(c)+"';")
def test(label,fn):fn();passed.append(label)
def reserve(endpoint='message.send',noted=False):return json.loads(sql(f"SELECT unipile_request_reserve('{A}','{endpoint}',50,60,{str(noted).lower()});"))
def reset():sql(f"TRUNCATE unipile_attempts; UPDATE unipile_accounts SET next_outbound_at=NULL,paused_until=NULL,status='connected',operation_policy=operation_policy||'{{\"paused\":false,\"daily_messages\":15,\"weekly_messages\":75,\"daily_invites\":5,\"weekly_invites\":20}}'::jsonb;")
run('run','--rm','-d','--network','none','--name',name,'-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:17-alpine')
try:
 for _ in range(40):
  if run('exec',name,'pg_isready','-h','127.0.0.1','-U','postgres',check=False).returncode==0:break
  time.sleep(.3)
 sql('''CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
 CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY);CREATE TABLE workspaces(id uuid PRIMARY KEY);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('qa.actor',true),'')::uuid $$;
 CREATE TABLE qa_context(context jsonb); INSERT INTO qa_context VALUES('{}');
 CREATE FUNCTION work_access_context() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT context FROM qa_context LIMIT 1 $$;
 CREATE FUNCTION work_subject_context(uuid,uuid) RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT context FROM qa_context LIMIT 1 $$;
 ''')
 sql(pathlib.Path('supabase/migrations/20260630192157_9935be66-baf6-4852-b07c-529567712eb8.sql').read_text())
 sql(f"ALTER TABLE unipile_accounts ADD COLUMN workspace_id uuid; INSERT INTO auth.users VALUES('{U}'); INSERT INTO workspaces VALUES('{W}');")
 sql(pathlib.Path('drizzle/migrations/0336_unipile_personal_account_access.sql').read_text())
 sql(pathlib.Path('drizzle/migrations/0337_unipile_secure_auth_flow.sql').read_text())
 context(base)
 sql(f"INSERT INTO unipile_accounts(id,owner_id,workspace_id,status,unipile_account_id,daily_window) VALUES('{A}','{U}','{W}','connected','provider','{{\"tz\":\"UTC\",\"start_hour\":0,\"end_hour\":24}}'); INSERT INTO unipile_rate_buckets(account_id,endpoint,count,last_request_at) VALUES('{A}','message.send',3,now());")
 sql(pathlib.Path('drizzle/migrations/0338_unipile_atomic_limits.sql').read_text())
 assert sql('SELECT count(*) FROM unipile_attempts')=='3';passed.append('legacy counters preserved')
 # Service-only boundaries and direct REST write protection.
 sql(f"SET ROLE authenticated; UPDATE unipile_accounts SET unipile_account_id='forged' WHERE id='{A}';",fail=True);passed.append('direct credential mutation denied')
 sql(f"SET ROLE authenticated; SELECT unipile_request_reserve('{A}','message.send',50,60);",fail=True);passed.append('public reservation denied')
 sql(f"SET ROLE authenticated; SELECT * FROM unipile_auth_flows;",fail=True);passed.append('private states unreadable')
 # Finalization must recheck context, then consume the flow exactly once.
 def flow():sql(f"DELETE FROM unipile_auth_flows; INSERT INTO unipile_auth_flows(id,owner_id,workspace_id,scope_id,state_hash,expires_at) VALUES('{F}','{U}','{W}','scope','hash',now()+interval '10 minutes');")
 def complete(state='hash',scope='scope'):return sql(f"SELECT unipile_connect_complete('{F}','{state}','provider','{scope}','QA');")
 for label,c in [('missing key',{**base,'keys':{}}),('deny',{**base,'keys':{'system.linkedin.view.own':True}}),('other workspace',{**base,'workspace':'aaaaaaaa-0000-4000-8000-00000000000b'}),('inactive',{})]:
  flow();context(c);sql(f"SELECT unipile_connect_complete('{F}','hash','provider','scope','QA');",fail=True);passed.append('completion rejects '+label)
 context(base);flow();assert complete()==A;passed.append('exact allowed completion')
 sql(f"SELECT unipile_connect_complete('{F}','hash','provider','scope','QA');",fail=True);passed.append('consumed callback rejected')
 flow();sql(f"UPDATE unipile_auth_flows SET expires_at=now()-interval '1 second';");sql(f"SELECT unipile_connect_complete('{F}','hash','provider','scope','QA');",fail=True);passed.append('expired callback rejected')
 flow();sql(f"SELECT unipile_connect_complete('{F}','forged','provider','scope','QA');",fail=True);passed.append('state mismatch rejected')
 # Concurrent operations serialize against the account row: exactly one permitted.
 reset()
 with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:results=list(ex.map(lambda _:reserve(),range(8)))
 assert sum(bool(r['ok']) for r in results)==1,results
 assert sql('SELECT count(*) FROM unipile_attempts')=='1';passed.append('eight concurrent outbound requests allow one')
 reset();r=reserve();sql("UPDATE unipile_accounts SET next_outbound_at=NULL; UPDATE unipile_attempts SET created_at=now()-interval '2 minutes';");assert reserve()['ok'];assert sql('SELECT count(*) FROM unipile_attempts')=='2';passed.append('failed calls still consume reservation')
 reset();sql("UPDATE unipile_accounts SET operation_policy=operation_policy||'{\"daily_messages\":0}'::jsonb;");assert reserve()['reason']=='daily_limit';passed.append('daily limit zero blocks')
 reset();sql("UPDATE unipile_accounts SET operation_policy=operation_policy||'{\"weekly_messages\":0}'::jsonb;");assert reserve()['reason']=='weekly_limit';passed.append('weekly limit zero blocks')
 reset();sql("UPDATE unipile_accounts SET operation_policy=operation_policy||'{\"paused\":true}'::jsonb;");assert reserve()['reason']=='account_paused';passed.append('manual pause blocks')
 reset();sql("UPDATE unipile_accounts SET paused_until=now()+interval '1 hour';");assert reserve()['reason']=='account_paused';passed.append('provider pause blocks')
 reset();sql("UPDATE unipile_accounts SET status='disconnected';");sql(f"SELECT unipile_request_reserve('{A}','message.send',50,60);",fail=True);passed.append('disconnected blocks')
 reset();context({});sql(f"SELECT unipile_request_reserve('{A}','message.send',50,60);",fail=True);passed.append('inactive reservation blocked')
 reset();context(base)
 def read_reserve():return json.loads(sql(f"SELECT unipile_request_reserve('{A}','profile.fetch',2,0,false);"))
 with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:reads=list(ex.map(lambda _:read_reserve(),range(8)))
 assert sum(bool(r['ok']) for r in reads)==2,reads;passed.append('daily quota holds under eight concurrent reads')
 reset();sql(f"UPDATE unipile_accounts SET operation_policy=operation_policy||'{{\"daily_invites\":15,\"weekly_invites\":100}}'::jsonb; INSERT INTO unipile_attempts(account_id,endpoint,noted,created_at) SELECT '{A}','invite.send',true,now()-interval '2 minutes' FROM generate_series(1,5);")
 assert reserve('invite.send',True)['reason']=='noted_invitation_limit';passed.append('noted invitation monthly ceiling enforced')
 reset();tz='UTC';h=int(sql("SELECT extract(hour FROM now() AT TIME ZONE 'UTC')::int;"))
 if h==23:tz='Etc/GMT+12';h=11
 sql(f"UPDATE unipile_accounts SET daily_window='{{\"tz\":\"{tz}\",\"start_hour\":{h+1},\"end_hour\":24}}';")
 window=reserve();assert window['reason']=='out_of_window';assert sql(f"SELECT ('{window['retryAt']}'::timestamptz AT TIME ZONE '{tz}')::date=(now() AT TIME ZONE '{tz}')::date;")=='t';passed.append('before-window retry is today not tomorrow')
 sql("UPDATE unipile_accounts SET daily_window='{\"tz\":\"UTC\",\"start_hour\":0,\"end_hour\":24}';")
 context(base);reset()
 sql("CREATE TABLE ats_sourcing_enrollments(id uuid DEFAULT gen_random_uuid(),owner_id uuid,workspace_id uuid,candidate_id uuid,status text,finished_at timestamptz,next_run_at timestamptz,last_error text);")
 sql(pathlib.Path('drizzle/migrations/0339_unipile_inbound_idempotency.sql').read_text())
 C='70000000-0000-4000-8000-000000000001'
 sql(f"INSERT INTO unipile_message_log(account_id,owner_id,kind,target_identifier,candidate_id,status) VALUES('{A}','{U}','message','sender','{C}','sent'); INSERT INTO ats_sourcing_enrollments(owner_id,workspace_id,candidate_id,status) VALUES('{U}','{W}','{C}','active');")
 def inbound():return json.loads(sql(f"SELECT unipile_receive_message('{A}','message','chat','sender','Resposta');"))
 with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:received=list(ex.map(lambda _:inbound(),range(8)))
 assert sum(not r['duplicate'] for r in received)==1,received
 assert sql('SELECT count(*) FROM unipile_inbound_messages')=='1'
 assert sql("SELECT status FROM ats_sourcing_enrollments")=='replied';passed.append('eight concurrent webhooks persist one message and pause cadence')
 sql("SET ROLE authenticated; SELECT * FROM unipile_inbound_messages;",fail=True);passed.append('inbound journal private')
 context({});assert json.loads(sql(f"SELECT unipile_receive_message('{A}','other','chat','sender','Resposta');"))['accepted'] is False;passed.append('inactive account cannot ingest')
 context(base);reset()
 sql(pathlib.Path('drizzle/migrations/0340_unipile_delivery_receipts.sql').read_text())
 def begin_delivery():return json.loads(sql(f"SELECT unipile_delivery_begin('{A}','{'a'*64}','message.send',50,60,false);"))
 with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:receipts=list(ex.map(lambda _:begin_delivery(),range(8)))
 leases=[r for r in receipts if r['ok']];assert len(leases)==1,receipts
 lease=leases[0];passed.append('one delivery lease for eight concurrent requests')
 sql(f"SELECT unipile_delivery_finish('{lease['id']}','{lease['token']}','sent','{{\"id\":\"provider-message\"}}');")
 again=begin_delivery();assert again['cached'] and again['response']['id']=='provider-message';passed.append('completed delivery returns cached receipt')
 sql(f"UPDATE unipile_delivery_receipts SET status='uncertain'; UPDATE unipile_accounts SET next_outbound_at=NULL;")
 assert begin_delivery()['reason']=='delivery_uncertain';passed.append('uncertain delivery never automatically repeated')
 sql(f"SELECT unipile_delivery_finish('{lease['id']}','00000000-0000-4000-8000-000000000000','sent','{{}}');",fail=True);passed.append('forged lease token denied')
 usage=json.loads(sql(f"SELECT unipile_usage_snapshot('{A}');"));assert next(b for b in usage['buckets'] if b['endpoint']=='message.send')['count']==1;passed.append('usage snapshot counts reserved attempts')
 context({});sql(f"SELECT unipile_usage_snapshot('{A}');",fail=True);passed.append('usage denies inactive member')
 context(base);sql('TRUNCATE unipile_auth_flows;')
 for n in range(5):sql(f"SELECT unipile_connect_start('{U}','{W}','personal',NULL,'{str(n)*64}');")
 assert sql('SELECT count(*) FROM unipile_auth_flows WHERE consumed_at IS NULL')=='1';passed.append('new authentication supersedes previous flow')
 sql(f"SELECT unipile_connect_start('{U}','{W}','personal',NULL,'{'f'*64}');",fail=True);passed.append('hosted authentication attempts limited atomically')
 sql('TRUNCATE unipile_auth_flows;')
 sql(f"SELECT unipile_connect_start('{U}','{W}','foreign','provider','{'e'*64}');",fail=True);passed.append('reconnect cannot change permanent scope')
 context(base)
 sql(f"INSERT INTO unipile_request_log(account_id,owner_id,endpoint,status,latency_ms) SELECT '{A}','{U}','message.send',CASE WHEN n%2=0 THEN 200 ELSE 429 END,n FROM generate_series(1,201)n;")
 metrics=json.loads(sql(f"SELECT unipile_usage_snapshot('{A}');"))['aggregate'];assert metrics['total']==201 and metrics['success']==100 and metrics['errors']==101;passed.append('24-hour metrics include more than the 100-row display page')
 context(base)
 sql(pathlib.Path('drizzle/migrations/0341_unipile_log_access.sql').read_text())
 def visible_logs(c):
  context(c)
  return sql(f"SET ROLE authenticated; SET qa.actor='{U}'; SELECT count(*) FROM unipile_request_log;")
 assert visible_logs(base)=='201';passed.append('authorized personal logs readable')
 for label,c in [('missing key',{**base,'keys':{}}),('deny',{**base,'keys':{'system.linkedin.manage.own':True}}),('other workspace',{**base,'workspace':'aaaaaaaa-0000-4000-8000-00000000000b'}),('inactive',{})]:
  assert visible_logs(c)=='0';passed.append('logs deny '+label)
 context(base);sql("SET ROLE authenticated; UPDATE unipile_message_log SET status='sent';",fail=True);passed.append('direct outreach log forgery denied')
 from inbox_runtime_sql import check as check_inbox_runtime
 check_inbox_runtime(sql,context,base,A,U,W,passed)
 print(json.dumps({'passed':passed,'count':len(passed),'engine':'PostgreSQL17','production_connections':0,'fixture':'synthetic identity; real schema, migrations, row locks and grants'},indent=2))
finally:run('rm','-f',name)
