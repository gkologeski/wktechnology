import { readFileSync } from "node:fs";
import type postgres from "postgres";

/** Physical shape only. Producers, proof, fingerprints and authorization load verbatim. */
export async function setupNotificationBusinessEvents(db: postgres.Sql) {
  await db.unsafe(`
    CREATE SCHEMA IF NOT EXISTS extensions;
    CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
    CREATE SCHEMA IF NOT EXISTS storage;
    CREATE TABLE public.view_as_test_records(record_id uuid PRIMARY KEY,workspace_id uuid,session_id uuid,table_name text);
    CREATE TABLE public.pipelines(id uuid PRIMARY KEY,workspace_id uuid,owner_id uuid,stages jsonb NOT NULL DEFAULT '[]');
    ALTER TABLE public.workflow_events ALTER COLUMN id SET DEFAULT gen_random_uuid(),
      ADD COLUMN before jsonb,ADD COLUMN after jsonb,ADD COLUMN resume_workflow_id uuid,
      ADD COLUMN resume_cursor integer,ADD COLUMN run_at timestamptz NOT NULL DEFAULT now(),
      ADD COLUMN created_at timestamptz NOT NULL DEFAULT clock_timestamp(),ADD COLUMN processed_at timestamptz;
    ALTER TABLE public.workflow_runs ALTER COLUMN id SET DEFAULT gen_random_uuid(),
      ADD COLUMN started_at timestamptz NOT NULL DEFAULT now(),ADD COLUMN finished_at timestamptz,
      ADD COLUMN log jsonb,ADD COLUMN error text;
    CREATE UNIQUE INDEX notification_business_fixture_run_dedupe ON public.workflow_runs(workflow_id,event_id);
    ALTER TABLE public.workflows ADD COLUMN last_published_at timestamptz;
    ALTER TABLE public.workflow_approvals ADD COLUMN decided_at timestamptz,ADD COLUMN comment text,
      ADD COLUMN decided_by uuid,ADD COLUMN decision_comment text,ADD COLUMN updated_at timestamptz DEFAULT now(),
      ADD COLUMN resume_cursor integer,ADD COLUMN event_snapshot jsonb;
    ALTER TABLE public.deals ADD COLUMN stage text,ADD COLUMN stage_id text,ADD COLUMN pipeline_id uuid,
      ADD COLUMN name text,ADD COLUMN company_id uuid,ADD COLUMN updated_at timestamptz DEFAULT now();
    ALTER TABLE public.proposals ADD COLUMN deal_id uuid,ADD COLUMN quote_id uuid,ADD COLUMN company_id uuid,
      ADD COLUMN contact_id uuid,ADD COLUMN locked boolean NOT NULL DEFAULT false,ADD COLUMN decided_at timestamptz,
      ADD COLUMN version integer NOT NULL DEFAULT 1,ADD COLUMN sent_at timestamptz,ADD COLUMN expires_at timestamptz;
    ALTER TABLE public.quotes ADD COLUMN deal_id uuid,ADD COLUMN company_id uuid,ADD COLUMN contact_id uuid,ADD COLUMN template_id uuid;
    ALTER TABLE public.contract_drafts ADD COLUMN deal_id uuid,ADD COLUMN proposal_id uuid,ADD COLUMN status text,
      ADD COLUMN public_token text,ADD COLUMN decided_at timestamptz,ADD COLUMN client_decided_at timestamptz,
      ADD COLUMN client_acceptance_bypassed_at timestamptz,ADD COLUMN revision integer NOT NULL DEFAULT 1;
    ALTER TABLE public.contracts ADD COLUMN title text,ADD COLUMN number text,ADD COLUMN body_html text,
      ADD COLUMN starts_at date,ADD COLUMN ends_at date,ADD COLUMN auto_renew boolean DEFAULT false,
      ADD COLUMN notice_days integer,ADD COLUMN signed_at timestamptz,ADD COLUMN total_value numeric,
      ADD COLUMN currency text DEFAULT 'BRL',ADD COLUMN contracting_legal_entity_id uuid,
      ADD COLUMN counterparty_company_id uuid,ADD COLUMN deal_id uuid;
    ALTER TABLE public.companies ADD COLUMN name text,ADD COLUMN cnpj text,ADD COLUMN website text;
    ALTER TABLE public.contacts ADD COLUMN first_name text,ADD COLUMN last_name text,ADD COLUMN email text;
    ALTER TABLE public.services ADD COLUMN contract_id uuid;
    CREATE TABLE public.legal_entities(id uuid PRIMARY KEY,workspace_id uuid,name text,cnpj text);
    CREATE TABLE public.contract_attachments(id uuid PRIMARY KEY,workspace_id uuid,contract_id uuid,
      kind text,file_name text,source_id uuid,source_stamp text,sha256 text,ready boolean DEFAULT false,created_at timestamptz DEFAULT now());
    CREATE TABLE public.quote_line_items(id uuid PRIMARY KEY,workspace_id uuid,quote_id uuid,service_catalog_id uuid,contracting_preset_id uuid);
    CREATE TABLE public.deal_line_items(id uuid PRIMARY KEY,workspace_id uuid,deal_id uuid,service_catalog_id uuid,contracting_preset_id uuid);
    CREATE TABLE public.service_catalog(id uuid PRIMARY KEY,workspace_id uuid,name text);
    CREATE TABLE public.contracting_presets(id uuid PRIMARY KEY,workspace_id uuid,name text);
    CREATE TABLE public.quote_templates(id uuid PRIMARY KEY,workspace_id uuid,html text);
    CREATE TABLE public.esign_documents(id uuid PRIMARY KEY,workspace_id uuid,status text,body text,content_hash text,
      completed_at timestamptz,sealed_at timestamptz,expires_at timestamptz);
    CREATE TABLE public.esign_signers(id uuid PRIMARY KEY,workspace_id uuid,document_id uuid,status text,signed_at timestamptz);
    CREATE TABLE public.ats_offers(id uuid PRIMARY KEY,esign_document_id uuid);
    CREATE TABLE public.hiring_contract_evidence(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid,contract_id uuid,
      kind text,contract_hash text,document_id uuid,document_hash text,customer_signer_id uuid,issuer_signer_id uuid,file_path text,file_hash text,
      recorded_by uuid,revoked_at timestamptz);
    CREATE TABLE public.contract_forsign_operations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid,contract_id uuid,
      evidence_id uuid,status text,operation_id text,contract_hash text);
    CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text,name text,user_metadata jsonb);
    GRANT ALL ON public.pipelines,public.esign_documents,public.esign_signers,public.ats_offers,
      public.hiring_contract_evidence,public.contract_forsign_operations,storage.objects TO service_role;
  `);
  await loadNotificationBusinessFunction(
    db,
    "drizzle/migrations/0047_view_as_role_test_records.sql",
    "is_test_record",
  );
  await loadNotificationBusinessFunction(
    db,
    "drizzle/migrations/0172_techprojects_cycle2_deal_delivery.sql",
    "deal_stage_type",
  );
  await loadNotificationBusinessFunction(
    db,
    "drizzle/migrations/0222_order4_sales_prepare.sql",
    "techerp_api.sales_approval_decide",
  );
  await loadNotificationBusinessFunction(
    db,
    "drizzle/migrations/0222_order4_sales_prepare.sql",
    "sales_workflow_approval_decide",
  );
  // Original non-bypass subject ownership/ACL and final 0223 approval policies.
  await db.unsafe(`
    ALTER FUNCTION techerp_api.sales_approval_decide(uuid,uuid,uuid,text,text,integer) OWNER TO techerp_api_subject;
    REVOKE ALL ON FUNCTION techerp_api.sales_approval_decide(uuid,uuid,uuid,text,text,integer) FROM PUBLIC,anon,authenticated,service_role;
    GRANT EXECUTE ON FUNCTION techerp_api.sales_approval_decide(uuid,uuid,uuid,text,text,integer) TO postgres;
    REVOKE ALL ON FUNCTION public.sales_workflow_approval_decide(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
    GRANT EXECUTE ON FUNCTION public.sales_workflow_approval_decide(uuid,uuid,text,text) TO service_role;
    ALTER TABLE public.workflow_approvals ENABLE ROW LEVEL SECURITY;
    GRANT SELECT ON public.workflow_approvals TO authenticated;
    CREATE POLICY sales_approval_source ON public.workflow_approvals AS RESTRICTIVE FOR SELECT TO authenticated USING(workspace_id=(sales_access_context()->>'workspace')::uuid AND sales_event_reference_access(entity,entity_id));
    CREATE POLICY sales_view ON public.workflow_approvals FOR SELECT TO authenticated USING(sales_approval_access((SELECT sales_access_context()),workspace_id,approver_user_id,'view',entity,entity_id));
    CREATE POLICY sales_decide ON public.workflow_approvals FOR UPDATE TO techerp_api_subject USING(status='pending' AND sales_approval_access((SELECT sales_access_context()),workspace_id,approver_user_id,'manage',entity,entity_id)) WITH CHECK(sales_approval_access((SELECT sales_access_context()),workspace_id,approver_user_id,'manage',entity,entity_id));
    REVOKE INSERT,UPDATE,DELETE ON public.workflow_approvals FROM authenticated,anon;
    GRANT UPDATE(status,decided_at,decided_by,decision_comment,updated_at) ON public.workflow_approvals TO techerp_api_subject;
  `);
  // Real HTTP event/run feeds use the final 0223 policies, including the source
  // restriction; no fixture permission predicate stands in for those gates.
  await db.unsafe(`
    ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.workflow_events ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.workflow_runs ENABLE ROW LEVEL SECURITY;
    GRANT SELECT ON public.workflows,public.workflow_events,public.workflow_runs TO authenticated;
    REVOKE INSERT,UPDATE,DELETE ON public.workflow_events FROM authenticated,anon;
    -- Extend the base fixture's independent restrictive-policy seam to this
    -- newly exercised source. The toggle alone cannot restrict an unbound table.
    CREATE POLICY notification_business_fixture_restriction ON public.proposals AS RESTRICTIVE FOR SELECT TO authenticated USING(public.notification_fixture_restriction(id));
  `);
  const salesPolicies = readFileSync("drizzle/migrations/0223_order4_sales_activate.sql", "utf8");
  for (const prefix of [
    'CREATE POLICY sales_view ON public."workflows" FOR SELECT',
    'CREATE POLICY sales_view ON public."workflow_runs" FOR SELECT',
    "CREATE POLICY sales_view ON public.workflow_events FOR SELECT",
    "CREATE POLICY sales_run_source ON public.workflow_runs AS RESTRICTIVE FOR SELECT",
  ]) {
    const statement = salesPolicies.split("\n").find((line) => line.startsWith(prefix));
    if (!statement) throw Error("Missing production read policy: " + prefix);
    await db.unsafe(statement);
  }
  await loadNotificationBusinessFunction(
    db,
    "drizzle/migrations/0378_hiring_signature_adapter.sql",
    "hiring_contract_fingerprint_without_attachments",
  );
  await loadNotificationBusinessFunction(
    db,
    "drizzle/migrations/0367_contract_signature_packages.sql",
    "contract_attachment_source_stamp",
  );
  await loadNotificationBusinessFunction(
    db,
    "drizzle/migrations/0367_contract_signature_packages.sql",
    "hiring_contract_fingerprint",
  );
  await db.unsafe(
    "REVOKE ALL ON FUNCTION public.hiring_contract_fingerprint(uuid),public.hiring_contract_fingerprint_without_attachments(uuid),public.contract_attachment_source_stamp(uuid) FROM PUBLIC,anon,authenticated,service_role",
  );
  await db.unsafe(readFileSync("drizzle/migrations/0397_notification_sales_contracts.sql", "utf8"));
}

/** Extract exact production definitions; this helper supplies no permission substitutes. */
export async function loadNotificationBusinessFunction(
  db: postgres.Sql,
  file: string,
  name: string,
) {
  const source = readFileSync(file, "utf8").replaceAll(
    "CREATE FUNCTION ",
    "CREATE OR REPLACE FUNCTION ",
  );
  const start = source.lastIndexOf(
    "CREATE OR REPLACE FUNCTION " + (name.includes(".") ? name : "public." + name) + "(",
  );
  if (start < 0) throw Error("Missing production function " + name);
  const tail = source.slice(start),
    opening = /\bAS\s+(\$[a-z_]*\$)/i.exec(tail);
  if (!opening) throw Error("Missing production function body " + name);
  const end = tail.indexOf(opening[1], opening.index + opening[0].length);
  if (end < 0) throw Error("Incomplete production function " + name);
  await db.unsafe(tail.slice(0, end + opening[1].length) + ";");
}
