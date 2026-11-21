import { readFileSync } from "node:fs";
import type postgres from "postgres";
import { loadNotificationBusinessFunction as load } from "./notification-business-events";
import { setupNotificationHirePeopleEmployment } from "./notification-hire-people-employment";

const migration = (name: string) => `drizzle/migrations/${name}.sql`;
const offers = migration("0206_ats_offer_approval_boundaries");
const preparation = migration("0375_hiring_preparation_approvals");
const esign = "supabase/migrations/20260519191027_0ff4d7ed-582a-4195-a34b-e34969225c38.sql";

function statement(file: string, prefix: string) {
  const source = readFileSync(file, "utf8");
  const start = source.indexOf(prefix);
  if (start < 0) throw Error(`Missing canonical DDL: ${file}::${prefix}`);
  const end = source.indexOf(";", start);
  if (end < 0) throw Error(`Incomplete canonical DDL: ${file}::${prefix}`);
  return source.slice(start, end + 1);
}

/** Additive physical shape. Authorization, signing, approval and P10 use real SQL. */
export async function setupNotificationHirePeople(db: postgres.Sql) {
  await db.unsafe(`
    DO $$ BEGIN
      IF to_regtype('public.people_employment_type') IS NULL THEN CREATE TYPE public.people_employment_type AS ENUM('pj','clt','contractor','intern','other');END IF;
      IF to_regtype('public.people_doc_status') IS NULL THEN CREATE TYPE public.people_doc_status AS ENUM('valid','expiring','expired','missing');END IF;
      IF to_regtype('public.esign_signer_status') IS NULL THEN CREATE TYPE public.esign_signer_status AS ENUM('pending','viewed','signed','declined');END IF;
      IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='techerp_request_writer') THEN CREATE ROLE techerp_request_writer NOLOGIN NOSUPERUSER NOBYPASSRLS INHERIT;END IF;
    END $$;
    GRANT authenticated TO techerp_request_writer;GRANT USAGE ON SCHEMA public,auth TO techerp_request_writer;
    ALTER TABLE public.people ADD COLUMN full_name text,ADD COLUMN email text,ADD COLUMN phone text,ADD COLUMN location text,
      ADD COLUMN candidate_id uuid,ADD COLUMN employment_type public.people_employment_type,
      ADD COLUMN hire_date date,ADD COLUMN termination_date date,ADD COLUMN role_title text,
      ADD COLUMN hiring_legal_entity_id uuid,ADD COLUMN created_at timestamptz DEFAULT now(),ADD COLUMN updated_at timestamptz DEFAULT now(),
      ADD COLUMN cost_hour numeric,ADD COLUMN monthly_cost numeric,ADD COLUMN personal_doc jsonb,
      ADD COLUMN bank text,ADD COLUMN bank_agency text,ADD COLUMN bank_account text,ADD COLUMN pix_key text,ADD COLUMN address text;
    ALTER TABLE public.ats_candidates ADD COLUMN full_name text,ADD COLUMN email text,ADD COLUMN phone text,ADD COLUMN location text;
    ALTER TABLE public.ats_jobs ADD COLUMN title text,ADD COLUMN deal_id uuid,ADD COLUMN employment_type text,
      ADD COLUMN hiring_governed boolean DEFAULT false,ADD COLUMN hiring_purpose text,ADD COLUMN hiring_contract_id uuid,
      ADD COLUMN hiring_billing_model text,ADD COLUMN hiring_role_id uuid,ADD COLUMN hiring_approval_status text DEFAULT 'not_requested';
    ALTER TABLE public.ats_applications ADD COLUMN candidate_id uuid,ADD COLUMN job_id uuid,ADD COLUMN stage_value text,
      ADD COLUMN stage_id uuid,ADD COLUMN hiring_details jsonb,ADD COLUMN applied_at timestamptz,
      ADD COLUMN created_at timestamptz DEFAULT now(),ADD COLUMN updated_at timestamptz DEFAULT now();
    ALTER TABLE public.ats_interviews ADD COLUMN application_id uuid,ADD COLUMN candidate_id uuid,ADD COLUMN job_id uuid,
      ADD COLUMN scheduled_at timestamptz,ADD COLUMN duration_min integer,ADD COLUMN stage_value text,
      ADD COLUMN notes text,ADD COLUMN self_schedule_token text,ADD COLUMN transcript text,ADD COLUMN ai_summary text,
      ADD COLUMN created_at timestamptz DEFAULT now(),ADD COLUMN updated_at timestamptz DEFAULT now();
    ALTER TABLE public.ats_offers ALTER COLUMN id SET DEFAULT gen_random_uuid(),
      ADD COLUMN workspace_id uuid,ADD COLUMN owner_id uuid,ADD COLUMN assigned_to uuid,
      ADD COLUMN application_id uuid,ADD COLUMN candidate_id uuid,ADD COLUMN job_id uuid,
      ADD COLUMN title text,ADD COLUMN body text,ADD COLUMN salary_amount numeric,ADD COLUMN salary_currency text DEFAULT 'BRL',
      ADD COLUMN start_date date,ADD COLUMN status text DEFAULT 'draft',ADD COLUMN public_token text,ADD COLUMN promote_to_stage text,
      ADD COLUMN sent_at timestamptz,ADD COLUMN signed_at timestamptz,ADD COLUMN declined_at timestamptz,
      ADD COLUMN decline_reason text,ADD COLUMN viewed_at timestamptz,ADD COLUMN approval_status text DEFAULT 'not_requested',
      ADD COLUMN revision integer DEFAULT 1,ADD COLUMN approved_revision integer,ADD COLUMN approved_by uuid,
      ADD COLUMN approved_at timestamptz,ADD COLUMN approval_note text,
      ADD COLUMN created_at timestamptz DEFAULT now(),ADD COLUMN updated_at timestamptz DEFAULT now();
    CREATE SCHEMA techerp_offers;
    CREATE TABLE techerp_offers.sessions(txid bigint NOT NULL,actor uuid,offer_id uuid NOT NULL,operation text NOT NULL,PRIMARY KEY(txid,offer_id));
    REVOKE ALL ON SCHEMA techerp_offers FROM PUBLIC,anon,authenticated;
    REVOKE ALL ON techerp_offers.sessions FROM PUBLIC,anon,authenticated,service_role;
    CREATE TABLE public.ats_offer_approvals(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid,offer_id uuid,
      revision integer,actor_id uuid,event text,note text,created_at timestamptz DEFAULT now());
    ALTER TABLE public.esign_documents ALTER COLUMN id SET DEFAULT gen_random_uuid(),ALTER COLUMN status SET DEFAULT 'draft',
      ADD COLUMN owner_id uuid,ADD COLUMN title text,ADD COLUMN ordered boolean DEFAULT false,ADD COLUMN sent_at timestamptz;
    ALTER TABLE public.esign_signers ALTER COLUMN id SET DEFAULT gen_random_uuid(),
      ALTER COLUMN status TYPE public.esign_signer_status USING status::public.esign_signer_status,
      ALTER COLUMN status SET DEFAULT 'pending',
      ADD COLUMN owner_id uuid,ADD COLUMN name text,ADD COLUMN email text,ADD COLUMN sign_order integer DEFAULT 1,
      ADD COLUMN public_token text DEFAULT encode(extensions.gen_random_bytes(32),'hex'),
      ADD COLUMN signed_name text,ADD COLUMN signature_data text,ADD COLUMN ip_address text,ADD COLUMN user_agent text,
      ADD COLUMN decline_reason text,ADD COLUMN declined_at timestamptz,ADD COLUMN viewed_at timestamptz;
    CREATE TABLE public.esign_audit(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid,document_id uuid,
      signer_id uuid,owner_id uuid,event text,metadata jsonb,ip_address text,user_agent text);
    ALTER TABLE public.legal_entities ADD COLUMN active boolean DEFAULT true;
    ALTER TABLE public.hiring_area_policies ADD COLUMN updated_by uuid,ADD COLUMN updated_at timestamptz DEFAULT now();
    ALTER TABLE public.hiring_preparation_requests ALTER COLUMN id SET DEFAULT gen_random_uuid(),
      ADD COLUMN title text,ADD COLUMN scope_text text DEFAULT '',ADD COLUMN purpose text,ADD COLUMN area_id uuid,
      ADD COLUMN legal_entity_id uuid,ADD COLUMN regime text,ADD COLUMN person_id uuid,ADD COLUMN company_id uuid,
      ADD COLUMN contact_id uuid,ADD COLUMN deal_id uuid,ADD COLUMN project_id uuid,ADD COLUMN commercial_contract_id uuid,
      ADD COLUMN status text DEFAULT 'draft',ADD COLUMN revision integer DEFAULT 1,ADD COLUMN created_by uuid,
      ADD COLUMN created_at timestamptz DEFAULT now(),ADD COLUMN updated_at timestamptz DEFAULT now(),
      ADD COLUMN selection_mode text DEFAULT 'needs_selection',ADD COLUMN modality text DEFAULT 'delivery',ADD COLUMN release_condition text,
      ADD CONSTRAINT notification_hiring_request_identity UNIQUE(workspace_id,id);
    CREATE TABLE public.hiring_preparation_reference_values(request_id uuid PRIMARY KEY,workspace_id uuid,reference_value numeric,revision integer);
    CREATE TABLE public.hiring_workspace_settings(workspace_id uuid PRIMARY KEY,enabled boolean DEFAULT false,
      signature_gate_enabled boolean DEFAULT false,employment_gate_enabled boolean DEFAULT false,updated_by uuid,updated_at timestamptz DEFAULT now());
    CREATE TABLE public.deal_role_profiles(id uuid PRIMARY KEY,workspace_id uuid,ats_job_id uuid,modality text,deal_id uuid);
  `);
  await db.unsafe(`ALTER TABLE public.people_documents ALTER COLUMN id SET DEFAULT gen_random_uuid(),
    ALTER COLUMN status TYPE public.people_doc_status USING status::public.people_doc_status,ALTER COLUMN status SET DEFAULT 'valid',
    ADD COLUMN owner_id uuid,ADD COLUMN doc_type text,ADD COLUMN doc_number text,ADD COLUMN issued_at date,
    ADD COLUMN expires_at date,ADD COLUMN file_url text,ADD COLUMN file_name text,ADD COLUMN is_sensitive boolean DEFAULT true,
    ADD COLUMN notes text,ADD COLUMN created_at timestamptz DEFAULT now(),ADD COLUMN updated_at timestamptz DEFAULT now(),
    ADD CONSTRAINT notification_document_person FOREIGN KEY(person_id) REFERENCES public.people(id);
    GRANT ALL ON public.people_documents,public.ats_offers,public.ats_offer_approvals,public.esign_audit TO service_role;
    GRANT SELECT ON public.people_documents,public.ats_offers TO authenticated;
    ALTER TABLE public.people_documents ENABLE ROW LEVEL SECURITY;ALTER TABLE public.ats_offers ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.hiring_preparation_reference_values ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON public.hiring_preparation_reference_values FROM PUBLIC,anon,authenticated;
    GRANT ALL ON public.hiring_preparation_reference_values TO service_role;
  `);
  for (const name of ["hr_person_resource_access", "hr_child_record_access", "hr_record_access"])
    await load(db, migration("0195_people_resource_actions"), name);
  await load(db, migration("0202_application_action_scope"), "ats_application_action_access");
  await load(db, migration("0203_interview_response_action_scope"), "ats_interview_action_access");
  await load(db, migration("0204_ats_configuration_actions"), "hr_record_access");
  for (const name of [
    "ats_offer_action_access",
    "ats_offer_guard",
    "ats_offer_document_guard",
    "ats_offer_transition",
    "ats_offer_sign",
    "ats_offers_sync_on_esign",
  ])
    await load(db, offers, name);
  await load(db, esign, "esign_check_completion");
  await db.unsafe(statement(esign, "CREATE TRIGGER esign_signers_completion"));
  await db.unsafe(
    statement(
      "supabase/migrations/20260624211130_6c73f080-e2f0-49ef-9213-bb8d85db7d74.sql",
      "CREATE TRIGGER trg_ats_offers_sync_on_esign",
    ),
  );
  await db.unsafe(`
    CREATE TRIGGER zzzz_ats_offer_guard BEFORE INSERT OR UPDATE OR DELETE ON public.ats_offers FOR EACH ROW EXECUTE FUNCTION public.ats_offer_guard();
    CREATE TRIGGER zzzz_ats_offer_document_guard BEFORE INSERT OR UPDATE OR DELETE ON public.esign_documents FOR EACH ROW EXECUTE FUNCTION public.ats_offer_document_guard();
    CREATE TRIGGER zzzz_ats_offer_document_guard BEFORE INSERT OR UPDATE OR DELETE ON public.esign_signers FOR EACH ROW EXECUTE FUNCTION public.ats_offer_document_guard();
    CREATE TRIGGER zzzz_ats_offer_document_guard BEFORE INSERT OR UPDATE OR DELETE ON public.esign_audit FOR EACH ROW EXECUTE FUNCTION public.ats_offer_document_guard();
    CREATE POLICY source_read ON public.ats_applications FOR SELECT TO authenticated USING(public.hr_record_access('applications','view',id));
    CREATE POLICY source_read ON public.ats_interviews FOR SELECT TO authenticated USING(public.hr_record_access('interviews','view',id));
  `);
  for (const prefix of [
    "CREATE POLICY offer_select",
    "CREATE UNIQUE INDEX ats_offer_one_signing_document",
  ])
    await db.unsafe(statement(migration("0207_ats_offer_hiring_activation"), prefix));
  for (const prefix of ["CREATE POLICY hr_child_view ON public.people_documents"])
    await db.unsafe(statement(migration("0195_people_resource_actions"), prefix));
  for (const table of [
    "people_documents",
    "ats_offers",
    "ats_applications",
    "ats_interviews",
    "hiring_preparation_requests",
  ])
    await db.unsafe(
      `CREATE POLICY notification_hr_fixture_restriction ON public.${table} AS RESTRICTIVE FOR SELECT TO authenticated USING(public.notification_fixture_restriction(id))`,
    );
  for (const name of ["hr_private_row_allowed", "hr_private_fields"])
    await load(db, migration("0198_hr_private_fields"), name);
  // Column ACLs match the canonical activation blocks; the unrelated private
  // 1:1/allocation tables are not needed to execute these People scenarios.
  await db.unsafe(`DO $$ DECLARE t text;cols text;hidden text[];BEGIN
    FOREACH t IN ARRAY ARRAY['people','ats_applications','ats_interviews','ats_offers'] LOOP
      hidden:=CASE t WHEN 'people' THEN ARRAY['cost_hour','monthly_cost','personal_doc','bank','bank_agency','bank_account','pix_key','address']
      WHEN 'ats_applications' THEN ARRAY['hiring_details'] WHEN 'ats_interviews' THEN ARRAY['notes']
      ELSE ARRAY['public_token','body','salary_amount','salary_currency','approval_note'] END;
      EXECUTE format('REVOKE SELECT ON public.%I FROM PUBLIC,anon,authenticated',t);
      SELECT string_agg(format('%I',attname),',') INTO cols FROM pg_attribute WHERE attrelid=('public.'||t)::regclass AND attnum>0 AND NOT attisdropped AND NOT attname=ANY(hidden);
      EXECUTE format('GRANT SELECT(%s) ON public.%I TO authenticated',cols,t);
    END LOOP;END $$;
    REVOKE ALL ON FUNCTION public.ats_offer_sign(text,text,text,text,text,text,text) FROM PUBLIC,anon,authenticated;
    GRANT EXECUTE ON FUNCTION public.ats_offer_sign(text,text,text,text,text,text,text) TO service_role;
    REVOKE ALL ON FUNCTION public.ats_offer_transition(uuid,text,integer,text) FROM PUBLIC,anon;
    GRANT EXECUTE ON FUNCTION public.ats_offer_transition(uuid,text,integer,text) TO authenticated;
    REVOKE ALL ON FUNCTION public.hr_private_row_allowed(text,text,jsonb,boolean) FROM PUBLIC,anon,authenticated;
    REVOKE ALL ON FUNCTION public.hr_private_fields(text,uuid[],boolean) FROM PUBLIC,anon;
    GRANT EXECUTE ON FUNCTION public.hr_private_fields(text,uuid[],boolean) TO authenticated;
  `);
  await load(db, migration("0373_hiring_requests"), "hiring_preparation_immutable");
  for (const table of ["hiring_preparation_approvals", "hiring_preparation_approval_events"])
    await db.unsafe(statement(preparation, `CREATE TABLE public.${table} (`));
  for (const name of [
    "hiring_preparation_approval_subject",
    "hiring_preparation_approval_current",
    "hiring_preparation_approval_access",
    "hiring_preparation_approval_route",
    "hiring_preparation_approval_invalidate",
    "hiring_preparation_approval_notify",
    "hiring_preparation_approval_request",
    "hiring_preparation_approval_decide",
  ])
    await load(db, preparation, name);
  for (const prefix of [
    "CREATE TRIGGER approval_event_immutable",
    "CREATE UNIQUE INDEX preparation_approval_stage_once",
    "CREATE UNIQUE INDEX preparation_approval_invalid_once",
    "CREATE TRIGGER preparation_revision_invalidates_approval",
    "CREATE TRIGGER preparation_value_invalidates_approval",
    "CREATE TRIGGER preparation_policy_invalidates_approval",
  ])
    await db.unsafe(statement(preparation, prefix));
  await db.unsafe(`
    REVOKE ALL ON public.hiring_preparation_approvals,public.hiring_preparation_approval_events FROM PUBLIC,anon,authenticated,techerp_request_writer;
    GRANT SELECT ON public.hiring_preparation_approvals,public.hiring_preparation_approval_events TO authenticated;
    GRANT ALL ON public.hiring_preparation_approvals,public.hiring_preparation_approval_events TO service_role;
    ALTER TABLE public.hiring_preparation_approvals ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.hiring_preparation_approval_events ENABLE ROW LEVEL SECURITY;
  `);
  for (const prefix of ["CREATE POLICY approval_read", "CREATE POLICY approval_event_read"])
    await db.unsafe(statement(preparation, prefix));
  await db.unsafe(`
    REVOKE ALL ON FUNCTION public.hiring_preparation_approval_subject(uuid,uuid,text,text),public.hiring_preparation_approval_current(uuid,uuid),public.hiring_preparation_approval_route(uuid,uuid),public.hiring_preparation_approval_notify(uuid) FROM PUBLIC,anon,authenticated,service_role;
    REVOKE ALL ON FUNCTION public.hiring_preparation_approval_request(uuid,text,uuid,integer),public.hiring_preparation_approval_decide(uuid,text,uuid,integer,uuid,text,text,text,uuid) FROM PUBLIC,anon,service_role;
    GRANT EXECUTE ON FUNCTION public.hiring_preparation_approval_request(uuid,text,uuid,integer),public.hiring_preparation_approval_decide(uuid,text,uuid,integer,uuid,text,text,text,uuid) TO authenticated;
  `);
  for (const table of [
    "hiring_access_models",
    "hiring_access_model_versions",
    "hiring_engagements",
    "hiring_employment_events",
  ])
    await db.unsafe(
      statement(
        migration("0311_hiring_employment_and_access_models"),
        `CREATE TABLE public.${table}(`,
      ),
    );
  await db.unsafe(`ALTER TABLE public.hiring_engagements ALTER COLUMN job_id DROP NOT NULL,ALTER COLUMN model_version_id DROP NOT NULL,
    ADD COLUMN hiring_request_id uuid REFERENCES public.hiring_preparation_requests(id);
    CREATE UNIQUE INDEX notification_fixture_one_engagement_request ON public.hiring_engagements(hiring_request_id) WHERE hiring_request_id IS NOT NULL;
    ALTER TABLE public.contracts ADD COLUMN hiring_person_id uuid;
  `);
  await db.unsafe(
    statement(
      migration("0381_hiring_execution_start"),
      "CREATE TABLE public.hiring_execution_starts(",
    ),
  );
  await db.unsafe(`
    REVOKE ALL ON public.hiring_engagements,public.hiring_employment_events,public.hiring_execution_starts FROM PUBLIC,anon,authenticated;
    GRANT SELECT ON public.hiring_engagements,public.hiring_employment_events,public.hiring_execution_starts TO authenticated;
    GRANT ALL ON public.hiring_engagements,public.hiring_employment_events,public.hiring_execution_starts TO service_role;
  `);
  await load(db, migration("0311_hiring_employment_and_access_models"), "hiring_employment_access");
  await setupNotificationHirePeopleEmployment(db);
  await db.unsafe(readFileSync(migration("0399_notification_hire_people"), "utf8"));
}
