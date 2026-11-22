import { beforeAll, beforeEach, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import {
  db,
  W,
  U,
  ROLE,
  WF,
  reset,
  withRole,
  request,
  fixtureJwt,
} from "../../tests/fixtures/notification-deliveries";
import { setupInboxExecutionCopy } from "../../tests/fixtures/inbox/runtime";
import { workflowDraftInsert } from "./workflows/draft-payload";

// This fixture owns a separate Docker CI database; it never uses draft PG*.
// The shared owned fixture loads the complete real migration sequence.
beforeAll(async () => setupInboxExecutionCopy(db), 60000);
beforeEach(async () => {
  // Clear only this owned disposable fixture, before legacy reset deletes parent rows.
  await db.unsafe(
    "TRUNCATE techerp_api.inbox_response_history_barriers,unipile_delivery_receipts,prospecting_sequence_runs,prospecting_sequence_effects,inbox_transition_receipts,inbox_response_receipts,inbox_channel_occurrences,inbox_channel_evidence,inbox_widget_receipts,live_chat_messages,gmail_sync_queue,email_messages,email_accounts CASCADE",
  );
  await reset();
  await db`insert into job_role_permission_overrides(workspace_id,role_id,permission_key,effect)
    values(${W},${ROLE},'techsales.inbox.chat.view.workspace','grant'),
      (${W},${ROLE},'system.workflows.create.workspace','grant'),
      (${W},${ROLE},'system.workflows.update.workspace','grant')`;
});

async function rootAndRun() {
  await db`delete from workflows where id=${WF}`;
  const p = workflowDraftInsert(
    {
      name: "Canonical Inbox resume regression",
      entity: "inbox_channel_occurrences",
      enabled: true,
      trigger: {
        event: "updated",
        notification_event: {
          key: "shared.chat.message_received",
          channel: "chat",
          account_ids: [],
        },
      },
      actions: [
        {
          type: "notify",
          title: "Atualização disponível",
          recipients: [{ kind: "source_responsible" }],
          delivery: { channels: ["inapp"], fallback: "none" },
        },
      ],
    },
    U,
    W,
  );
  await withRole(
    "authenticated",
    U,
    (
      tx,
    ) => tx`insert into workflows(id,name,workspace_id,owner_id,entity,enabled,status,trigger,actions,draft_trigger,draft_actions)
    values(${WF},${p.name},${W},${U},${p.entity},${p.enabled},${p.status},${tx.json(p.trigger)},${tx.json(p.actions)},${tx.json(p.draft_trigger)},${tx.json(p.draft_actions)})`,
  );
  await withRole(
    "authenticated",
    U,
    (tx) =>
      tx`update workflows set trigger=draft_trigger,actions=draft_actions,status='published',published_version=1,execution_user_id=${U} where id=${WF}`,
  );
  await withRole("authenticated", U, (tx) => tx`update workflows set enabled=true where id=${WF}`);
  const session = randomUUID();
  await db`insert into live_chat_sessions(id,workspace_id,owner_id,assignee_id,visitor_id,status) values(${session},${W},${W},${U},${session},'open')`;
  const produced = await request(
    "/rpc/widget_inbound_commit",
    {
      p_session: session,
      p_visitor: session,
      p_request: randomUUID(),
      p_body: "Real canonical visitor input",
    },
    U,
    fixtureJwt("service_role"),
  );
  expect(produced.status).toBe(200);
  const [root] =
    await db`select e.id from workflow_events e join inbox_channel_occurrences o on o.id=e.entity_id
    where o.message_id=${produced.payload} and o.event_key='shared.chat.message_received'`;
  if (!root || typeof root["id"] !== "string") throw new Error("Canonical producer root missing.");
  const id = root["id"];
  await db`insert into workflow_runs(id,workspace_id,owner_id,workflow_id,event_id,entity,entity_id,status)
    select ${randomUUID()},${W},${U},${WF},id,entity,entity_id,'running' from workflow_events where id=${id}`;
  return id;
}
async function child(root: string, forgedPayload = false, forgedParent = false) {
  const id = randomUUID();
  await withRole(
    "service_role",
    null,
    (
      tx,
    ) => tx`insert into workflow_events(id,workspace_id,owner_id,entity,entity_id,event_type,before,after,
    notification_event_key,notification_parent_event_id,resume_workflow_id,workflow_version,resume_cursor)
    select ${id},workspace_id,owner_id,entity,entity_id,event_type,before,
    after||${tx.json(forgedPayload ? { forged: true } : {})},notification_event_key,${forgedParent ? randomUUID() : root},${WF},1,1 from workflow_events where id=${root}`,
  );
  return id;
}
async function current(id: string, version = 1) {
  const result = await request(
    "/rpc/notification_business_event_check",
    { p_event: id, p_workflow: WF, p_version: version },
    U,
    fixtureJwt("service_role"),
  );
  expect(result.status).toBe(200);
  return result.payload;
}
it("root→child keeps the original private occurred_at, deterministic unique resume identity and true worker proof", async () => {
  const root = await rootAndRun();
  expect(await current(root)).toBe(true);
  const resume = await child(root);
  expect(await current(resume)).toBe(true);
  const [proof] =
    await db`select c.occurred_at is not null and c.occurred_at=r.occurred_at as same_time,
    c.occurrence_key=('resume:'||${root}||':'||${WF}||':1:1') as exact_resume,
    c.occurrence_key<>r.occurrence_key as unique_identity from notification_business_event_proofs c
    join notification_business_event_proofs r on r.event_id=c.root_event_id where c.event_id=${resume}`;
  expect(proof).toMatchObject({ same_time: true, exact_resume: true, unique_identity: true });
  await child(root); // Same position returns NULL, never another persisted child.
  expect(
    await db`select event_id from notification_business_event_proofs where parent_event_id=${root} and workflow_id=${WF} and resume_cursor=1`,
  ).toHaveLength(1);
});
it.each(["payload", "parent"])(
  "forged %s is 42501 and both event/proof INSERTs roll back atomically",
  async (kind) => {
    const root = await rootAndRun();
    const before =
      await db`select (select count(*) from workflow_events) events,(select count(*) from notification_business_event_proofs) proofs`;
    await expect(child(root, kind === "payload", kind === "parent")).rejects.toMatchObject({
      code: "42501",
    });
    expect(
      await db`select (select count(*) from workflow_events) events,(select count(*) from notification_business_event_proofs) proofs`,
    ).toEqual(before);
  },
);
it("revoked permission invalidates existing root/child and blocks a new resume", async () => {
  const root = await rootAndRun(),
    resume = await child(root);
  await db`update job_role_permission_overrides set effect='deny' where workspace_id=${W} and role_id=${ROLE} and permission_key='techsales.inbox.chat.view.workspace'`;
  expect(await current(root)).toBe(false);
  expect(await current(resume)).toBe(false);
  await expect(child(root)).rejects.toMatchObject({ code: "42501" });
});
it("wrong version blocks the complete chain", async () => {
  const root = await rootAndRun(),
    resume = await child(root);
  expect(await current(root, 2)).toBe(false);
  expect(await current(resume, 2)).toBe(false);
});
it("pause→reactivate advances real cutoff and never revives the old root/child", async () => {
  const root = await rootAndRun(),
    resume = await child(root);
  await withRole("authenticated", U, (tx) => tx`update workflows set enabled=false where id=${WF}`);
  expect(await current(resume)).toBe(false);
  await withRole("authenticated", U, (tx) => tx`update workflows set enabled=true where id=${WF}`);
  expect(await current(root)).toBe(false);
  expect(await current(resume)).toBe(false);
  await expect(child(root)).rejects.toMatchObject({ code: "42501" });
});
