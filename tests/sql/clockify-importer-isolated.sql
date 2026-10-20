-- Prova isolada do importador Clockify (banco descartável local, nunca o compartilhado).
-- Uso: psql -f tests/sql/clockify-importer-isolated.sql após 0157/0158, com a estrutura mínima abaixo.
-- Resultado de 2026-10-20: 23 checagens 't' e 8 avisos 'ok', nenhum 'FALHOU'.

-- Estrutura mínima espelhando as colunas reais usadas (auditadas no catálogo de produção).
do $r$ begin if not exists (select 1 from pg_roles where rolname=$q$anon$q$) then create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; end if; end $r$;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
grant usage on schema auth, public to anon, authenticated, service_role;
create type public.project_status as enum ('planning','active','on_hold','done','cancelled');
create type public.project_task_status as enum ('todo','doing','review','done');
create type public.project_member_role as enum ('manager','contributor','viewer');
create table public.workspaces (id uuid primary key, created_by uuid);
create table public.workspace_members (workspace_id uuid not null, user_id uuid not null, role text not null default 'member', status text not null default 'active', primary key (workspace_id,user_id));
create table public.companies (id uuid primary key default gen_random_uuid(), workspace_id uuid not null, name text);
create table public.projects (id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id), owner_id uuid not null, service_id uuid, contract_id uuid, name text not null, description text, status public.project_status not null default 'planning', starts_at date, due_at date, progress int not null default 0, planned_hours numeric, planned_cost numeric, metadata jsonb not null default '{}', created_at timestamptz not null default now(), updated_at timestamptz not null default now(), assigned_to uuid);
create table public.project_tasks (id uuid primary key default gen_random_uuid(), workspace_id uuid not null, project_id uuid not null references public.projects(id) on delete cascade, milestone_id uuid, title text not null, description text, status public.project_task_status not null default 'todo', assignee_id uuid, due_at date, estimated_hours numeric, sort_order int not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), list_id uuid, parent_task_id uuid, custom_status_id uuid, priority text not null default 'normal', start_at date, tags text[] not null default '{}', assignee_ids uuid[] not null default '{}', custom_field_values jsonb not null default '{}');
create table public.project_members (id uuid primary key default gen_random_uuid(), workspace_id uuid not null, project_id uuid not null references public.projects(id) on delete cascade, user_id uuid not null, role_in_project public.project_member_role not null default 'contributor', cost_rate_hour numeric, bill_rate_hour numeric, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), can_track_time boolean not null default true, unique (project_id,user_id));
create table public.project_time_entries (id uuid primary key default gen_random_uuid(), workspace_id uuid not null, project_id uuid not null references public.projects(id) on delete cascade, task_id uuid references public.project_tasks(id) on delete set null, user_id uuid not null, entry_date date, hours numeric check (hours > 0), description text, billable boolean not null default true, approved_at timestamptz, approved_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), started_at timestamptz, stopped_at timestamptz, hourly_rate numeric, financial_entry_id uuid, allocation_id uuid, person_id uuid, invoice_id uuid, invoiced_at timestamptz, start_time time, end_time time, duration_minutes int, source text not null default 'manual' check (source in ('manual','timer','api','integration','import')), external_id text, status text not null default 'draft' check (status in ('draft','submitted','approved','rejected','locked')), submitted_at timestamptz, rejected_at timestamptz, rejected_by uuid, reject_reason text, locked_at timestamptz, created_by uuid);
create table public.workflow_events (id bigserial primary key, owner_id uuid, workspace_id uuid, entity text, entity_id uuid, event_type text, before jsonb, after jsonb);
create table public.project_updates (id bigserial primary key, workspace_id uuid, project_id uuid, kind text, title text);
create function public.is_active_workspace_admin(_workspace uuid, _user uuid) returns boolean language sql stable security definer as $$
  select _workspace is not null and _user is not null and exists (select 1 from public.workspace_members wm where wm.workspace_id=_workspace and wm.user_id=_user and wm.status='active' and wm.role in ('owner','admin')) $$;
-- Gatilhos reais relevantes (corpo copiado de produção)
create function public.enqueue_wf() returns trigger language plpgsql as $$ begin insert into public.workflow_events (owner_id, workspace_id, entity, entity_id, event_type) values (new.owner_id, new.workspace_id, 'projects', new.id, tg_op); return null; end $$;
create trigger trg_wf_events_projects after insert or update on public.projects for each row execute function public.enqueue_wf();
create function public.enqueue_wf_tasks() returns trigger language plpgsql as $$ begin insert into public.workflow_events (workspace_id, entity, entity_id, event_type) values (new.workspace_id, 'project_tasks', new.id, tg_op); return null; end $$;
create trigger trg_wf_events_project_tasks after insert or update on public.project_tasks for each row execute function public.enqueue_wf_tasks();
CREATE FUNCTION public.project_time_entries_validate() RETURNS trigger LANGUAGE plpgsql AS $f$
DECLARE v_overlap record;
BEGIN
  IF NEW.project_id IS NULL THEN RAISE EXCEPTION 'Apontamento exige um projeto.'; END IF;
  IF NEW.user_id IS NULL THEN RAISE EXCEPTION 'Apontamento exige um profissional.'; END IF;
  IF NEW.start_time IS NOT NULL AND NEW.end_time IS NOT NULL THEN
    IF NEW.end_time <= NEW.start_time THEN RAISE EXCEPTION 'O horário final deve ser maior que o horário inicial.'; END IF;
    NEW.duration_minutes := ROUND(EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 60)::int;
  ELSIF NEW.duration_minutes IS NULL AND NEW.hours IS NOT NULL THEN
    NEW.duration_minutes := GREATEST(0, ROUND(NEW.hours * 60))::int;
  END IF;
  IF NEW.duration_minutes IS NOT NULL THEN
    IF NEW.duration_minutes < 0 THEN RAISE EXCEPTION 'A duração do apontamento não pode ser negativa.'; END IF;
    NEW.hours := ROUND((NEW.duration_minutes::numeric / 60), 2);
  END IF;
  IF NEW.start_time IS NOT NULL AND NEW.end_time IS NOT NULL THEN
    SELECT t.start_time, t.end_time INTO v_overlap FROM public.project_time_entries t
     WHERE t.user_id = NEW.user_id AND t.entry_date = NEW.entry_date AND t.id IS DISTINCT FROM NEW.id
       AND t.start_time IS NOT NULL AND t.end_time IS NOT NULL AND t.start_time < NEW.end_time AND t.end_time > NEW.start_time LIMIT 1;
    IF v_overlap IS NOT NULL THEN RAISE EXCEPTION 'Já existe um apontamento entre % e % neste dia.', to_char(v_overlap.start_time, 'HH24:MI'), to_char(v_overlap.end_time, 'HH24:MI'); END IF;
  END IF;
  IF NEW.created_by IS NULL THEN NEW.created_by := COALESCE(auth.uid(), NEW.user_id); END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $f$;
CREATE TRIGGER project_time_entries_validate_trg BEFORE INSERT OR UPDATE ON public.project_time_entries FOR EACH ROW EXECUTE FUNCTION public.project_time_entries_validate();
grant all on all tables in schema public to service_role; grant all on all sequences in schema public to service_role;

\ir ../../drizzle/migrations/0157_clockify_importer.sql
\ir ../../drizzle/migrations/0158_clockify_importer_indexes.sql

\set ON_ERROR_STOP 1
insert into workspaces values ('11111111-1111-4111-8111-111111111111', null), ('22222222-2222-4222-8222-222222222222', null);
insert into workspace_members values
 ('11111111-1111-4111-8111-111111111111','aaaaaaaa-0000-4000-8000-000000000001','admin','active'),
 ('11111111-1111-4111-8111-111111111111','aaaaaaaa-0000-4000-8000-000000000002','member','inactive'),
 ('11111111-1111-4111-8111-111111111111','aaaaaaaa-0000-4000-8000-000000000003','admin','inactive'),
 ('22222222-2222-4222-8222-222222222222','bbbbbbbb-0000-4000-8000-000000000001','admin','active');
set role service_role;
-- projeto via RPC: sem workflow
select (clockify_import_apply('11111111-1111-4111-8111-111111111111','projects','insert',
  '[{"_key":"p1","row":{"owner_id":"aaaaaaaa-0000-4000-8000-000000000001","name":"Portal","status":"done","planned_hours":10.5,"metadata":{"clockify":{"archived":true}}}}]')->0->>'id') as pid \gset
select count(*) = 0 as "wf_suprimido_no_rpc" from workflow_events;
-- mesmo insert fora do RPC continua gerando workflow (gatilho intacto)
insert into projects (workspace_id, owner_id, name) values ('11111111-1111-4111-8111-111111111111','aaaaaaaa-0000-4000-8000-000000000001','Manual');
select count(*) = 1 as "wf_normal_fora_do_rpc" from workflow_events;
select (clockify_import_apply('11111111-1111-4111-8111-111111111111','project_tasks','insert',
  format('[{"_key":"t1","row":{"project_id":"%s","title":"Design","status":"done","estimated_hours":2,"assignee_id":"aaaaaaaa-0000-4000-8000-000000000002","assignee_ids":["aaaaaaaa-0000-4000-8000-000000000002"]}}]', :'pid')::jsonb)->0->>'id') as tid \gset
select count(*) = 1 as "wf_tarefa_suprimido" from workflow_events;
select clockify_import_apply('11111111-1111-4111-8111-111111111111','project_members','insert',
  format('[{"_key":"m","row":{"project_id":"%s","user_id":"aaaaaaaa-0000-4000-8000-000000000002","bill_rate_hour":150}},{"_key":"m2","row":{"project_id":"%s","user_id":"aaaaaaaa-0000-4000-8000-000000000002"}}]', :'pid', :'pid')::jsonb) as members \gset
select (:'members'::jsonb->0->>'id') = (:'members'::jsonb->1->>'id') as "membro_idempotente";
-- apontamentos: virada com 24:00:00, segundos, sobreposição e curto demais
select clockify_import_apply('11111111-1111-4111-8111-111111111111','project_time_entries','insert', format('[
 {"_key":"e:0","row":{"project_id":"%1$s","task_id":"%2$s","user_id":"aaaaaaaa-0000-4000-8000-000000000002","entry_date":"2026-01-05","start_time":"22:30:00","end_time":"24:00:00","duration_minutes":90,"description":"Virada","billable":false,"external_id":"clockify:x:0","status":"locked","created_by":"aaaaaaaa-0000-4000-8000-000000000001","started_at":"2026-01-06T01:30:00Z","stopped_at":"2026-01-06T03:00:00Z"}},
 {"_key":"e:1","row":{"project_id":"%1$s","user_id":"aaaaaaaa-0000-4000-8000-000000000002","entry_date":"2026-01-06","start_time":"00:00:00","end_time":"01:15:00","duration_minutes":75,"external_id":"clockify:x:1","status":"locked"}},
 {"_key":"o","row":{"project_id":"%1$s","user_id":"aaaaaaaa-0000-4000-8000-000000000002","entry_date":"2026-01-05","start_time":"23:00:00","end_time":"23:30:00","duration_minutes":30,"status":"locked"}},
 {"_key":"s","row":{"project_id":"%1$s","user_id":"aaaaaaaa-0000-4000-8000-000000000002","entry_date":"2026-01-07","start_time":"10:00:00","end_time":"10:00:15","duration_minutes":0,"status":"locked"}},
 {"_key":"x","row":{"project_id":"%1$s","user_id":"bbbbbbbb-0000-4000-8000-000000000001","entry_date":"2026-01-08","start_time":"10:00:00","end_time":"11:00:00","status":"locked"}},
 {"_key":"d","row":{"project_id":"%1$s","user_id":"aaaaaaaa-0000-4000-8000-000000000002","entry_date":"2026-11-03","duration_minutes":210,"status":"draft","started_at":"2024-11-03T04:30:00Z","stopped_at":"2024-11-03T08:00:00Z"}}
]', :'pid', :'tid')::jsonb) as res \gset
select (:'res'::jsonb->0 ? 'id') and (:'res'::jsonb->1 ? 'id') as "virada_gravada";
select (:'res'::jsonb->2->>'error') like 'Já existe um apontamento%' as "sobreposicao_barrada_pela_validacao";
select (:'res'::jsonb->3->>'code') = '23514' as "curto_barrado_pelo_check_hours";
select (:'res'::jsonb->4->>'error') = 'Profissional fora do workspace.' as "usuario_de_outro_ws_barrado";
select (:'res'::jsonb->5 ? 'id') as "dst_sem_horario_gravado";
select duration_minutes = 90 and hours = 1.50 and status = 'locked' and locked_at is not null and source = 'import' and created_by = 'aaaaaaaa-0000-4000-8000-000000000001' and approved_at is null as "linha_virada_ok"
  from project_time_entries where external_id = 'clockify:x:0';
select hours = 3.50 and start_time is null as "dst_horas_reais" from project_time_entries where entry_date = '2026-11-03';
-- update só em linha de importação
select (clockify_import_apply('11111111-1111-4111-8111-111111111111','project_time_entries','update', format('[{"_key":"u","id":"%s","row":{"project_id":"%s","entry_date":"2026-01-05","start_time":"22:30:00","end_time":"24:00:00","duration_minutes":90,"description":"Editada na origem","billable":true}}]', (select id from project_time_entries where external_id='clockify:x:0'), :'pid')::jsonb)->0 ? 'id') as "update_importada_ok";
insert into project_time_entries (workspace_id, project_id, user_id, entry_date, start_time, end_time) values ('11111111-1111-4111-8111-111111111111', :'pid', 'aaaaaaaa-0000-4000-8000-000000000001', '2026-02-01','09:00','10:00');
select (clockify_import_apply('11111111-1111-4111-8111-111111111111','project_time_entries','update', format('[{"_key":"u","id":"%s","row":{"project_id":"%s","description":"x"}}]', (select id from project_time_entries where source='manual'), :'pid')::jsonb)->0->>'error') = 'Registro de destino não encontrado.' as "update_manual_recusada";
-- projeto de outro workspace recusado
insert into projects (id, workspace_id, owner_id, name) values ('cccccccc-0000-4000-8000-000000000001','22222222-2222-4222-8222-222222222222','bbbbbbbb-0000-4000-8000-000000000001','Outro');
select (clockify_import_apply('11111111-1111-4111-8111-111111111111','project_tasks','insert','[{"_key":"t","row":{"project_id":"cccccccc-0000-4000-8000-000000000001","title":"x"}}]')->0->>'error') = 'Projeto fora do workspace.' as "projeto_de_outro_ws_barrado";
select (select count(*) from project_tasks where workspace_id='22222222-2222-4222-8222-222222222222') = 0 as "outro_ws_intacto";
-- vínculos e mapeamentos só com destino do mesmo workspace
do $$ begin
  begin
    insert into clockify_import_links (workspace_id, source_workspace_id, entity_type, external_id, target_table, target_id, source_hash)
    values ('11111111-1111-4111-8111-111111111111','5f1a2b3c4d5e6f7a8b9c0d1e','project','7b1a2b3c4d5e6f7a8b9c0d11','projects','cccccccc-0000-4000-8000-000000000001','h');
    raise notice 'FALHOU: vinculo cruzado aceito';
  exception when others then raise notice 'ok vinculo_cruzado_barrado: %', sqlerrm; end;
  begin
    insert into clockify_mappings (workspace_id, source_workspace_id, entity_type, external_id, target_id)
    values ('11111111-1111-4111-8111-111111111111','5f1a2b3c4d5e6f7a8b9c0d1e','user','6a1a2b3c4d5e6f7a8b9c0d11','bbbbbbbb-0000-4000-8000-000000000001');
    raise notice 'FALHOU: mapeamento cruzado aceito';
  exception when others then raise notice 'ok mapeamento_cruzado_barrado: %', sqlerrm; end;
  begin
    insert into clockify_staging_records (workspace_id, source_workspace_id, entity_type, external_id, payload, payload_hash)
    values ('11111111-1111-4111-8111-111111111111','5f1a2b3c4d5e6f7a8b9c0d1e','time_entry','../../etc', '{}', 'h');
    raise notice 'FALHOU: id externo invalido aceito';
  exception when others then raise notice 'ok id_externo_invalido_barrado'; end;
end $$;
insert into clockify_import_links (workspace_id, source_workspace_id, entity_type, external_id, segment, target_table, target_id, source_hash)
values ('11111111-1111-4111-8111-111111111111','5f1a2b3c4d5e6f7a8b9c0d1e','time_entry','8c1a2b3c4d5e6f7a8b9c0d01',0,'project_time_entries',(select id from project_time_entries where external_id='clockify:x:0'),'h');
do $$ begin
  begin
    insert into clockify_import_links (workspace_id, source_workspace_id, entity_type, external_id, segment, target_table, target_id, source_hash)
    values ('11111111-1111-4111-8111-111111111111','5f1a2b3c4d5e6f7a8b9c0d1e','time_entry','8c1a2b3c4d5e6f7a8b9c0d01',0,'project_time_entries',(select id from project_time_entries where external_id='clockify:x:1'),'h');
    raise notice 'FALHOU: chave idempotente duplicada aceita';
  exception when unique_violation then raise notice 'ok chave_idempotente_unica'; end;
end $$;
insert into clockify_import_runs (workspace_id, source_workspace_id, kind, requested_by) values ('11111111-1111-4111-8111-111111111111','5f1a2b3c4d5e6f7a8b9c0d1e','dry_run','aaaaaaaa-0000-4000-8000-000000000001');
do $$ begin
  begin
    insert into clockify_import_runs (workspace_id, source_workspace_id, kind, requested_by) values ('11111111-1111-4111-8111-111111111111','5f1a2b3c4d5e6f7a8b9c0d1e','import','aaaaaaaa-0000-4000-8000-000000000001');
    raise notice 'FALHOU: duas execucoes ativas';
  exception when unique_violation then raise notice 'ok uma_execucao_ativa_por_ws'; end;
end $$;
reset role;
-- RLS: admin ativo lê; admin inativo, membro e outro workspace não; chave nunca legível
set role authenticated;
set request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-000000000001';
select count(*) = 1 as "admin_ativo_le_execucoes" from clockify_import_runs;
set request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-000000000003';
select count(*) = 0 as "admin_inativo_nao_le" from clockify_import_runs;
set request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-000000000002';
select count(*) = 0 as "membro_nao_le" from clockify_import_links;
set request.jwt.claim.sub = 'bbbbbbbb-0000-4000-8000-000000000001';
select count(*) = 0 as "outro_ws_nao_le" from clockify_import_runs;
do $$ begin
  begin perform 1 from clockify_connections; raise notice 'FALHOU: conexao legivel';
  exception when insufficient_privilege then raise notice 'ok conexao_inacessivel_ao_navegador'; end;
  begin perform clockify_import_apply('11111111-1111-4111-8111-111111111111','projects','insert','[]'); raise notice 'FALHOU: rpc liberada';
  exception when insufficient_privilege then raise notice 'ok rpc_so_servidor'; end;
  begin insert into clockify_import_runs (workspace_id, source_workspace_id, kind, requested_by) values ('11111111-1111-4111-8111-111111111111','5f1a2b3c4d5e6f7a8b9c0d1e','dry_run', auth.uid()); raise notice 'FALHOU: escrita liberada';
  exception when insufficient_privilege then raise notice 'ok escrita_so_servidor'; end;
end $$;
reset role;
