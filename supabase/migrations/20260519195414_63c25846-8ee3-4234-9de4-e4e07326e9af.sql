
CREATE TYPE public.goal_metric AS ENUM (
  'deals_won_count','deals_won_value','deals_created','activities_count','calls_count','emails_sent','tasks_completed'
);
CREATE TYPE public.goal_period AS ENUM ('month','quarter','year','custom');

CREATE TABLE public.goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  target_user_id uuid,
  name text NOT NULL,
  metric public.goal_metric NOT NULL,
  period public.goal_period NOT NULL DEFAULT 'month',
  period_start date NOT NULL,
  period_end date NOT NULL,
  target_value numeric(14,2) NOT NULL DEFAULT 0,
  pipeline_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (period_end >= period_start)
);

CREATE INDEX goals_owner_idx ON public.goals(owner_id);
CREATE INDEX goals_period_idx ON public.goals(period_start, period_end);

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY goals_select ON public.goals FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.is_workspace_admin(owner_id, auth.uid()));
CREATE POLICY goals_insert ON public.goals FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() OR public.is_workspace_admin(owner_id, auth.uid()));
CREATE POLICY goals_update ON public.goals FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.is_workspace_admin(owner_id, auth.uid()))
  WITH CHECK (owner_id = auth.uid() OR public.is_workspace_admin(owner_id, auth.uid()));
CREATE POLICY goals_delete ON public.goals FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR public.is_workspace_admin(owner_id, auth.uid()));
