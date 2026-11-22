import assert from "node:assert/strict";
import type postgres from "postgres";
import { INBOX_CHANNEL_EVENT_KEYS } from "../../../src/lib/workflows/inbox-channel-events";

/** Run AFTER real producers and publication on the authorized disposable CI
 * copy. No synthesized events, skipped keys or permissive policies accepted. */
export async function checkThirteenCurrentProofs(
  db: postgres.Sql,
  occurrences: ReadonlyMap<string, string>,
  workflows: ReadonlyMap<string, string>,
  profiles: ReadonlyMap<number, string>,
) {
  const target = await db`select current_database() name`;
  assert.equal(
    target[0]?.["name"],
    "techerp_notification_ci",
    "Never run publication checks on the draft/app",
  );
  assert.deepEqual([...occurrences.keys()].sort(), [...INBOX_CHANNEL_EVENT_KEYS].sort());
  assert.deepEqual([...workflows.keys()].sort(), [...INBOX_CHANNEL_EVENT_KEYS].sort());
  let checks = 0;
  for (const key of INBOX_CHANNEL_EVENT_KEYS) {
    const occurrence = occurrences.get(key),
      workflow = workflows.get(key);
    assert.ok(occurrence && workflow, `Missing actual producer/workflow ${key}`);
    const current = await db`select techerp_api.inbox_message_evidence_current(id) valid
      from public.inbox_channel_occurrences where id=${occurrence} and event_key=${key}`;
    assert.equal(current.length, 1);
    assert.equal(current[0]?.["valid"], true, `Current canonical receipt/projection ${key}`);
    const roots =
      await db`select p.event_id,techerp_api.notification_business_proof_current(p) valid
      from public.notification_business_event_proofs p where p.source_id=${occurrence}
      and p.event_key=${key} and p.root_event_id=p.event_id and p.parent_event_id is null`;
    assert.equal(roots.length, 1, `Exactly one attested root for ${key}`);
    assert.equal(roots[0]?.["valid"], true, `Business proof ${key}`);
    const event = roots[0]?.["event_id"];
    assert.ok(typeof event === "string");
    checks += 2;
    // Corrupt copies, never edit an immutable production/fixture proof row.
    for (const patch of [
      { workspace_id: crypto.randomUUID() },
      { producer_id: crypto.randomUUID() },
      { source_id: crypto.randomUUID() },
      { reference_id: crypto.randomUUID() },
      { source_revision: "0".repeat(64) },
      { occurrence_key: "forged-occurrence" },
      {
        event_key:
          key === "shared.chat.message_received"
            ? "shared.email.message_received"
            : "shared.chat.message_received",
      },
    ]) {
      const changed = await db`select techerp_api.notification_business_proof_current(
        jsonb_populate_record(null::public.notification_business_event_proofs,to_jsonb(p)||${db.json(patch)})) valid
        from public.notification_business_event_proofs p where p.event_id=${event}`;
      assert.equal(changed[0]?.["valid"], false, `Tampered business proof ${key}`);
      checks++;
    }
    for (const n of [11, 12, 13, 14, 15]) {
      const actor = profiles.get(n);
      assert.ok(actor, `Missing worker subject ${n}`);
      const result =
        await db`select techerp_api.sales_worker_check('workflows',${workflow},${actor},
        (select workspace_id from public.workflows where id=${workflow}),
        jsonb_build_array(jsonb_build_object('record_table','inbox_channel_occurrences','id',${occurrence}::uuid,'action','view'))) valid`;
      assert.equal(result[0]?.["valid"], n === 11, `Actual worker subject ${n}, ${key}`);
      checks++;
    }
  }
  return checks;
}
