import { createHash, randomUUID } from "node:crypto";
import { db, W, A, U, C, D, ROLE, X, WF, withRole } from "./notification-deliveries";
import { workflowNotificationEventTrigger } from "../../src/lib/workflows/notification-events";

async function grant(...keys: string[]) {
  for (const key of keys)
    await db`insert into job_role_permission_overrides(workspace_id,role_id,permission_key,effect)
      values(${W},${ROLE},${key},'grant') on conflict do nothing`;
}

/** Real P11 approvals, signature, execution, reserve/attest/register chain, reused by P12. */
export async function prepareCanonicalFiscalDocument(
  kind: "professional" | "supplier" = "professional",
  delivery: Record<string, unknown> = { channels: ["inapp"], fallback: "none" },
) {
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
  const trigger = JSON.parse(
    JSON.stringify(workflowNotificationEventTrigger("finance.invoice.received")),
  );
  const storedDelivery = JSON.parse(JSON.stringify(delivery));
  await db`update workflows set entity='hiring_fiscal_documents',execution_user_id=${U},trigger=${db.json(trigger)},
    actions=${db.json([{ type: "send_notification", title: "Atualização fiscal disponível", recipients: [{ kind: "source_responsible" }], delivery: storedDelivery }])},
    last_published_at=clock_timestamp()-interval '10 days' where id=${WF}`;
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
