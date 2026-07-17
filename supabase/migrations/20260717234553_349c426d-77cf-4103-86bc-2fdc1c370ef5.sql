-- Sprint 3: Serviços — helper para próxima data de faturamento
create or replace function public.services_next_billing(_current date, _cadence public.service_cadence)
returns date
language sql
immutable
set search_path = public
as $$
  select case _cadence
    when 'monthly'   then (_current + interval '1 month')::date
    when 'quarterly' then (_current + interval '3 months')::date
    when 'yearly'    then (_current + interval '1 year')::date
    else null
  end
$$;

grant execute on function public.services_next_billing(date, public.service_cadence) to authenticated, service_role;