ALTER TABLE public.financial_categories ADD COLUMN IF NOT EXISTS external_ids jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.financial_cost_centers ADD COLUMN IF NOT EXISTS external_ids jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE public.contaazul_sync_state (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL,
  entity text NOT NULL,
  last_synced_at timestamptz,
  cursor text,
  imported_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, entity)
);

GRANT SELECT ON public.contaazul_sync_state TO authenticated;
GRANT ALL ON public.contaazul_sync_state TO service_role;

ALTER TABLE public.contaazul_sync_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contaazul_sync_state_select_members"
  ON public.contaazul_sync_state FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "contaazul_sync_state_admin_all"
  ON public.contaazul_sync_state FOR ALL TO authenticated
  USING (public.is_workspace_admin_of(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_admin_of(workspace_id, auth.uid()));

CREATE TRIGGER contaazul_sync_state_touch_updated_at
  BEFORE UPDATE ON public.contaazul_sync_state
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_contaazul_sync_state_workspace ON public.contaazul_sync_state (workspace_id);