
-- Tabela de histórico de permanência por etapa
create table if not exists public.stage_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  entity text not null check (entity in ('leads','deals')),
  entity_id uuid not null,
  pipeline_id uuid,
  stage_id text not null,
  sla_hours numeric,
  entered_at timestamptz not null default now(),
  exited_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists stage_entries_open_idx
  on public.stage_entries (owner_id, entity, entity_id)
  where exited_at is null;

create index if not exists stage_entries_breach_idx
  on public.stage_entries (owner_id, entered_at)
  where exited_at is null and sla_hours is not null;

alter table public.stage_entries enable row level security;

drop policy if exists stage_entries_owner on public.stage_entries;
create policy stage_entries_owner on public.stage_entries
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Função: dado owner+entity+stage_id, busca sla_hours dentro de pipelines.stages
create or replace function public.lookup_stage_sla(
  p_owner uuid, p_entity text, p_pipeline_id uuid, p_stage text
) returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select (s->>'sla_hours')::numeric
    from public.pipelines p,
         lateral jsonb_array_elements(p.stages) s
   where p.owner_id = p_owner
     and (p_pipeline_id is null or p.id = p_pipeline_id)
     and p.entity = case when p_entity = 'leads' then 'lead' else 'deal' end
     and s->>'value' = p_stage
     and (s->>'sla_hours') is not null
   limit 1
$$;

-- Trigger: ao criar/atualizar leads ou deals, mantém stage_entries
create or replace function public.track_stage_entries()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entity text := tg_argv[0];
  v_new_stage text;
  v_old_stage text;
  v_sla numeric;
begin
  if v_entity = 'leads' then
    v_new_stage := coalesce(new.stage_id, new.status::text);
    if tg_op = 'UPDATE' then
      v_old_stage := coalesce(old.stage_id, old.status::text);
    end if;
  else
    v_new_stage := coalesce(new.stage_id, new.stage::text);
    if tg_op = 'UPDATE' then
      v_old_stage := coalesce(old.stage_id, old.stage::text);
    end if;
  end if;

  if tg_op = 'UPDATE' and v_new_stage is not distinct from v_old_stage then
    return null;
  end if;

  -- fecha entrada aberta
  update public.stage_entries
     set exited_at = now()
   where owner_id = new.owner_id
     and entity = v_entity
     and entity_id = new.id
     and exited_at is null;

  -- abre nova entrada
  if v_new_stage is not null then
    v_sla := public.lookup_stage_sla(new.owner_id, v_entity, new.pipeline_id, v_new_stage);
    insert into public.stage_entries (owner_id, entity, entity_id, pipeline_id, stage_id, sla_hours)
    values (new.owner_id, v_entity, new.id, new.pipeline_id, v_new_stage, v_sla);
  end if;

  return null;
end;
$$;

drop trigger if exists leads_track_stage on public.leads;
create trigger leads_track_stage
after insert or update on public.leads
for each row execute function public.track_stage_entries('leads');

drop trigger if exists deals_track_stage on public.deals;
create trigger deals_track_stage
after insert or update on public.deals
for each row execute function public.track_stage_entries('deals');
