
-- ============================================================
-- bank_connections: conexão OAuth por workspace/provider
-- ============================================================
CREATE TABLE public.bank_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  provider TEXT NOT NULL, -- 'inter' (futuro: 'itau', 'bb'...)
  status TEXT NOT NULL DEFAULT 'disconnected'
    CHECK (status IN ('disconnected','connecting','connected','error','revoked')),
  mode TEXT NOT NULL DEFAULT 'mock'
    CHECK (mode IN ('mock','sandbox','production')),
  display_name TEXT,
  client_id TEXT,
  scopes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  external_account_id TEXT,
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, provider)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_connections TO authenticated;
GRANT ALL ON public.bank_connections TO service_role;
ALTER TABLE public.bank_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY ws_bank_connections_select ON public.bank_connections
  FOR SELECT TO authenticated
  USING (
    workspace_id IN (SELECT current_user_workspaces())
    AND is_workspace_admin_v2(workspace_id, auth.uid())
  );

CREATE POLICY ws_bank_connections_write ON public.bank_connections
  FOR ALL TO authenticated
  USING (
    workspace_id IN (SELECT current_user_workspaces())
    AND is_workspace_admin_v2(workspace_id, auth.uid())
  )
  WITH CHECK (
    workspace_id IN (SELECT current_user_workspaces())
    AND is_workspace_admin_v2(workspace_id, auth.uid())
  );

CREATE INDEX bank_connections_workspace_idx ON public.bank_connections (workspace_id, provider);

-- ============================================================
-- bank_connection_tokens: tokens OAuth (isolados)
-- ============================================================
CREATE TABLE public.bank_connection_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES public.bank_connections(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_type TEXT NOT NULL DEFAULT 'Bearer',
  scope TEXT,
  expires_at TIMESTAMPTZ,
  rotated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_connection_tokens TO authenticated;
GRANT ALL ON public.bank_connection_tokens TO service_role;
ALTER TABLE public.bank_connection_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY ws_bank_connection_tokens_select ON public.bank_connection_tokens
  FOR SELECT TO authenticated
  USING (
    workspace_id IN (SELECT current_user_workspaces())
    AND is_workspace_admin_v2(workspace_id, auth.uid())
  );

CREATE POLICY ws_bank_connection_tokens_write ON public.bank_connection_tokens
  FOR ALL TO authenticated
  USING (
    workspace_id IN (SELECT current_user_workspaces())
    AND is_workspace_admin_v2(workspace_id, auth.uid())
  )
  WITH CHECK (
    workspace_id IN (SELECT current_user_workspaces())
    AND is_workspace_admin_v2(workspace_id, auth.uid())
  );

CREATE INDEX bank_connection_tokens_conn_idx ON public.bank_connection_tokens (connection_id);
CREATE UNIQUE INDEX bank_connection_tokens_active_uniq
  ON public.bank_connection_tokens (connection_id)
  WHERE rotated_at IS NULL;

-- ============================================================
-- bank_connection_events: audit trail
-- ============================================================
CREATE TABLE public.bank_connection_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES public.bank_connections(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL,
  event_type TEXT NOT NULL, -- 'initiate','authorize','refresh','disconnect','error'
  actor_id UUID,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.bank_connection_events TO authenticated;
GRANT ALL ON public.bank_connection_events TO service_role;
ALTER TABLE public.bank_connection_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY ws_bank_connection_events_select ON public.bank_connection_events
  FOR SELECT TO authenticated
  USING (
    workspace_id IN (SELECT current_user_workspaces())
    AND is_workspace_admin_v2(workspace_id, auth.uid())
  );

CREATE POLICY ws_bank_connection_events_insert ON public.bank_connection_events
  FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id IN (SELECT current_user_workspaces())
    AND is_workspace_admin_v2(workspace_id, auth.uid())
  );

CREATE INDEX bank_connection_events_conn_idx ON public.bank_connection_events (connection_id, created_at DESC);

-- Trigger de updated_at
CREATE TRIGGER trg_bank_connections_updated
  BEFORE UPDATE ON public.bank_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_bank_connection_tokens_updated
  BEFORE UPDATE ON public.bank_connection_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
