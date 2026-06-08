
-- Catalog (shared across workspaces, read-only for users)
CREATE TABLE public.marketplace_apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  short_description TEXT,
  description TEXT,
  icon_url TEXT,
  vendor TEXT,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  docs_url TEXT,
  install_kind TEXT NOT NULL DEFAULT 'config' CHECK (install_kind IN ('oauth','config','webhook','builtin')),
  popular BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.marketplace_apps TO authenticated;
GRANT ALL ON public.marketplace_apps TO service_role;
ALTER TABLE public.marketplace_apps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "marketplace_apps read all auth" ON public.marketplace_apps FOR SELECT TO authenticated USING (active = true);
CREATE POLICY "marketplace_apps service all" ON public.marketplace_apps FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER trg_marketplace_apps_updated BEFORE UPDATE ON public.marketplace_apps FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Installations per workspace
CREATE TABLE public.marketplace_installations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  owner_id UUID NOT NULL,
  app_slug TEXT NOT NULL REFERENCES public.marketplace_apps(slug) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled','error')),
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_test_at TIMESTAMPTZ,
  last_test_ok BOOLEAN,
  last_test_error TEXT,
  installed_by UUID,
  installed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, app_slug)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketplace_installations TO authenticated;
GRANT ALL ON public.marketplace_installations TO service_role;
ALTER TABLE public.marketplace_installations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mp_inst select" ON public.marketplace_installations FOR SELECT TO authenticated USING (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE POLICY "mp_inst write" ON public.marketplace_installations FOR ALL TO authenticated USING (workspace_id IN (SELECT public.current_user_workspaces())) WITH CHECK (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE POLICY "mp_inst service" ON public.marketplace_installations FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER trg_mp_inst_updated BEFORE UPDATE ON public.marketplace_installations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Slack integration (one per workspace)
CREATE TABLE public.slack_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL UNIQUE,
  owner_id UUID NOT NULL,
  team_id TEXT,
  team_name TEXT,
  access_token TEXT NOT NULL,
  bot_user_id TEXT,
  default_channel_id TEXT,
  default_channel_name TEXT,
  scope TEXT,
  installed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.slack_integrations TO authenticated;
GRANT ALL ON public.slack_integrations TO service_role;
ALTER TABLE public.slack_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "slack_int select" ON public.slack_integrations FOR SELECT TO authenticated USING (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE POLICY "slack_int write" ON public.slack_integrations FOR ALL TO authenticated USING (workspace_id IN (SELECT public.current_user_workspaces())) WITH CHECK (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE POLICY "slack_int service" ON public.slack_integrations FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER trg_slack_int_updated BEFORE UPDATE ON public.slack_integrations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Slack event routes
CREATE TABLE public.slack_event_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  owner_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  channel_name TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  per_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.slack_event_routes TO authenticated;
GRANT ALL ON public.slack_event_routes TO service_role;
ALTER TABLE public.slack_event_routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "slack_routes select" ON public.slack_event_routes FOR SELECT TO authenticated USING (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE POLICY "slack_routes write" ON public.slack_event_routes FOR ALL TO authenticated USING (workspace_id IN (SELECT public.current_user_workspaces())) WITH CHECK (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE POLICY "slack_routes service" ON public.slack_event_routes FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER trg_slack_routes_updated BEFORE UPDATE ON public.slack_event_routes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_slack_routes_ws_event ON public.slack_event_routes(workspace_id, event_type) WHERE enabled = true;

-- Zapier REST hook subscriptions
CREATE TABLE public.zapier_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  owner_id UUID NOT NULL,
  api_key_id UUID REFERENCES public.api_keys(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  target_url TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  last_delivery_at TIMESTAMPTZ,
  last_delivery_status INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.zapier_subscriptions TO authenticated;
GRANT ALL ON public.zapier_subscriptions TO service_role;
ALTER TABLE public.zapier_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "zap_sub select" ON public.zapier_subscriptions FOR SELECT TO authenticated USING (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE POLICY "zap_sub write" ON public.zapier_subscriptions FOR ALL TO authenticated USING (workspace_id IN (SELECT public.current_user_workspaces())) WITH CHECK (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE POLICY "zap_sub service" ON public.zapier_subscriptions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER trg_zap_sub_updated BEFORE UPDATE ON public.zapier_subscriptions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_zap_sub_ws_event ON public.zapier_subscriptions(workspace_id, event) WHERE active = true;

-- Seed catalog
INSERT INTO public.marketplace_apps (slug, name, category, short_description, description, vendor, scopes, install_kind, popular, sort_order) VALUES
('slack', 'Slack', 'Notificações', 'Notificações de CRM em canais do Slack', 'Receba alertas de deals, leads e tickets em canais. Use comandos /lovable.', 'Slack', ARRAY['channels:read','chat:write','commands'], 'oauth', true, 10),
('zapier', 'Zapier', 'Automação', 'Conecte seu CRM a milhares de apps', 'Triggers (new_lead, deal_won...) e actions (create_contact, send_whatsapp).', 'Zapier', ARRAY['api'], 'config', true, 20),
('make', 'Make (Integromat)', 'Automação', 'Cenários visuais com seu CRM', 'Compatível via mesmas APIs do Zapier (REST hooks).', 'Make', ARRAY['api'], 'config', true, 25),
('google-calendar', 'Google Calendar', 'Calendário', 'Sincronize reuniões e eventos', 'Two-way sync com agenda do Google.', 'Google', ARRAY['calendar'], 'oauth', true, 30),
('gmail', 'Gmail', 'Email', 'Envio e captura de emails', 'Conecte sua caixa Gmail ao CRM.', 'Google', ARRAY['gmail.send','gmail.readonly'], 'oauth', true, 35),
('hubspot', 'HubSpot Sync', 'CRM', 'Sincronize com HubSpot', 'Two-way sync com HubSpot.', 'HubSpot', ARRAY['contacts','companies','deals'], 'oauth', false, 40),
('whatsapp-cloud', 'WhatsApp Cloud API', 'Mensageria', 'Envio via Meta WhatsApp Cloud', 'Templates aprovados, mídia e webhooks.', 'Meta', ARRAY['whatsapp_business_messaging'], 'oauth', true, 15),
('twilio', 'Twilio Voice', 'Voz', 'Discador e gravação de chamadas', 'Voice + recordings nativos no CRM.', 'Twilio', ARRAY['voice'], 'config', false, 50),
('stripe', 'Stripe', 'Pagamentos', 'Cobrança internacional', 'Stripe para clientes fora do Brasil.', 'Stripe', ARRAY['payments'], 'oauth', false, 60),
('asaas', 'Asaas', 'Pagamentos BR', 'Pix, boleto e cartão para o Brasil', 'Webhook integrado.', 'Asaas', ARRAY['payments'], 'config', true, 55),
('nfe-io', 'NFE.io', 'Fiscal BR', 'Emissão de NFS-e', 'Emissão automática após pagamento.', 'NFE.io', ARRAY['invoices'], 'config', false, 65),
('teams', 'Microsoft Teams', 'Notificações', 'Notificações em canais do Teams', 'Alertas por webhook do Teams.', 'Microsoft', ARRAY['incoming-webhook'], 'webhook', false, 70);
