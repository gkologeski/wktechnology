
-- ============================================================
-- 1. SAVED VIEWS, LAYOUTS, AUDIT LOG
-- ============================================================
CREATE TABLE public.saved_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  entity text NOT NULL CHECK (entity IN ('leads','contacts','companies','deals')),
  name text NOT NULL,
  is_shared boolean NOT NULL DEFAULT false,
  is_default boolean NOT NULL DEFAULT false,
  filters jsonb NOT NULL DEFAULT '{"op":"and","conditions":[]}'::jsonb,
  quick_filters jsonb NOT NULL DEFAULT '[]'::jsonb,
  column_order text[] DEFAULT NULL,
  sort_by text DEFAULT 'created_at',
  sort_dir text DEFAULT 'desc' CHECK (sort_dir IN ('asc','desc')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.saved_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY saved_views_select ON public.saved_views FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR is_shared = true);
CREATE POLICY saved_views_modify ON public.saved_views FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE TRIGGER saved_views_set_updated BEFORE UPDATE ON public.saved_views
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.record_layouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  entity text NOT NULL CHECK (entity IN ('leads','contacts','companies','deals')),
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, entity)
);
ALTER TABLE public.record_layouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY record_layouts_owner ON public.record_layouts FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE TRIGGER record_layouts_set_updated BEFORE UPDATE ON public.record_layouts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.property_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  entity text NOT NULL CHECK (entity IN ('leads','contacts','companies','deals')),
  entity_id uuid NOT NULL,
  property text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.property_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY property_history_owner ON public.property_history FOR SELECT TO authenticated
  USING (owner_id = auth.uid());
CREATE INDEX idx_property_history_entity ON public.property_history (entity, entity_id, changed_at DESC);

-- Generic audit trigger: writes one row per changed column
CREATE OR REPLACE FUNCTION public.log_property_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  k text;
  old_v jsonb;
  new_v jsonb;
  entity_name text := TG_ARGV[0];
  skip_cols text[] := ARRAY['updated_at','created_at','id','owner_id'];
BEGIN
  IF TG_OP = 'UPDATE' THEN
    FOR k IN SELECT jsonb_object_keys(to_jsonb(NEW)) LOOP
      IF k = ANY(skip_cols) THEN CONTINUE; END IF;
      old_v := to_jsonb(OLD)->k;
      new_v := to_jsonb(NEW)->k;
      IF old_v IS DISTINCT FROM new_v THEN
        INSERT INTO public.property_history (owner_id, entity, entity_id, property, old_value, new_value, changed_by)
        VALUES (NEW.owner_id, entity_name, NEW.id, k, old_v, new_v, auth.uid());
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER leads_audit AFTER UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.log_property_changes('leads');
CREATE TRIGGER contacts_audit AFTER UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.log_property_changes('contacts');
CREATE TRIGGER companies_audit AFTER UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.log_property_changes('companies');
CREATE TRIGGER deals_audit AFTER UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.log_property_changes('deals');

-- ============================================================
-- 2. PIPELINES
-- ============================================================
CREATE TABLE public.pipelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  entity text NOT NULL CHECK (entity IN ('leads','deals')),
  name text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  stages jsonb NOT NULL DEFAULT '[]'::jsonb,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pipelines ENABLE ROW LEVEL SECURITY;
CREATE POLICY pipelines_owner ON public.pipelines FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE TRIGGER pipelines_set_updated BEFORE UPDATE ON public.pipelines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.leads ADD COLUMN pipeline_id uuid;
ALTER TABLE public.deals ADD COLUMN pipeline_id uuid;

-- ============================================================
-- 3. SCORING / LABELS / TARGET ACCOUNTS / OUTCOMES
-- ============================================================
ALTER TABLE public.leads ADD COLUMN score integer NOT NULL DEFAULT 0;
ALTER TABLE public.leads ADD COLUMN label text;
ALTER TABLE public.contacts ADD COLUMN score integer NOT NULL DEFAULT 0;
ALTER TABLE public.contacts ADD COLUMN label text;
ALTER TABLE public.companies ADD COLUMN is_target_account boolean NOT NULL DEFAULT false;
ALTER TABLE public.companies ADD COLUMN target_account_tier text;
ALTER TABLE public.activities ADD COLUMN outcome text;
ALTER TABLE public.activities ADD COLUMN outcome_set_at timestamptz;

CREATE TABLE public.scoring_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  entity text NOT NULL CHECK (entity IN ('leads','contacts')),
  name text NOT NULL,
  condition jsonb NOT NULL DEFAULT '{}'::jsonb,
  points integer NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.scoring_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY scoring_rules_owner ON public.scoring_rules FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- ============================================================
-- 4. TEAM MEMBERS
-- ============================================================
CREATE TYPE public.team_role AS ENUM ('owner','admin','member');
CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_owner_id uuid NOT NULL,
  member_user_id uuid NOT NULL,
  role public.team_role NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_owner_id, member_user_id)
);
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY team_members_select ON public.team_members FOR SELECT TO authenticated
  USING (workspace_owner_id = auth.uid() OR member_user_id = auth.uid());
CREATE POLICY team_members_owner_modify ON public.team_members FOR ALL TO authenticated
  USING (workspace_owner_id = auth.uid()) WITH CHECK (workspace_owner_id = auth.uid());

-- ============================================================
-- 5. SEGMENTS
-- ============================================================
CREATE TABLE public.segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  entity text NOT NULL CHECK (entity IN ('leads','contacts','companies','deals')),
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'static' CHECK (kind IN ('static','dynamic')),
  filters jsonb NOT NULL DEFAULT '{"op":"and","conditions":[]}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.segments ENABLE ROW LEVEL SECURITY;
CREATE POLICY segments_owner ON public.segments FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE TRIGGER segments_set_updated BEFORE UPDATE ON public.segments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.segment_members (
  segment_id uuid NOT NULL REFERENCES public.segments(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (segment_id, entity_id)
);
ALTER TABLE public.segment_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY segment_members_owner ON public.segment_members FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.segments s WHERE s.id = segment_id AND s.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.segments s WHERE s.id = segment_id AND s.owner_id = auth.uid()));

-- ============================================================
-- 6. SEQUENCES
-- ============================================================
CREATE TABLE public.sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  entity text NOT NULL CHECK (entity IN ('leads','contacts')),
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY sequences_owner ON public.sequences FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE TRIGGER sequences_set_updated BEFORE UPDATE ON public.sequences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.sequence_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id uuid NOT NULL REFERENCES public.sequences(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  entity_id uuid NOT NULL,
  current_step integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','completed','removed')),
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  next_run_at timestamptz,
  finished_at timestamptz
);
ALTER TABLE public.sequence_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY sequence_enrollments_owner ON public.sequence_enrollments FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- ============================================================
-- 7. WORKFLOWS
-- ============================================================
CREATE TABLE public.workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  entity text NOT NULL CHECK (entity IN ('leads','contacts','companies','deals')),
  trigger jsonb NOT NULL DEFAULT '{}'::jsonb,
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
CREATE POLICY workflows_owner ON public.workflows FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE TRIGGER workflows_set_updated BEFORE UPDATE ON public.workflows
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 8. GDPR / SUBSCRIPTIONS
-- ============================================================
ALTER TABLE public.contacts ADD COLUMN marketing_status text DEFAULT 'non-marketing' CHECK (marketing_status IN ('marketing','non-marketing'));
ALTER TABLE public.contacts ADD COLUMN legal_basis text;
ALTER TABLE public.contacts ADD COLUMN consent_date timestamptz;

CREATE TABLE public.subscription_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.subscription_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY subscription_types_owner ON public.subscription_types FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TABLE public.contact_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL,
  subscription_type_id uuid NOT NULL REFERENCES public.subscription_types(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  opted_in boolean NOT NULL DEFAULT true,
  source text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contact_id, subscription_type_id)
);
ALTER TABLE public.contact_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY contact_subscriptions_owner ON public.contact_subscriptions FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- ============================================================
-- 9. PLAYBOOKS
-- ============================================================
CREATE TABLE public.playbooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  entity text NOT NULL CHECK (entity IN ('leads','contacts','companies','deals')),
  content jsonb NOT NULL DEFAULT '[]'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.playbooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY playbooks_owner ON public.playbooks FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE TRIGGER playbooks_set_updated BEFORE UPDATE ON public.playbooks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.playbook_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_id uuid NOT NULL REFERENCES public.playbooks(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  entity text NOT NULL,
  entity_id uuid NOT NULL,
  responses jsonb NOT NULL DEFAULT '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.playbook_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY playbook_responses_owner ON public.playbook_responses FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- ============================================================
-- 10. LEAD AUTO-ADVANCE TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION public.auto_advance_lead_stage()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.related_lead_id IS NOT NULL AND NEW.type IN ('email','call','meeting') THEN
    UPDATE public.leads
       SET status = 'contacted'
     WHERE id = NEW.related_lead_id
       AND status = 'new';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER activities_auto_advance_lead
  AFTER INSERT ON public.activities
  FOR EACH ROW EXECUTE FUNCTION public.auto_advance_lead_stage();

-- ============================================================
-- 11. INDEXES
-- ============================================================
CREATE INDEX idx_saved_views_owner_entity ON public.saved_views (owner_id, entity);
CREATE INDEX idx_segment_members_segment ON public.segment_members (segment_id);
CREATE INDEX idx_pipelines_owner_entity ON public.pipelines (owner_id, entity);
CREATE INDEX idx_sequence_enrollments_next_run ON public.sequence_enrollments (next_run_at) WHERE status = 'active';
CREATE INDEX idx_leads_score ON public.leads (owner_id, score DESC);
CREATE INDEX idx_companies_target ON public.companies (owner_id, is_target_account) WHERE is_target_account = true;
