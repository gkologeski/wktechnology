
-- Sprint 6: Contract approvals (legal / finance / purchasing) + audit events

CREATE TYPE public.contract_approval_stage AS ENUM ('legal', 'finance', 'purchasing');
CREATE TYPE public.contract_approval_status AS ENUM ('pending', 'approved', 'rejected', 'skipped');

CREATE TABLE public.contract_approvals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL,
  owner_id UUID NOT NULL,
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  stage public.contract_approval_stage NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  approver_id UUID,
  status public.contract_approval_status NOT NULL DEFAULT 'pending',
  comment TEXT,
  decided_at TIMESTAMPTZ,
  decided_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX contract_approvals_contract_idx ON public.contract_approvals(contract_id, sort_order);
CREATE INDEX contract_approvals_workspace_idx ON public.contract_approvals(workspace_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contract_approvals TO authenticated;
GRANT ALL ON public.contract_approvals TO service_role;

ALTER TABLE public.contract_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY ws_contract_approvals_select ON public.contract_approvals
  FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT workspace_id FROM public.current_user_workspaces()));

CREATE POLICY ws_contract_approvals_insert ON public.contract_approvals
  FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM public.current_user_workspaces()));

CREATE POLICY ws_contract_approvals_update ON public.contract_approvals
  FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT workspace_id FROM public.current_user_workspaces()))
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM public.current_user_workspaces()));

CREATE POLICY ws_contract_approvals_delete ON public.contract_approvals
  FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT workspace_id FROM public.current_user_workspaces()));

CREATE TRIGGER trg_contract_approvals_updated_at
  BEFORE UPDATE ON public.contract_approvals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Audit trail
CREATE TABLE public.contract_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL,
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  actor_id UUID,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX contract_events_contract_idx ON public.contract_events(contract_id, created_at DESC);

GRANT SELECT, INSERT ON public.contract_events TO authenticated;
GRANT ALL ON public.contract_events TO service_role;

ALTER TABLE public.contract_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY ws_contract_events_select ON public.contract_events
  FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT workspace_id FROM public.current_user_workspaces()));

CREATE POLICY ws_contract_events_insert ON public.contract_events
  FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM public.current_user_workspaces()));
