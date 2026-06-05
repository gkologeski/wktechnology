insert into public.workspace_members (workspace_id, user_id, role)
values ('184b9435-0a9b-4334-9e89-8854dc883f5d', '5946963b-3c55-49c8-85b9-25251008a14b', 'member')
on conflict (workspace_id, user_id) do nothing;

update public.profiles
set active_workspace_id = '184b9435-0a9b-4334-9e89-8854dc883f5d'
where id = '5946963b-3c55-49c8-85b9-25251008a14b'
  and active_workspace_id is null;