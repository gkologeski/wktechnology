
-- Fase 5b: workflow_approvals — pausa run até decisão do aprovador.
CREATE TABLE public.workflow_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  run_id UUID REFERENCES public.workflow_runs(id) ON DELETE SET NULL,
  entity TEXT NOT NULL,
  entity_id UUID NOT NULL,
  requested_by UUID,
  approver_user_id UUID,
  resume_cursor INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','expired')),
  title TEXT NOT NULL,
  note TEXT,
  decided_at TIMESTAMPTZ,
  decided_by UUID,
  decision_comment TEXT,
  event_snapshot JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_approvals TO authenticated;
GRANT ALL ON public.workflow_approvals TO service_role;

ALTER TABLE public.workflow_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their workflow_approvals"
  ON public.workflow_approvals
  FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE INDEX workflow_approvals_pending_idx
  ON public.workflow_approvals (owner_id, status, created_at)
  WHERE status = 'pending';

CREATE INDEX workflow_approvals_workflow_idx
  ON public.workflow_approvals (workflow_id);

CREATE TRIGGER trg_workflow_approvals_updated_at
  BEFORE UPDATE ON public.workflow_approvals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Fase 5c: workflow_time_cursors — evita redisparo de triggers baseados em tempo.
CREATE TABLE public.workflow_time_cursors (
  workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL,
  owner_id UUID NOT NULL,
  last_fired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (workflow_id, entity_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_time_cursors TO authenticated;
GRANT ALL ON public.workflow_time_cursors TO service_role;

ALTER TABLE public.workflow_time_cursors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their workflow_time_cursors"
  ON public.workflow_time_cursors
  FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE INDEX workflow_time_cursors_owner_idx
  ON public.workflow_time_cursors (owner_id, workflow_id);
