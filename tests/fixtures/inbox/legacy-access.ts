import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type postgres from "postgres";
import {
  db as ownedDatabase,
  reset,
  withRole,
  W,
  A,
  U,
  C,
  D,
  N,
  F,
  X,
} from "../notification-deliveries";

const sources = [
  "leads",
  "contacts",
  "companies",
  "deals",
  "tickets",
  "activities",
  "ats_jobs",
  "ats_candidates",
  "ats_applications",
  "ats_interviews",
  "ats_offers",
  "people",
  "people_documents",
  "hiring_preparation_requests",
  "hiring_fiscal_documents",
  "projects",
  "project_tasks",
  "project_milestones",
  "contracts",
  "financial_entries",
  "bank_payments",
  "quotes",
  "proposals",
  "services",
  "recurring_plans",
  "subscription_invoices",
  "customer_invoices",
  "whatsapp_messages",
] as const;
const actors = [U, N, D, C, F];

/** Capture private service-helper decisions and actual authenticated INVOKER
 * reference RLS separately. These are SQL role cases, not GoTrue login tests. */
export async function legacyAccessVector(db: postgres.Sql) {
  assert.equal(db, ownedDatabase);
  const result = [];
  for (const actor of actors) {
    const references = await withRole(
      "authenticated",
      actor,
      (tx) => tx`
      select value source, public.sales_event_reference_access(value,${X}) allowed
      from jsonb_array_elements_text(${tx.json(sources)}) order by value`,
    );
    const dispatch = await db.begin(async (tx) => {
      // Internal helpers run under their real production function ownership and
      // install the subject's current RLS context themselves. No allow stub.
      await tx`select set_config('request.jwt.claims',${JSON.stringify({ role: "authenticated", sub: actor })},true)`;
      return tx`select value source,
        techerp_api.notification_source_visible(${W},${actor},value,${X}) source_visible,
        techerp_api.notification_center_source_visible(${W},${actor},value,${X}) center_visible
        from jsonb_array_elements_text(${tx.json(sources)}) order by value`;
    });
    result.push({ actor, references: [...references], dispatch: [...dispatch] });
  }
  return result;
}

export async function prepareLegacyAccessVector(db: postgres.Sql) {
  assert.equal(db, ownedDatabase);
  await reset();
  const denied = randomUUID();
  await db`insert into job_roles(id,workspace_id) values(${denied},${W})`;
  await db`insert into user_job_roles(role_id,user_id,workspace_id,owner_id)
    values(${denied},${D},${W},${A})`;
  await db`insert into job_role_permission_overrides(workspace_id,role_id,permission_key,effect)
    select ${W},${denied},key,'deny' from permissions where key like '%.view.%'`;
  await db`update workspace_members set status='inactive' where workspace_id=${W} and user_id=${C}`;
  await db`insert into whatsapp_conversations(id,workspace_id,owner_id,assigned_to,
    wa_phone_number_id,contact_phone) values(${X},${W},${A},${U},'123456789','+12025550123')`;
  await db`insert into whatsapp_messages(id,workspace_id,owner_id,conversation_id,
    direction,provider,status) values(${X},${W},${A},${X},'inbound','meta','received')`;
  const vector = await legacyAccessVector(db);
  const allowed = vector[0]!;
  assert.equal(allowed.references.find((row) => row.source === "deals")?.allowed, true);
  assert.equal(allowed.references.find((row) => row.source === "whatsapp_messages")?.allowed, true);
  for (const deniedActor of vector.slice(1))
    assert.equal(deniedActor.references.find((row) => row.source === "deals")?.allowed, false);
  return vector;
}

export function assertLegacyAccessUnchanged(
  before: Awaited<ReturnType<typeof legacyAccessVector>>,
  after: Awaited<ReturnType<typeof legacyAccessVector>>,
) {
  assert.deepEqual(after, before, "Inbox migrations changed a legacy permission decision");
  assert.equal(before.length, 5);
  for (const item of before) {
    assert.equal(item.references.length, 28);
    assert.equal(item.dispatch.length, 28);
  }
}
