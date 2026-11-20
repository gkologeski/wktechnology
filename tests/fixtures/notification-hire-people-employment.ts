import { readFileSync } from "node:fs";
import type postgres from "postgres";
import { loadNotificationBusinessFunction as load } from "./notification-business-events";

const migration = (name: string) => `drizzle/migrations/${name}.sql`;
const preparation = migration("0376_hiring_formalization");
const integrity = migration("0379_hiring_formalization_integrity");
const execution = migration("0381_hiring_execution_start");
const employment = migration("0311_hiring_employment_and_access_models");

function statement(file: string, prefix: string) {
  const source = readFileSync(file, "utf8");
  const start = source.indexOf(prefix);
  if (start < 0) throw Error(`Missing canonical employment DDL: ${file}::${prefix}`);
  return source.slice(start, source.indexOf(";", start) + 1);
}

/** Real admission/start and formalization predicates; no authorization/signature stubs. */
export async function setupNotificationHirePeopleEmployment(db: postgres.Sql) {
  await db.unsafe(`
    ALTER TABLE public.people ALTER COLUMN id SET DEFAULT gen_random_uuid();
    ALTER TABLE public.services ADD COLUMN IF NOT EXISTS source_deal_line_item_id uuid;
    ALTER TABLE public.service_catalog ADD COLUMN IF NOT EXISTS staffing_kind text;
    ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS role text DEFAULT 'provider',
      ADD COLUMN IF NOT EXISTS document_kind text DEFAULT 'main',
      ADD COLUMN IF NOT EXISTS hiring_request_origin uuid REFERENCES public.hiring_preparation_requests(id);
    ALTER TABLE public.contract_drafts ADD COLUMN IF NOT EXISTS title text,ADD COLUMN IF NOT EXISTS body_html text,
      ADD COLUMN IF NOT EXISTS prepared_terms jsonb,ADD COLUMN IF NOT EXISTS template_id uuid;
    ALTER TABLE public.hiring_contract_evidence ADD COLUMN IF NOT EXISTS recorded_at timestamptz DEFAULT now();
    ALTER TABLE public.contract_forsign_operations ADD COLUMN IF NOT EXISTS requested_members jsonb,ADD COLUMN IF NOT EXISTS members jsonb;
  `);
  for (const [file, prefix] of [
    [migration("0362_contract_handoffs"), "CREATE TABLE public.contract_handoff_settings("],
    [
      migration("0360_contract_signer_contacts"),
      "CREATE TABLE public.contract_signature_participants (",
    ],
    [preparation, "CREATE TABLE public.hiring_formalizations("],
    [preparation, "CREATE TABLE public.hiring_formalization_events("],
  ])
    await db.unsafe(statement(file, prefix));
  // The real immutable origin constraint applies to both ATS and direct rows.
  await db.unsafe(
    statement(
      execution,
      "ALTER TABLE public.hiring_engagements ADD CONSTRAINT hiring_engagement_origin",
    ),
  );
  for (const name of ["ats_hiring_terms_access"])
    await load(db, migration("0206_ats_offer_approval_boundaries"), name);
  await load(db, migration("0204_ats_configuration_actions"), "hr_record_capabilities");
  const offers = readFileSync(migration("0206_ats_offer_approval_boundaries"), "utf8");
  const patchStart = offers.indexOf("DO $$ DECLARE def text;BEGIN");
  const patchEnd = offers.indexOf("END $$;", patchStart) + "END $$;".length;
  if (patchStart < 0) throw Error("Missing canonical hiring capability/access extension");
  await db.unsafe(offers.slice(patchStart, patchEnd));
  for (const name of ["hiring_recruitment_reason", "hiring_workflow_recruitment_check"])
    await load(db, migration("0310_hiring_recruitment_authorization"), name);
  await load(db, employment, "hiring_employment_admit");
  for (const name of [
    "hiring_formalization_lock",
    "hiring_formalization_current",
    "hiring_formalization_subject",
    "hiring_formalization_recipient",
    "hiring_formalization_fingerprint",
    "hiring_formalization_ready_subject",
    "hiring_formalization_valid",
  ])
    await load(db, preparation, name);
  for (const name of [
    "hiring_formalization_forsign_roster",
    "hiring_formalization_signed",
    "hiring_contract_signature_reason",
  ])
    await load(db, integrity, name);
  for (const name of [
    "hiring_execution_manager",
    "hiring_execution_subject",
    "hiring_execution_problem",
    "hiring_execution_activation_ok",
    "hiring_execution_start",
  ])
    await load(db, execution, name);
  for (const [file, prefix] of [
    [preparation, "CREATE POLICY hiring_formalization_read"],
    [preparation, "CREATE POLICY hiring_formalization_event_read"],
    [preparation, "CREATE TRIGGER hiring_formalization_event_immutable"],
    [execution, "CREATE POLICY hiring_execution_start_read"],
    [execution, "CREATE TRIGGER hiring_execution_start_immutable"],
    [employment, "CREATE POLICY hiring_engagement_read"],
    [employment, "CREATE POLICY hiring_employment_event_read"],
    [
      migration("0360_contract_signer_contacts"),
      "CREATE POLICY contract_signature_participants_read",
    ],
  ])
    await db.unsafe(statement(file, prefix));
  await db.unsafe(`
    ALTER TABLE public.hiring_formalizations ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.hiring_formalization_events ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.hiring_execution_starts ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.hiring_engagements ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.hiring_employment_events ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.contract_signature_participants ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON public.hiring_formalizations,public.hiring_formalization_events,public.contract_signature_participants FROM PUBLIC,anon,authenticated,techerp_request_writer;
    GRANT SELECT ON public.hiring_formalizations,public.hiring_formalization_events,public.contract_signature_participants TO authenticated;
    GRANT ALL ON public.hiring_formalizations,public.hiring_formalization_events,public.contract_signature_participants TO service_role;
    REVOKE ALL ON FUNCTION public.hiring_recruitment_reason(uuid,uuid),public.hiring_workflow_recruitment_check(uuid,uuid),
      public.ats_hiring_terms_access(jsonb,text),public.hiring_formalization_lock(uuid),public.hiring_formalization_current(uuid,uuid),
      public.hiring_formalization_subject(uuid,uuid,text,text),public.hiring_formalization_recipient(uuid),public.hiring_formalization_fingerprint(uuid),
      public.hiring_formalization_ready_subject(uuid,uuid,text,text),public.hiring_formalization_valid(uuid),
      public.hiring_formalization_forsign_roster(jsonb,jsonb),public.hiring_formalization_signed(uuid,uuid),
      public.hiring_contract_signature_reason(uuid,uuid,uuid),public.hiring_execution_manager(uuid,uuid),
      public.hiring_execution_subject(uuid,uuid,text),public.hiring_execution_problem(uuid,uuid),public.hiring_execution_activation_ok(uuid,uuid)
      FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
    REVOKE ALL ON FUNCTION public.hiring_employment_admit(uuid,uuid,uuid,uuid,uuid,date,date,text,text,date),
      public.hiring_execution_start(uuid,uuid,integer,date,date,text,uuid) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
    GRANT EXECUTE ON FUNCTION public.hiring_employment_admit(uuid,uuid,uuid,uuid,uuid,date,date,text,text,date),
      public.hiring_execution_start(uuid,uuid,integer,date,date,text,uuid),public.ats_hiring_terms_access(jsonb,text) TO authenticated;
    REVOKE ALL ON FUNCTION public.hr_record_capabilities(text,uuid[]) FROM PUBLIC,anon;
    GRANT EXECUTE ON FUNCTION public.hr_record_capabilities(text,uuid[]) TO authenticated;
  `);
}
