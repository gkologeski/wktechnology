-- CRM, HubSpot pipeline and signing-audit writers preserve validated source workspace.
-- Catalog audit found no direct SQL INSERT writers for these six tables.
ALTER TABLE public.leads ALTER COLUMN workspace_id SET DEFAULT public.default_workspace_for_user(auth.uid());
ALTER TABLE public.companies ALTER COLUMN workspace_id SET DEFAULT public.default_workspace_for_user(auth.uid());
ALTER TABLE public.contacts ALTER COLUMN workspace_id SET DEFAULT public.default_workspace_for_user(auth.uid());
ALTER TABLE public.deals ALTER COLUMN workspace_id SET DEFAULT public.default_workspace_for_user(auth.uid());
ALTER TABLE public.pipelines ALTER COLUMN workspace_id SET DEFAULT public.default_workspace_for_user(auth.uid());
ALTER TABLE public.esign_audit ALTER COLUMN workspace_id SET DEFAULT public.default_workspace_for_user(auth.uid());
