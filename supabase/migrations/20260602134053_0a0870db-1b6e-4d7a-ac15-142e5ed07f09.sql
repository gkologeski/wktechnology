UPDATE public.hubspot_owners
SET workspace_id = public.default_workspace_for_user(workspace_id)
WHERE workspace_id NOT IN (SELECT workspace_id FROM public.workspace_members)
  AND public.default_workspace_for_user(workspace_id) IS NOT NULL;