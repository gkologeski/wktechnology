-- ============================================================
-- 1) Tabela: plans (catálogo)
-- ============================================================
CREATE TABLE public.plans (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  tier_rank INT NOT NULL,
  price_monthly NUMERIC(10,2) NOT NULL DEFAULT 0,
  price_yearly NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.plans TO authenticated;
GRANT ALL ON public.plans TO service_role;

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plans readable by authenticated"
  ON public.plans FOR SELECT TO authenticated USING (true);

CREATE POLICY "plans manageable by platform admins"
  ON public.plans FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE TRIGGER plans_set_updated_at
  BEFORE UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 2) Tabela: plan_entitlements
-- ============================================================
CREATE TABLE public.plan_entitlements (
  plan_code TEXT NOT NULL REFERENCES public.plans(code) ON DELETE CASCADE,
  key TEXT NOT NULL,
  limit_int INT, -- null = ilimitado quando enabled=true
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (plan_code, key)
);

GRANT SELECT ON public.plan_entitlements TO authenticated;
GRANT ALL ON public.plan_entitlements TO service_role;

ALTER TABLE public.plan_entitlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plan_entitlements readable by authenticated"
  ON public.plan_entitlements FOR SELECT TO authenticated USING (true);

CREATE POLICY "plan_entitlements manageable by platform admins"
  ON public.plan_entitlements FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

-- ============================================================
-- 3) Tabela: workspace_subscriptions
-- ============================================================
CREATE TABLE public.workspace_subscriptions (
  workspace_owner_id UUID PRIMARY KEY,
  plan_code TEXT NOT NULL REFERENCES public.plans(code) DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'active', -- active|trialing|past_due|canceled
  trial_ends_at TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.workspace_subscriptions TO authenticated;
GRANT ALL ON public.workspace_subscriptions TO service_role;

ALTER TABLE public.workspace_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subs visible to workspace members"
  ON public.workspace_subscriptions FOR SELECT TO authenticated
  USING (
    workspace_owner_id = auth.uid()
    OR public.is_platform_admin(auth.uid())
    OR public.is_workspace_member(workspace_owner_id, auth.uid())
  );

CREATE POLICY "subs managed by platform admins"
  ON public.workspace_subscriptions FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE TRIGGER workspace_subscriptions_set_updated_at
  BEFORE UPDATE ON public.workspace_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 4) Tabela: usage_counters
-- ============================================================
CREATE TABLE public.usage_counters (
  workspace_owner_id UUID NOT NULL,
  key TEXT NOT NULL,
  period_month DATE NOT NULL,
  used INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_owner_id, key, period_month)
);

GRANT SELECT ON public.usage_counters TO authenticated;
GRANT ALL ON public.usage_counters TO service_role;

ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usage visible to workspace members"
  ON public.usage_counters FOR SELECT TO authenticated
  USING (
    workspace_owner_id = auth.uid()
    OR public.is_platform_admin(auth.uid())
    OR public.is_workspace_member(workspace_owner_id, auth.uid())
  );

-- ============================================================
-- 5) Helper functions
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_workspace_plan(_workspace UUID)
RETURNS TEXT
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT plan_code FROM public.workspace_subscriptions WHERE workspace_owner_id = _workspace),
    'free'
  );
$$;

CREATE OR REPLACE FUNCTION public.get_entitlement_limit(_workspace UUID, _key TEXT)
RETURNS INT
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT pe.limit_int
    FROM public.plan_entitlements pe
   WHERE pe.plan_code = public.get_workspace_plan(_workspace)
     AND pe.key = _key
     AND pe.enabled = true;
$$;

CREATE OR REPLACE FUNCTION public.has_entitlement(_workspace UUID, _key TEXT)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT enabled FROM public.plan_entitlements
       WHERE plan_code = public.get_workspace_plan(_workspace) AND key = _key),
    false
  );
$$;

-- ============================================================
-- 6) Enforcement triggers para entidades
-- ============================================================
CREATE OR REPLACE FUNCTION public.assert_entity_limit()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_entity TEXT := TG_ARGV[0];
  v_key TEXT := v_entity || '.max';
  v_limit INT;
  v_count INT;
BEGIN
  -- Platform admins ignoram limites
  IF auth.uid() IS NOT NULL AND public.is_platform_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  v_limit := public.get_entitlement_limit(NEW.owner_id, v_key);

  -- null = ilimitado
  IF v_limit IS NULL THEN
    RETURN NEW;
  END IF;

  EXECUTE format(
    'SELECT count(*) FROM public.%I WHERE owner_id = $1 AND deleted_at IS NULL',
    v_entity
  ) INTO v_count USING NEW.owner_id;

  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'plan_limit_exceeded:%', v_entity USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_plan_limit_leads
  BEFORE INSERT ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.assert_entity_limit('leads');

CREATE TRIGGER enforce_plan_limit_contacts
  BEFORE INSERT ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.assert_entity_limit('contacts');

CREATE TRIGGER enforce_plan_limit_companies
  BEFORE INSERT ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.assert_entity_limit('companies');

CREATE TRIGGER enforce_plan_limit_deals
  BEFORE INSERT ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.assert_entity_limit('deals');

-- ============================================================
-- 7) Seed: planos
-- ============================================================
INSERT INTO public.plans (code, name, tier_rank, price_monthly, price_yearly) VALUES
  ('free',   'Free',   0,   0,    0),
  ('bronze', 'Bronze', 1,  49,   490),
  ('prata',  'Prata',  2, 149,  1490),
  ('ouro',   'Ouro',   3, 349,  3490);

-- ============================================================
-- 8) Seed: entitlements
-- Convenção: limit_int = NULL com enabled=true significa ilimitado;
--            enabled=false significa recurso bloqueado.
-- ============================================================
DO $$
DECLARE
  -- (key, free_limit, free_enabled, bronze_limit, bronze_enabled, prata_limit, prata_enabled, ouro_limit, ouro_enabled)
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT * FROM (VALUES
      -- Entidades (limites duros)
      ('leads.max',                 500,  true,  5000,  true, 25000,  true, NULL::INT, true),
      ('contacts.max',              500,  true,  5000,  true, 25000,  true, NULL,      true),
      ('companies.max',             500,  true,  5000,  true, 25000,  true, NULL,      true),
      ('deals.max',                 100,  true,  2000,  true, 10000,  true, NULL,      true),
      ('users.max',                 1,    true,  3,     true, 10,     true, NULL,      true),
      ('pipelines.max',             1,    true,  3,     true, 10,     true, NULL,      true),
      ('custom_properties.max',     5,    true,  25,    true, 100,    true, NULL,      true),
      ('custom_objects.max',        0,    false, 0,     false, 3,     true, NULL,      true),
      ('email_templates.max',       3,    true,  25,    true, NULL,   true, NULL,      true),
      ('forms.max',                 1,    true,  5,     true, 25,     true, NULL,      true),
      ('dashboards.max',            1,    true,  5,     true, 25,     true, NULL,      true),
      ('sequences.active.max',      0,    false, 3,     true, 25,     true, NULL,      true),
      ('workflows.active.max',      1,    true,  10,    true, 50,     true, NULL,      true),
      ('whatsapp_numbers.max',      0,    false, 1,     true, 3,      true, NULL,      true),
      ('webhooks.max',              0,    false, 0,     false, 10,    true, NULL,      true),
      ('api_keys.max',              0,    false, 0,     false, 3,     true, NULL,      true),
      ('audit_log.days',            7,    true,  30,    true, 365,    true, NULL,      true),

      -- Cotas mensais
      ('email.sends.monthly',       50,   true,  1000,  true, 10000,  true, NULL,      true),
      ('email_broadcasts.monthly',  1,    true,  5,     true, 50,     true, NULL,      true),
      ('twilio.minutes.monthly',    30,   true,  500,   true, 2000,   true, NULL,      true),
      ('enrichment.monthly',        10,   true,  100,   true, 1000,   true, 10000,     true),
      ('ai_compose.monthly',        10,   true,  100,   true, 1000,   true, NULL,      true),
      ('ai_summaries.monthly',      5,    true,  50,    true, 500,    true, NULL,      true),

      -- Flags booleanas (limit_int = 0)
      ('feature.whatsapp_inbox',    0,    false, 0,     true,  0,     true, 0,         true),
      ('feature.whatsapp_campaigns',0,    false, 0,     false, 0,     true, 0,         true),
      ('feature.sequences',         0,    false, 0,     true,  0,     true, 0,         true),
      ('feature.workflows',         0,    true,  0,     true,  0,     true, 0,         true),
      ('feature.scoring_rules',     0,    false, 0,     true,  0,     true, 0,         true),
      ('feature.scoring_ai',        0,    false, 0,     false, 0,     true, 0,         true),
      ('feature.macros',            0,    false, 0,     true,  0,     true, 0,         true),
      ('feature.sla',               0,    false, 0,     false, 0,     true, 0,         true),
      ('feature.rotation',          0,    false, 0,     false, 0,     true, 0,         true),
      ('feature.playbooks',         0,    false, 0,     false, 0,     false,0,         true),
      ('feature.surveys',           0,    false, 0,     false, 0,     true, 0,         true),
      ('feature.goals',             0,    false, 0,     true,  0,     true, 0,         true),
      ('feature.scheduled_exports', 0,    false, 0,     false, 0,     true, 0,         true),
      ('feature.sentiment',         0,    false, 0,     false, 0,     true, 0,         true),
      ('feature.quotes',            0,    false, 0,     true,  0,     true, 0,         true),
      ('feature.recurring',         0,    false, 0,     false, 0,     true, 0,         true),
      ('feature.esign',             0,    false, 0,     false, 0,     false,0,         true),
      ('feature.tickets',           0,    false, 0,     true,  0,     true, 0,         true),
      ('feature.portal',            0,    false, 0,     false, 0,     true, 0,         true),
      ('feature.portal_whitelabel', 0,    false, 0,     false, 0,     false,0,         true),
      ('feature.booking',           0,    false, 0,     true,  0,     true, 0,         true),
      ('feature.hubspot_import',    0,    true,  0,     true,  0,     true, 0,         true),
      ('feature.google_calendar',   0,    true,  0,     true,  0,     true, 0,         true),
      ('feature.custom_roles',      0,    false, 0,     false, 0,     true, 0,         true),
      ('feature.branding_colors',   0,    false, 0,     false, 0,     true, 0,         true),
      ('feature.white_label',       0,    false, 0,     false, 0,     false,0,         true)
    ) AS t(key,
           fl, fe,
           bl, be,
           pl, pe,
           ol, oe)
  LOOP
    INSERT INTO public.plan_entitlements (plan_code, key, limit_int, enabled) VALUES
      ('free',   rec.key, rec.fl, rec.fe),
      ('bronze', rec.key, rec.bl, rec.be),
      ('prata',  rec.key, rec.pl, rec.pe),
      ('ouro',   rec.key, rec.ol, rec.oe);
  END LOOP;
END $$;

-- ============================================================
-- 9) Backfill: workspaces existentes recebem Ouro (cortesia)
-- ============================================================
INSERT INTO public.workspace_subscriptions (workspace_owner_id, plan_code, status)
SELECT DISTINCT p.id, 'ouro', 'active'
  FROM public.profiles p
ON CONFLICT (workspace_owner_id) DO NOTHING;