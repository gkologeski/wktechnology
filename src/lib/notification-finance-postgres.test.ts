import { beforeEach, expect, it } from "vitest";
import { createHash, randomUUID } from "node:crypto";
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
const title = "Atualização financeira disponível";
const recipients = [{ kind: "source_responsible" }];
const delivery = { channels: ["inapp"], fallback: "none" };
const events = () =>
  db`select * from workflow_events where notification_event_key like 'finance.%' order by created_at,id`;
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
async function configure(key: WorkflowNotificationEventKey, entity = "financial_entries") {
  const trigger = JSON.parse(JSON.stringify(workflowNotificationEventTrigger(key)));
  await db`update workflows set entity=${entity},execution_user_id=${U},trigger=${db.json(trigger)},actions=${db.json([{ type: "send_notification", title, recipients, delivery }])},last_published_at=clock_timestamp()-interval '10 days' where id=${WF}`;
}
async function entry(
  key: WorkflowNotificationEventKey = "finance.payable.due",
  dueDelta = key.endsWith("overdue") ? -1 : 0,
) {
  await configure(key);
  await db`update financial_entries set direction=${key.includes("receivable") ? "receivable" : "payable"},status='open',amount=1000,paid_amount=0,currency='BRL',
    description='Synthetic private title',notes='Synthetic private note',attachments='["private/synthetic.pdf"]',metadata='{"pix_key":"synthetic-private-key"}',
    competence_date=(now() at time zone 'America/Sao_Paulo')::date,due_date=(now() at time zone 'America/Sao_Paulo')::date+${dueDelta}::integer where id=${X}`;
}
async function readyEntry() {
  await entry();
  // A new rule published during the current day may notify today's open title.
  await db`update workflows set last_published_at=clock_timestamp() where id=${WF}`;
  expect(await tick()).toMatchObject({ status: 200, payload: { enqueued: 1 } });
  return (await events())[0].id as string;
}
async function dispatch(event: string, rules = recipients) {
  const [row] = await db`select entity,entity_id from workflow_events where id=${event}`;
  const run = randomUUID();
  await db`insert into workflow_runs(id,workspace_id,owner_id,workflow_id,event_id,entity,entity_id) values(${run},${W},${A},${WF},${event},${row.entity},${row.entity_id}) on conflict(workflow_id,event_id) do nothing`;
  const [actual] =
    await db`select id from workflow_runs where workflow_id=${WF} and event_id=${event}`;
  return withRole(
    "service_role",
    null,
    async (tx) =>
      (
        await tx`select notification_workflow_dispatch_v2(${WF},${actual.id},1,${row.entity},${row.entity_id},${tx.json(rules)},${title},null,'0',${tx.json(delivery)}) result`
      )[0].result,
  );
}
async function payment(amount: number) {
  await grant(
    "techfinance.payments.create.workspace",
    "techfinance.payments.view.workspace",
    "techfinance.payments.delete.workspace",
  );
  return withRole(
    "authenticated",
    U,
    async (tx) =>
      (
        await tx`insert into financial_payments(workspace_id,entry_id,amount,paid_at,created_by) values(${W},${X},${amount},current_date,${U}) returning id`
      )[0].id as string,
  );
}

it("Finance notifications allow authorized member", async () => {
  const event = await readyEntry();
  expect(await check(event)).toEqual({ status: 200, payload: true });
  expect(await request(`/financial_entries?select=id&id=eq.${X}`)).toEqual({
    status: 200,
    payload: [{ id: X }],
  });
  expect(await dispatch(event)).toMatchObject({ sent: 1, duplicate: 0 });
  expect(await dispatch(event)).toMatchObject({ sent: 0, duplicate: 1 });
  const [notice] =
    await db`select n.link,c.event_key,c.source_table,c.source_id from notifications n join notification_workspace_context c on c.notification_id=n.id`;
  expect(notice).toMatchObject({
    link: `/finance/entries/${X}`,
    event_key: "finance.payable.due",
    source_table: "financial_entries",
    source_id: X,
  });
});
it("Finance notifications reject missing permission", async () => {
  const event = await readyEntry();
  await db`delete from job_role_permission_overrides where role_id=${ROLE} and permission_key='techfinance.entries.view.workspace'`;
  expect(await check(event)).toEqual({ status: 200, payload: false });
  expect(await request(`/financial_entries?select=id&id=eq.${X}`)).toEqual({
    status: 200,
    payload: [],
  });
  expect((await db`select count(*)::int n from notifications`)[0].n).toBe(0);
});
it("Finance notifications reject explicit deny", async () => {
  const event = await readyEntry();
  await db`update job_role_permission_overrides set effect='deny' where role_id=${ROLE} and permission_key='techfinance.entries.view.workspace'`;
  expect(await check(event)).toEqual({ status: 200, payload: false });
  expect(await request(`/financial_entries?select=id&id=eq.${X}`)).toEqual({
    status: 200,
    payload: [],
  });
  expect((await db`select count(*)::int n from notification_delivery_intents`)[0].n).toBe(0);
});
it("Finance notifications reject foreign workspace", async () => {
  const event = await readyEntry();
  expect(await request(`/financial_entries?select=id&id=eq.${X}`, undefined, F)).toEqual({
    status: 200,
    payload: [],
  });
  await db`update workflows set workspace_id=${B} where id=${WF}`;
  expect(await check(event)).toEqual({ status: 200, payload: false });
  expect((await db`select count(*)::int n from notifications`)[0].n).toBe(0);
});
it("Finance notifications reject inactive member", async () => {
  const event = await readyEntry();
  await db`update workspace_members set status='inactive' where workspace_id=${W} and user_id=${U}`;
  expect(await check(event)).toEqual({ status: 200, payload: false });
  expect(await request(`/financial_entries?select=id&id=eq.${X}`)).toEqual({
    status: 200,
    payload: [],
  });
  expect((await db`select count(*)::int n from workflow_deliveries`)[0].n).toBe(0);
});

it("uses the actual partial payment balance and revokes an occurrence when its final payment is posted", async () => {
  await entry("finance.receivable.overdue", -2);
  await payment(300);
  expect(
    (await db`select status,paid_amount from financial_entries where id=${X}`)[0],
  ).toMatchObject({ status: "partial", paid_amount: "300.00" });
  expect(await tick()).toMatchObject({ status: 200, payload: { enqueued: 1 } });
  const event = (await events())[0].id as string;
  expect(await check(event)).toEqual({ status: 200, payload: true });
  // A title reader does not need permission to inspect bank payment details.
  await db`delete from job_role_permission_overrides where role_id=${ROLE} and permission_key='techfinance.payments.view.workspace'`;
  expect(await check(event)).toEqual({ status: 200, payload: true });
  expect(await request("/financial_payments?select=id")).toMatchObject({
    status: 200,
    payload: [],
  });
  await payment(700);
  expect(
    (await db`select status,paid_amount from financial_entries where id=${X}`)[0],
  ).toMatchObject({ status: "paid", paid_amount: "1000.00" });
  expect(await check(event)).toEqual({ status: 200, payload: false });
  expect(await tick()).toMatchObject({ status: 200, payload: { enqueued: 0 } });
});

it("rejects clock-stale backlog but recovers a missed post-publication overdue crossing once", async () => {
  await entry("finance.payable.overdue", -1);
  await db`update workflows set last_published_at=clock_timestamp() where id=${WF}`;
  expect(await tick()).toMatchObject({ status: 200, payload: { enqueued: 0 } });
  await db`update workflows set last_published_at=((now() at time zone 'America/Sao_Paulo')::date::timestamp at time zone 'America/Sao_Paulo')-interval '1 minute' where id=${WF}`;
  // The old enum can still be open because no payment changed at midnight.
  expect((await db`select status from financial_entries where id=${X}`)[0].status).toBe("open");
  expect(await tick()).toMatchObject({ status: 200, payload: { enqueued: 1 } });
  const event = (await events())[0].id as string;
  expect(await check(event)).toEqual({ status: 200, payload: true });
  expect(await tick()).toMatchObject({ status: 200, payload: { enqueued: 0 } });
  await db`update workflows set published_version=2,last_published_at=clock_timestamp() where id=${WF}`;
  expect(await tick()).toMatchObject({ status: 200, payload: { enqueued: 0 } });
});

it("binds each reminder to its direction and deadline without repeating a previously observed date", async () => {
  const event = await readyEntry();
  await db`update financial_entries set due_date=due_date+1 where id=${X}`;
  expect(await check(event)).toEqual({ status: 200, payload: false });
  expect(await tick()).toMatchObject({ status: 200, payload: { enqueued: 0 } });
  await db`update financial_entries set due_date=due_date-1 where id=${X}`;
  expect(await tick()).toMatchObject({ status: 200, payload: { enqueued: 0 } });
  await db`update financial_entries set direction='receivable' where id=${X}`;
  expect(await check(event)).toEqual({ status: 200, payload: false });
});

it("keeps neutral public snapshots equal to the TS resume projection and leaves real amounts behind the title read boundary", async () => {
  const event = await readyEntry();
  const [row] = await db`select before,after from workflow_events where id=${event}`;
  expect(row.after).toMatchObject({ id: X, workspace_id: W, direction: "payable", status: "open" });
  for (const field of [
    "amount",
    "paid_amount",
    "description",
    "notes",
    "metadata",
    "attachments",
    "bank_account_id",
    "counterparty_company_id",
  ])
    expect(row.after).not.toHaveProperty(field);
  const [source] = await db`select to_jsonb(e) payload from financial_entries e where id=${X}`;
  expect(row.after).toEqual(
    projectWorkflowSnapshot(source.payload, "financial_entries", "finance.payable.due"),
  );
  const raw = await request(`/financial_entries?select=amount&id=eq.${X}`);
  expect(raw).toMatchObject({ status: 200, payload: [{ amount: 1000 }] });
  const exposed = await request(`/workflow_events?select=after&id=eq.${event}`);
  expect(exposed).toMatchObject({ status: 200, payload: [{ after: row.after }] });
});

/** Same real approval/formalization/signature/start chain as P10, with a private synthetic fiscal upload. */
async function pendingFiscalDocument(kind: "professional" | "supplier" = "professional") {
  const resource =
    kind === "professional" ? "techpeople.hiring_requests" : "techcontracts.supplier_requests";
  const docType = kind === "supplier" ? "nfe" : "nfse";
  await grant(
    `${resource}.view.workspace`,
    `${resource}.reference.view.workspace`,
    `${resource}.approval.approve.workspace`,
    `${resource}.approval_request.create.workspace`,
    `${resource}.formalization.approve.workspace`,
    `${resource}.formalization.manage.workspace`,
    `${resource}.execution.approve.workspace`,
    `${resource}.fiscal_documents.create.workspace`,
    `${resource}.fiscal_documents.view.workspace`,
    `${resource}.fiscal_documents.approve.workspace`,
    "techcontracts.contracts.view.workspace",
    "techcontracts.contract_drafts.approve.workspace",
    "techcontracts.approvals.approve.workspace",
    "techcontracts.signature_evidence.manage.workspace",
  );
  await configure("finance.invoice.received", "hiring_fiscal_documents");
  const requestId = randomUUID(),
    entity = randomUUID(),
    draft = randomUUID(),
    evidence = randomUUID();
  const [group] = await db`select id from user_groups where workspace_id=${W} limit 1`;
  const wkTax = "00000000000000",
    issuerTax = "11111111111111";
  await db`update people set full_name='Synthetic issuer',email='issuer@example.test',employment_type='pj',cnpj=${issuerTax},hire_date=current_date where id=${X}`;
  await db`update companies set name='Synthetic supplier',cnpj=${issuerTax} where id=${X}`;
  await db`update contacts set company_id=${X},email='issuer@example.test' where id=${X}`;
  await db`insert into legal_entities(id,workspace_id,name,cnpj,active) values(${entity},${W},'Synthetic WK entity',${wkTax},true)`;
  await db`insert into hiring_area_policies(workspace_id,area_id,manager_id,ceo_id,manager_delegate_id,ceo_delegate_id,updated_by) values(${W},${group.id},${U},${C},${D},${D},${A})`;
  await db`insert into hiring_preparation_requests(id,workspace_id,kind,title,scope_text,purpose,area_id,status,revision,created_by,selection_mode,person_id,regime,legal_entity_id,company_id,contact_id)
    values(${requestId},${W},${kind},'Synthetic fiscal request','Synthetic approved scope','internal',${group.id},'ready',1,${A},'defined',${kind === "professional" ? X : null},${kind === "professional" ? "pj" : null},${entity},${kind === "supplier" ? X : null},${kind === "supplier" ? X : null})`;
  await db`insert into hiring_preparation_reference_values(request_id,workspace_id,reference_value,revision) values(${requestId},${W},4321,1)`;
  const approval = await withRole(
    "authenticated",
    A,
    async (tx) =>
      (await tx`select hiring_preparation_approval_request(${W},${kind},${requestId},1) id`)[0]
        .id as string,
  );
  for (const [actor, stage] of [
    [U, "manager"],
    [C, "ceo"],
  ])
    await withRole(
      "authenticated",
      actor,
      (tx) =>
        tx`select hiring_preparation_approval_decide(${W},${kind},${requestId},1,${approval},${stage},'approved','Synthetic independent review',${randomUUID()})`,
    );
  await db`update contracts set title='Synthetic purchase instrument',body_html='Synthetic approved instrument',role='client',document_kind='main',hiring_request_origin=${requestId},hiring_person_id=${kind === "professional" ? X : null},counterparty_company_id=${kind === "supplier" ? X : null},contracting_legal_entity_id=${entity},status='signing',starts_at=current_date-5,ends_at=current_date+30 where id=${X}`;
  await db`insert into contract_drafts(id,workspace_id,hiring_request_origin,title,body_html,status,prepared_terms) values(${draft},${W},${requestId},'Synthetic draft','Synthetic approved instrument','accepted','{}')`;
  await db`insert into contract_handoff_settings(workspace_id,enabled,legal_user_id,finance_user_id,signature_user_id) values(${W},true,${D},${C},${D})`;
  await db`insert into contract_draft_approvers(workspace_id,user_id) values(${W},${D})`;
  await db`insert into hiring_formalizations(request_id,workspace_id,contract_id,draft_id,approval_id,request_revision,status,prepared_by,legal_user,finance_user,signature_user,settings_snapshot,legal_by,legal_at,accepted_at,finance_by,finance_at)
    select ${requestId},${W},${X},${draft},${approval},1,'signing',${D},${D},${C},${D},to_jsonb(s),${D},now(),now(),${C},now() from contract_handoff_settings s where workspace_id=${W}`;
  await db`update hiring_formalizations set document_hash=hiring_formalization_fingerprint(${requestId}) where request_id=${requestId}`;
  const [{ hash }] = await db`select hiring_contract_fingerprint(${X}) hash`;
  const fileHash = "f".repeat(64),
    file = `synthetic/${evidence}.pdf`,
    roster = [{ email: "issuer@example.test" }, { email: "wk@example.test" }];
  await db`insert into hiring_contract_evidence(id,workspace_id,contract_id,kind,contract_hash,file_path,file_hash,recorded_by) values(${evidence},${W},${X},'external',${hash},${file},${fileHash},${D})`;
  await db`insert into contract_forsign_operations(workspace_id,contract_id,evidence_id,status,operation_id,contract_hash,requested_members,members)
    values(${W},${X},${evidence},'evidence_recorded','1001',${hash},${db.json(roster)},${db.json(roster.map((member) => ({ ...member, status: "Completed" })))})`;
  await db`insert into storage.objects(bucket_id,name,user_metadata) values('contract-signature-evidence',${file},${db.json({ sha256: fileHash, contract_hash: hash })})`;
  const startId = await withRole(
    "authenticated",
    U,
    async (tx) =>
      (
        await tx`select hiring_execution_start(${W},${requestId},1,current_date-5,current_date+30,'Synthetic authorized start',${randomUUID()}) id`
      )[0].id as string,
  );
  const content = Buffer.from("<NFe><Synthetic>Local fixture only</Synthetic></NFe>");
  const sha = createHash("sha256").update(content).digest("hex");
  const reserved = await withRole(
    "authenticated",
    U,
    async (tx) =>
      (
        await tx`select hiring_fiscal_reserve(${W},${requestId},'synthetic-nf.xml','application/xml',${content.length},${randomUUID()}) result`
      )[0].result as { id: string; path: string },
  );
  expect(await events()).toHaveLength(0);
  await db`insert into storage.objects(bucket_id,name,metadata) values('hiring-fiscal-documents',${reserved.path},${db.json({ size: content.length, sha256: sha })})`;
  const attest = () =>
    withRole(
      "service_role",
      null,
      (tx) =>
        tx`select hiring_fiscal_attest(${W},${requestId},${reserved.id},${U},${sha},${content.length},'application/xml')`,
    );
  const register = () =>
    withRole(
      "authenticated",
      U,
      async (tx) =>
        (
          await tx`select hiring_fiscal_register(${W},${requestId},${reserved.id},${sha},${docType},null,${issuerTax},${wkTax},1500,'BRL','SYNTHETIC-NF-1',current_date-2,null) id`
        )[0].id as string,
    );
  return { ...reserved, requestId, startId, evidence, sha, attest, register };
}
async function readyFiscal(kind: "professional" | "supplier" = "professional") {
  const f = await pendingFiscalDocument(kind);
  await f.attest();
  expect(await events()).toHaveLength(0);
  expect(await f.register()).toBe(f.id);
  const rows = await events();
  expect(rows).toHaveLength(1);
  return { ...f, event: rows[0] };
}

it("emits invoice received only after real reservation attestation and canonical registration, not issuance or an old issue date", async () => {
  const f = await pendingFiscalDocument();
  await expect(f.register()).rejects.toThrow(/confirmado/);
  expect(await events()).toHaveLength(0);
  await f.attest();
  expect(await events()).toHaveLength(0);
  expect(await f.register()).toBe(f.id);
  expect(await f.register()).toBe(f.id);
  const rows = await events();
  expect(rows).toHaveLength(1);
  expect(await check(rows[0].id)).toEqual({ status: 200, payload: true });
  expect(rows[0].after).toMatchObject({
    id: f.id,
    request_id: f.requestId,
    doc_type: "nfse",
    status: "registered",
  });
  for (const field of [
    "amount",
    "document_number",
    "issuer_tax_id",
    "taker_tax_id",
    "file_name",
    "storage_path",
    "sha256",
    "server_sha256",
    "mime_type",
  ])
    expect(rows[0].after).not.toHaveProperty(field);
  const [source] =
    await db`select to_jsonb(f) payload from hiring_fiscal_documents f where id=${f.id}`;
  expect(rows[0].after).toEqual(
    projectWorkflowSnapshot(source.payload, "hiring_fiscal_documents", "finance.invoice.received"),
  );
  const [proof] =
    await db`select occurred_at from notification_business_event_proofs where event_id=${rows[0].id}`;
  expect(new Date(proof.occurred_at).toISOString()).toBe(
    new Date(source.payload.registered_at).toISOString(),
  );
  expect(await dispatch(rows[0].id)).toMatchObject({ sent: 1 });
  const notices =
    await db`select n.user_id,n.link,c.event_key from notifications n join notification_workspace_context c on c.notification_id=n.id where c.event_key='finance.invoice.received'`;
  expect(notices).toEqual([
    {
      user_id: C,
      link: `/people/hiring-requests?request=${f.requestId}&fiscalDocumentId=${f.id}`,
      event_key: "finance.invoice.received",
    },
  ]);
});

it("uses the fiscal boolean gateway without granting raw document reads and honors independent parent RLS", async () => {
  const f = await readyFiscal();
  expect(await request(`/rpc/notification_fiscal_reference_access?p_document=${f.id}`)).toEqual({
    status: 200,
    payload: true,
  });
  expect(await request("/rpc/notification_fiscal_reference_access", { p_document: f.id })).toEqual({
    status: 200,
    payload: true,
  });
  expect((await request(`/hiring_fiscal_documents?select=id&id=eq.${f.id}`)).status).toBe(403);
  expect(
    (await request(`/hiring_fiscal_documents?select=amount,storage_path&id=eq.${f.id}`)).status,
  ).toBe(403);
  expect(
    (
      await request(
        "/rpc/notification_fiscal_reference_access",
        { p_document: f.id },
        U,
        fixtureJwt("service_role"),
      )
    ).status,
  ).toBe(403);
  expect(
    await request("/rpc/notification_fiscal_reference_access", { p_document: f.id }, F),
  ).toEqual({ status: 200, payload: false });
  expect(
    await withRole("authenticated", U, async (tx) => {
      await tx`select set_config('test.notification_hidden',${f.requestId},true)`;
      return (await tx`select notification_fiscal_reference_access(${f.id}) allowed`)[0].allowed;
    }),
  ).toBe(false);
  expect(await check(f.event.id)).toEqual({ status: 200, payload: true });
  await expect(
    db`update hiring_preparation_requests set workspace_id=${B} where id=${f.requestId}`,
  ).rejects.toMatchObject({ code: "23503" });
  expect(await check(f.event.id)).toEqual({ status: 200, payload: true });
});

it("requires the dedicated fiscal view key even when the user can read the request and financial titles", async () => {
  const f = await readyFiscal();
  await db`delete from job_role_permission_overrides where role_id=${ROLE} and permission_key='techpeople.hiring_requests.fiscal_documents.view.workspace'`;
  expect(await request("/rpc/notification_fiscal_reference_access", { p_document: f.id })).toEqual({
    status: 200,
    payload: false,
  });
  expect(await check(f.event.id)).toEqual({ status: 200, payload: false });
  expect(
    await request(`/hiring_preparation_requests?select=id&id=eq.${f.requestId}`),
  ).toMatchObject({ status: 200, payload: [{ id: f.requestId }] });
  expect(
    (
      await db`select count(*)::int n from notification_workspace_context where event_key='finance.invoice.received'`
    )[0].n,
  ).toBe(0);
});

it("never substitutes an inactive or denied named Finance recipient and invalidates a changed formalization", async () => {
  const f = await readyFiscal();
  const financeRole = randomUUID();
  await db`insert into job_roles(id,workspace_id) values(${financeRole},${W})`;
  await db`insert into user_job_roles(role_id,user_id,workspace_id,owner_id) values(${financeRole},${C},${W},${A})`;
  await db`insert into job_role_permission_overrides(workspace_id,role_id,permission_key,effect) values(${W},${financeRole},'techpeople.hiring_requests.fiscal_documents.view.workspace','deny')`;
  expect(await check(f.event.id)).toEqual({ status: 200, payload: true });
  expect(await dispatch(f.event.id)).toMatchObject({ sent: 0 });
  expect(
    (
      await db`select count(*)::int n from notification_workspace_context where event_key='finance.invoice.received'`
    )[0].n,
  ).toBe(0);
  await db`delete from job_role_permission_overrides where role_id=${financeRole}`;
  await db`update workspace_members set status='inactive' where workspace_id=${W} and user_id=${C}`;
  await expect(dispatch(f.event.id)).rejects.toMatchObject({ code: "42501" });
  await db`update workspace_members set status='active' where workspace_id=${W} and user_id=${C}`;
  await db`update contract_handoff_settings set finance_user_id=${D} where workspace_id=${W}`;
  expect(await check(f.event.id)).toEqual({ status: 200, payload: false });
  expect(
    (
      await db`select count(*)::int n from notification_workspace_context where event_key='finance.invoice.received'`
    )[0].n,
  ).toBe(0);
});

it("retains fiscal occurrence dedupe after queue purge and revokes the original proof after human rejection", async () => {
  const f = await readyFiscal();
  await withRole(
    "authenticated",
    C,
    (tx) =>
      tx`select hiring_fiscal_review(${W},${f.requestId},${f.id},${f.sha},'rejected','Synthetic independent fiscal rejection',${randomUUID()})`,
  );
  expect(await check(f.event.id)).toEqual({ status: 200, payload: false });
  expect(await events()).toHaveLength(1);
  await db`delete from workflow_events where id=${f.event.id}`;
  expect(await f.register()).toBe(f.id);
  expect(await events()).toHaveLength(0);
  expect(
    (
      await db`select count(*)::int n from notification_business_occurrence_receipts where event_key='finance.invoice.received'`
    )[0].n,
  ).toBe(1);
});

it("revokes fiscal receipt execution when its signed instrument evidence is revoked", async () => {
  const f = await readyFiscal();
  expect(await check(f.event.id)).toEqual({ status: 200, payload: true });
  await db`update hiring_contract_evidence set revoked_at=now() where id=${f.evidence}`;
  expect(await check(f.event.id)).toEqual({ status: 200, payload: false });
  await expect(dispatch(f.event.id)).rejects.toMatchObject({ code: "42501" });
  expect(
    (
      await db`select count(*)::int n from notification_workspace_context where event_key='finance.invoice.received'`
    )[0].n,
  ).toBe(0);
});

it("uses the explicit fiscal creator only when configured and never treats request ownership as an implicit recipient", async () => {
  const f = await readyFiscal();
  const rules = [{ kind: "source_creator" }];
  await db`update workflows set actions=${db.json([{ type: "send_notification", title, recipients: rules, delivery }])} where id=${WF}`;
  expect(await dispatch(f.event.id, rules)).toMatchObject({ sent: 1 });
  const rows =
    await db`select n.user_id from notifications n join notification_workspace_context c on c.notification_id=n.id where c.event_key='finance.invoice.received'`;
  expect(rows).toEqual([{ user_id: U }]);
});

it("rejects forged fiscal occurrences and readonly write references without leaking proof or raw data", async () => {
  const f = await readyFiscal();
  await expect(
    withRole(
      "service_role",
      null,
      (
        tx,
      ) => tx`insert into workflow_events(id,workspace_id,owner_id,entity,entity_id,event_type,after,notification_event_key)
    values(${randomUUID()},${W},${U},'hiring_fiscal_documents',${f.id},'updated','{}','finance.invoice.received')`,
    ),
  ).rejects.toMatchObject({ code: "42501" });
  for (const action of ["update", "delete"])
    expect(
      await withRole(
        "service_role",
        null,
        async (tx) =>
          (
            await tx`select sales_worker_authorize('workflows',${WF},${tx.json([{ record_table: "hiring_fiscal_documents", id: f.id, action }])}) allowed`
          )[0].allowed,
      ),
    ).toBe(false);
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

it("rejects mutated payment cache writes and invalidates cancellation through the real financial operation", async () => {
  const event = await readyEntry();
  await grant(
    "techfinance.entries.update.workspace",
    "techfinance.entry_cancellation.manage.workspace",
  );
  await expect(
    withRole(
      "authenticated",
      U,
      (tx) => tx`update financial_entries set paid_amount=999,status='paid' where id=${X}`,
    ),
  ).rejects.toMatchObject({ code: "23514" });
  expect(await check(event)).toEqual({ status: 200, payload: true });
  await withRole(
    "authenticated",
    U,
    (tx) => tx`update financial_entries set status='cancelled' where id=${X}`,
  );
  expect(await check(event)).toEqual({ status: 200, payload: false });
  expect((await db`select count(*)::int n from financial_payments`)[0].n).toBe(0);
});

it.each([
  { key: "finance.payable.due", direction: "payable", dueDelta: 0 },
  { key: "finance.receivable.due", direction: "receivable", dueDelta: 0 },
  { key: "finance.payable.overdue", direction: "payable", dueDelta: -1 },
  { key: "finance.receivable.overdue", direction: "receivable", dueDelta: -1 },
] as const)(
  "queues the actual $key direction once and retains its cursor after event and proof purge",
  async ({ key, direction, dueDelta }) => {
    await entry(key, dueDelta);
    expect(await tick()).toMatchObject({ status: 200, payload: { enqueued: 1 } });
    const rows = await events();
    expect(rows).toHaveLength(1);
    expect(rows[0].notification_event_key).toBe(key);
    expect(rows[0].after).toMatchObject({ direction, id: X });
    expect(await check(rows[0].id)).toEqual({ status: 200, payload: true });
    expect(await tick()).toMatchObject({ status: 200, payload: { enqueued: 0 } });
    await db`delete from workflow_events where id=${rows[0].id}`;
    expect(
      (
        await db`select count(*)::int n from notification_business_event_proofs where event_id=${rows[0].id}`
      )[0].n,
    ).toBe(0);
    expect(await events()).toHaveLength(0);
    expect(await tick()).toMatchObject({ status: 200, payload: { enqueued: 0 } });
  },
);

it("registers the actual supplier NF through TechContracts and revokes only its dedicated fiscal authority", async () => {
  const f = await readyFiscal("supplier");
  expect(await check(f.event.id)).toEqual({ status: 200, payload: true });
  expect(f.event.after).toMatchObject({ kind: "supplier", doc_type: "nfe", status: "registered" });
  expect(await request("/rpc/notification_fiscal_reference_access", { p_document: f.id })).toEqual({
    status: 200,
    payload: true,
  });
  expect(await dispatch(f.event.id)).toMatchObject({ sent: 1 });
  const rows =
    await db`select n.user_id,n.link from notifications n join notification_workspace_context c on c.notification_id=n.id where c.event_key='finance.invoice.received'`;
  expect(rows).toEqual([
    {
      user_id: C,
      link: `/contracts/supplier-requests?request=${f.requestId}&fiscalDocumentId=${f.id}`,
    },
  ]);
  await db`update job_role_permission_overrides set effect='deny' where role_id=${ROLE} and permission_key='techcontracts.supplier_requests.fiscal_documents.view.workspace'`;
  expect(await check(f.event.id)).toEqual({ status: 200, payload: false });
  expect(await request("/rpc/notification_fiscal_reference_access", { p_document: f.id })).toEqual({
    status: 200,
    payload: false,
  });
  expect(await request(`/hiring_preparation_requests?select=id&id=eq.${f.requestId}`)).toEqual({
    status: 200,
    payload: [{ id: f.requestId }],
  });
  expect((await request(`/hiring_fiscal_documents?select=id&id=eq.${f.id}`)).status).toBe(403);
});

it.each([
  { type: "create_payable_schedule", amount: "10" },
  { type: "create_receivable_invoice", amount: "10" },
  { type: "cancel_payable_schedules" },
])(
  "denies the financial effect alias $type at the current proof and service worker boundaries",
  async (action) => {
    const event = await readyEntry();
    const actions = [
      {
        type: "legacy_container",
        actions: [{ type: "parallel", branches: [{ actions: [action] }] }],
      },
    ];
    await db`update workflows set actions=${db.json(actions)} where id=${WF}`;
    expect(
      (
        await db`select techerp_api.notification_finance_actions_valid(${db.json(actions)}) allowed`
      )[0].allowed,
    ).toBe(false);
    expect(await check(event)).toEqual({ status: 200, payload: false });
    const refs = [{ workflow_version: 1 }, { record_table: "financial_entries", id: X }];
    expect(
      await withRole(
        "service_role",
        null,
        async (tx) =>
          (await tx`select sales_worker_authorize('workflows',${WF},${tx.json(refs)}) allowed`)[0]
            .allowed,
      ),
    ).toBe(false);
    await expect(dispatch(event)).rejects.toMatchObject({ code: "42501" });
    expect((await db`select count(*)::int n from financial_payments`)[0].n).toBe(0);
    // Existing generic workflows keep their existing permission/process boundary.
    await db`update workflows set trigger='{"event":"updated","filters":[]}',actions=${db.json([action])} where id=${WF}`;
    expect(
      await withRole(
        "service_role",
        null,
        async (tx) =>
          (await tx`select sales_worker_authorize('workflows',${WF},${tx.json(refs)}) allowed`)[0]
            .allowed,
      ),
    ).toBe(true);
  },
);
