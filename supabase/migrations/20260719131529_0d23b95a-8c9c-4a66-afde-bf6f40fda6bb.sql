
CREATE TABLE public.financial_cost_centers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  legal_entity_id uuid REFERENCES public.legal_entities(id) ON DELETE SET NULL,
  parent_id uuid REFERENCES public.financial_cost_centers(id) ON DELETE SET NULL,
  name text NOT NULL,
  code text,
  active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX financial_cost_centers_workspace_idx ON public.financial_cost_centers(workspace_id);
CREATE INDEX financial_cost_centers_legal_entity_idx ON public.financial_cost_centers(workspace_id, legal_entity_id);
CREATE UNIQUE INDEX financial_cost_centers_workspace_name_key
  ON public.financial_cost_centers(workspace_id, lower(name));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_cost_centers TO authenticated;
GRANT ALL ON public.financial_cost_centers TO service_role;

ALTER TABLE public.financial_cost_centers ENABLE ROW LEVEL SECURITY;

CREATE POLICY ws_cc_select ON public.financial_cost_centers
  FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT current_user_workspaces()));

CREATE POLICY ws_cc_write ON public.financial_cost_centers
  FOR ALL TO authenticated
  USING (
    workspace_id IN (SELECT current_user_workspaces())
    AND public.is_workspace_admin(auth.uid(), workspace_id)
  )
  WITH CHECK (
    workspace_id IN (SELECT current_user_workspaces())
    AND public.is_workspace_admin(auth.uid(), workspace_id)
  );

CREATE OR REPLACE FUNCTION public.tg_financial_cost_centers_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER financial_cost_centers_touch
BEFORE UPDATE ON public.financial_cost_centers
FOR EACH ROW EXECUTE FUNCTION public.tg_financial_cost_centers_touch();

-- Rateios
CREATE TABLE public.financial_entry_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES public.financial_entries(id) ON DELETE CASCADE,
  cost_center_id uuid NOT NULL REFERENCES public.financial_cost_centers(id) ON DELETE RESTRICT,
  amount numeric(14,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX financial_entry_allocations_entry_idx ON public.financial_entry_allocations(entry_id);
CREATE INDEX financial_entry_allocations_cc_idx ON public.financial_entry_allocations(cost_center_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_entry_allocations TO authenticated;
GRANT ALL ON public.financial_entry_allocations TO service_role;

ALTER TABLE public.financial_entry_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY ws_alloc_all ON public.financial_entry_allocations
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.financial_entries e
      WHERE e.id = entry_id
        AND e.workspace_id IN (SELECT current_user_workspaces())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.financial_entries e
      WHERE e.id = entry_id
        AND e.workspace_id IN (SELECT current_user_workspaces())
    )
  );
