
-- =========================================================
-- Sprint 1 — Fundação: Contratos, Serviços, Projetos, Financeiro
-- =========================================================

-- ENUMS ---------------------------------------------------
CREATE TYPE public.contract_role AS ENUM ('provider','client');
CREATE TYPE public.contract_status AS ENUM (
  'draft','in_review','in_negotiation','awaiting_signature',
  'active','renewing','ended','terminated'
);
CREATE TYPE public.service_type AS ENUM ('one_time','recurring','usage_based','milestone');
CREATE TYPE public.service_status AS ENUM ('pending','active','paused','cancelled','completed');
CREATE TYPE public.service_cadence AS ENUM ('monthly','quarterly','yearly','on_delivery');
CREATE TYPE public.project_status AS ENUM ('planning','active','on_hold','done','cancelled');
CREATE TYPE public.project_task_status AS ENUM ('todo','doing','review','done');
CREATE TYPE public.project_member_role AS ENUM ('manager','contributor','viewer');
CREATE TYPE public.project_milestone_status AS ENUM ('pending','in_progress','done','cancelled');
CREATE TYPE public.financial_direction AS ENUM ('receivable','payable');
CREATE TYPE public.financial_origin_type AS ENUM ('contract','service','project_milestone','manual','expense');
CREATE TYPE public.financial_entry_status AS ENUM ('open','partial','paid','overdue','cancelled');
CREATE TYPE public.financial_category_kind AS ENUM ('revenue','expense');

-- =========================================================
-- CONTRACTS
-- =========================================================
CREATE TABLE public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  role public.contract_role NOT NULL DEFAULT 'provider',
  counterparty_company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  parent_contract_id UUID REFERENCES public.contracts(id) ON DELETE SET NULL,
  number TEXT,
  title TEXT NOT NULL,
  status public.contract_status NOT NULL DEFAULT 'draft',
  starts_at DATE,
  ends_at DATE,
  auto_renew BOOLEAN NOT NULL DEFAULT FALSE,
  notice_days INTEGER NOT NULL DEFAULT 30,
  total_value NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  readjustment_index TEXT,
  readjustment_period TEXT,
  payment_terms JSONB NOT NULL DEFAULT '{}'::jsonb,
  body_html TEXT,
  public_token TEXT UNIQUE,
  signed_at TIMESTAMPTZ,
  signed_pdf_path TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contracts TO authenticated;
GRANT ALL ON public.contracts TO service_role;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY ws_contracts_select ON public.contracts FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE POLICY ws_contracts_insert ON public.contracts FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT public.current_user_workspaces()) AND owner_id = auth.uid());
CREATE POLICY ws_contracts_update ON public.contracts FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()))
  WITH CHECK (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE POLICY ws_contracts_delete ON public.contracts FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE INDEX contracts_workspace_idx ON public.contracts(workspace_id);
CREATE INDEX contracts_deal_idx ON public.contracts(deal_id);
CREATE INDEX contracts_counterparty_idx ON public.contracts(counterparty_company_id);
CREATE INDEX contracts_status_idx ON public.contracts(status);
CREATE TRIGGER contracts_updated BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- SERVICES
-- =========================================================
CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  role public.contract_role NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  type public.service_type NOT NULL DEFAULT 'recurring',
  status public.service_status NOT NULL DEFAULT 'pending',
  quantity NUMERIC(14,4) NOT NULL DEFAULT 1,
  unit_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  cadence public.service_cadence,
  starts_at DATE,
  ends_at DATE,
  next_billing_at DATE,
  delivery_owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.services TO authenticated;
GRANT ALL ON public.services TO service_role;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY ws_services_select ON public.services FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE POLICY ws_services_insert ON public.services FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT public.current_user_workspaces()) AND owner_id = auth.uid());
CREATE POLICY ws_services_update ON public.services FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()))
  WITH CHECK (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE POLICY ws_services_delete ON public.services FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE INDEX services_workspace_idx ON public.services(workspace_id);
CREATE INDEX services_contract_idx ON public.services(contract_id);
CREATE INDEX services_status_idx ON public.services(status);
CREATE INDEX services_next_billing_idx ON public.services(next_billing_at)
  WHERE status = 'active';
CREATE TRIGGER services_updated BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- PROJECTS
-- =========================================================
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  contract_id UUID REFERENCES public.contracts(id) ON DELETE SET NULL,
  role public.contract_role NOT NULL DEFAULT 'provider',
  name TEXT NOT NULL,
  description TEXT,
  status public.project_status NOT NULL DEFAULT 'planning',
  starts_at DATE,
  due_at DATE,
  progress INTEGER NOT NULL DEFAULT 0,
  planned_hours NUMERIC(10,2),
  planned_cost NUMERIC(14,2),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY ws_projects_select ON public.projects FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE POLICY ws_projects_insert ON public.projects FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT public.current_user_workspaces()) AND owner_id = auth.uid());
CREATE POLICY ws_projects_update ON public.projects FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()))
  WITH CHECK (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE POLICY ws_projects_delete ON public.projects FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE INDEX projects_workspace_idx ON public.projects(workspace_id);
CREATE INDEX projects_service_idx ON public.projects(service_id);
CREATE INDEX projects_status_idx ON public.projects(status);
CREATE TRIGGER projects_updated BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- PROJECT MEMBERS -----------------------------------------
CREATE TABLE public.project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_in_project public.project_member_role NOT NULL DEFAULT 'contributor',
  cost_rate_hour NUMERIC(10,2),
  bill_rate_hour NUMERIC(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_members TO authenticated;
GRANT ALL ON public.project_members TO service_role;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY ws_project_members_select ON public.project_members FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE POLICY ws_project_members_insert ON public.project_members FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE POLICY ws_project_members_update ON public.project_members FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()))
  WITH CHECK (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE POLICY ws_project_members_delete ON public.project_members FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE INDEX project_members_project_idx ON public.project_members(project_id);
CREATE INDEX project_members_user_idx ON public.project_members(user_id);
CREATE TRIGGER project_members_updated BEFORE UPDATE ON public.project_members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- PROJECT MILESTONES --------------------------------------
CREATE TABLE public.project_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  due_at DATE,
  status public.project_milestone_status NOT NULL DEFAULT 'pending',
  billable BOOLEAN NOT NULL DEFAULT FALSE,
  bill_amount NUMERIC(14,2),
  financial_entry_id UUID,
  completed_at TIMESTAMPTZ,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_milestones TO authenticated;
GRANT ALL ON public.project_milestones TO service_role;
ALTER TABLE public.project_milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY ws_project_milestones_select ON public.project_milestones FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE POLICY ws_project_milestones_insert ON public.project_milestones FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE POLICY ws_project_milestones_update ON public.project_milestones FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()))
  WITH CHECK (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE POLICY ws_project_milestones_delete ON public.project_milestones FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE INDEX project_milestones_project_idx ON public.project_milestones(project_id);
CREATE TRIGGER project_milestones_updated BEFORE UPDATE ON public.project_milestones
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- PROJECT TASKS -------------------------------------------
CREATE TABLE public.project_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  milestone_id UUID REFERENCES public.project_milestones(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status public.project_task_status NOT NULL DEFAULT 'todo',
  assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  due_at DATE,
  estimated_hours NUMERIC(10,2),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_tasks TO authenticated;
GRANT ALL ON public.project_tasks TO service_role;
ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY ws_project_tasks_select ON public.project_tasks FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE POLICY ws_project_tasks_insert ON public.project_tasks FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE POLICY ws_project_tasks_update ON public.project_tasks FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()))
  WITH CHECK (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE POLICY ws_project_tasks_delete ON public.project_tasks FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE INDEX project_tasks_project_idx ON public.project_tasks(project_id);
CREATE INDEX project_tasks_status_idx ON public.project_tasks(status);
CREATE INDEX project_tasks_assignee_idx ON public.project_tasks(assignee_id);
CREATE TRIGGER project_tasks_updated BEFORE UPDATE ON public.project_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- PROJECT TIME ENTRIES ------------------------------------
CREATE TABLE public.project_time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.project_tasks(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  hours NUMERIC(6,2) NOT NULL CHECK (hours > 0),
  description TEXT,
  billable BOOLEAN NOT NULL DEFAULT TRUE,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_time_entries TO authenticated;
GRANT ALL ON public.project_time_entries TO service_role;
ALTER TABLE public.project_time_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY ws_project_time_entries_select ON public.project_time_entries FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE POLICY ws_project_time_entries_insert ON public.project_time_entries FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT public.current_user_workspaces()) AND user_id = auth.uid());
CREATE POLICY ws_project_time_entries_update ON public.project_time_entries FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()) AND (user_id = auth.uid() OR public.is_workspace_admin_v2(workspace_id, auth.uid())))
  WITH CHECK (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE POLICY ws_project_time_entries_delete ON public.project_time_entries FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()) AND (user_id = auth.uid() OR public.is_workspace_admin_v2(workspace_id, auth.uid())));
CREATE INDEX project_time_entries_project_idx ON public.project_time_entries(project_id);
CREATE INDEX project_time_entries_user_date_idx ON public.project_time_entries(user_id, entry_date);
CREATE TRIGGER project_time_entries_updated BEFORE UPDATE ON public.project_time_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- FINANCIAL: categories, bank accounts, entries, payments
-- =========================================================
CREATE TABLE public.financial_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.financial_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  code TEXT,
  kind public.financial_category_kind NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_categories TO authenticated;
GRANT ALL ON public.financial_categories TO service_role;
ALTER TABLE public.financial_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY ws_financial_categories_select ON public.financial_categories FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE POLICY ws_financial_categories_write ON public.financial_categories FOR ALL TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()) AND public.is_workspace_admin_v2(workspace_id, auth.uid()))
  WITH CHECK (workspace_id IN (SELECT public.current_user_workspaces()) AND public.is_workspace_admin_v2(workspace_id, auth.uid()));
CREATE INDEX financial_categories_workspace_idx ON public.financial_categories(workspace_id);
CREATE TRIGGER financial_categories_updated BEFORE UPDATE ON public.financial_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.financial_bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'bank',
  initial_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_bank_accounts TO authenticated;
GRANT ALL ON public.financial_bank_accounts TO service_role;
ALTER TABLE public.financial_bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY ws_financial_bank_accounts_select ON public.financial_bank_accounts FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE POLICY ws_financial_bank_accounts_write ON public.financial_bank_accounts FOR ALL TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()) AND public.is_workspace_admin_v2(workspace_id, auth.uid()))
  WITH CHECK (workspace_id IN (SELECT public.current_user_workspaces()) AND public.is_workspace_admin_v2(workspace_id, auth.uid()));
CREATE INDEX financial_bank_accounts_workspace_idx ON public.financial_bank_accounts(workspace_id);
CREATE TRIGGER financial_bank_accounts_updated BEFORE UPDATE ON public.financial_bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.financial_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  direction public.financial_direction NOT NULL,
  origin_type public.financial_origin_type NOT NULL DEFAULT 'manual',
  origin_id UUID,
  contract_id UUID REFERENCES public.contracts(id) ON DELETE SET NULL,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  counterparty_company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  category_id UUID REFERENCES public.financial_categories(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'BRL',
  competence_date DATE NOT NULL,
  due_date DATE NOT NULL,
  paid_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  status public.financial_entry_status NOT NULL DEFAULT 'open',
  payment_method TEXT,
  notes TEXT,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  external_ref TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_entries TO authenticated;
GRANT ALL ON public.financial_entries TO service_role;
ALTER TABLE public.financial_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY ws_financial_entries_select ON public.financial_entries FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE POLICY ws_financial_entries_insert ON public.financial_entries FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT public.current_user_workspaces()) AND owner_id = auth.uid());
CREATE POLICY ws_financial_entries_update ON public.financial_entries FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()))
  WITH CHECK (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE POLICY ws_financial_entries_delete ON public.financial_entries FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE INDEX financial_entries_workspace_idx ON public.financial_entries(workspace_id);
CREATE INDEX financial_entries_direction_status_idx ON public.financial_entries(direction, status);
CREATE INDEX financial_entries_due_date_idx ON public.financial_entries(due_date);
CREATE INDEX financial_entries_contract_idx ON public.financial_entries(contract_id);
CREATE INDEX financial_entries_service_idx ON public.financial_entries(service_id);
CREATE INDEX financial_entries_project_idx ON public.financial_entries(project_id);
CREATE INDEX financial_entries_counterparty_idx ON public.financial_entries(counterparty_company_id);
CREATE TRIGGER financial_entries_updated BEFORE UPDATE ON public.financial_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- FK diferido do milestone -> financial_entries
ALTER TABLE public.project_milestones
  ADD CONSTRAINT project_milestones_entry_fk
  FOREIGN KEY (financial_entry_id) REFERENCES public.financial_entries(id) ON DELETE SET NULL;

CREATE TABLE public.financial_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  entry_id UUID NOT NULL REFERENCES public.financial_entries(id) ON DELETE CASCADE,
  bank_account_id UUID REFERENCES public.financial_bank_accounts(id) ON DELETE SET NULL,
  paid_at DATE NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  method TEXT,
  reference TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_payments TO authenticated;
GRANT ALL ON public.financial_payments TO service_role;
ALTER TABLE public.financial_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY ws_financial_payments_select ON public.financial_payments FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE POLICY ws_financial_payments_insert ON public.financial_payments FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE POLICY ws_financial_payments_update ON public.financial_payments FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()))
  WITH CHECK (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE POLICY ws_financial_payments_delete ON public.financial_payments FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE INDEX financial_payments_entry_idx ON public.financial_payments(entry_id);
CREATE INDEX financial_payments_workspace_idx ON public.financial_payments(workspace_id);
CREATE TRIGGER financial_payments_updated BEFORE UPDATE ON public.financial_payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger: atualizar paid_amount/status ao inserir/atualizar/remover payment
CREATE OR REPLACE FUNCTION public.recalc_financial_entry(_entry_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total NUMERIC(14,2);
  v_amount NUMERIC(14,2);
  v_due DATE;
  v_status public.financial_entry_status;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO v_total FROM public.financial_payments WHERE entry_id = _entry_id;
  SELECT amount, due_date, status INTO v_amount, v_due, v_status FROM public.financial_entries WHERE id = _entry_id;
  IF v_amount IS NULL THEN RETURN; END IF;

  IF v_status = 'cancelled' THEN
    UPDATE public.financial_entries SET paid_amount = v_total WHERE id = _entry_id;
    RETURN;
  END IF;

  IF v_total >= v_amount THEN
    UPDATE public.financial_entries SET paid_amount = v_total, status = 'paid' WHERE id = _entry_id;
  ELSIF v_total > 0 THEN
    UPDATE public.financial_entries SET paid_amount = v_total, status = 'partial' WHERE id = _entry_id;
  ELSIF v_due < CURRENT_DATE THEN
    UPDATE public.financial_entries SET paid_amount = 0, status = 'overdue' WHERE id = _entry_id;
  ELSE
    UPDATE public.financial_entries SET paid_amount = 0, status = 'open' WHERE id = _entry_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.financial_payments_after_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_financial_entry(OLD.entry_id);
    RETURN OLD;
  ELSE
    PERFORM public.recalc_financial_entry(NEW.entry_id);
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER financial_payments_recalc
AFTER INSERT OR UPDATE OR DELETE ON public.financial_payments
FOR EACH ROW EXECUTE FUNCTION public.financial_payments_after_change();

-- =========================================================
-- Registrar módulos no catálogo
-- =========================================================
INSERT INTO public.modules (id, name, default_product_name, icon, sort_order)
VALUES
  ('contracts', 'Contratos', 'TechContracts', 'FileText', 30),
  ('services',  'Serviços',  'TechServices',  'Package',  31),
  ('projects',  'Projetos',  'TechProjects',  'Kanban',   32),
  ('finance',   'Financeiro','TechFinance',   'DollarSign', 33)
ON CONFLICT (id) DO NOTHING;
