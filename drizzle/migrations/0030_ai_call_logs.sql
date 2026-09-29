CREATE TABLE IF NOT EXISTS public.ai_call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  provider text NOT NULL,
  model text,
  feature text NOT NULL DEFAULT 'outros',
  trigger_source text NOT NULL DEFAULT 'user' CHECK (trigger_source IN ('user','automatic')),
  triggered_by uuid,
  prompt_tokens integer,
  completion_tokens integer,
  estimated_cost_usd numeric(12,6),
  duration_ms integer,
  status text NOT NULL CHECK (status IN ('success','failed')),
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_call_logs_ws_created_idx ON public.ai_call_logs (workspace_id, created_at DESC);
GRANT SELECT ON public.ai_call_logs TO authenticated;
GRANT ALL ON public.ai_call_logs TO service_role;
ALTER TABLE public.ai_call_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read AI call logs" ON public.ai_call_logs;
CREATE POLICY "Admins read AI call logs" ON public.ai_call_logs
  FOR SELECT TO authenticated USING (public.is_workspace_admin_v2(workspace_id, auth.uid()));