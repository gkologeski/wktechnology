
CREATE TABLE public.sla_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  pipeline_id uuid NULL REFERENCES public.pipelines(id) ON DELETE SET NULL,
  priority public.ticket_priority NULL,
  first_response_mins int NOT NULL DEFAULT 60,
  resolution_mins int NOT NULL DEFAULT 1440,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sla_policies_workspace_idx ON public.sla_policies(workspace_id);
CREATE INDEX sla_policies_match_idx ON public.sla_policies(workspace_id, active, pipeline_id, priority);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sla_policies TO authenticated;
GRANT ALL ON public.sla_policies TO service_role;

ALTER TABLE public.sla_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sla_policies_select" ON public.sla_policies FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT current_user_workspaces()));
CREATE POLICY "sla_policies_insert" ON public.sla_policies FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT current_user_workspaces()) AND public.is_workspace_admin(owner_id, auth.uid()));
CREATE POLICY "sla_policies_update" ON public.sla_policies FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT current_user_workspaces()) AND public.is_workspace_admin(owner_id, auth.uid()));
CREATE POLICY "sla_policies_delete" ON public.sla_policies FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT current_user_workspaces()) AND public.is_workspace_admin(owner_id, auth.uid()));

CREATE TRIGGER sla_policies_updated_at BEFORE UPDATE ON public.sla_policies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.tickets
  ADD COLUMN sla_policy_id uuid NULL REFERENCES public.sla_policies(id) ON DELETE SET NULL,
  ADD COLUMN sla_first_response_due_at timestamptz NULL,
  ADD COLUMN sla_resolution_due_at timestamptz NULL,
  ADD COLUMN sla_first_response_at timestamptz NULL,
  ADD COLUMN sla_first_response_breached boolean NOT NULL DEFAULT false,
  ADD COLUMN sla_resolution_breached boolean NOT NULL DEFAULT false;

CREATE INDEX tickets_sla_first_due_idx ON public.tickets(sla_first_response_due_at)
  WHERE sla_first_response_at IS NULL AND NOT sla_first_response_breached AND deleted_at IS NULL;
CREATE INDEX tickets_sla_res_due_idx ON public.tickets(sla_resolution_due_at)
  WHERE resolved_at IS NULL AND NOT sla_resolution_breached AND deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.find_sla_policy(_owner uuid, _pipeline uuid, _priority public.ticket_priority)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.sla_policies
  WHERE owner_id = _owner AND active
  ORDER BY
    CASE WHEN pipeline_id IS NOT NULL AND pipeline_id = _pipeline AND priority IS NOT NULL AND priority = _priority THEN 1
         WHEN priority IS NOT NULL AND priority = _priority AND pipeline_id IS NULL THEN 2
         WHEN pipeline_id IS NOT NULL AND pipeline_id = _pipeline AND priority IS NULL THEN 3
         WHEN pipeline_id IS NULL AND priority IS NULL THEN 4
         ELSE 9 END,
    created_at ASC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.apply_sla_to_ticket()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_policy public.sla_policies%ROWTYPE;
  v_base timestamptz;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.priority IS NOT DISTINCT FROM OLD.priority
     AND NEW.pipeline_id IS NOT DISTINCT FROM OLD.pipeline_id THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_policy FROM public.sla_policies
    WHERE id = public.find_sla_policy(NEW.owner_id, NEW.pipeline_id, NEW.priority);

  IF NOT FOUND THEN
    NEW.sla_policy_id := NULL;
    NEW.sla_first_response_due_at := NULL;
    NEW.sla_resolution_due_at := NULL;
    RETURN NEW;
  END IF;

  v_base := COALESCE(NEW.created_at, now());
  NEW.sla_policy_id := v_policy.id;
  IF NEW.sla_first_response_at IS NULL THEN
    NEW.sla_first_response_due_at := v_base + make_interval(mins => v_policy.first_response_mins);
  END IF;
  IF NEW.resolved_at IS NULL THEN
    NEW.sla_resolution_due_at := v_base + make_interval(mins => v_policy.resolution_mins);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER tickets_apply_sla
  BEFORE INSERT OR UPDATE OF priority, pipeline_id ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.apply_sla_to_ticket();
