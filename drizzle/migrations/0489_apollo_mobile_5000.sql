-- CELULAR-5000: a single operation across the installation, not a renewable quota.
-- Each occupied slot reserves nine credits before a paid POST. Never reclaim it.
create table public.apollo_mobile_5000_attempts (
  slot integer primary key check (slot between 1 and 555),
  workspace_id uuid not null,
  contact_id uuid not null unique,
  actor_id uuid not null,
  identity_hash text not null unique,
  status text not null default 'reserved'
    check (status in ('reserved','pending','updated','skipped','uncertain')),
  request_id text,
  person_id text,
  created_at timestamptz not null default now()
);
alter table public.apollo_mobile_5000_attempts enable row level security;
revoke all on table public.apollo_mobile_5000_attempts from public, anon, authenticated, service_role;
grant select, insert on table public.apollo_mobile_5000_attempts to service_role;
grant update (status, request_id, person_id) on table public.apollo_mobile_5000_attempts to service_role;

create function public.reserve_apollo_mobile_5000(w uuid, c uuid, u uuid, identity text)
returns integer
language plpgsql security invoker set search_path = pg_catalog as $$
declare next_slot integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('techerp:apollo-mobile-5000', 0));
  select coalesce(max(slot), 0) + 1 into next_slot from public.apollo_mobile_5000_attempts;
  if next_slot > 555 then return null; end if;
  insert into public.apollo_mobile_5000_attempts(slot, workspace_id, contact_id, actor_id, identity_hash)
  values (next_slot, w, c, u, identity)
  on conflict do nothing
  returning slot into next_slot;
  return next_slot;
end;
$$;
revoke all on function public.reserve_apollo_mobile_5000(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.reserve_apollo_mobile_5000(uuid, uuid, uuid, text) to service_role;

-- SELECT on contacts.mobile_phone is intentionally denied on the raw table.
-- This caller-bound RPC performs the guarded compare-and-set without exposing it.
create function public.apply_apollo_mobile_5000(
  w uuid, c uuid, seen_at timestamptz, mobile text, expected_request text
) returns boolean
language plpgsql security definer set search_path = pg_catalog as $$
declare
  actor uuid := auth.uid();
  context jsonb;
  held_slot integer;
begin
  if actor is null or public.is_read_only_view() is distinct from false then
    raise exception 'Sem permissão para atualizar celular.' using errcode = '42501';
  end if;
  perform public.sales_area_authorize('techsales.prospecting_enrichment','manage',null,null);
  context := public.shared_field_context();
  if (context->>'workspace_id')::uuid is distinct from w
     or context #>> '{rules,techsales.contacts,mobile_phone}' is not null
     or public.sales_record_access('contacts', c, 'update') is distinct from true then
    raise exception 'Sem permissão para atualizar celular.' using errcode = '42501';
  end if;
  if mobile is null or mobile !~ '^\+[1-9][0-9]{6,14}$' then
    raise exception 'Celular fora do formato esperado.' using errcode = '22023';
  end if;
  select slot into held_slot from public.apollo_mobile_5000_attempts
  where workspace_id=w and contact_id=c and actor_id=actor
    and request_id=expected_request and status='pending'
  for update;
  if not found then return false; end if;
  update public.contacts
  set mobile_phone=mobile
  where id=c and workspace_id=w and audience='sales' and deleted_at is null
    and mobile_phone is null and updated_at=seen_at;
  if not found then return false; end if;
  update public.apollo_mobile_5000_attempts set status='updated' where slot=held_slot;
  return true;
end;
$$;
revoke all on function public.apply_apollo_mobile_5000(uuid,uuid,timestamptz,text,text) from public, anon, authenticated, service_role;
grant execute on function public.apply_apollo_mobile_5000(uuid,uuid,timestamptz,text,text) to authenticated;
notify pgrst, 'reload schema';
