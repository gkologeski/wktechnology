
create table public.survey_responses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  ticket_id uuid not null,
  contact_id uuid,
  kind text not null default 'csat' check (kind in ('csat','nps')),
  token text not null unique default replace(gen_random_uuid()::text,'-',''),
  score integer,
  comment text,
  sent_at timestamptz not null default now(),
  responded_at timestamptz,
  created_at timestamptz not null default now()
);
create index survey_responses_owner_idx on public.survey_responses(owner_id);
create index survey_responses_ticket_idx on public.survey_responses(ticket_id);
alter table public.survey_responses enable row level security;

create policy survey_responses_select on public.survey_responses for select to authenticated
  using (owner_id = auth.uid() or public.is_workspace_admin(owner_id, auth.uid()));
create policy survey_responses_insert on public.survey_responses for insert to authenticated
  with check (owner_id = auth.uid() or public.is_workspace_admin(owner_id, auth.uid()));
create policy survey_responses_update on public.survey_responses for update to authenticated
  using (owner_id = auth.uid() or public.is_workspace_admin(owner_id, auth.uid()));
create policy survey_responses_delete on public.survey_responses for delete to authenticated
  using (owner_id = auth.uid() or public.is_workspace_admin(owner_id, auth.uid()));

-- Trigger: cria pesquisa quando ticket é resolvido
create or replace function public.create_ticket_survey()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'UPDATE')
     and new.status in ('resolved','closed')
     and (old.status is distinct from new.status)
     and not exists (select 1 from public.survey_responses where ticket_id = new.id) then
    insert into public.survey_responses (owner_id, ticket_id, contact_id, kind)
    values (new.owner_id, new.id, new.contact_id, 'csat');
  end if;
  return null;
end $$;

drop trigger if exists tickets_create_survey on public.tickets;
create trigger tickets_create_survey
  after update on public.tickets
  for each row execute function public.create_ticket_survey();
