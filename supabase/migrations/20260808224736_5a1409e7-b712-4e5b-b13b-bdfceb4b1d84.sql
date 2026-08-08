CREATE TABLE public.contract_link_ai_suggestions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL,
  run_id uuid NOT NULL,
  pending_contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  target_contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('parent','amendment')),
  confidence text NOT NULL CHECK (confidence IN ('high','medium','low')),
  reason text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT 'ai' CHECK (source IN ('rule','ai')),
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','applied','dismissed','superseded')),
  created_by uuid,
  decided_by uuid,
  decided_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contract_link_ai_suggestions TO authenticated;
GRANT ALL ON public.contract_link_ai_suggestions TO service_role;

ALTER TABLE public.contract_link_ai_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contract_link_ai_suggestions_select" ON public.contract_link_ai_suggestions
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "contract_link_ai_suggestions_insert" ON public.contract_link_ai_suggestions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()) AND created_by = auth.uid());

CREATE POLICY "contract_link_ai_suggestions_update" ON public.contract_link_ai_suggestions
  FOR UPDATE TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));

CREATE INDEX idx_clais_workspace_created ON public.contract_link_ai_suggestions (workspace_id, created_at DESC);
CREATE INDEX idx_clais_run ON public.contract_link_ai_suggestions (run_id);
CREATE INDEX idx_clais_pending ON public.contract_link_ai_suggestions (pending_contract_id);
CREATE INDEX idx_clais_target ON public.contract_link_ai_suggestions (target_contract_id);

CREATE TRIGGER trg_clais_updated_at
  BEFORE UPDATE ON public.contract_link_ai_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();