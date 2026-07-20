
-- user_effective_permissions exige ujr.owner_id = workspace_id.
-- Ajusta o backfill anterior e futuros: owner_id = workspace_id.
UPDATE public.user_job_roles ujr
SET owner_id = wm.workspace_id
FROM public.workspace_members wm
WHERE wm.user_id = ujr.user_id
  AND ujr.owner_id <> wm.workspace_id
  AND ujr.role_id IN (
    'aaaaaaaa-0000-4000-8000-000000000001'::uuid,
    'aaaaaaaa-0000-4000-8000-000000000002'::uuid,
    'aaaaaaaa-0000-4000-8000-000000000008'::uuid,
    'aaaaaaaa-0000-4000-8000-000000000009'::uuid
  );
