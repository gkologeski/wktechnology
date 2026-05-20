
-- 42 API keys
CREATE TABLE public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  scopes TEXT[] NOT NULL DEFAULT ARRAY['read']::text[],
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_api_keys_owner ON public.api_keys(owner_id);
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "api_keys owner/admin all" ON public.api_keys FOR ALL
  USING (public.is_workspace_admin(owner_id, auth.uid()))
  WITH CHECK (public.is_workspace_admin(owner_id, auth.uid()));
CREATE TRIGGER trg_api_keys_updated BEFORE UPDATE ON public.api_keys
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 43 Outbound webhooks
CREATE TABLE public.outbound_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  secret TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_outbound_webhooks_owner ON public.outbound_webhooks(owner_id);
ALTER TABLE public.outbound_webhooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "outbound_webhooks owner/admin all" ON public.outbound_webhooks FOR ALL
  USING (public.is_workspace_admin(owner_id, auth.uid()))
  WITH CHECK (public.is_workspace_admin(owner_id, auth.uid()));
CREATE TRIGGER trg_outbound_webhooks_updated BEFORE UPDATE ON public.outbound_webhooks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TYPE delivery_status AS ENUM ('pending','success','failed','dead');

CREATE TABLE public.webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  webhook_id UUID NOT NULL REFERENCES public.outbound_webhooks(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  attempt INT NOT NULL DEFAULT 0,
  status delivery_status NOT NULL DEFAULT 'pending',
  response_status INT,
  response_body TEXT,
  next_retry_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_webhook_deliveries_owner ON public.webhook_deliveries(owner_id);
CREATE INDEX idx_webhook_deliveries_pending ON public.webhook_deliveries(status, next_retry_at) WHERE status IN ('pending','failed');
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "webhook_deliveries owner/admin read" ON public.webhook_deliveries FOR SELECT
  USING (public.is_workspace_admin(owner_id, auth.uid()));

-- 44 HubSpot sync state
CREATE TABLE public.hubspot_sync_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  entity TEXT NOT NULL,
  local_id UUID NOT NULL,
  hubspot_id TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'both',
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_payload JSONB,
  UNIQUE(owner_id, entity, local_id),
  UNIQUE(owner_id, entity, hubspot_id)
);
ALTER TABLE public.hubspot_sync_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hubspot_sync_state owner/admin all" ON public.hubspot_sync_state FOR ALL
  USING (public.is_workspace_admin(owner_id, auth.uid()))
  WITH CHECK (public.is_workspace_admin(owner_id, auth.uid()));

-- 45 Custom Objects
CREATE TABLE public.custom_objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  icon TEXT,
  schema JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(owner_id, slug)
);
ALTER TABLE public.custom_objects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "custom_objects owner/admin all" ON public.custom_objects FOR ALL
  USING (public.is_workspace_admin(owner_id, auth.uid()))
  WITH CHECK (public.is_workspace_admin(owner_id, auth.uid()));
CREATE TRIGGER trg_custom_objects_updated BEFORE UPDATE ON public.custom_objects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.custom_object_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  object_id UUID NOT NULL REFERENCES public.custom_objects(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_custom_records_object ON public.custom_object_records(object_id);
CREATE INDEX idx_custom_records_owner ON public.custom_object_records(owner_id);
ALTER TABLE public.custom_object_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "custom_records owner/admin all" ON public.custom_object_records FOR ALL
  USING (public.is_workspace_admin(owner_id, auth.uid()))
  WITH CHECK (public.is_workspace_admin(owner_id, auth.uid()));
CREATE TRIGGER trg_custom_records_updated BEFORE UPDATE ON public.custom_object_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 46 Push subscriptions
CREATE TABLE public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_push_subs_user ON public.push_subscriptions(user_id);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "push own" ON public.push_subscriptions FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 48 White-label branding
CREATE TABLE public.workspace_branding (
  owner_id UUID PRIMARY KEY,
  brand_name TEXT,
  logo_url TEXT,
  favicon_url TEXT,
  primary_color TEXT,
  accent_color TEXT,
  custom_domain TEXT,
  support_email TEXT,
  footer_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.workspace_branding ENABLE ROW LEVEL SECURITY;
CREATE POLICY "branding owner/admin all" ON public.workspace_branding FOR ALL
  USING (public.is_workspace_admin(owner_id, auth.uid()))
  WITH CHECK (public.is_workspace_admin(owner_id, auth.uid()));
CREATE POLICY "branding read public by domain" ON public.workspace_branding FOR SELECT
  USING (true);
CREATE TRIGGER trg_branding_updated BEFORE UPDATE ON public.workspace_branding
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
