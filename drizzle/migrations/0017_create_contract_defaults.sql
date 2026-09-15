CREATE TABLE public.contract_defaults (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL DEFAULT auth.uid(),
  document_kind TEXT,
  defaults JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX contract_defaults_ws_kind_uniq
  ON public.contract_defaults (workspace_id, COALESCE(document_kind, '__all__'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contract_defaults TO authenticated;
GRANT ALL ON public.contract_defaults TO service_role;

ALTER TABLE public.contract_defaults ENABLE ROW LEVEL SECURITY;

CREATE POLICY contract_defaults_select ON public.contract_defaults
  FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()));

CREATE POLICY contract_defaults_insert ON public.contract_defaults
  FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id IN (SELECT public.current_user_workspaces())
    AND (
      public.is_workspace_admin_v2(workspace_id, auth.uid())
      OR public.user_has_permission(auth.uid(), workspace_id, 'techcontracts.contracts.update.workspace')
    )
  );

CREATE POLICY contract_defaults_update ON public.contract_defaults
  FOR UPDATE TO authenticated
  USING (
    workspace_id IN (SELECT public.current_user_workspaces())
    AND (
      public.is_workspace_admin_v2(workspace_id, auth.uid())
      OR public.user_has_permission(auth.uid(), workspace_id, 'techcontracts.contracts.update.workspace')
    )
  )
  WITH CHECK (
    workspace_id IN (SELECT public.current_user_workspaces())
    AND (
      public.is_workspace_admin_v2(workspace_id, auth.uid())
      OR public.user_has_permission(auth.uid(), workspace_id, 'techcontracts.contracts.update.workspace')
    )
  );

CREATE POLICY contract_defaults_delete ON public.contract_defaults
  FOR DELETE TO authenticated
  USING (
    workspace_id IN (SELECT public.current_user_workspaces())
    AND (
      public.is_workspace_admin_v2(workspace_id, auth.uid())
      OR public.user_has_permission(auth.uid(), workspace_id, 'techcontracts.contracts.update.workspace')
    )
  );