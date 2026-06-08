
-- Landing Pages
CREATE TABLE public.landing_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
  theme JSONB NOT NULL DEFAULT '{}'::jsonb,
  seo JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  views_count INT NOT NULL DEFAULT 0,
  conversions_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(owner_id, slug)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.landing_pages TO authenticated;
GRANT SELECT ON public.landing_pages TO anon;
GRANT ALL ON public.landing_pages TO service_role;
ALTER TABLE public.landing_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lp_member_all" ON public.landing_pages FOR ALL TO authenticated
  USING (is_workspace_member(owner_id, auth.uid())) WITH CHECK (is_workspace_member(owner_id, auth.uid()));
CREATE POLICY "lp_public_read" ON public.landing_pages FOR SELECT TO anon
  USING (status = 'published');
CREATE TRIGGER trg_lp_updated BEFORE UPDATE ON public.landing_pages FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.landing_page_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  landing_page_id UUID NOT NULL REFERENCES public.landing_pages(id) ON DELETE CASCADE,
  variant_id UUID,
  event_type TEXT NOT NULL,
  visitor_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  utm JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.landing_page_events TO authenticated;
GRANT INSERT ON public.landing_page_events TO anon;
GRANT ALL ON public.landing_page_events TO service_role;
ALTER TABLE public.landing_page_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lpe_member_read" ON public.landing_page_events FOR SELECT TO authenticated
  USING (is_workspace_member(owner_id, auth.uid()));
CREATE POLICY "lpe_anon_insert" ON public.landing_page_events FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "lpe_auth_insert" ON public.landing_page_events FOR INSERT TO authenticated WITH CHECK (true);

-- A/B tests
CREATE TABLE public.ab_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  variants JSONB NOT NULL DEFAULT '[]'::jsonb,
  success_metric TEXT NOT NULL DEFAULT 'click',
  status TEXT NOT NULL DEFAULT 'draft',
  winner_variant_id TEXT,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ab_tests TO authenticated;
GRANT ALL ON public.ab_tests TO service_role;
ALTER TABLE public.ab_tests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "abt_member_all" ON public.ab_tests FOR ALL TO authenticated
  USING (is_workspace_member(owner_id, auth.uid())) WITH CHECK (is_workspace_member(owner_id, auth.uid()));
CREATE TRIGGER trg_abt_updated BEFORE UPDATE ON public.ab_tests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.ab_test_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  test_id UUID NOT NULL REFERENCES public.ab_tests(id) ON DELETE CASCADE,
  variant_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  subject_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.ab_test_events TO authenticated;
GRANT ALL ON public.ab_test_events TO service_role;
ALTER TABLE public.ab_test_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "abte_member_all" ON public.ab_test_events FOR ALL TO authenticated
  USING (is_workspace_member(owner_id, auth.uid())) WITH CHECK (is_workspace_member(owner_id, auth.uid()));

-- Multi-touch attribution
CREATE TABLE public.attribution_touchpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  contact_id UUID,
  lead_id UUID,
  deal_id UUID,
  channel TEXT NOT NULL,
  source TEXT,
  campaign TEXT,
  medium TEXT,
  content TEXT,
  term TEXT,
  url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attribution_touchpoints TO authenticated;
GRANT ALL ON public.attribution_touchpoints TO service_role;
ALTER TABLE public.attribution_touchpoints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "att_member_all" ON public.attribution_touchpoints FOR ALL TO authenticated
  USING (is_workspace_member(owner_id, auth.uid())) WITH CHECK (is_workspace_member(owner_id, auth.uid()));
CREATE INDEX idx_att_contact ON public.attribution_touchpoints(owner_id, contact_id, occurred_at);
CREATE INDEX idx_att_deal ON public.attribution_touchpoints(owner_id, deal_id, occurred_at);

-- Ads accounts & audiences
CREATE TABLE public.ads_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  provider TEXT NOT NULL,
  external_account_id TEXT NOT NULL,
  display_name TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(owner_id, provider, external_account_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ads_accounts TO authenticated;
GRANT ALL ON public.ads_accounts TO service_role;
ALTER TABLE public.ads_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ads_admin_all" ON public.ads_accounts FOR ALL TO authenticated
  USING (is_workspace_admin_v2(owner_id, auth.uid())) WITH CHECK (is_workspace_admin_v2(owner_id, auth.uid()));
CREATE TRIGGER trg_ads_updated BEFORE UPDATE ON public.ads_accounts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.ads_audiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  account_id UUID NOT NULL REFERENCES public.ads_accounts(id) ON DELETE CASCADE,
  segment_id UUID,
  external_audience_id TEXT,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  size_estimate INT,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ads_audiences TO authenticated;
GRANT ALL ON public.ads_audiences TO service_role;
ALTER TABLE public.ads_audiences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ads_aud_member_all" ON public.ads_audiences FOR ALL TO authenticated
  USING (is_workspace_member(owner_id, auth.uid())) WITH CHECK (is_workspace_member(owner_id, auth.uid()));
CREATE TRIGGER trg_ads_aud_updated BEFORE UPDATE ON public.ads_audiences FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.ads_lead_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  account_id UUID NOT NULL REFERENCES public.ads_accounts(id) ON DELETE CASCADE,
  external_form_id TEXT NOT NULL,
  name TEXT NOT NULL,
  campaign_name TEXT,
  field_mapping JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(account_id, external_form_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ads_lead_forms TO authenticated;
GRANT ALL ON public.ads_lead_forms TO service_role;
ALTER TABLE public.ads_lead_forms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ads_lf_member_all" ON public.ads_lead_forms FOR ALL TO authenticated
  USING (is_workspace_member(owner_id, auth.uid())) WITH CHECK (is_workspace_member(owner_id, auth.uid()));
CREATE TRIGGER trg_ads_lf_updated BEFORE UPDATE ON public.ads_lead_forms FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
