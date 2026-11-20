import { beforeEach, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import {
  workflowNotificationEventTrigger,
  type WorkflowNotificationEventKey,
} from "./workflows/notification-events";
import {
  db,
  W,
  B,
  A,
  U,
  C,
  F,
  ROLE,
  X,
  WF,
  EVENT,
  reset,
  withRole,
  request,
  fixtureJwt,
} from "../../tests/fixtures/notification-deliveries";

// The same disposable PostgreSQL/PostgREST loads P4/P6/P7 plus the complete P8
// migration. No configured URL, production JWT or provider client is used here.
beforeEach(reset);
const PIPELINE = "f1000000-0000-4000-8000-000000000001";
const stages = [
  { value: "open", type: "open" },
  { value: "custom_won", type: "won" },
  { value: "custom_lost", type: "lost" },
];
const action = {
  type: "send_notification",
  title: "Atualização comercial",
  recipients: [{ kind: "source_responsible" }],
  delivery: { channels: ["inapp"], fallback: "none" },
};
// Exercise the same JSON serialization as an HTTP workflow request, rather than
// casting an interface with optional fields to the database driver's JSON type.
const triggerJson = (key: WorkflowNotificationEventKey) =>
  db.json(JSON.parse(JSON.stringify(workflowNotificationEventTrigger(key))));

async function configure(key: WorkflowNotificationEventKey = "crm.deal.won", entity = "deals") {
  await db`insert into pipelines(id,workspace_id,owner_id,stages) values(${PIPELINE},${W},${A},${db.json(stages)})`;
  await db`update deals set stage='new',stage_id='open',pipeline_id=${PIPELINE},name='Synthetic deal' where id=${X}`;
  // Remove setup-only transitions; each assertion below starts at a real change.
  await db`delete from workflow_events where notification_event_key is not null`;
  await db`update workflows set execution_user_id=${U},entity=${entity},trigger=${triggerJson(key)},
    actions=${db.json([action])},last_published_at=clock_timestamp()-interval '1 second' where id=${WF}`;
}
async function ready() {
  await configure();
  await db`update deals set stage_id='custom_won' where id=${X}`;
  return (await events("crm.deal.won"))[0].id as string;
}
const events = (key?: string) =>
  key
    ? db`select id,entity,entity_id,notification_event_key,before,after from workflow_events where notification_event_key=${key} order by created_at,id`
    : db`select id,entity,entity_id,notification_event_key,before,after from workflow_events where notification_event_key is not null order by created_at,id`;
const check = (event: string, workflow = WF, version = 1) =>
  request(
    "/rpc/notification_business_event_check",
    { p_event: event, p_workflow: workflow, p_version: version },
    U,
    fixtureJwt("service_role"),
  );
async function dispatch(
  event: string,
  entity = "deals",
  delivery = action.delivery,
  workflow = WF,
) {
  const run = randomUUID();
  await db`insert into workflow_runs(id,workspace_id,owner_id,workflow_id,event_id,entity,entity_id) values(${run},${W},${A},${workflow},${event},${entity},${X})`;
  return withRole(
    "service_role",
    null,
    async (tx) =>
      (
        await tx`select notification_workflow_dispatch_v2(${workflow},${run},1,${entity},${X},${tx.json(action.recipients)},${action.title},null,'0',${tx.json(delivery)}) result`
      )[0].result,
  );
}
async function seedRun(event: string, status = "running") {
  const run = randomUUID();
  await db`insert into workflow_runs(id,workspace_id,owner_id,workflow_id,event_id,entity,entity_id,status) values(${run},${W},${A},${WF},${event},'deals',${X},${status})`;
  return run;
}
async function resume(event: string, after?: Record<string, unknown>, actor: string | null = null) {
  const parent = (await events()).find((row) => row.id === event)!;
  return withRole(
    "service_role",
    actor,
    async (tx) =>
      tx`insert into workflow_events(workspace_id,owner_id,entity,entity_id,event_type,before,after,resume_workflow_id,resume_cursor,workflow_version,notification_event_key,notification_parent_event_id)
      values(${W},${U},'deals',${X},'updated',${tx.json(parent.before)},${tx.json(after ?? { ...parent.after, __wf_path: [{ path: [0], step: 1 }] })},${WF},1,1,'crm.deal.won',${event}) returning id`,
  );
}

it("Sales contracts allow authorized member", async () => {
  const event = await ready();
  expect(await check(event)).toEqual({ status: 200, payload: true });
  expect(await dispatch(event)).toMatchObject({ sent: 1, duplicate: 0 });
  expect(
    (
      await db`select n.type,c.event_key,c.source_table,c.source_id from notifications n join notification_workspace_context c on c.notification_id=n.id`
    )[0],
  ).toMatchObject({
    type: "workflow",
    event_key: "crm.deal.won",
    source_table: "deals",
    source_id: X,
  });
  expect(await request(`/notifications?select=id,type&user_id=eq.${U}`)).toMatchObject({
    status: 200,
    payload: [expect.objectContaining({ type: "workflow" })],
  });
});

it("Sales contracts reject missing permission", async () => {
  const event = await ready();
  await db`delete from job_role_permission_overrides where role_id=${ROLE} and permission_key='techsales.deals.view.workspace'`;
  expect(await check(event)).toEqual({ status: 200, payload: false });
  expect(await request(`/deals?select=id&id=eq.${X}`)).toEqual({ status: 200, payload: [] });
  expect((await db`select count(*)::int n from notifications where user_id=${U}`)[0].n).toBe(0);
});

it("Sales contracts reject explicit deny", async () => {
  const event = await ready();
  await db`update job_role_permission_overrides set effect='deny' where role_id=${ROLE} and permission_key='techsales.deals.view.workspace'`;
  expect(await check(event)).toEqual({ status: 200, payload: false });
  expect(await request(`/deals?select=id&id=eq.${X}`)).toEqual({ status: 200, payload: [] });
  expect((await db`select count(*)::int n from notifications where user_id=${U}`)[0].n).toBe(0);
});

it("Sales contracts reject foreign workspace", async () => {
  const event = await ready();
  expect(await request(`/deals?select=id&id=eq.${X}`, undefined, F)).toEqual({
    status: 200,
    payload: [],
  });
  await db`update workflows set workspace_id=${B} where id=${WF}`;
  expect(await check(event)).toEqual({ status: 200, payload: false });
  expect(
    (await request("/rpc/notification_delivery_capabilities", { p_workspace: B })).status,
  ).toBe(403);
});

it("Sales contracts reject inactive member", async () => {
  const event = await ready();
  await db`update workspace_members set status='inactive' where workspace_id=${W} and user_id=${U}`;
  expect(await check(event)).toEqual({ status: 200, payload: false });
  expect(
    (await request("/rpc/notification_delivery_capabilities", { p_workspace: W })).status,
  ).toBe(403);
  expect((await db`select count(*)::int n from notifications where user_id=${U}`)[0].n).toBe(0);
});

it("emits one canonical deal event per real transition including custom outcomes and reopening", async () => {
  await configure();
  await db`update deals set stage_id='custom_won' where id=${X}`;
  expect((await events()).map((event) => event.notification_event_key)).toEqual(["crm.deal.won"]);
  await db`update deals set stage_id='custom_won',name='Unrelated label edit' where id=${X}`;
  expect(await events()).toHaveLength(1);
  await db`update deals set stage_id='custom_lost' where id=${X}`;
  await db`update deals set stage_id='open' where id=${X}`;
  expect((await events()).map((event) => event.notification_event_key)).toEqual([
    "crm.deal.won",
    "crm.deal.lost",
    "crm.deal.stage_changed",
  ]);
});

it("rejects a forged named public column and keeps the private proof inaccessible through user and service APIs", async () => {
  const event = await ready();
  const args = { p_event: event, p_workflow: WF, p_version: 1 };
  expect((await request("/rpc/notification_business_event_check", args)).status).toBe(403);
  expect((await request("/notification_business_event_proofs?select=*")).status).toBe(403);
  expect(
    (
      await request(
        "/notification_business_event_proofs?select=*",
        undefined,
        U,
        fixtureJwt("service_role"),
      )
    ).status,
  ).toBe(403);
  await expect(
    withRole("service_role", null, async (tx) => {
      await tx`insert into workflow_events(id,workspace_id,owner_id,entity,entity_id,notification_event_key) values(${randomUUID()},${W},${A},'deals',${X},'crm.deal.won')`;
    }),
  ).rejects.toMatchObject({ code: "42501" });
  expect(await events("crm.deal.won")).toHaveLength(1);
});

it("revalidates the current source, workflow version and published state instead of trusting a captured snapshot", async () => {
  const event = await ready();
  expect(await check(event, WF, 2)).toEqual({ status: 200, payload: false });
  await db`update workflows set enabled=false where id=${WF}`;
  expect(await check(event)).toEqual({ status: 200, payload: false });
  await db`update workflows set enabled=true where id=${WF}`;
  await db`update deals set workspace_id=${B} where id=${X}`;
  expect(await check(event)).toEqual({ status: 200, payload: false });
});

it("does not consume an old business occurrence when a rule is newly published", async () => {
  const event = await ready();
  await db`update workflows set last_published_at=clock_timestamp() where id=${WF}`;
  expect(await check(event)).toEqual({ status: 200, payload: false });
});

it("emits proposal acceptance only after the canonical sent-to-accepted transition with a locked decided document", async () => {
  await configure("crm.proposal.accepted", "proposals");
  await db`update proposals set status='sent',locked=true,version=2,deal_id=${X} where id=${X}`;
  await db`update proposals set status='accepted',decided_at=clock_timestamp() where id=${X}`;
  const emitted = await events("crm.proposal.accepted");
  expect(emitted).toHaveLength(1);
  expect(emitted[0]).toMatchObject({ entity: "proposals", entity_id: X });
  expect(await check(emitted[0].id)).toEqual({ status: 200, payload: true });
  await db`update proposals set status='accepted' where id=${X}`;
  expect(await events("crm.proposal.accepted")).toHaveLength(1);
});

it("keeps delay resumptions attached to the real run and rejects changed business content or a non-service actor", async () => {
  const event = await ready();
  const parent = (await events())[0];
  await seedRun(event);
  await expect(resume(event, { ...parent.after, name: "Forged domain" })).rejects.toMatchObject({
    code: "42501",
  });
  await expect(resume(event, undefined, U)).rejects.toMatchObject({ code: "42501" });
  const [child] = await resume(event);
  expect(await check(child.id)).toEqual({ status: 200, payload: true });
  expect(
    (
      await db`select notification_parent_event_id,after from workflow_events where id=${child.id}`
    )[0],
  ).toMatchObject({
    notification_parent_event_id: event,
    after: { name: "Synthetic deal", __wf_path: [{ path: [0], step: 1 }] },
  });
  await expect(
    withRole(
      "service_role",
      null,
      (tx) => tx`update workflow_events set notification_event_key=null where id=${child.id}`,
    ),
  ).rejects.toMatchObject({ code: "42501" });
  await db`update workflows set last_published_at=clock_timestamp() where id=${WF}`;
  expect(await check(child.id)).toEqual({ status: 200, payload: false });
});

it("resumes through the real approval subject/RLS gate and preserves the original business snapshot", async () => {
  const event = await ready();
  const run = await seedRun(event, "waiting_approval");
  const approval = randomUUID();
  const frame = [{ path: [1], step: 2 }];
  await db`insert into workflow_approvals(id,workspace_id,workflow_id,run_id,entity,entity_id,approver_user_id,workflow_version,resume_cursor,event_snapshot)
    values(${approval},${W},${WF},${run},'deals',${X},${U},1,2,${db.json({ after: { name: "Untrusted approval snapshot", __wf_path: frame } })})`;
  const decide = (actor: string) =>
    request(
      "/rpc/sales_workflow_approval_decide",
      { p_actor: actor, p_id: approval, p_decision: "approved", p_comment: "Synthetic approval" },
      U,
      fixtureJwt("service_role"),
    );
  expect((await decide(F)).status).toBe(403);
  expect(await decide(U)).toMatchObject({
    status: 200,
    payload: { ok: true, decision: "approved" },
  });
  const [child] =
    await db`select id,notification_parent_event_id,after from workflow_events where notification_parent_event_id=${event}`;
  expect(child).toMatchObject({
    notification_parent_event_id: event,
    after: { name: "Synthetic deal", __wf_path: frame },
  });
  expect(await check(child.id)).toEqual({ status: 200, payload: true });
  expect(
    (await db`select status,decided_by from workflow_approvals where id=${approval}`)[0],
  ).toMatchObject({ status: "approved", decided_by: U });
  await db`update workflows set published_version=2,last_published_at=clock_timestamp() where id=${WF}`;
  expect(await check(child.id, WF, 2)).toEqual({ status: 200, payload: false });
});

async function proposalApproval() {
  await configure("crm.proposal.accepted", "proposals");
  await db`update proposals set status='sent',locked=true,version=2,deal_id=${X} where id=${X}`;
  await db`update proposals set status='accepted',decided_at=clock_timestamp() where id=${X}`;
  const [event] = await events("crm.proposal.accepted");
  const run = randomUUID(),
    approval = randomUUID();
  await db`insert into workflow_runs(id,workspace_id,owner_id,workflow_id,event_id,entity,entity_id,status)
    values(${run},${W},${A},${WF},${event.id},'proposals',${X},'waiting_approval')`;
  await db`insert into workflow_approvals(id,workspace_id,workflow_id,run_id,entity,entity_id,approver_user_id,workflow_version,resume_cursor,event_snapshot)
    values(${approval},${W},${WF},${run},'proposals',${X},${U},1,1,${db.json({ after: { ...event.after, __wf_path: [{ path: [0], step: 1 }] } })})`;
  return { event: event.id as string, run, approval };
}
const proposalRecipient = (actor = U) =>
  request(
    "/rpc/sales_workflow_approval_recipient",
    {
      p_workflow: WF,
      p_user: actor,
      p_entity: "proposals",
      p_id: X,
      p_version: 1,
    },
    U,
    fixtureJwt("service_role"),
  );
const decideProposal = (approval: string, actor = U) =>
  request(
    "/rpc/sales_workflow_approval_decide",
    {
      p_actor: actor,
      p_id: approval,
      p_decision: "approved",
      p_comment: "Synthetic proposal decision",
    },
    U,
    fixtureJwt("service_role"),
  );
async function proposalFeeds(ids: Awaited<ReturnType<typeof proposalApproval>>, actor = U) {
  return Promise.all([
    request(`/workflow_events?select=id&id=eq.${ids.event}`, undefined, actor),
    request(`/workflow_runs?select=id&id=eq.${ids.run}`, undefined, actor),
    request(`/workflow_approvals?select=id&id=eq.${ids.approval}`, undefined, actor),
  ]);
}
async function expectProposalBlocked(ids: Awaited<ReturnType<typeof proposalApproval>>, actor = U) {
  expect(await proposalRecipient(actor)).toEqual({ status: 200, payload: false });
  expect(await proposalFeeds(ids, actor)).toEqual(
    Array.from({ length: 3 }, () => ({ status: 200, payload: [] })),
  );
  expect((await decideProposal(ids.approval, actor)).status).toBe(403);
  expect(
    (await db`select status,decided_at from workflow_approvals where id=${ids.approval}`)[0],
  ).toEqual({ status: "pending", decided_at: null });
  expect((await db`select status from workflow_runs where id=${ids.run}`)[0].status).toBe(
    "waiting_approval",
  );
  expect(
    await db`select id from workflow_events where notification_parent_event_id=${ids.event}`,
  ).toHaveLength(0);
}

it("proposal approval allows the authorized assigned member and exposes event run and approval feeds through source RLS", async () => {
  const ids = await proposalApproval();
  expect(await proposalRecipient()).toEqual({ status: 200, payload: true });
  expect(await proposalFeeds(ids)).toEqual([
    { status: 200, payload: [{ id: ids.event }] },
    { status: 200, payload: [{ id: ids.run }] },
    { status: 200, payload: [{ id: ids.approval }] },
  ]);
  expect(await request("/rpc/sales_event_reference_access", { e: "proposals", i: X })).toEqual({
    status: 200,
    payload: true,
  });
  expect(await request("/rpc/sales_event_reference_access", { e: "quotes", i: X })).toEqual({
    status: 200,
    payload: false,
  });
  expect(
    await withRole("authenticated", U, async (tx) => {
      await tx`select set_config('test.notification_hidden',${X},true)`;
      return {
        visibleSourceRows: (await tx`select id from proposals where id=${X}`).length,
        allowed: (await tx`select sales_event_reference_access('proposals',${X}) allowed`)[0]
          .allowed,
      };
    }),
  ).toEqual({ visibleSourceRows: 0, allowed: false });
  // C has the same role and source visibility, but is not the assigned approver.
  expect((await decideProposal(ids.approval, C)).status).toBe(403);
  expect(await decideProposal(ids.approval)).toMatchObject({
    status: 200,
    payload: { ok: true, decision: "approved" },
  });
  const [child] =
    await db`select id,notification_event_key,notification_parent_event_id from workflow_events where notification_parent_event_id=${ids.event}`;
  expect(child).toMatchObject({
    notification_event_key: "crm.proposal.accepted",
    notification_parent_event_id: ids.event,
  });
  expect(await check(child.id)).toEqual({ status: 200, payload: true });
  expect(await request(`/workflow_events?select=id&id=eq.${child.id}`)).toEqual({
    status: 200,
    payload: [{ id: child.id }],
  });
});

it("proposal approval rejects missing source permission and hides all three feeds", async () => {
  const ids = await proposalApproval();
  await db`delete from job_role_permission_overrides where role_id=${ROLE} and permission_key='techsales.proposals.view.workspace'`;
  await expectProposalBlocked(ids);
});

it("proposal approval rejects an explicit source deny and hides all three feeds", async () => {
  const ids = await proposalApproval();
  await db`update job_role_permission_overrides set effect='deny' where role_id=${ROLE} and permission_key='techsales.proposals.view.workspace'`;
  await expectProposalBlocked(ids);
});

it("proposal approval rejects another workspace even when that actor has equivalent permissions there", async () => {
  const ids = await proposalApproval();
  const foreignRole = randomUUID();
  await db`insert into job_roles(id,workspace_id) values(${foreignRole},${B})`;
  await db`insert into user_job_roles(role_id,user_id,workspace_id,owner_id) values(${foreignRole},${F},${B},${B})`;
  for (const key of [
    "techsales.proposals.view.workspace",
    "system.workflows.view.workspace",
    "system.workflows.manage.workspace",
    "system.workflow_approvals.view.workspace",
    "system.workflow_approvals.manage.workspace",
  ])
    await db`insert into job_role_permission_overrides(workspace_id,role_id,permission_key,effect) values(${B},${foreignRole},${key},'grant')`;
  await expectProposalBlocked(ids, F);
  await db`update proposals set workspace_id=${B} where id=${X}`;
  await expectProposalBlocked(ids);
});

it("proposal approval rejects an inactive member and hides all three feeds", async () => {
  const ids = await proposalApproval();
  await db`update workspace_members set status='inactive' where workspace_id=${W} and user_id=${U}`;
  await expectProposalBlocked(ids);
});

it("emits an accepted draft only from the linked accepted proposal and invalidates bypass or revision changes", async () => {
  await configure("contracts.draft.accepted");
  await db`update proposals set status='accepted',locked=true,decided_at=clock_timestamp(),deal_id=${X} where id=${X}`;
  const draft = randomUUID();
  await db`insert into contract_drafts(id,workspace_id,deal_id,proposal_id,status,public_token) values(${draft},${W},${X},${X},'sent','synthetic-token')`;
  await db`update contract_drafts set status='accepted',decided_at=clock_timestamp(),client_decided_at=clock_timestamp() where id=${draft}`;
  const [event] = await events("contracts.draft.accepted");
  expect(event).toMatchObject({ entity: "deals", entity_id: X });
  expect(await check(event.id)).toEqual({ status: 200, payload: true });
  await db`update contract_drafts set revision=2 where id=${draft}`;
  expect(await check(event.id)).toEqual({ status: 200, payload: false });
  await db`update contract_drafts set status='sent',client_acceptance_bypassed_at=clock_timestamp() where id=${draft}`;
  await db`update contract_drafts set status='accepted' where id=${draft}`;
  expect(await events("contracts.draft.accepted")).toHaveLength(1);
});

it("requires native completion evidence for an ordinary contract and rejects partial, stale or revoked signatures", async () => {
  await configure("contracts.signature.completed", "contracts");
  const document = randomUUID(),
    customer = randomUUID(),
    issuer = randomUUID(),
    evidence = randomUUID();
  const body = "Synthetic signed contract";
  await db`insert into esign_documents(id,workspace_id,status,body,content_hash,sealed_at,completed_at)
    values(${document},${W},'sent',${body},encode(extensions.digest(convert_to(${body},'UTF8'),'sha256'),'hex'),now(),now())`;
  await db`insert into esign_signers(id,workspace_id,document_id,status,signed_at) values(${customer},${W},${document},'signed',now()),(${issuer},${W},${document},'pending',null)`;
  await db`insert into hiring_contract_evidence(id,workspace_id,contract_id,kind,contract_hash,document_id,document_hash,customer_signer_id,issuer_signer_id)
    select ${evidence},${W},${X},'native',hiring_contract_fingerprint(${X}),${document},content_hash,${customer},${issuer} from esign_documents where id=${document}`;
  await db`update esign_documents set status='completed' where id=${document}`;
  expect(await events("contracts.signature.completed")).toHaveLength(0);
  await db`update esign_signers set status='signed',signed_at=now() where id=${issuer}`;
  await db`update esign_documents set status='sent' where id=${document}`;
  await db`update esign_documents set status='completed' where id=${document}`;
  const [event] = await events("contracts.signature.completed");
  expect(event).toMatchObject({ entity: "contracts", entity_id: X });
  expect(await check(event.id)).toEqual({ status: 200, payload: true });
  await db`update esign_documents set status='completed' where id=${document}`;
  expect(await events("contracts.signature.completed")).toHaveLength(1);
  await db`update contracts set title='Changed after signature' where id=${X}`;
  expect(await check(event.id)).toEqual({ status: 200, payload: false });
  await db`update contracts set title=null where id=${X}`;
  await db`update hiring_contract_evidence set revoked_at=now() where id=${evidence}`;
  expect(await check(event.id)).toEqual({ status: 200, payload: false });
});

it("accepts ForSign only after current external evidence and storage hashes are recorded", async () => {
  await configure("contracts.signature.completed", "contracts");
  const evidence = randomUUID(),
    operation = randomUUID();
  await db`insert into hiring_contract_evidence(id,workspace_id,contract_id,kind,contract_hash,file_path,file_hash)
    values(${evidence},${W},${X},'external',hiring_contract_fingerprint(${X}),'fixture/signed.pdf','synthetic-sha')`;
  await db`insert into storage.objects(bucket_id,name,user_metadata) select 'contract-signature-evidence',file_path,jsonb_build_object('sha256',file_hash,'contract_hash',contract_hash) from hiring_contract_evidence where id=${evidence}`;
  await db`insert into contract_forsign_operations(id,workspace_id,contract_id,status,operation_id,contract_hash)
    values(${operation},${W},${X},'completed','synthetic-operation',hiring_contract_fingerprint(${X}))`;
  expect(await events("contracts.signature.completed")).toHaveLength(0);
  await db`update contract_forsign_operations set evidence_id=${evidence},status='evidence_recorded' where id=${operation}`;
  const [event] = await events("contracts.signature.completed");
  expect(await check(event.id)).toEqual({ status: 200, payload: true });
  await db`update contract_forsign_operations set status='evidence_recorded' where id=${operation}`;
  expect(await events("contracts.signature.completed")).toHaveLength(1);
  await db`update storage.objects set user_metadata='{"sha256":"changed"}' where name='fixture/signed.pdf'`;
  expect(await check(event.id)).toEqual({ status: 200, payload: false });
});

it("keeps 288 proved resumptions valid and invalidates the entire wait when its original signature is changed or revoked", async () => {
  await configure("contracts.signature.completed", "contracts");
  const evidence = randomUUID(),
    operation = randomUUID();
  await db`insert into hiring_contract_evidence(id,workspace_id,contract_id,kind,contract_hash,file_path,file_hash)
    values(${evidence},${W},${X},'external',hiring_contract_fingerprint(${X}),'fixture/long-wait.pdf','synthetic-sha')`;
  await db`insert into storage.objects(bucket_id,name,user_metadata) select 'contract-signature-evidence',file_path,jsonb_build_object('sha256',file_hash,'contract_hash',contract_hash) from hiring_contract_evidence where id=${evidence}`;
  await db`insert into contract_forsign_operations(id,workspace_id,contract_id,status,operation_id,contract_hash)
    values(${operation},${W},${X},'completed','synthetic-long-wait',hiring_contract_fingerprint(${X}))`;
  await db`update contract_forsign_operations set evidence_id=${evidence},status='evidence_recorded' where id=${operation}`;
  const [root] = await events("contracts.signature.completed");
  const chain = await withRole("service_role", null, async (tx) => {
    const ids: string[] = [];
    let parent = root.id as string;
    for (let cursor = 1; cursor <= 288; cursor++) {
      await tx`insert into workflow_runs(id,workspace_id,owner_id,workflow_id,event_id,entity,entity_id,status)
        values(${randomUUID()},${W},${A},${WF},${parent},'contracts',${X},'running')`;
      const [child] =
        await tx`insert into workflow_events(workspace_id,owner_id,entity,entity_id,event_type,before,after,resume_workflow_id,resume_cursor,workflow_version,notification_event_key,notification_parent_event_id)
        select workspace_id,${U},entity,entity_id,event_type,before,after||jsonb_build_object('__wf_wait',jsonb_build_object('poll',${cursor}::integer)),${WF},${cursor},1,notification_event_key,id from workflow_events where id=${parent} returning id`;
      parent = child.id as string;
      ids.push(parent);
    }
    return ids;
  });
  expect(chain).toHaveLength(288);
  expect(
    (
      await db`select count(*)::int total,count(distinct root_event_id)::int roots,min(root_event_id::text) root from notification_business_event_proofs where source_id=${X} and event_key='contracts.signature.completed'`
    )[0],
  ).toEqual({ total: 289, roots: 1, root: root.id });
  const endpoints = [root.id, chain[0], chain.at(-1)!] as string[];
  for (const id of endpoints) expect(await check(id)).toEqual({ status: 200, payload: true });
  await expect(
    withRole(
      "service_role",
      null,
      (
        tx,
      ) => tx`insert into workflow_events(workspace_id,owner_id,entity,entity_id,event_type,before,after,resume_workflow_id,resume_cursor,workflow_version,notification_event_key,notification_parent_event_id)
    select workspace_id,${U},entity,entity_id,event_type,before,after,${WF},289,1,notification_event_key,${EVENT} from workflow_events where id=${root.id}`,
    ),
  ).rejects.toMatchObject({ code: "42501" });
  await db`update contracts set title='Changed during durable wait' where id=${X}`;
  for (const id of endpoints) expect(await check(id)).toEqual({ status: 200, payload: false });
  await db`update contracts set title=null where id=${X}`;
  for (const id of endpoints) expect(await check(id)).toEqual({ status: 200, payload: true });
  await db`update hiring_contract_evidence set revoked_at=now() where id=${evidence}`;
  for (const id of endpoints) expect(await check(id)).toEqual({ status: 200, payload: false });
});

const dueTick = () =>
  request("/rpc/notification_business_due_tick", { p_limit: 100 }, U, fixtureJwt("service_role"));
it("queues distinct expiration and notice deadlines once, including across republishing, and rechecks a changed deadline", async () => {
  await configure("contracts.contract.expiring", "contracts");
  const renewal = randomUUID();
  await db`insert into workflows(id,workspace_id,owner_id,execution_user_id,entity,trigger,actions,last_published_at)
    values(${renewal},${W},${A},${U},'contracts',${triggerJson("contracts.contract.renewal_due")},${db.json([action])},clock_timestamp()-interval '1 second')`;
  await db`update contracts set status='active',ends_at=(now() at time zone 'America/Sao_Paulo')::date+10,auto_renew=true,notice_days=5 where id=${X}`;
  expect(await dueTick()).toEqual({ status: 200, payload: { enqueued: 2 } });
  const emitted = await events();
  expect(emitted.map((row) => row.notification_event_key).sort()).toEqual([
    "contracts.contract.expiring",
    "contracts.contract.renewal_due",
  ]);
  for (const event of emitted)
    expect(
      await check(event.id, event.notification_event_key.endsWith("renewal_due") ? renewal : WF),
    ).toEqual({ status: 200, payload: true });
  expect(await dueTick()).toEqual({ status: 200, payload: { enqueued: 0 } });
  await db`update contracts set ends_at=ends_at+1 where id=${X}`;
  for (const event of emitted)
    expect(
      await check(event.id, event.notification_event_key.endsWith("renewal_due") ? renewal : WF),
    ).toEqual({ status: 200, payload: false });
  await db`update contracts set ends_at=ends_at-1 where id=${X}`;
  await db`update workflows set published_version=2,last_published_at=clock_timestamp() where id in(${WF},${renewal})`;
  expect(await dueTick()).toEqual({ status: 200, payload: { enqueued: 0 } });
  for (const event of emitted)
    expect(
      await check(event.id, event.notification_event_key.endsWith("renewal_due") ? renewal : WF, 2),
    ).toEqual({ status: 200, payload: false });
});

it("does not schedule expired, distant, disabled-renewal or invalid-notice deadlines", async () => {
  await configure("contracts.contract.renewal_due", "contracts");
  for (const [days, renew, notice] of [
    [-1, true, 0],
    [400, true, 5],
    [10, false, 5],
    [10, true, -1],
  ] as const) {
    await db`update contracts set status='active',ends_at=(now() at time zone 'America/Sao_Paulo')::date+${days}::integer,auto_renew=${renew},notice_days=${notice} where id=${X}`;
    expect(await dueTick()).toEqual({ status: 200, payload: { enqueued: 0 } });
  }
  expect(await events()).toHaveLength(0);
});

it("isolates WhatsApp event opt-outs and rechecks them before sending without overriding consent revocation", async () => {
  const won = await ready();
  const lostWorkflow = randomUUID();
  await db`insert into workflows(id,workspace_id,owner_id,execution_user_id,entity,trigger,actions,last_published_at)
    values(${lostWorkflow},${W},${A},${U},'deals',${triggerJson("crm.deal.lost")},${db.json([action])},clock_timestamp()-interval '1 second')`;
  await db`update deals set stage_id='custom_lost' where id=${X}`;
  const [lost] = await events("crm.deal.lost");
  await withRole("authenticated", U, async (tx) => {
    await tx`select notification_delivery_settings_save(${W},${tx.json({ email_enabled: true, whatsapp_enabled: true, email_daily_limit: 10, whatsapp_daily_limit: 10, wa_sender_id: "123456789", wa_template_name: "techerp_update", wa_template_language: "pt_BR", wa_estimated_unit_micros: 1000, wa_daily_budget_micros: 10000, currency: "BRL" })},0)`;
    await tx`select save_notification_delivery_consent(${W},true,'+5548999990001',0)`;
  });
  await db`insert into notification_user_preferences(workspace_id,user_id,settings,revision) values(${W},${U},'{"eventOverrides":{"crm.deal.won":{"whatsapp":false}}}',1)`;
  expect(await dispatch(won, "deals", { channels: ["whatsapp"], fallback: "none" })).toMatchObject({
    queued: 1,
  });
  expect(
    await dispatch(lost.id, "deals", { channels: ["whatsapp"], fallback: "none" }, lostWorkflow),
  ).toMatchObject({ queued: 1 });
  const jobs =
    await db`select d.id,i.event_key from workflow_deliveries d join notification_delivery_intents i on i.id=d.notification_intent_id order by i.event_key`;
  const wonJob = jobs.find((job) => job.event_key === "crm.deal.won")!;
  const lostJob = jobs.find((job) => job.event_key === "crm.deal.lost")!;
  const claim = (id: string) =>
    withRole(
      "service_role",
      null,
      async (tx) => (await tx`select notification_delivery_claim(${id}) result`)[0].result,
    );
  expect(await claim(wonJob.id)).toMatchObject({
    result: "suppressed",
    reason: "preferences_disabled",
  });
  const claimed = await claim(lostJob.id);
  expect(claimed).toMatchObject({ result: "claimed" });
  await db`update notification_user_preferences set settings='{"eventOverrides":{"crm.deal.won":{"whatsapp":true},"crm.deal.lost":{"whatsapp":false}}}',revision=revision+1 where workspace_id=${W} and user_id=${U}`;
  const preflight = (id: string, token: string) =>
    withRole(
      "service_role",
      null,
      async (tx) =>
        (await tx`select notification_delivery_preflight(${id},${token}) result`)[0].result,
    );
  expect(await preflight(lostJob.id, claimed.token)).toMatchObject({
    allowed: false,
    reason: "preferences_disabled",
  });
  await withRole("authenticated", U, async (tx) => {
    await tx`select save_notification_delivery_consent(${W},false,'',1)`;
  });
  const thirdWorkflow = randomUUID();
  await db`insert into workflows(id,workspace_id,owner_id,execution_user_id,entity,trigger,actions,last_published_at)
    values(${thirdWorkflow},${W},${A},${U},'deals',${triggerJson("crm.deal.won")},${db.json([action])},clock_timestamp()-interval '1 second')`;
  await db`update deals set stage_id='custom_won' where id=${X}`;
  const freshWon = (await events("crm.deal.won")).find((event) => event.id !== won)!;
  await dispatch(freshWon.id, "deals", { channels: ["whatsapp"], fallback: "none" }, thirdWorkflow);
  const [third] = await db`select id from workflow_deliveries where workflow_id=${thirdWorkflow}`;
  expect(await claim(third.id)).toMatchObject({ result: "suppressed", reason: "consent_revoked" });
});
