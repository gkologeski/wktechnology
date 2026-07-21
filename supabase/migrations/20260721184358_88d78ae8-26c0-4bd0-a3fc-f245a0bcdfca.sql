
-- =========================================================
-- TechPeople — Sprint 1: HRIS core (people, documents, events)
-- =========================================================

-- 1. Enums
DO $$ BEGIN
  CREATE TYPE public.people_employment_type AS ENUM ('pj', 'clt', 'contractor', 'intern', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.people_status AS ENUM ('active', 'bench', 'on_leave', 'offboarding', 'terminated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.people_doc_status AS ENUM ('valid', 'expiring', 'expired', 'missing');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================================
-- 2. people
-- =========================================================
CREATE TABLE public.people (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id              uuid NOT NULL,                -- workspace owner
  profile_id            uuid REFERENCES public.profiles(id) ON DELETE SET NULL, -- ERP user, if any
  candidate_id          uuid REFERENCES public.ats_candidates(id) ON DELETE SET NULL,
  manager_id            uuid,                          -- profiles.id of direct manager
  full_name             text NOT NULL,
  preferred_name        text,
  email                 text,
  phone                 text,
  photo_url             text,
  employment_type       public.people_employment_type NOT NULL DEFAULT 'pj',
  status                public.people_status NOT NULL DEFAULT 'active',
  role_title            text,
  seniority             text,
  location              text,
  timezone              text,
  hire_date             date,
  termination_date      date,
  -- PJ / company info
  legal_entity_name     text,
  cnpj                  text,
  -- Sensitive (admin only)
  cost_hour             numeric(14, 2),
  monthly_cost          numeric(14, 2),
  currency              text NOT NULL DEFAULT 'BRL',
  personal_doc          jsonb NOT NULL DEFAULT '{}'::jsonb,  -- RG, CPF, endereço (restrito)
  -- Meta
  tags                  text[] NOT NULL DEFAULT '{}',
  notes                 text,
  archived              boolean NOT NULL DEFAULT false,
  created_by            uuid,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX people_owner_idx      ON public.people(owner_id);
CREATE INDEX people_manager_idx    ON public.people(manager_id) WHERE manager_id IS NOT NULL;
CREATE INDEX people_profile_idx    ON public.people(profile_id) WHERE profile_id IS NOT NULL;
CREATE INDEX people_candidate_idx  ON public.people(candidate_id) WHERE candidate_id IS NOT NULL;
CREATE INDEX people_status_idx     ON public.people(owner_id, status) WHERE archived = false;
CREATE UNIQUE INDEX people_owner_candidate_uniq
  ON public.people(owner_id, candidate_id) WHERE candidate_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.people TO authenticated;
GRANT ALL ON public.people TO service_role;
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- 3. Access helpers (SECURITY DEFINER, avoid recursion)
-- =========================================================

-- Full access: workspace admin OR direct manager OR the person themself
CREATE OR REPLACE FUNCTION public.can_view_person(_person_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.people p
    WHERE p.id = _person_id
      AND (
        public.is_workspace_admin_v2(auth.uid(), p.owner_id)
        OR p.manager_id = auth.uid()
        OR p.profile_id = auth.uid()
      )
  );
$$;

-- Sensitive fields (cost, personal docs) — admin only
CREATE OR REPLACE FUNCTION public.can_view_person_sensitive(_person_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.people p
    WHERE p.id = _person_id
      AND public.is_workspace_admin_v2(auth.uid(), p.owner_id)
  );
$$;

-- Convenience: can current user modify person?
CREATE OR REPLACE FUNCTION public.can_manage_person(_person_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.people p
    WHERE p.id = _person_id
      AND public.is_workspace_admin_v2(auth.uid(), p.owner_id)
  );
$$;

-- =========================================================
-- 4. people RLS
-- =========================================================
CREATE POLICY people_select ON public.people
FOR SELECT TO authenticated
USING (
  public.is_workspace_admin_v2(auth.uid(), owner_id)
  OR manager_id = auth.uid()
  OR profile_id = auth.uid()
);

CREATE POLICY people_insert ON public.people
FOR INSERT TO authenticated
WITH CHECK (
  public.is_workspace_admin_v2(auth.uid(), owner_id)
);

CREATE POLICY people_update ON public.people
FOR UPDATE TO authenticated
USING (
  public.is_workspace_admin_v2(auth.uid(), owner_id)
)
WITH CHECK (
  public.is_workspace_admin_v2(auth.uid(), owner_id)
);

CREATE POLICY people_delete ON public.people
FOR DELETE TO authenticated
USING (
  public.is_workspace_admin_v2(auth.uid(), owner_id)
);

-- =========================================================
-- 5. people_documents
-- =========================================================
CREATE TABLE public.people_documents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      uuid NOT NULL,
  person_id     uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  doc_type      text NOT NULL,           -- rg, cpf, cnpj, contrato_social, foto, certidao_negativa, cnh, etc
  doc_number    text,
  issued_at     date,
  expires_at    date,
  file_url      text,
  file_name     text,
  status        public.people_doc_status NOT NULL DEFAULT 'valid',
  is_sensitive  boolean NOT NULL DEFAULT true,
  notes         text,
  created_by    uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX people_documents_person_idx  ON public.people_documents(person_id);
CREATE INDEX people_documents_owner_idx   ON public.people_documents(owner_id);
CREATE INDEX people_documents_expires_idx ON public.people_documents(owner_id, expires_at) WHERE expires_at IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.people_documents TO authenticated;
GRANT ALL ON public.people_documents TO service_role;
ALTER TABLE public.people_documents ENABLE ROW LEVEL SECURITY;

-- Only admins can see personal documents (they are sensitive by default)
CREATE POLICY people_documents_select ON public.people_documents
FOR SELECT TO authenticated
USING (
  public.is_workspace_admin_v2(auth.uid(), owner_id)
  OR (
    is_sensitive = false
    AND public.can_view_person(person_id)
  )
);

CREATE POLICY people_documents_write ON public.people_documents
FOR ALL TO authenticated
USING (public.is_workspace_admin_v2(auth.uid(), owner_id))
WITH CHECK (public.is_workspace_admin_v2(auth.uid(), owner_id));

-- =========================================================
-- 6. people_events (timeline)
-- =========================================================
CREATE TABLE public.people_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     uuid NOT NULL,
  person_id    uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  event_type   text NOT NULL,   -- hired, promoted, status_changed, doc_added, review_completed, alert, note, allocation, offboarded
  title        text NOT NULL,
  description  text,
  metadata     jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id     uuid,
  visible_to_person boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX people_events_person_idx ON public.people_events(person_id, created_at DESC);
CREATE INDEX people_events_owner_idx  ON public.people_events(owner_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.people_events TO authenticated;
GRANT ALL ON public.people_events TO service_role;
ALTER TABLE public.people_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY people_events_select ON public.people_events
FOR SELECT TO authenticated
USING (
  public.can_view_person(person_id)
  AND (
    visible_to_person = true
    OR public.is_workspace_admin_v2(auth.uid(), owner_id)
    OR EXISTS (SELECT 1 FROM public.people p WHERE p.id = people_events.person_id AND p.manager_id = auth.uid())
  )
);

CREATE POLICY people_events_write ON public.people_events
FOR ALL TO authenticated
USING (public.is_workspace_admin_v2(auth.uid(), owner_id))
WITH CHECK (public.is_workspace_admin_v2(auth.uid(), owner_id));

-- =========================================================
-- 7. updated_at triggers
-- =========================================================
CREATE OR REPLACE FUNCTION public.people_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER people_updated_at
BEFORE UPDATE ON public.people
FOR EACH ROW EXECUTE FUNCTION public.people_touch_updated_at();

CREATE TRIGGER people_documents_updated_at
BEFORE UPDATE ON public.people_documents
FOR EACH ROW EXECUTE FUNCTION public.people_touch_updated_at();

-- =========================================================
-- 8. Timeline auto-log on people changes
-- =========================================================
CREATE OR REPLACE FUNCTION public.people_log_event()
RETURNS trigger LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.people_events (owner_id, person_id, event_type, title, actor_id)
    VALUES (NEW.owner_id, NEW.id, 'hired', 'Pessoa cadastrada', NEW.created_by);
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.people_events (owner_id, person_id, event_type, title, description, actor_id)
    VALUES (NEW.owner_id, NEW.id, 'status_changed',
            'Status alterado: ' || OLD.status::text || ' → ' || NEW.status::text,
            NULL, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER people_log_event_trg
AFTER INSERT OR UPDATE OF status ON public.people
FOR EACH ROW EXECUTE FUNCTION public.people_log_event();

-- =========================================================
-- 9. Extend workflow_events entity CHECK to accept 'people'
-- =========================================================
ALTER TABLE public.workflow_events DROP CONSTRAINT IF EXISTS workflow_events_entity_check;
ALTER TABLE public.workflow_events ADD CONSTRAINT workflow_events_entity_check
CHECK (entity = ANY (ARRAY[
  'leads','contacts','companies','deals','tickets',
  'ats_jobs','ats_candidates','ats_applications','ats_interviews',
  'contracts','services','quotes','products','proposals',
  'customer_invoices','subscription_invoices','recurring_plans',
  'financial_entries','bank_payments',
  'projects','project_tasks','project_milestones',
  'people'
]));
