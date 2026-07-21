
CREATE TABLE public.people_benefits (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        uuid NOT NULL,
  person_id       uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  benefit_type    text NOT NULL,
  provider        text,
  plan_name       text,
  monthly_value   numeric(14,2) NOT NULL DEFAULT 0,
  employee_share  numeric(14,2) NOT NULL DEFAULT 0,
  currency        text NOT NULL DEFAULT 'BRL',
  starts_on       date,
  ends_on         date,
  active          boolean NOT NULL DEFAULT true,
  notes           text,
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT people_benefits_monthly_nonneg CHECK (monthly_value >= 0),
  CONSTRAINT people_benefits_share_nonneg   CHECK (employee_share >= 0)
);

CREATE INDEX people_benefits_owner_idx   ON public.people_benefits(owner_id);
CREATE INDEX people_benefits_person_idx  ON public.people_benefits(person_id);
CREATE INDEX people_benefits_active_idx  ON public.people_benefits(person_id, active) WHERE active = true;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.people_benefits TO authenticated;
GRANT ALL ON public.people_benefits TO service_role;

ALTER TABLE public.people_benefits ENABLE ROW LEVEL SECURITY;

CREATE POLICY people_benefits_select ON public.people_benefits
FOR SELECT TO authenticated
USING (
  public.is_workspace_admin_v2(auth.uid(), owner_id)
  OR public.can_view_person(person_id)
);

CREATE POLICY people_benefits_write ON public.people_benefits
FOR ALL TO authenticated
USING (public.is_workspace_admin_v2(auth.uid(), owner_id))
WITH CHECK (public.is_workspace_admin_v2(auth.uid(), owner_id));

CREATE TRIGGER people_benefits_updated_at
BEFORE UPDATE ON public.people_benefits
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE VIEW public.people_total_cost
WITH (security_invoker = true) AS
SELECT
  p.id                                     AS person_id,
  p.owner_id                               AS owner_id,
  p.full_name                              AS full_name,
  p.employment_type                        AS employment_type,
  p.status                                 AS status,
  p.monthly_cost                           AS monthly_cost,
  COALESCE(b.total_benefits, 0)            AS benefits_total,
  COALESCE(p.monthly_cost, 0) + COALESCE(b.total_benefits, 0) AS total_cost_monthly
FROM public.people p
LEFT JOIN (
  SELECT person_id, SUM(monthly_value) AS total_benefits
  FROM public.people_benefits
  WHERE active = true
    AND (starts_on IS NULL OR starts_on <= CURRENT_DATE)
    AND (ends_on   IS NULL OR ends_on   >= CURRENT_DATE)
  GROUP BY person_id
) b ON b.person_id = p.id;

GRANT SELECT ON public.people_total_cost TO authenticated;
