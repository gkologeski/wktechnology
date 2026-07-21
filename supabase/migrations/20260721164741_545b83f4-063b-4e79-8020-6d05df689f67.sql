
CREATE TABLE public.workflow_action_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  workspace_id uuid,
  name text NOT NULL,
  description text,
  action_type text NOT NULL,
  entity text,
  table_name text,
  action_json jsonb NOT NULL,
  visibility text NOT NULL DEFAULT 'personal' CHECK (visibility IN ('personal','shared')),
  usage_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wat_name_length CHECK (char_length(name) BETWEEN 1 AND 120)
);

CREATE INDEX wat_by_workspace ON public.workflow_action_templates (workspace_id, action_type);
CREATE INDEX wat_by_owner ON public.workflow_action_templates (owner_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_action_templates TO authenticated;
GRANT ALL ON public.workflow_action_templates TO service_role;
ALTER TABLE public.workflow_action_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY wat_select ON public.workflow_action_templates FOR SELECT TO authenticated
USING (
  owner_id = auth.uid()
  OR (
    visibility = 'shared'
    AND workspace_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = public.workflow_action_templates.workspace_id
        AND wm.user_id = auth.uid()
    )
  )
);

CREATE POLICY wat_insert ON public.workflow_action_templates FOR INSERT TO authenticated
WITH CHECK (
  owner_id = auth.uid()
  AND (
    visibility = 'personal'
    OR (visibility = 'shared' AND workspace_id IS NOT NULL AND public.is_workspace_admin(workspace_id, auth.uid()))
  )
);

CREATE POLICY wat_update ON public.workflow_action_templates FOR UPDATE TO authenticated
USING (
  owner_id = auth.uid()
  OR (visibility = 'shared' AND workspace_id IS NOT NULL AND public.is_workspace_admin(workspace_id, auth.uid()))
)
WITH CHECK (
  owner_id = auth.uid()
  OR (visibility = 'shared' AND workspace_id IS NOT NULL AND public.is_workspace_admin(workspace_id, auth.uid()))
);

CREATE POLICY wat_delete ON public.workflow_action_templates FOR DELETE TO authenticated
USING (
  owner_id = auth.uid()
  OR (visibility = 'shared' AND workspace_id IS NOT NULL AND public.is_workspace_admin(workspace_id, auth.uid()))
);

CREATE OR REPLACE FUNCTION public.wat_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER wat_updated_at
BEFORE UPDATE ON public.workflow_action_templates
FOR EACH ROW EXECUTE FUNCTION public.wat_touch_updated_at();

CREATE OR REPLACE FUNCTION public.increment_wat_usage(_id uuid)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  UPDATE public.workflow_action_templates
  SET usage_count = usage_count + 1
  WHERE id = _id;
$$;

GRANT EXECUTE ON FUNCTION public.increment_wat_usage(uuid) TO authenticated;
