-- Backfill user_job_roles from legacy team_members.access_profile_id
-- Only inserts when the mapping does not already exist (ON CONFLICT DO NOTHING).
INSERT INTO public.user_job_roles (user_id, workspace_id, role_id, is_primary)
SELECT
  tm.member_user_id,
  tm.workspace_owner_id,
  CASE ap.base_role
    WHEN 'admin'   THEN 'aaaaaaaa-0000-4000-8000-000000000008'::uuid  -- Workspace Admin
    WHEN 'manager' THEN 'aaaaaaaa-0000-4000-8000-000000000002'::uuid  -- Gerente Comercial
    WHEN 'member'  THEN 'aaaaaaaa-0000-4000-8000-000000000001'::uuid  -- Vendedor
  END AS role_id,
  true
FROM public.team_members tm
JOIN public.access_profiles ap ON ap.id = tm.access_profile_id
WHERE tm.access_profile_id IS NOT NULL
  AND tm.member_user_id IS NOT NULL
ON CONFLICT (user_id, workspace_id, role_id) DO NOTHING;