CREATE TABLE public.workspace_ai_settings (
  workspace_id uuid PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'lovable' CHECK (provider IN ('lovable','openai','anthropic','google','xai','deepseek','openrouter')),
  model text,
  status text NOT NULL DEFAULT 'configured' CHECK (status IN ('configured','connected','failed','disabled')),
  last_error text,
  last_tested_at timestamptz,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.workspace_ai_settings TO authenticated;
GRANT ALL ON public.workspace_ai_settings TO service_role;
ALTER TABLE public.workspace_ai_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read AI settings" ON public.workspace_ai_settings
  FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE TABLE public.workspace_ai_credentials (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('openai','anthropic','google','xai','deepseek','openrouter')),
  key_ciphertext text NOT NULL,
  key_last4 text,
  model text,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, provider)
);
GRANT ALL ON public.workspace_ai_credentials TO service_role;
ALTER TABLE public.workspace_ai_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only" ON public.workspace_ai_credentials
  FOR ALL TO service_role USING (true) WITH CHECK (true);