
CREATE TYPE public.allocation_status AS ENUM ('active','paused','ended');

CREATE TABLE public.people_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  role_title text,
  allocation_pct numeric NOT NULL DEFAULT 100 CHECK (allocation_pct >= 0 AND allocation_pct <= 100),
  billable_rate numeric,
  cost_rate numeric,
  currency text NOT NULL DEFAULT 'BRL',
  starts_at date NOT NULL DEFAULT CURRENT_DATE,
  ends_at date,
  status public.allocation_status NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_people_allocations_person ON public.people_allocations(person_id);
CREATE INDEX idx_people_allocations_contract ON public.people_allocations(contract_id);
CREATE INDEX idx_people_allocations_workspace ON public.people_allocations(workspace_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.people_allocations TO authenticated;
GRANT ALL ON public.people_allocations TO service_role;

ALTER TABLE public.people_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allocations_ws_select" ON public.people_allocations
  FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "allocations_ws_insert" ON public.people_allocations
  FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
    AND owner_id = auth.uid()
  );

CREATE POLICY "allocations_ws_update" ON public.people_allocations
  FOR UPDATE TO authenticated
  USING (
    workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
    AND (owner_id = auth.uid() OR public.is_workspace_admin_v2(auth.uid(), workspace_id))
  );

CREATE POLICY "allocations_ws_delete" ON public.people_allocations
  FOR DELETE TO authenticated
  USING (
    workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
    AND (owner_id = auth.uid() OR public.is_workspace_admin_v2(auth.uid(), workspace_id))
  );

CREATE TRIGGER update_people_allocations_updated_at
  BEFORE UPDATE ON public.people_allocations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
