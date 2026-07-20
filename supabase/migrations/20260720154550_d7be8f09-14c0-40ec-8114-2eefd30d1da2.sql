
-- Backfill de user_job_roles para membros legados sem job_role atribuído.
-- Sem isso, user_has_permission() retorna false e RLS bloqueia inserts em activities/deals/etc.
INSERT INTO public.user_job_roles (user_id, role_id, owner_id, is_primary)
SELECT
  wm.user_id,
  CASE wm.role
    WHEN 'owner'   THEN 'aaaaaaaa-0000-4000-8000-000000000009'::uuid
    WHEN 'admin'   THEN 'aaaaaaaa-0000-4000-8000-000000000008'::uuid
    WHEN 'manager' THEN 'aaaaaaaa-0000-4000-8000-000000000002'::uuid
    ELSE                'aaaaaaaa-0000-4000-8000-000000000001'::uuid
  END,
  COALESCE(w.created_by, wm.user_id),
  true
FROM public.workspace_members wm
JOIN public.workspaces w ON w.id = wm.workspace_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_job_roles ujr WHERE ujr.user_id = wm.user_id
);
