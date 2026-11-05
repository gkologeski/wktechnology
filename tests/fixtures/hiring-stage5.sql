-- Platform columns needed by the production billing migration; disposable SQL only.
CREATE TYPE financial_origin_type AS ENUM('manual','contract','service','project_milestone');
ALTER TABLE services ADD COLUMN status text DEFAULT 'active',ADD COLUMN type text DEFAULT 'recurring',ADD COLUMN cadence text DEFAULT 'monthly',ADD COLUMN starts_at date,ADD COLUMN ends_at date,ADD COLUMN percent numeric,ADD COLUMN percent_base_amount numeric,ADD COLUMN next_billing_at timestamptz,ADD COLUMN role text DEFAULT 'provider';
ALTER TABLE people_allocations ADD COLUMN service_id uuid;
ALTER TABLE project_time_entries ADD COLUMN user_id uuid,ADD COLUMN person_id uuid,ADD COLUMN allocation_id uuid,ADD COLUMN entry_date date,ADD COLUMN status text DEFAULT 'draft',ADD COLUMN source text DEFAULT 'manual',ADD COLUMN billable boolean DEFAULT true,ADD COLUMN started_at timestamptz,ADD COLUMN stopped_at timestamptz,ADD COLUMN duration_minutes int,ADD COLUMN hours numeric,ADD COLUMN duration_seconds bigint,ADD COLUMN financial_entry_id uuid,ADD COLUMN invoiced_at timestamptz,ADD COLUMN invoice_id uuid,ADD COLUMN period_closing_id uuid,ADD COLUMN client_acceptance_id uuid,ADD COLUMN revision int DEFAULT 1;
CREATE TABLE project_milestones(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid,project_id uuid,name text,status text,completed_at timestamptz,billable boolean,bill_amount numeric,financial_entry_id uuid,created_by uuid);
CREATE TABLE project_period_closings(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid,status text,scope text,project_id uuid,user_id uuid,period_from date,period_to date);
CREATE TABLE financial_entries(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid,owner_id uuid,direction text,origin_type financial_origin_type,origin_id uuid,contract_id uuid,service_id uuid,project_id uuid,counterparty_company_id uuid,legal_entity_id uuid,description text,amount numeric,currency text,competence_date date,due_date date,status text,external_ref text,metadata jsonb,notes text,paid_amount numeric DEFAULT 0,created_at timestamptz DEFAULT now());
CREATE UNIQUE INDEX fixture_fe_external ON financial_entries(workspace_id,external_ref) WHERE external_ref IS NOT NULL;
CREATE TABLE financial_payments(id uuid,entry_id uuid,amount numeric);
CREATE TABLE bank_charges(id uuid,financial_entry_id uuid,status text);
CREATE TABLE bank_payments(id uuid,financial_entry_id uuid,status text);
CREATE TABLE project_reconciliation_issues(workspace_id uuid,status text);
ALTER TABLE ats_offers ADD COLUMN application_id uuid;
CREATE FUNCTION current_user_workspaces() RETURNS SETOF uuid LANGUAGE sql STABLE AS $$ SELECT active_workspace_id FROM profiles WHERE id=auth.uid() $$;
CREATE FUNCTION project_time_assert_actor(w uuid,b boolean) RETURNS void LANGUAGE plpgsql STABLE AS $$ BEGIN IF NOT is_workspace_member(w,auth.uid()) OR NOT EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid() AND active_workspace_id=w) OR (b AND is_read_only_view()) THEN RAISE EXCEPTION 'actor not allowed' USING ERRCODE='42501';END IF;END $$;
CREATE FUNCTION project_time_tz_valid(t text) RETURNS boolean LANGUAGE sql STABLE AS $$SELECT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=t)$$;
CREATE FUNCTION project_entry_seconds(a timestamptz,b timestamptz,m integer,h numeric) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$SELECT coalesce(extract(epoch FROM b-a),m*60,h*3600,0)$$;

CREATE TABLE ats_hiring_decisions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid,application_id uuid,actor_id uuid,event text,created_at timestamptz DEFAULT now());
CREATE TYPE perm_action AS ENUM('view','create','update','delete','export','approve','assign','manage');
CREATE TYPE perm_scope AS ENUM('own','team','workspace','org');
ALTER TABLE permissions ALTER COLUMN action TYPE perm_action USING action::perm_action,ALTER COLUMN scope TYPE perm_scope USING scope::perm_scope;

ALTER TABLE shared_field_catalog ADD COLUMN guard_fields text[];
