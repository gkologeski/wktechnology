CREATE TABLE public.people_psychosocial_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  person_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  assessed_at DATE NOT NULL DEFAULT CURRENT_DATE,
  method TEXT NOT NULL DEFAULT 'self_report' CHECK (method IN ('self_report','manager','hr','anonymous_survey')),
  dimensions JSONB NOT NULL DEFAULT '{}'::jsonb,
  overall_score NUMERIC(4,2),
  risk_level TEXT NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low','moderate','high','critical')),
  burnout_signals BOOLEAN NOT NULL DEFAULT false,
  harassment_signals BOOLEAN NOT NULL DEFAULT false,
  action_plan TEXT,
  follow_up_at DATE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','archived')),
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_psych_person ON public.people_psychosocial_assessments(person_id, assessed_at DESC);
CREATE INDEX idx_psych_owner_risk ON public.people_psychosocial_assessments(owner_id, risk_level, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.people_psychosocial_assessments TO authenticated;
GRANT ALL ON public.people_psychosocial_assessments TO service_role;
ALTER TABLE public.people_psychosocial_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "psych_select_sensitive" ON public.people_psychosocial_assessments FOR SELECT TO authenticated
  USING (public.can_view_person_sensitive(person_id));
CREATE POLICY "psych_insert_manage" ON public.people_psychosocial_assessments FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_person(person_id));
CREATE POLICY "psych_update_manage" ON public.people_psychosocial_assessments FOR UPDATE TO authenticated
  USING (public.can_manage_person(person_id)) WITH CHECK (public.can_manage_person(person_id));
CREATE POLICY "psych_delete_manage" ON public.people_psychosocial_assessments FOR DELETE TO authenticated
  USING (public.can_manage_person(person_id));

CREATE TRIGGER trg_psych_updated_at BEFORE UPDATE ON public.people_psychosocial_assessments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.people_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  person_id UUID REFERENCES public.people(id) ON DELETE SET NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  category TEXT NOT NULL CHECK (category IN ('safety','harassment','discrimination','psychosocial','near_miss','accident','other')),
  severity TEXT NOT NULL DEFAULT 'low' CHECK (severity IN ('low','moderate','high','critical')),
  is_confidential BOOLEAN NOT NULL DEFAULT true,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  witnesses TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','investigating','resolved','archived')),
  resolution TEXT,
  resolved_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_incidents_person ON public.people_incidents(person_id, occurred_at DESC);
CREATE INDEX idx_incidents_owner ON public.people_incidents(owner_id, status, severity);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.people_incidents TO authenticated;
GRANT ALL ON public.people_incidents TO service_role;
ALTER TABLE public.people_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "incidents_select_sensitive" ON public.people_incidents FOR SELECT TO authenticated
  USING (
    (person_id IS NOT NULL AND public.can_view_person_sensitive(person_id))
    OR (person_id IS NULL AND public.is_workspace_admin_v2(owner_id, auth.uid()))
  );
CREATE POLICY "incidents_insert_manage" ON public.people_incidents FOR INSERT TO authenticated
  WITH CHECK (
    (person_id IS NOT NULL AND public.can_manage_person(person_id))
    OR (person_id IS NULL AND public.is_workspace_admin_v2(owner_id, auth.uid()))
  );
CREATE POLICY "incidents_update_manage" ON public.people_incidents FOR UPDATE TO authenticated
  USING (
    (person_id IS NOT NULL AND public.can_manage_person(person_id))
    OR (person_id IS NULL AND public.is_workspace_admin_v2(owner_id, auth.uid()))
  )
  WITH CHECK (
    (person_id IS NOT NULL AND public.can_manage_person(person_id))
    OR (person_id IS NULL AND public.is_workspace_admin_v2(owner_id, auth.uid()))
  );
CREATE POLICY "incidents_delete_admin" ON public.people_incidents FOR DELETE TO authenticated
  USING (public.is_workspace_admin_v2(owner_id, auth.uid()));

CREATE TRIGGER trg_incidents_updated_at BEFORE UPDATE ON public.people_incidents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();