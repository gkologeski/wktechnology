-- Execute in a disposable PostgreSQL database after applying migration 0489.
begin;
set local role authenticated;
do $$
begin
  if has_function_privilege(current_user,'public.reserve_apollo_mobile_5000(uuid,uuid,uuid,text)','execute')
    or has_table_privilege(current_user,'public.apollo_mobile_5000_attempts','select') then
    raise exception 'authenticated must not access the ledger';
  end if;
end
$$;
reset role;
set local role anon;
do $$
begin
  if has_function_privilege(current_user,'public.reserve_apollo_mobile_5000(uuid,uuid,uuid,text)','execute')
    or has_table_privilege(current_user,'public.apollo_mobile_5000_attempts','select') then
    raise exception 'anonymous must not access the ledger';
  end if;
end
$$;
reset role;
set local role service_role;
do $$
declare
  w constant uuid := '00000000-0000-0000-0000-000000000001';
  actor constant uuid := '00000000-0000-0000-0000-000000000002';
  c uuid;
  next_slot integer;
begin
  for i in 1..555 loop
    c := md5('contact-' || i)::uuid;
    next_slot := public.reserve_apollo_mobile_5000(w,c,actor,'person-'||i);
    if next_slot is distinct from i then raise exception 'bad slot %',i; end if;
    if i = 1 then
      if public.reserve_apollo_mobile_5000(w,c,actor,'other') is not null then
        raise exception 'duplicate contact was charged';
      end if;
      if public.reserve_apollo_mobile_5000(w,md5('duplicate')::uuid,actor,'person-1') is not null then
        raise exception 'duplicate identity was charged';
      end if;
      update public.apollo_mobile_5000_attempts set status='uncertain' where slot=1;
    end if;
  end loop;
  if public.reserve_apollo_mobile_5000(md5('other-workspace')::uuid,md5('new')::uuid,actor,'new') is not null then
    raise exception 'global ceiling was exceeded';
  end if;
  if has_table_privilege(current_user,'public.apollo_mobile_5000_attempts','delete')
    or has_column_privilege(current_user,'public.apollo_mobile_5000_attempts','slot','update') then
    raise exception 'service role must not reclaim reservations';
  end if;
  if (select count(*) from public.apollo_mobile_5000_attempts) <> 555 then
    raise exception 'unexpected reservation count';
  end if;
end
$$;
rollback;

-- Boundary fixtures for the existing CRM permissions and contact shape.
-- The protected column is intentionally not readable via the authenticated role.
begin;
create schema auth;
create function auth.uid() returns uuid language sql as
$$select nullif(current_setting('test.apollo_actor', true), '')::uuid$$;
create function public.is_read_only_view() returns boolean language sql as
$$select coalesce(current_setting('test.apollo_readonly', true) = '1', false)$$;
create function public.sales_area_authorize(r text, a text, t text, i uuid)
returns boolean language plpgsql as $$
begin
  if current_setting('test.apollo_allow', true) is distinct from '1'
    or r <> 'techsales.prospecting_enrichment' or a <> 'manage' then
    raise exception 'sales area denied' using errcode='42501';
  end if;
  return true;
end
$$;
create function public.sales_record_access(t text, i uuid, a text)
returns boolean language sql as $$
  select t='contacts' and a='update' and current_setting('test.apollo_record', true)=i::text
$$;
create function public.shared_field_context() returns jsonb language sql as $$
  select jsonb_build_object('workspace_id', current_setting('test.apollo_workspace', true),
  'rules', case when current_setting('test.apollo_field', true)='1'
       then '{"techsales.contacts":{"mobile_phone":"readonly"}}'::jsonb else '{}'::jsonb end)
$$;
create table public.contacts(id uuid primary key,workspace_id uuid,audience text,deleted_at timestamptz,
  mobile_phone text,updated_at timestamptz);
insert into public.contacts values
 ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','sales',null,null,'2026-11-01 UTC'),
 ('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000001','sales',null,'+5548991234568','2026-11-01 UTC');
insert into public.apollo_mobile_5000_attempts(slot,workspace_id,contact_id,actor_id,identity_hash,status,request_id)
values (1,'00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002','one','pending','99'),
       (2,'00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000002','two','pending','100');
set local role authenticated;
do $$
declare
 w constant uuid := '00000000-0000-0000-0000-000000000001';
 c constant uuid := '00000000-0000-0000-0000-000000000003';
 occupied constant uuid := '00000000-0000-0000-0000-000000000004';
 seen constant timestamptz := '2026-11-01 UTC';
 phone constant text := '+5548991234567';
begin
  if has_column_privilege(current_user,'public.contacts','mobile_phone','select') then
    raise exception 'fixture must not expose the cell phone column';
  end if;
  perform set_config('test.apollo_actor','00000000-0000-0000-0000-000000000002',true);
  perform set_config('test.apollo_workspace',w::text,true);
  perform set_config('test.apollo_record',c::text,true);
  begin
    perform public.apply_apollo_mobile_5000(w,c,seen,phone,'99');
    raise exception 'allowed without sales grant';
  exception when insufficient_privilege then null;
  end;
  perform set_config('test.apollo_allow','1',true);
  perform set_config('test.apollo_field','1',true);
  begin
    perform public.apply_apollo_mobile_5000(w,c,seen,phone,'99');
    raise exception 'updated protected field';
  exception when insufficient_privilege then null;
  end;
  perform set_config('test.apollo_field','0',true);
  begin
    perform public.apply_apollo_mobile_5000(md5('other')::uuid,c,seen,phone,'99');
    raise exception 'allowed foreign workspace';
  exception when insufficient_privilege then null;
  end;
  if public.apply_apollo_mobile_5000(w,c,seen,phone,'wrong') then raise exception 'accepted wrong request'; end if;
  if public.apply_apollo_mobile_5000(w,c,seen-interval '1 second',phone,'99') then raise exception 'accepted stale snapshot'; end if;
  if not public.apply_apollo_mobile_5000(w,c,seen,phone,'99') then raise exception 'did not update empty field'; end if;
  if public.apply_apollo_mobile_5000(w,c,seen,phone,'99') then raise exception 'replayed already applied request'; end if;
  perform set_config('test.apollo_record',occupied::text,true);
  if public.apply_apollo_mobile_5000(w,occupied,seen,phone,'100') then raise exception 'overwrote existing cell phone'; end if;
end
$$;
reset role;
do $$
begin
  if (select status from public.apollo_mobile_5000_attempts where slot=1) is distinct from 'updated'
   or (select mobile_phone from public.contacts where id='00000000-0000-0000-0000-000000000003') is distinct from '+5548991234567'
   or (select mobile_phone from public.contacts where id='00000000-0000-0000-0000-000000000004') is distinct from '+5548991234568' then
    raise exception 'unexpected post-update state';
  end if;
end
$$;
rollback;
