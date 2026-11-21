-- Physical, synthetic source tables for the generic producer regression tests.
-- The producer and both backfill predicates are loaded verbatim from production
-- migrations by the test. This fixture does not model or replace authorization.
CREATE SCHEMA auth;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
CREATE TABLE public.workspaces(id uuid PRIMARY KEY,created_by uuid);
CREATE TABLE public.workflow_events(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid,
  workspace_id uuid,
  entity text NOT NULL,
  entity_id uuid NOT NULL,
  event_type text NOT NULL CHECK(event_type IN('created','updated','stage_changed')),
  before jsonb,
  after jsonb,
  processed_at timestamptz
);
CREATE TABLE public.workflows(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  execution_user_id uuid,
  workspace_id uuid NOT NULL,
  entity text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'draft',
  published_version integer NOT NULL DEFAULT 1,
  trigger jsonb NOT NULL DEFAULT '{}',
  actions jsonb NOT NULL DEFAULT '[]',
  goal_filters jsonb
);
CREATE TABLE public.workflow_runs(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid,
  workspace_id uuid,
  owner_id uuid,
  event_id uuid,
  entity text,
  entity_id uuid,
  status text,
  log jsonb,
  error text,
  started_at timestamptz,
  finished_at timestamptz,
  UNIQUE(workflow_id,event_id)
);
-- Synthetic effect only: no external message, provider or business side effect.
-- No uniqueness here: an accidental second action must remain observable.
CREATE TABLE public.workflow_test_effects(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.workflow_runs(id),
  workflow_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  entity_id uuid NOT NULL,
  snapshot jsonb
);
DO $sources$
DECLARE source text;
BEGIN
  FOREACH source IN ARRAY ARRAY[
    'leads','contacts','companies','deals','tickets','ats_jobs','ats_candidates',
    'ats_applications','ats_interviews','projects','project_tasks','project_milestones',
    'contracts','financial_entries','bank_payments','quotes','proposals','services',
    'recurring_plans','subscription_invoices','customer_invoices','people'
  ] LOOP
    EXECUTE format('CREATE TABLE public.%I (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid,owner_id uuid,
      status text DEFAULT ''todo'',custom_status_id uuid,stage_id uuid,stage text,
      stage_value text,active boolean DEFAULT true,title text,company_id uuid,
      job_title text,size_description text,updated_at timestamptz DEFAULT now()
    )',source);
  END LOOP;
END $sources$;
