import subprocess,time,pathlib,json,uuid
D='/Applications/Docker.app/Contents/Resources/bin/docker'
name='techerp-linkedin-qa-'+str(uuid.uuid4())
def run(*a,input=None):
 return subprocess.run([D,*a],input=input,text=True,capture_output=True,check=True).stdout
run('run','--rm','-d','--network','none','--name',name,'-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:17-alpine')
try:
 for i in range(30):
  if subprocess.run([D,'exec',name,'pg_isready','-U','postgres'],capture_output=True).returncode==0:break
  time.sleep(.3)
 setup='''CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
 CREATE SCHEMA auth;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('qa.actor',true),'')::uuid $$;
 CREATE FUNCTION public.work_access_context() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT current_setting('qa.context')::jsonb $$;
 CREATE TABLE public.unipile_accounts(id uuid,workspace_id uuid,owner_id uuid);
 ALTER TABLE public.unipile_accounts ENABLE ROW LEVEL SECURITY;
 GRANT USAGE ON SCHEMA auth TO authenticated;
 GRANT SELECT,INSERT,UPDATE,DELETE ON public.unipile_accounts TO authenticated;
 CREATE POLICY legacy_owner ON public.unipile_accounts FOR ALL TO authenticated USING(auth.uid()=owner_id) WITH CHECK(auth.uid()=owner_id);
 INSERT INTO public.unipile_accounts VALUES('50000000-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-00000000000a','10000000-0000-4000-8000-000000000001');
 '''
 migration=pathlib.Path('drizzle/migrations/0336_unipile_personal_account_access.sql').read_text()
 run('exec','-i',name,'psql','-U','postgres','-v','ON_ERROR_STOP=1',input=setup+migration)
 U='10000000-0000-4000-8000-000000000001'; W='aaaaaaaa-0000-4000-8000-00000000000a'
 base={'actor':U,'workspace':W,'keys':{'system.linkedin.view.own':True,'system.linkedin.manage.own':True},'read_only':False}
 cases=[('allowed',base,1),('missing_permission',{**base,'keys':{}},0),('explicit_deny',{**base,'keys':{'system.linkedin.manage.own':True}},0),('foreign_workspace',{**base,'workspace':'aaaaaaaa-0000-4000-8000-00000000000b'},0),('inactive_member',{},0)]
 for label,ctx,count in cases:
  sql=f"SET ROLE authenticated; SET qa.actor='{U}'; SET qa.context='{json.dumps(ctx)}'; SELECT count(*) FROM public.unipile_accounts;"
  out=run('exec','-i',name,'psql','-U','postgres','-qAt','-v','ON_ERROR_STOP=1',input=sql).strip()
  assert out==str(count),(label,out)
 print(json.dumps({'passed':[c[0] for c in cases],'engine':'PostgreSQL 17','production_connections':0,'fixture':'synthetic work_access_context; real migration and restrictive RLS'},indent=2))
finally:run('rm','-f',name)
