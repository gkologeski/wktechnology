-- 1) Pontuação de perguntas de texto
ALTER TABLE public.prospecting_questions
  ADD COLUMN IF NOT EXISTS text_points integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS text_min_chars integer NOT NULL DEFAULT 1;

-- 2) Critérios de ICP
CREATE TABLE IF NOT EXISTS public.icp_criteria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  name text NOT NULL,
  entity text NOT NULL DEFAULT 'company',
  field text NOT NULL,
  op text NOT NULL DEFAULT 'eq',
  value jsonb,
  points integer NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.icp_criteria TO authenticated;
GRANT ALL ON public.icp_criteria TO service_role;

ALTER TABLE public.icp_criteria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ws_select_icp_criteria" ON public.icp_criteria
  FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()));

CREATE POLICY "ws_insert_icp_criteria" ON public.icp_criteria
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() AND workspace_id IN (SELECT public.current_user_workspaces()));

CREATE POLICY "ws_update_icp_criteria" ON public.icp_criteria
  FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()))
  WITH CHECK (workspace_id IN (SELECT public.current_user_workspaces()));

CREATE POLICY "ws_delete_icp_criteria" ON public.icp_criteria
  FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()));

CREATE INDEX IF NOT EXISTS icp_criteria_ws_idx ON public.icp_criteria (workspace_id, enabled);

-- 3) Contribuições de score (parcelas por origem, idempotentes)
CREATE TABLE IF NOT EXISTS public.score_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  entity text NOT NULL,
  entity_id uuid NOT NULL,
  source text NOT NULL,
  source_key text NOT NULL DEFAULT '',
  points integer NOT NULL DEFAULT 0,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.score_contributions TO authenticated;
GRANT ALL ON public.score_contributions TO service_role;

ALTER TABLE public.score_contributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ws_select_score_contributions" ON public.score_contributions
  FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()));

CREATE POLICY "ws_insert_score_contributions" ON public.score_contributions
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() AND workspace_id IN (SELECT public.current_user_workspaces()));

CREATE POLICY "ws_update_score_contributions" ON public.score_contributions
  FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()))
  WITH CHECK (workspace_id IN (SELECT public.current_user_workspaces()));

CREATE POLICY "ws_delete_score_contributions" ON public.score_contributions
  FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()));

CREATE UNIQUE INDEX IF NOT EXISTS score_contributions_unique_idx
  ON public.score_contributions (entity, entity_id, source, source_key);

CREATE INDEX IF NOT EXISTS score_contributions_entity_idx
  ON public.score_contributions (entity, entity_id);

CREATE OR REPLACE FUNCTION public.touch_updated_at_generic()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS icp_criteria_touch ON public.icp_criteria;
CREATE TRIGGER icp_criteria_touch BEFORE UPDATE ON public.icp_criteria
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_generic();

DROP TRIGGER IF EXISTS score_contributions_touch ON public.score_contributions;
CREATE TRIGGER score_contributions_touch BEFORE UPDATE ON public.score_contributions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_generic();
