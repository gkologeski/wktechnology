
-- WABAs connected via Meta
CREATE TABLE public.wa_business_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  waba_id text NOT NULL,
  business_id text,
  business_name text,
  access_token text NOT NULL,
  status text NOT NULL DEFAULT 'connected',
  webhook_verified_at timestamptz,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, waba_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wa_business_accounts TO authenticated;
GRANT ALL ON public.wa_business_accounts TO service_role;
ALTER TABLE public.wa_business_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ws_select_wa_business_accounts" ON public.wa_business_accounts FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "ws_insert_wa_business_accounts" ON public.wa_business_accounts FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "ws_update_wa_business_accounts" ON public.wa_business_accounts FOR UPDATE TO authenticated USING (public.is_workspace_member(workspace_id, auth.uid())) WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "ws_delete_wa_business_accounts" ON public.wa_business_accounts FOR DELETE TO authenticated USING (public.is_workspace_admin_v2(workspace_id, auth.uid()));
CREATE TRIGGER trg_wa_business_accounts_updated BEFORE UPDATE ON public.wa_business_accounts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Phone numbers per WABA
CREATE TABLE public.wa_phone_numbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  waba_id uuid NOT NULL REFERENCES public.wa_business_accounts(id) ON DELETE CASCADE,
  phone_number_id text NOT NULL,
  display_phone_number text NOT NULL,
  verified_name text,
  quality_rating text,
  messaging_limit_tier text,
  is_default boolean NOT NULL DEFAULT false,
  routing_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, phone_number_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wa_phone_numbers TO authenticated;
GRANT ALL ON public.wa_phone_numbers TO service_role;
ALTER TABLE public.wa_phone_numbers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ws_select_wa_phone_numbers" ON public.wa_phone_numbers FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "ws_insert_wa_phone_numbers" ON public.wa_phone_numbers FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "ws_update_wa_phone_numbers" ON public.wa_phone_numbers FOR UPDATE TO authenticated USING (public.is_workspace_member(workspace_id, auth.uid())) WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "ws_delete_wa_phone_numbers" ON public.wa_phone_numbers FOR DELETE TO authenticated USING (public.is_workspace_admin_v2(workspace_id, auth.uid()));
CREATE TRIGGER trg_wa_phone_numbers_updated BEFORE UPDATE ON public.wa_phone_numbers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_wa_phone_numbers_waba ON public.wa_phone_numbers(waba_id);

-- HSM templates (Meta-managed)
CREATE TABLE public.wa_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  waba_id uuid NOT NULL REFERENCES public.wa_business_accounts(id) ON DELETE CASCADE,
  meta_template_id text,
  name text NOT NULL,
  language text NOT NULL,
  category text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  components jsonb NOT NULL DEFAULT '[]'::jsonb,
  rejection_reason text,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(waba_id, name, language)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wa_templates TO authenticated;
GRANT ALL ON public.wa_templates TO service_role;
ALTER TABLE public.wa_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ws_select_wa_templates" ON public.wa_templates FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "ws_insert_wa_templates" ON public.wa_templates FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "ws_update_wa_templates" ON public.wa_templates FOR UPDATE TO authenticated USING (public.is_workspace_member(workspace_id, auth.uid())) WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "ws_delete_wa_templates" ON public.wa_templates FOR DELETE TO authenticated USING (public.is_workspace_member(workspace_id, auth.uid()));
CREATE TRIGGER trg_wa_templates_updated BEFORE UPDATE ON public.wa_templates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Commerce catalogs cache
CREATE TABLE public.wa_catalogs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  waba_id uuid REFERENCES public.wa_business_accounts(id) ON DELETE SET NULL,
  catalog_id text NOT NULL,
  name text,
  vertical text,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, catalog_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wa_catalogs TO authenticated;
GRANT ALL ON public.wa_catalogs TO service_role;
ALTER TABLE public.wa_catalogs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ws_select_wa_catalogs" ON public.wa_catalogs FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "ws_insert_wa_catalogs" ON public.wa_catalogs FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "ws_update_wa_catalogs" ON public.wa_catalogs FOR UPDATE TO authenticated USING (public.is_workspace_member(workspace_id, auth.uid())) WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "ws_delete_wa_catalogs" ON public.wa_catalogs FOR DELETE TO authenticated USING (public.is_workspace_member(workspace_id, auth.uid()));
CREATE TRIGGER trg_wa_catalogs_updated BEFORE UPDATE ON public.wa_catalogs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.wa_catalog_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  catalog_id uuid NOT NULL REFERENCES public.wa_catalogs(id) ON DELETE CASCADE,
  retailer_id text NOT NULL,
  name text,
  price text,
  currency text,
  availability text,
  image_url text,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(catalog_id, retailer_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wa_catalog_products TO authenticated;
GRANT ALL ON public.wa_catalog_products TO service_role;
ALTER TABLE public.wa_catalog_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ws_select_wa_catalog_products" ON public.wa_catalog_products FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "ws_insert_wa_catalog_products" ON public.wa_catalog_products FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "ws_update_wa_catalog_products" ON public.wa_catalog_products FOR UPDATE TO authenticated USING (public.is_workspace_member(workspace_id, auth.uid())) WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "ws_delete_wa_catalog_products" ON public.wa_catalog_products FOR DELETE TO authenticated USING (public.is_workspace_member(workspace_id, auth.uid()));
CREATE TRIGGER trg_wa_catalog_products_updated BEFORE UPDATE ON public.wa_catalog_products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Click-to-WhatsApp ad referrals
CREATE TABLE public.wa_ad_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  message_id uuid REFERENCES public.whatsapp_messages(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  source_type text,
  source_id text,
  source_url text,
  ctwa_clid text,
  headline text,
  body text,
  media_type text,
  media_url text,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wa_ad_referrals TO authenticated;
GRANT ALL ON public.wa_ad_referrals TO service_role;
ALTER TABLE public.wa_ad_referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ws_select_wa_ad_referrals" ON public.wa_ad_referrals FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "ws_insert_wa_ad_referrals" ON public.wa_ad_referrals FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "ws_update_wa_ad_referrals" ON public.wa_ad_referrals FOR UPDATE TO authenticated USING (public.is_workspace_member(workspace_id, auth.uid())) WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "ws_delete_wa_ad_referrals" ON public.wa_ad_referrals FOR DELETE TO authenticated USING (public.is_workspace_member(workspace_id, auth.uid()));

-- Add Meta columns to legacy whatsapp tables (additive — keep twilio_* for back-compat)
ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'twilio',
  ADD COLUMN IF NOT EXISTS wa_phone_number_id text,
  ADD COLUMN IF NOT EXISTS conversation_origin text,
  ADD COLUMN IF NOT EXISTS last_inbound_at timestamptz;

ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'twilio',
  ADD COLUMN IF NOT EXISTS wa_message_id text,
  ADD COLUMN IF NOT EXISTS context_message_id text,
  ADD COLUMN IF NOT EXISTS pricing_category text,
  ADD COLUMN IF NOT EXISTS interactive_type text,
  ADD COLUMN IF NOT EXISTS referral_id uuid REFERENCES public.wa_ad_referrals(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_whatsapp_messages_wa_message_id ON public.whatsapp_messages(wa_message_id) WHERE wa_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_wa_phone ON public.whatsapp_conversations(wa_phone_number_id);
