import { beforeEach, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { projectWorkflowSnapshot } from "./workflows/engine/authorization.server";
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
  D,
  F,
  ROLE,
  X,
  WF,
  reset,
  withRole,
  request,
  fixtureJwt,
} from "../../tests/fixtures/notification-deliveries";

beforeEach(reset);
const DOC = "f1000000-0000-4000-8000-000000000001";
const title = "Atualização disponível";
const recipients = [{ kind: "source_responsible" }];
const pending = [{ kind: "pending_approvers" }];
const inapp = { channels: ["inapp"], fallback: "none" };
const eventRows = () =>
  db`select * from workflow_events where notification_event_key like 'ats.%' or notification_event_key like 'people.%' order by created_at,id`;
const check = (event: string, workflow = WF) =>
  request(
    "/rpc/notification_business_event_check",
    { p_event: event, p_workflow: workflow, p_version: 1 },
    U,
    fixtureJwt("service_role"),
  );
const tick = () =>
  request("/rpc/notification_business_due_tick", { p_limit: 100 }, U, fixtureJwt("service_role"));

async function grant(...keys: string[]) {
  for (const key of keys)
    await db`insert into job_role_permission_overrides(workspace_id,role_id,permission_key,effect) values(${W},${ROLE},${key},'grant') on conflict do nothing`;
}
async function configure(key: WorkflowNotificationEventKey, entity: string) {
  const trigger = JSON.parse(JSON.stringify(workflowNotificationEventTrigger(key)));
  const rules = key === "people.approval.pending" ? pending : recipients;
  await db`update workflows set entity=${entity},execution_user_id=${U},trigger=${db.json(trigger)},
    actions=${db.json([{ type: "send_notification", title, recipients: rules, delivery: inapp }])},last_published_at=clock_timestamp()-interval '10 days' where id=${WF}`;
  await db`update people set full_name='Synthetic person',email='person@example.test',status='active',archived=false where id=${X}`;
}
async function readyDocument() {
  await grant("techpeople.documents.view.workspace");
  await configure("people.document.expiring", "people_documents");
  await db`insert into people_documents(id,workspace_id,owner_id,assigned_to,created_by,person_id,doc_type,doc_number,expires_at,status,file_url,file_name,notes)
    values(${DOC},${W},${A},${U},${C},${X},'Synthetic private document','private-document-number',
    (now() at time zone 'America/Sao_Paulo')::date+5,'valid','private/synthetic/document','private-document.pdf','private-document-note')`;
  expect(await tick()).toMatchObject({ status: 200, payload: { enqueued: 1 } });
  return (await eventRows())[0].id as string;
}
async function seedRun(event: string) {
  const [row] = await db`select entity,entity_id from workflow_events where id=${event}`;
  const id = randomUUID();
  await db`insert into workflow_runs(id,workspace_id,owner_id,workflow_id,event_id,entity,entity_id)
    values(${id},${W},${A},${WF},${event},${row.entity},${row.entity_id}) on conflict(workflow_id,event_id) do nothing`;
  return (await db`select id from workflow_runs where workflow_id=${WF} and event_id=${event}`)[0]
    .id as string;
}
async function dispatch(event: string, rules = recipients) {
  const run = await seedRun(event);
  const [row] = await db`select entity,entity_id from workflow_events where id=${event}`;
  return withRole(
    "service_role",
    null,
    async (tx) =>
      (
        await tx`select notification_workflow_dispatch_v2(${WF},${run},1,${row.entity},${row.entity_id},${tx.json(rules)},${title},null,'0',${tx.json(inapp)}) result`
      )[0].result,
  );
}

it("Hire People notifications allow authorized member", async () => {
  const event = await readyDocument();
  expect(await check(event)).toEqual({ status: 200, payload: true });
  expect(await request(`/people_documents?select=id&id=eq.${DOC}`)).toEqual({
    status: 200,
    payload: [{ id: DOC }],
  });
  expect(await dispatch(event)).toMatchObject({ sent: 1, duplicate: 0 });
  expect(await dispatch(event)).toMatchObject({ sent: 0, duplicate: 1 });
  const [notice] =
    await db`select n.link,c.event_key,c.source_table,c.source_id from notifications n join notification_workspace_context c on c.notification_id=n.id`;
  expect(notice).toMatchObject({
    event_key: "people.document.expiring",
    source_table: "people_documents",
    source_id: DOC,
  });
  expect(notice.link).toContain(X);
  expect(notice.link).toContain(DOC);
});

it("Hire People notifications reject missing permission", async () => {
  const event = await readyDocument();
  await db`delete from job_role_permission_overrides where role_id=${ROLE} and permission_key='techpeople.documents.view.workspace'`;
  expect(await check(event)).toEqual({ status: 200, payload: false });
  expect(await request(`/people_documents?select=id&id=eq.${DOC}`)).toEqual({
    status: 200,
    payload: [],
  });
  expect(await request(`/people?select=id&id=eq.${X}`)).toEqual({
    status: 200,
    payload: [{ id: X }],
  });
  expect((await db`select count(*)::int n from notification_delivery_intents`)[0].n).toBe(0);
});

it("Hire People notifications reject explicit deny", async () => {
  const event = await readyDocument();
  await db`update job_role_permission_overrides set effect='deny' where role_id=${ROLE} and permission_key='techpeople.documents.view.workspace'`;
  expect(await check(event)).toEqual({ status: 200, payload: false });
  expect(await request(`/people_documents?select=id&id=eq.${DOC}`)).toEqual({
    status: 200,
    payload: [],
  });
  expect((await db`select count(*)::int n from notifications`)[0].n).toBe(0);
});

it("Hire People notifications reject foreign workspace", async () => {
  const event = await readyDocument();
  expect(await request(`/people_documents?select=id&id=eq.${DOC}`, undefined, F)).toEqual({
    status: 200,
    payload: [],
  });
  await db`update workflows set workspace_id=${B} where id=${WF}`;
  expect(await check(event)).toEqual({ status: 200, payload: false });
  expect((await db`select count(*)::int n from notifications`)[0].n).toBe(0);
});

it("Hire People notifications reject inactive member", async () => {
  const event = await readyDocument();
  await db`update workspace_members set status='inactive' where workspace_id=${W} and user_id=${U}`;
  expect(await check(event)).toEqual({ status: 200, payload: false });
  expect(await request(`/people_documents?select=id&id=eq.${DOC}`)).toEqual({
    status: 200,
    payload: [],
  });
  expect((await db`select count(*)::int n from workflow_deliveries`)[0].n).toBe(0);
});

it("derives document windows from civil dates without exposing document contents or repeating a known deadline", async () => {
  const event = await readyDocument();
  const [row] = await eventRows();
  expect(JSON.stringify(row.after)).not.toMatch(/private-document|private\/synthetic/);
  expect(row.after).toMatchObject({ id: DOC, person_id: X, status: "valid" });
  expect(await tick()).toMatchObject({ status: 200, payload: { enqueued: 0 } });
  await db`update people_documents set expires_at=(now() at time zone 'America/Sao_Paulo')::date-1 where id=${DOC}`;
  expect(await check(event)).toEqual({ status: 200, payload: false });
  expect(await tick()).toMatchObject({ status: 200, payload: { enqueued: 0 } });
  await db`update people_documents set expires_at=(now() at time zone 'America/Sao_Paulo')::date+5 where id=${DOC}`;
  expect(await tick()).toMatchObject({ status: 200, payload: { enqueued: 0 } });
  await db`update people set archived=true where id=${X}`;
  expect(await check(event)).toEqual({ status: 200, payload: false });
});

it("invalidates a pending document when its person is moved to another workspace or an independent RLS policy hides it", async () => {
  const event = await readyDocument();
  const allowed = await withRole("service_role", null, async (tx) => {
    await tx`select set_config('test.notification_hidden',${DOC},true)`;
    return (await tx`select notification_business_event_check(${event},${WF},1) allowed`)[0]
      .allowed;
  });
  expect(allowed).toBe(false);
  expect(await check(event)).toEqual({ status: 200, payload: true });
  await db`update people set workspace_id=${B} where id=${X}`;
  expect(await check(event)).toEqual({ status: 200, payload: false });
});

async function activeApplication(id = randomUUID()) {
  await db`update ats_jobs set status='published',title='Synthetic vacancy' where id=${X}`;
  await db`update ats_candidates set full_name='Synthetic candidate',email='candidate@example.test' where id=${X}`;
  await db`insert into ats_applications(id,workspace_id,owner_id,assigned_to,job_id,candidate_id,status,applied_at,hiring_details)
    values(${id},${W},${A},${U},${X},${X},'active',clock_timestamp(),${db.json({ salary: 12345, notes: "private-hiring-details" })})`;
  return id;
}

it("captures only a newly received canonical application and keeps hiring terms out of its public snapshot", async () => {
  await configure("ats.application.received", "ats_applications");
  const application = await activeApplication();
  const [event] = await eventRows();
  expect(await check(event.id)).toEqual({ status: 200, payload: true });
  expect(event.after).not.toHaveProperty("hiring_details");
  await db`update ats_applications set status='withdrawn' where id=${application}`;
  expect(await check(event.id)).toEqual({ status: 200, payload: false });
  await db`update ats_applications set status='active' where id=${application}`;
  expect(await eventRows()).toHaveLength(1);
  const old = randomUUID();
  await db`insert into ats_applications(id,workspace_id,owner_id,job_id,candidate_id,status,applied_at) values(${old},${W},${A},${X},${X},'active',now()-interval '1 year')`;
  expect(await check((await eventRows()).find((row) => row.entity_id === old)!.id)).toEqual({
    status: 200,
    payload: false,
  });
});

it("captures a future interview slot once and invalidates cancelled or rescheduled occurrences", async () => {
  await grant("techhire.interviews.view.workspace");
  await configure("ats.interview.scheduled", "ats_interviews");
  const application = await activeApplication();
  const interview = randomUUID();
  await db`insert into ats_interviews(id,workspace_id,owner_id,assigned_to,application_id,job_id,candidate_id,status,scheduled_at,duration_min,notes,self_schedule_token,ai_summary)
    values(${interview},${W},${A},${U},${application},${X},${X},'scheduled',now()+interval '2 days',60,'private-interview-note','private-scheduling-capability','private-AI-summary')`;
  const event = (await eventRows()).find(
    (row) => row.notification_event_key === "ats.interview.scheduled",
  )!;
  expect(await check(event.id)).toEqual({ status: 200, payload: true });
  expect(JSON.stringify(event.after)).not.toMatch(/private-/);
  await db`update ats_interviews set notes='Another private note' where id=${interview}`;
  expect(
    (await eventRows()).filter((row) => row.notification_event_key === "ats.interview.scheduled"),
  ).toHaveLength(1);
  await db`update ats_interviews set status='canceled' where id=${interview}`;
  expect(await check(event.id)).toEqual({ status: 200, payload: false });
  await db`update ats_interviews set status='scheduled',scheduled_at=now()+interval '3 days' where id=${interview}`;
  expect(
    (await eventRows()).filter((row) => row.notification_event_key === "ats.interview.scheduled"),
  ).toHaveLength(2);
});

it("emits offer acceptance only after the actual protected signing operation completes the real roster", async () => {
  await grant(
    "techhire.offers.view.workspace",
    "techhire.offers.update.workspace",
    "techhire.offer_terms.view.workspace",
    "techhire.offer_terms.update.workspace",
    "techhire.offers.approve.workspace",
    "techhire.offer_delivery.manage.workspace",
  );
  await configure("ats.offer.accepted", "ats_offers");
  const application = await activeApplication();
  const offer = randomUUID();
  await db`insert into ats_offers(id,workspace_id,owner_id,assigned_to,application_id,candidate_id,job_id,title,body,salary_amount,status)
    values(${offer},${W},${U},${U},${application},${X},${X},'Synthetic offer','private-offer-body',12345,'draft')`;
  for (const [action, actor] of [
    ["request", U],
    ["approve", D],
    ["send", U],
  ] as const)
    await withRole(
      "authenticated",
      actor,
      (tx) => tx`select ats_offer_transition(${offer},${action},1,'Synthetic review')`,
    );
  expect(
    (await eventRows()).filter((row) => row.notification_event_key === "ats.offer.accepted"),
  ).toHaveLength(0);
  const [signer] =
    await db`select s.public_token from esign_signers s join ats_offers o on o.esign_document_id=s.document_id where o.id=${offer}`;
  await withRole(
    "service_role",
    null,
    (tx) =>
      tx`select ats_offer_sign(${signer.public_token},'sign','Synthetic candidate','synthetic-signature',null,null,null)`,
  );
  const event = (await eventRows()).find(
    (row) => row.notification_event_key === "ats.offer.accepted",
  )!;
  expect(event).toBeDefined();
  expect(await check(event.id)).toEqual({ status: 200, payload: true });
  expect(JSON.stringify(event.after)).not.toMatch(/private-offer-body|salary|public_token/);
  expect(
    (await db`select a.status from ats_applications a where id=${application}`)[0].status,
  ).toBe("active");
  await db`delete from job_role_permission_overrides where role_id=${ROLE} and permission_key in('techhire.offer_terms.view.workspace','techhire.offer_terms.update.workspace')`;
  expect(await check(event.id)).toEqual({ status: 200, payload: true });
  expect(await request(`/ats_offers?select=id&id=eq.${offer}`)).toEqual({
    status: 200,
    payload: [{ id: offer }],
  });
  expect((await request(`/ats_offers?select=body&id=eq.${offer}`)).status).toBe(403);
  await dispatch(event.id);
  expect((await db`select link from notifications where entity_id=${offer}`)[0].link).toContain(
    `/offers?offerId=${offer}`,
  );
  await db`update job_role_permission_overrides set effect='deny' where role_id=${ROLE} and permission_key='techhire.offers.view.workspace'`;
  expect(await check(event.id)).toEqual({ status: 200, payload: false });
  await expect(
    withRole(
      "service_role",
      null,
      (tx) => tx`update ats_offers set status='sent' where id=${offer}`,
    ),
  ).rejects.toMatchObject({ code: "42501" });
});

async function pendingPreparation() {
  await grant(
    "techpeople.hiring_requests.view.workspace",
    "techpeople.hiring_requests.reference.view.workspace",
    "techpeople.hiring_requests.approval.approve.workspace",
    "techpeople.hiring_requests.approval_request.create.workspace",
  );
  await configure("people.approval.pending", "hiring_preparation_requests");
  const [group] = await db`select id from user_groups where workspace_id=${W} limit 1`;
  await db`insert into hiring_area_policies(workspace_id,area_id,manager_id,ceo_id,manager_delegate_id,ceo_delegate_id,updated_by)
    values(${W},${group.id},${U},${C},${D},${D},${A})`;
  const id = randomUUID();
  await db`insert into hiring_preparation_requests(id,workspace_id,kind,title,scope_text,purpose,area_id,status,revision,created_by,selection_mode)
    values(${id},${W},'professional','Synthetic professional request','Synthetic scope','internal',${group.id},'ready',1,${A},'needs_selection')`;
  await db`insert into hiring_preparation_reference_values(request_id,workspace_id,reference_value,revision) values(${id},${W},98765,1)`;
  const approval = await withRole(
    "authenticated",
    A,
    async (tx) =>
      (await tx`select hiring_preparation_approval_request(${W},'professional',${id},1) id`)[0]
        .id as string,
  );
  return {
    id,
    approval,
    event: (await eventRows()).find(
      (row) => row.notification_event_key === "people.approval.pending",
    )!,
  };
}
async function decidePreparation(id: string, approval: string, actor: string, stage: string) {
  return withRole(
    "authenticated",
    actor,
    (tx) =>
      tx`select hiring_preparation_approval_decide(${W},'professional',${id},1,${approval},${stage},'approved','Synthetic independent review',${randomUUID()})`,
  );
}

it("routes preparation notices to the released approver and reuses the canonical in-app row", async () => {
  const { id, approval, event } = await pendingPreparation();
  expect(await check(event.id)).toEqual({ status: 200, payload: true });
  expect((await db`select count(*)::int n from notifications`)[0].n).toBe(1);
  expect(JSON.stringify(event.after)).not.toMatch(
    /reference_value|98765|scope_text|Synthetic professional/,
  );
  await expect(decidePreparation(id, approval, C, "ceo")).rejects.toMatchObject({ code: "42501" });
  await dispatch(event.id, pending);
  expect((await db`select count(*)::int n from notifications`)[0].n).toBe(1);
  await decidePreparation(id, approval, U, "manager");
  expect(await check(event.id)).toEqual({ status: 200, payload: false });
  const notices = await db`select id,user_id from notifications order by created_at,id`;
  expect(notices.map((row) => row.user_id).sort()).toEqual([U, C].sort());
  expect(
    await request(`/notifications?select=id&id=eq.${notices.find((row) => row.user_id === U)!.id}`),
  ).toEqual({ status: 200, payload: [] });
  await decidePreparation(id, approval, C, "ceo");
  const latest = (await eventRows())
    .filter((row) => row.notification_event_key === "people.approval.pending")
    .at(-1)!;
  expect(await check(latest.id)).toEqual({ status: 200, payload: false });
});

it("retains one current canonical approval notice after queue purge and hides it when authority is revoked", async () => {
  const { event, approval } = await pendingPreparation();
  const [notice] = await db`select id from notifications`;
  await db`delete from workflow_events where id=${event.id}`;
  await db`select hiring_preparation_approval_notify(${approval})`;
  expect(await eventRows()).toHaveLength(0);
  expect((await db`select count(*)::int n from notifications`)[0].n).toBe(1);
  expect(await request(`/notifications?select=id&id=eq.${notice.id}`)).toEqual({
    status: 200,
    payload: [{ id: notice.id }],
  });
  expect(
    (
      await db`select count(*)::int n from notification_business_occurrence_receipts where event_key='people.approval.pending'`
    )[0].n,
  ).toBe(1);
  await db`update workspace_members set status='inactive' where workspace_id=${W} and user_id=${U}`;
  expect(await request(`/notifications?select=id&id=eq.${notice.id}`)).toEqual({
    status: 200,
    payload: [],
  });
});

it("rejects arbitrary approval transports in nested legacy containers and never exposes private proof tables", async () => {
  const { event } = await pendingPreparation();
  await db`update workflows set actions=${db.json([{ type: "legacy_container", actions: [{ type: "send_email", to: "outside@example.test" }] }])} where id=${WF}`;
  expect(await check(event.id)).toEqual({ status: 200, payload: false });
  expect((await db`select count(*)::int n from notification_delivery_intents`)[0].n).toBe(0);
  expect((await request("/notification_business_event_proofs?select=*")).status).toBe(403);
  expect(
    (
      await request(
        "/notification_business_occurrence_receipts?select=*",
        undefined,
        U,
        fixtureJwt("service_role"),
      )
    ).status,
  ).toBe(403);
});

it("captures one authorized ATS admission from the real employment RPC and invalidates an ended engagement", async () => {
  await grant(
    "techpeople.employment.manage.workspace",
    "techpeople.people.update.workspace",
    "techhire.candidates.update.workspace",
    "techhire.hiring.approve.workspace",
  );
  await configure("people.employment.started", "people");
  const application = await activeApplication();
  const entity = randomUUID(),
    model = randomUUID(),
    version = randomUUID();
  await db`update people set employment_type='pj',hire_date=current_date where id=${X}`;
  await db`update ats_jobs set hiring_governed=true,hiring_purpose='internal',employment_type='pj',hiring_role_id=${ROLE},hiring_approval_status='approved' where id=${X}`;
  await db`update ats_applications set status='hired' where id=${application}`;
  await db`insert into hiring_workspace_settings(workspace_id,signature_gate_enabled,employment_gate_enabled) values(${W},true,true)`;
  await db`insert into legal_entities(id,workspace_id,name,cnpj,active) values(${entity},${W},'Synthetic WK entity','00000000000000',true)`;
  await db`insert into hiring_access_models(id,workspace_id,role_id,name,active,updated_by) values(${model},${W},${ROLE},'Synthetic access model',true,${U})`;
  await db`insert into hiring_access_model_versions(id,model_id,workspace_id,revision,role_id,name,allocation_only,permission_keys,created_by) values(${version},${model},${W},1,${ROLE},'Synthetic version',true,'{}',${U})`;
  const admit = () =>
    withRole(
      "authenticated",
      U,
      async (tx) =>
        (
          await tx`select hiring_employment_admit(${W},${application},${X},${model},${entity},current_date,null,'Synthetic admission period','pj',current_date) id`
        )[0].id as string,
    );
  const engagement = await admit();
  expect(await admit()).toBe(engagement);
  const events = (await eventRows()).filter(
    (row) => row.notification_event_key === "people.employment.started",
  );
  expect(events).toHaveLength(1);
  expect(await check(events[0].id)).toEqual({ status: 200, payload: true });
  expect(events[0].after).not.toHaveProperty("monthly_cost");
  const [proof] =
    await db`select reference_id,producer_table,occurrence_key from notification_business_event_proofs where event_id=${events[0].id}`;
  expect(proof).toMatchObject({
    reference_id: engagement,
    producer_table: "hiring_employment_events",
    occurrence_key: engagement,
  });
  await db`update hiring_engagements set status='ended',revision=revision+1 where id=${engagement}`;
  expect(await check(events[0].id)).toEqual({ status: 200, payload: false });
});

it("captures a direct professional start after the real current approval and signature chain commits", async () => {
  await grant(
    "techpeople.hiring_requests.view.workspace",
    "techpeople.hiring_requests.reference.view.workspace",
    "techpeople.hiring_requests.approval.approve.workspace",
    "techpeople.hiring_requests.approval_request.create.workspace",
    "techpeople.hiring_requests.formalization.approve.workspace",
    "techpeople.hiring_requests.formalization.manage.workspace",
    "techpeople.hiring_requests.execution.approve.workspace",
    "techcontracts.contracts.view.workspace",
    "techcontracts.contract_drafts.approve.workspace",
    "techcontracts.approvals.approve.workspace",
    "techcontracts.signature_evidence.manage.workspace",
  );
  await configure("people.employment.started", "people");
  const requestId = randomUUID(),
    entity = randomUUID(),
    draft = randomUUID(),
    evidence = randomUUID(),
    operation = randomUUID();
  const [group] = await db`select id from user_groups where workspace_id=${W} limit 1`;
  await db`update people set employment_type='pj',hire_date=current_date where id=${X}`;
  await db`insert into legal_entities(id,workspace_id,name,cnpj,active) values(${entity},${W},'Synthetic WK entity','00000000000000',true)`;
  await db`insert into hiring_area_policies(workspace_id,area_id,manager_id,ceo_id,manager_delegate_id,ceo_delegate_id,updated_by)
    values(${W},${group.id},${U},${C},${D},${D},${A})`;
  await db`insert into hiring_preparation_requests(id,workspace_id,kind,title,scope_text,purpose,area_id,status,revision,created_by,selection_mode,person_id,regime,legal_entity_id)
    values(${requestId},${W},'professional','Synthetic direct request','Synthetic approved scope','internal',${group.id},'ready',1,${A},'defined',${X},'pj',${entity})`;
  await db`insert into hiring_preparation_reference_values(request_id,workspace_id,reference_value,revision) values(${requestId},${W},4321,1)`;
  const approval = await withRole(
    "authenticated",
    A,
    async (tx) =>
      (
        await tx`select hiring_preparation_approval_request(${W},'professional',${requestId},1) id`
      )[0].id as string,
  );
  await decidePreparation(requestId, approval, U, "manager");
  await decidePreparation(requestId, approval, C, "ceo");
  await db`update contracts set title='Synthetic purchase instrument',body_html='Synthetic approved instrument',role='client',document_kind='main',hiring_request_origin=${requestId},hiring_person_id=${X},contracting_legal_entity_id=${entity},status='signing',starts_at=current_date,ends_at=current_date+30 where id=${X}`;
  await db`insert into contract_drafts(id,workspace_id,hiring_request_origin,title,body_html,status,prepared_terms) values(${draft},${W},${requestId},'Synthetic draft','Synthetic approved instrument','accepted','{}')`;
  await db`insert into contract_handoff_settings(workspace_id,enabled,legal_user_id,finance_user_id,signature_user_id) values(${W},true,${D},${C},${D})`;
  await db`insert into contract_draft_approvers(workspace_id,user_id) values(${W},${D})`;
  await db`insert into hiring_formalizations(request_id,workspace_id,contract_id,draft_id,approval_id,request_revision,status,prepared_by,legal_user,finance_user,signature_user,settings_snapshot,legal_by,legal_at,accepted_at,finance_by,finance_at)
    select ${requestId},${W},${X},${draft},${approval},1,'signing',${D},${D},${C},${D},to_jsonb(s),${D},now(),now(),${C},now() from contract_handoff_settings s where workspace_id=${W}`;
  await db`update hiring_formalizations set document_hash=hiring_formalization_fingerprint(${requestId}) where request_id=${requestId}`;
  const [{ hash }] = await db`select hiring_contract_fingerprint(${X}) hash`;
  const fileHash = "f".repeat(64),
    file = `synthetic/${evidence}.pdf`;
  const roster = [{ email: "person@example.test" }, { email: "wk@example.test" }];
  await db`insert into hiring_contract_evidence(id,workspace_id,contract_id,kind,contract_hash,file_path,file_hash,recorded_by) values(${evidence},${W},${X},'external',${hash},${file},${fileHash},${D})`;
  await db`insert into contract_forsign_operations(workspace_id,contract_id,evidence_id,status,operation_id,contract_hash,requested_members,members)
    values(${W},${X},${evidence},'evidence_recorded','1001',${hash},${db.json(roster)},${db.json(roster.map((member) => ({ ...member, status: "Completed" })))})`;
  await db`insert into storage.objects(bucket_id,name,user_metadata) values('contract-signature-evidence',${file},${db.json({ sha256: fileHash, contract_hash: hash })})`;
  expect(
    (
      await db`select hiring_formalization_current(${W},${requestId}) current,hiring_formalization_valid(${requestId}) valid,hiring_formalization_signed(${W},${X}) signed`
    )[0],
  ).toEqual({ current: true, valid: true, signed: true });
  expect(
    (
      await db`select count(*)::int n from workflow_events where notification_event_key='people.employment.started'`
    )[0].n,
  ).toBe(0);
  const start = () =>
    withRole(
      "authenticated",
      U,
      async (tx) =>
        (
          await tx`select hiring_execution_start(${W},${requestId},1,current_date,current_date+30,'Synthetic authorized start',${operation}) id`
        )[0].id as string,
    );
  const started = await start();
  expect(await start()).toBe(started);
  expect((await db`select status from contracts where id=${X}`)[0].status).toBe("active");
  const events = (await eventRows()).filter(
    (row) => row.notification_event_key === "people.employment.started",
  );
  expect(events).toHaveLength(1);
  expect(await check(events[0].id)).toEqual({ status: 200, payload: true });
  const [proof] =
    await db`select producer_table,producer_id,reference_id from notification_business_event_proofs where event_id=${events[0].id}`;
  expect(proof).toMatchObject({ producer_table: "hiring_execution_starts", producer_id: started });
  expect(
    (
      await db`select job_id,application_id,model_version_id,hiring_request_id from hiring_engagements where id=${proof.reference_id}`
    )[0],
  ).toEqual({
    job_id: null,
    application_id: null,
    model_version_id: null,
    hiring_request_id: requestId,
  });
  await db`update hiring_contract_evidence set revoked_at=now() where id=${evidence}`;
  expect(await check(events[0].id)).toEqual({ status: 200, payload: false });
});

it("minimizes actual generic People event snapshots before public HTTP reads while preserving legacy public tokens", async () => {
  await configure("people.employment.started", "people");
  await db`update people set full_name='Previous public name',email='before@example.test',role_title='Previous public role',cost_hour=123,
    monthly_cost=456,personal_doc='{"number":"private-doc"}',bank='private-bank',bank_agency='private-agency',bank_account='private-account',pix_key='private-key',address='private-address' where id=${X}`;
  await db.unsafe(
    "CREATE TRIGGER notification_fixture_people AFTER UPDATE ON public.people FOR EACH ROW EXECUTE FUNCTION public.enqueue_workflow_event('people')",
  );
  let event: string;
  try {
    await db`update people set full_name='Current public name',email='after@example.test',role_title='Current public role',monthly_cost=789 where id=${X}`;
    event = (
      await db`select id from workflow_events where entity='people' and notification_event_key is null order by created_at desc limit 1`
    )[0].id as string;
  } finally {
    await db.unsafe("DROP TRIGGER notification_fixture_people ON public.people");
  }
  const response = await request(`/workflow_events?select=before,after&id=eq.${event}`);
  expect(response.status).toBe(200);
  const payload = response.payload as Array<{
    before: Record<string, unknown>;
    after: Record<string, unknown>;
  }>;
  expect(payload).toHaveLength(1);
  expect(payload[0].before).toMatchObject({
    full_name: "Previous public name",
    email: "before@example.test",
    role_title: "Previous public role",
  });
  expect(payload[0].after).toMatchObject({
    full_name: "Current public name",
    email: "after@example.test",
    role_title: "Current public role",
  });
  for (const snapshot of [payload[0].before, payload[0].after])
    for (const field of [
      "cost_hour",
      "monthly_cost",
      "personal_doc",
      "bank",
      "bank_agency",
      "bank_account",
      "pix_key",
      "address",
    ])
      expect(snapshot).not.toHaveProperty(field);
  expect((await request(`/people?select=monthly_cost&id=eq.${X}`)).status).toBe(403);
});

it("keeps all six named HR SQL projections identical to the TS resume projection", async () => {
  const sample = {
    id: X,
    workspace_id: W,
    owner_id: A,
    assigned_to: U,
    person_id: X,
    profile_id: U,
    candidate_id: X,
    job_id: X,
    application_id: X,
    interviewer_id: U,
    manager_id: C,
    status: "active",
    stage_value: "screening",
    stage_id: X,
    revision: 1,
    approved_revision: 1,
    approval_status: "approved",
    kind: "professional",
    created_by: A,
    created_at: "2026-11-20T12:00:00Z",
    updated_at: "2026-11-20T12:00:00Z",
    applied_at: "2026-11-20T12:00:00Z",
    scheduled_at: "2026-11-21T12:00:00Z",
    start_date: "2026-11-21",
    sent_at: "2026-11-20T12:00:00Z",
    signed_at: "2026-11-20T12:00:00Z",
    hire_date: "2026-11-21",
    termination_date: null,
    expires_at: "2026-12-20",
    full_name: "Private named identity",
    email: "private@example.test",
    doc_type: "Private document",
    doc_number: "private-number",
    file_name: "private.pdf",
    file_url: "private/path",
    notes: "private note",
    hiring_details: { salary: 12345 },
    salary_amount: 12345,
    body: "private body",
    public_token: "private capability",
    monthly_cost: 12345,
    ai_summary: "private summary",
    __wf_wait: { cursor: 1 },
    __wf_state: { sent: true },
    __wf_path: [{ key: "branch", cursor: 1 }],
  };
  for (const [entity, key] of [
    ["ats_applications", "ats.application.received"],
    ["ats_interviews", "ats.interview.scheduled"],
    ["ats_offers", "ats.offer.accepted"],
    ["people", "people.employment.started"],
    ["people_documents", "people.document.expiring"],
    ["hiring_preparation_requests", "people.approval.pending"],
  ] as const) {
    const [row] =
      await db`select techerp_api.notification_hr_snapshot(${entity},${db.json(sample)}) snapshot`;
    expect(row.snapshot).toEqual(projectWorkflowSnapshot(sample, entity, key));
  }
});

it("does not promote a caller-inserted approval notice and rejects write references to read-only sources", async () => {
  const { id, approval } = await pendingPreparation();
  const [before] =
    await db`select count(*)::int n from notification_business_event_proofs where event_key='people.approval.pending'`;
  const forged = randomUUID();
  await withRole(
    "service_role",
    null,
    (
      tx,
    ) => tx`insert into notifications(id,workspace_id,owner_id,user_id,type,title,entity,entity_id,dedupe_key)
    values(${forged},${W},${C},${C},'hiring_preparation_approval','Synthetic unproven notice','hiring_preparation_request',${id},${"preparation-approval:" + approval + ":ceo"})`,
  );
  expect(
    (
      await db`select count(*)::int n from notification_business_event_proofs where event_key='people.approval.pending'`
    )[0].n,
  ).toBe(before.n);
  expect(
    (
      await db`select event_key from notification_workspace_context where notification_id=${forged}`
    )[0].event_key,
  ).toBeNull();
  for (const action of ["update", "delete"]) {
    const allowed = await withRole(
      "service_role",
      null,
      async (tx) =>
        (
          await tx`select sales_worker_authorize('workflows',${WF},${tx.json([{ workflow_version: 1 }, { record_table: "hiring_preparation_requests", id, action }])}) allowed`
        )[0].allowed,
    );
    expect(allowed).toBe(false);
  }
});

it("uses only an explicit approval substitute and revokes notices when the live reference revision changes", async () => {
  const { id } = await pendingPreparation();
  await db`update hiring_area_policies set manager_id=${A},revision=revision+1 where workspace_id=${W}`;
  const approval = await withRole(
    "authenticated",
    A,
    async (tx) =>
      (await tx`select hiring_preparation_approval_request(${W},'professional',${id},1) id`)[0]
        .id as string,
  );
  const [notice] =
    await db`select n.id,p.event_id from notifications n join notification_business_event_proofs p on p.producer_id=n.id and p.root_event_id=p.event_id where n.user_id=${D} and p.reference_id=${approval}`;
  expect(notice).toBeDefined();
  expect(await check(notice.event_id)).toEqual({ status: 200, payload: true });
  await expect(decidePreparation(id, approval, A, "manager")).rejects.toMatchObject({
    code: "42501",
  });
  await db`update workspace_members set status='inactive' where workspace_id=${W} and user_id=${D}`;
  expect(await check(notice.event_id)).toEqual({ status: 200, payload: false });
  await db`update workspace_members set status='active' where workspace_id=${W} and user_id=${D}`;
  await decidePreparation(id, approval, D, "manager");
  const [ceo] =
    await db`select n.id,p.event_id from notifications n join notification_business_event_proofs p on p.producer_id=n.id and p.root_event_id=p.event_id where n.user_id=${C} and p.reference_id=${approval}`;
  expect(await check(ceo.event_id)).toEqual({ status: 200, payload: true });
  await db`update hiring_preparation_reference_values set revision=revision+1,reference_value=reference_value+1 where request_id=${id}`;
  expect(await check(ceo.event_id)).toEqual({ status: 200, payload: false });
  expect(await request(`/notifications?select=id&id=eq.${ceo.id}`, undefined, C)).toEqual({
    status: 200,
    payload: [],
  });
});

it("rejects a public named event without its private proof and invalidates a resumed document after its deadline changes", async () => {
  const event = await readyDocument();
  await expect(
    withRole(
      "service_role",
      null,
      (
        tx,
      ) => tx`insert into workflow_events(id,workspace_id,owner_id,entity,entity_id,notification_event_key)
    values(${randomUUID()},${W},${A},'people_documents',${DOC},'people.document.expiring')`,
    ),
  ).rejects.toMatchObject({ code: "42501" });
  const run = await seedRun(event);
  await db`update workflow_runs set status='running' where id=${run}`;
  const child = randomUUID();
  await withRole(
    "service_role",
    null,
    (
      tx,
    ) => tx`insert into workflow_events(id,workspace_id,owner_id,entity,entity_id,event_type,before,after,notification_event_key,notification_parent_event_id,resume_workflow_id,workflow_version,resume_cursor)
    select ${child},workspace_id,owner_id,entity,entity_id,event_type,before,after,'people.document.expiring',id,${WF},1,1 from workflow_events where id=${event}`,
  );
  expect(await check(child)).toEqual({ status: 200, payload: true });
  await db`update people_documents set expires_at=expires_at+1 where id=${DOC}`;
  expect(await check(event)).toEqual({ status: 200, payload: false });
  expect(await check(child)).toEqual({ status: 200, payload: false });
});
