import { notificationSchedulingActionProblem } from "@/lib/notifications/scheduling-types";
import { workRpc } from "@/lib/access-control/work-core.server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  WORKFLOW_READONLY_SOURCE_TABLES,
  WORKFLOW_WRITABLE_TABLES,
  isWorkflowReadonlySource,
  type WorkflowAction,
  type WorkflowEntity,
} from "../types";
import {
  isMinimalNotificationEvent,
  notificationEventActionProblem,
  notificationEventConfigurationProblem,
  FINANCE_NOTIFICATION_ENTRY_FIELDS,
  FINANCE_NOTIFICATION_FISCAL_FIELDS,
} from "../notification-events";
import type { RunCtx } from "./run-context";
import { assertSalesWorker } from "@/lib/access-control/sales-worker.server";
import { SALES_TABLE_RESOURCES } from "@/lib/access-control/sales-resources";
import { SALES_PRIVATE_COLUMNS } from "@/lib/access-control/sales-private-columns";
import {
  publicProjectSnapshot,
  WORK_COST_PRIVATE_COLUMNS,
} from "@/lib/access-control/work-cost-projection";
import { findAssociation, ENTITY_ASSOCIATIONS } from "../associations";
import { renderWorkflowTokens as renderTokens } from "../render-tokens";

type Requirement = NonNullable<Parameters<typeof assertSalesWorker>[3]>[number];
const privateFields = new Set<string>(Object.values(SALES_PRIVATE_COLUMNS).flat());
const immutable = new Set(["workspace_id", "owner_id", ...privateFields]);
const creates: Record<string, string> = {
  create_lead: "leads",
  create_contact: "contacts",
  create_company: "companies",
  create_deal: "deals",
  create_ticket: "tickets",
  create_task: "activities",
  create_activity: "activities",
  create_survey_activity: "activities",
  linkedin_task: "activities",
  open_deal_dialog: "activities",
};
const contextualRecords = new Set<string>([
  ...WORKFLOW_WRITABLE_TABLES,
  ...WORKFLOW_READONLY_SOURCE_TABLES,
  "people",
  "profiles",
  "legal_entities",
  "financial_cost_centers",
  "financial_categories",
  "financial_bank_accounts",
  "subscriptions",
]);
function resource(table: string) {
  return (SALES_TABLE_RESOURCES as Record<string, string>)[table];
}

/** These columns have a canonical private read boundary, independent of row visibility. */
export const WORKFLOW_PRIVATE_SOURCE_FIELDS: Readonly<Record<string, readonly string[]>> = {
  people: [
    "cost_hour",
    "monthly_cost",
    "personal_doc",
    "bank",
    "bank_agency",
    "bank_account",
    "pix_key",
    "address",
  ],
  ats_applications: ["hiring_details"],
  ats_interviews: ["notes", "self_schedule_token"],
  ats_offers: ["public_token", "body", "salary_amount", "salary_currency", "approval_note"],
};

const minimalSourceFields: Readonly<Record<string, readonly string[]>> = {
  financial_entries: FINANCE_NOTIFICATION_ENTRY_FIELDS,
  hiring_fiscal_documents: FINANCE_NOTIFICATION_FISCAL_FIELDS,
  ats_applications: [
    "id",
    "workspace_id",
    "owner_id",
    "assigned_to",
    "candidate_id",
    "job_id",
    "status",
    "stage_value",
    "stage_id",
    "applied_at",
    "created_at",
    "updated_at",
  ],
  ats_interviews: [
    "id",
    "workspace_id",
    "owner_id",
    "assigned_to",
    "application_id",
    "candidate_id",
    "job_id",
    "interviewer_id",
    "status",
    "stage_value",
    "scheduled_at",
    "created_at",
    "updated_at",
  ],
  ats_offers: [
    "id",
    "workspace_id",
    "owner_id",
    "assigned_to",
    "application_id",
    "candidate_id",
    "job_id",
    "status",
    "revision",
    "approved_revision",
    "approval_status",
    "start_date",
    "sent_at",
    "signed_at",
    "created_at",
    "updated_at",
  ],
  people: [
    "id",
    "workspace_id",
    "owner_id",
    "assigned_to",
    "profile_id",
    "candidate_id",
    "manager_id",
    "status",
    "hire_date",
    "termination_date",
    "created_at",
    "updated_at",
  ],
  people_documents: [
    "id",
    "workspace_id",
    "owner_id",
    "assigned_to",
    "person_id",
    "status",
    "expires_at",
    "created_at",
    "updated_at",
  ],
  hiring_preparation_requests: [
    "id",
    "workspace_id",
    "kind",
    "status",
    "revision",
    "created_by",
    "created_at",
    "updated_at",
  ],
};

/** Safe event-domain projection; reserved durable execution controls are preserved. */
export function projectWorkflowSnapshot<T>(value: T, entity?: string, eventKey?: string | null): T {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const minimal =
    entity && (isWorkflowReadonlySource(entity) || isMinimalNotificationEvent(eventKey))
      ? minimalSourceFields[entity]
      : undefined;
  const excluded = entity ? (WORKFLOW_PRIVATE_SOURCE_FIELDS[entity] ?? []) : [];
  return Object.fromEntries(
    Object.entries(publicProjectSnapshot(value, entity)).filter(
      ([key]) =>
        !excluded.includes(key) &&
        (!minimal ||
          minimal.includes(key) ||
          ["__wf_wait", "__wf_state", "__wf_path"].includes(key)),
    ),
  ) as T;
}

/** Privileged snapshots never bypass credential, project-cost or HR private reads. */
export function sanitizeWorkflowSnapshot<T>(
  value: T,
  entity?: string,
  eventKey?: string | null,
): T {
  if (Array.isArray(value))
    return value.map((item) => sanitizeWorkflowSnapshot(item, entity, eventKey)) as T;
  const associations =
    entity && Object.hasOwn(ENTITY_ASSOCIATIONS, entity)
      ? ENTITY_ASSOCIATIONS[entity as WorkflowEntity]
      : [];
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(projectWorkflowSnapshot(value, entity, eventKey))
        .filter(([key]) => !privateFields.has(key))
        .map(([key, item]) => [
          key,
          sanitizeWorkflowSnapshot(
            item,
            associations.find((association) => association.key === key)?.target_table,
          ),
        ]),
    ) as T;
  return value;
}
export async function authorizeWorkflowStep(
  client: SupabaseClient,
  ctx: RunCtx,
  action?: WorkflowAction,
  workflowJson?: string,
) {
  if (!ctx.workflowId) throw new Error("Workflow sem origem de autorização.");
  const refs: Requirement[] =
    ctx.workflowVersion != null ? [{ workflow_version: ctx.workflowVersion }] : [];
  const row = (
    table: string,
    id: string,
    op: "view" | "update" | "delete" | "assign" | "manage" = "view",
  ) => {
    if (!id) return;
    if (resource(table)) refs.push({ table, id, action: op });
    else if (op === "view" && contextualRecords.has(table)) refs.push({ record_table: table, id });
  };
  const area = (
    r: string,
    op: "view" | "create" | "manage" | "assign" | "update",
    subject_id?: string,
  ) => refs.push({ resource: r, action: op, ...(subject_id ? { subject_id } : {}) });
  const resolved = (v: unknown) =>
    String(renderTokens(String(v ?? ""), ctx.after, ctx.vars) ?? "").trim();
  row(ctx.entity, ctx.entityId);
  const encoded = workflowJson ?? (action ? JSON.stringify(action) : "");
  for (const assoc of ENTITY_ASSOCIATIONS[ctx.entity] ?? [])
    if (encoded.includes(`{{${assoc.key}.`) && ctx.after?.[assoc.fk_column])
      row(assoc.target_table, String(ctx.after[assoc.fk_column]));

  if (action) {
    const schedulingProblem = notificationSchedulingActionProblem(ctx.notificationEventKey, [
      action,
    ]);
    if (schedulingProblem) throw new Error(schedulingProblem);
    const financeProblem = notificationEventConfigurationProblem(ctx.notificationEventKey, action);
    if (financeProblem) throw new Error(financeProblem);
    const approvalProblem =
      ctx.entity === "hiring_preparation_requests"
        ? notificationEventActionProblem("people.approval.pending", [action])
        : null;
    if (approvalProblem) throw new Error(approvalProblem);
    const a = action as unknown as Record<string, unknown>;
    const table = typeof a.table === "string" ? a.table : ctx.entity;
    const costDestination = creates[action.type] ?? table;
    const sourceMutations = [
      "set_field",
      "set_substatus",
      "clear_field",
      "increment_field",
      "copy_field_from_association",
      "associate_records",
      "disassociate_records",
      "assign_to",
      "rotate_assign",
    ];
    if (
      (isWorkflowReadonlySource(ctx.entity) && sourceMutations.includes(action.type)) ||
      (["create_record", "update_record", "delete_record"].includes(action.type) &&
        isWorkflowReadonlySource(table))
    )
      throw new Error(
        "Esta origem é somente leitura; use a operação canônica para alterar o registro.",
      );
    const sourceTable =
      action.type === "copy_field_from_association"
        ? findAssociation(ctx.entity, String(a.association))?.target_table
        : ctx.entity;
    const protectedProjectField = (target: string | undefined, field: unknown) =>
      target === "projects" && WORK_COST_PRIVATE_COLUMNS.projects.some((name) => name === field);
    if (
      [a.field, a.target_field].some((field) => protectedProjectField(costDestination, field)) ||
      protectedProjectField(sourceTable, a.source_field) ||
      [a.values, a.extra_fields].some(
        (values) =>
          values &&
          typeof values === "object" &&
          Object.keys(values).some((field) => protectedProjectField(costDestination, field)),
      )
    )
      throw new Error(
        "Campo financeiro protegido de projeto exige a operação financeira canônica.",
      );
    const protectedHrField = (target: string | undefined, field: unknown) =>
      typeof field === "string" &&
      !!target &&
      (WORKFLOW_PRIVATE_SOURCE_FIELDS[target] ?? []).includes(field.split(".")[0]);
    if (
      [a.field, a.target_field].some((field) => protectedHrField(costDestination, field)) ||
      protectedHrField(sourceTable, a.source_field) ||
      [a.values, a.extra_fields].some(
        (values) =>
          values &&
          typeof values === "object" &&
          Object.keys(values).some((field) => protectedHrField(costDestination, field)),
      )
    )
      throw new Error("Campo privado de RH exige a operação canônica autorizada.");
    for (const key of ["field", "target_field", "source_field"])
      if (typeof a[key] === "string" && immutable.has(a[key] as string))
        throw new Error("Campo protegido não pode ser lido ou alterado por ação genérica.");
    for (const key of Object.keys((a.values ?? a.extra_fields ?? {}) as object)) {
      if (
        immutable.has(key) ||
        (table === "proposals" &&
          ["status", "locked", "version", "sent_at", "decided_at", "variables"].includes(key)) ||
        (table === "quotes" &&
          ["status", "paid_at", "payment_session_id", "accepted_at", "declined_at"].includes(key))
      )
        throw new Error("Use a operação específica para este campo protegido.");
    }
    if (
      ctx.entity === "proposals" &&
      [a.field, a.target_field].some((f) =>
        ["status", "locked", "version", "sent_at", "decided_at", "variables"].includes(String(f)),
      )
    )
      throw new Error("Propostas exigem as operações específicas de aprovação e envio.");
    if (
      ctx.entity === "quotes" &&
      [a.field, a.target_field].some((f) =>
        ["status", "paid_at", "payment_session_id", "accepted_at", "declined_at"].includes(
          String(f),
        ),
      )
    )
      throw new Error("Cotações exigem operação específica para decisões e pagamentos.");
    if (
      [
        "set_field",
        "set_substatus",
        "clear_field",
        "increment_field",
        "copy_field_from_association",
        "associate_records",
        "disassociate_records",
      ].includes(action.type)
    )
      row(ctx.entity, ctx.entityId, "update");
    const responsibleFields = [
      "assigned_to",
      "assigned_user_id",
      "assignee_id",
      "host_user_id",
      "recruiter_id",
    ];
    const directField = String(a.field ?? a.target_field ?? "");
    if (responsibleFields.includes(directField) && resource(ctx.entity)) {
      row(ctx.entity, ctx.entityId, "assign");
      area(
        resource(ctx.entity),
        "assign",
        resolved(a.value) || String(ctx.after?.owner_id ?? ctx.ownerId),
      );
    }
    const values = (a.values ?? a.extra_fields ?? {}) as Record<string, unknown>;
    if (resource(table))
      for (const field of responsibleFields)
        if (values[field] != null) {
          if (action.type !== "create_record")
            row(
              table,
              action.type === "update_record" ? resolved(a.target_id) : ctx.entityId,
              "assign",
            );
          area(resource(table), "assign", resolved(values[field]));
        }

    if (["assign_to", "rotate_assign"].includes(action.type)) {
      row(ctx.entity, ctx.entityId, "update");
      row(ctx.entity, ctx.entityId, "assign");
      if (a.user_id && resource(ctx.entity))
        area(resource(ctx.entity), "assign", String(a.user_id));
      if (a.rule_id) row("rotation_rules", String(a.rule_id), "update");
    }
    if (["copy_field_from_association", "associate_records"].includes(action.type)) {
      const assoc = findAssociation(ctx.entity, String(a.association));
      if (assoc)
        row(
          assoc.target_table,
          action.type === "associate_records"
            ? resolved(a.target_id)
            : String(ctx.after?.[assoc.fk_column] ?? ""),
        );
    }
    if (creates[action.type]) {
      const destination = creates[action.type];
      const r =
        action.type === "create_task" ||
        action.type === "linkedin_task" ||
        action.type === "open_deal_dialog" ||
        (action.type === "create_activity" && a.activity_type === "task")
          ? "techsales.tasks"
          : action.type === "create_activity" && a.activity_type === "note"
            ? "techsales.notes"
            : resource(destination);
      area(r, "view");
      area(r, "create");
      const assignee = String(a.owner_id ?? a.assignee_id ?? ctx.ownerId);
      if (assignee !== ctx.ownerId) area(r, "assign", assignee);
    }
    if (action.type === "create_record" && resource(table)) {
      area(resource(table), "view");
      area(resource(table), "create");
      if (a.owner_id && a.owner_id !== ctx.ownerId)
        area(resource(table), "assign", String(a.owner_id));
    }
    if (["update_record", "delete_record"].includes(action.type))
      row(table, resolved(a.target_id), action.type === "update_record" ? "update" : "delete");
    if (action.type === "approval_step")
      refs.push({ member_id: String(a.approver_user_id ?? ctx.ownerId) });
    // Explicit legacy recipients keep their original step gate. Dynamic recipients are
    // resolved and checked against current source RLS by the atomic SQL dispatcher.
    if (action.type === "send_notification" && !a.recipients)
      refs.push({ member_id: String(a.user_id ?? "").trim() || ctx.ownerId });
    if (action.type === "handoff") {
      const target =
        String(a.user_id ?? "").trim() || String(ctx.after?.assigned_to ?? ctx.ownerId);
      refs.push({ member_id: target });
      if (a.user_id && resource(ctx.entity)) {
        row(ctx.entity, ctx.entityId, "update");
        row(ctx.entity, ctx.entityId, "assign");
        area(resource(ctx.entity), "assign", target);
      }
    }
    if (action.type === "send_notification" && action.delivery) {
      if (action.delivery.channels.includes("email") || action.delivery.fallback === "email") {
        area("techsales.inbox.email", "view");
        area("techsales.inbox.email", "create");
      }
      if (action.delivery.channels.includes("whatsapp")) {
        area("techsales.inbox.whatsapp", "view");
        area("techsales.inbox.whatsapp", "create");
      }
    }
    if (action.type === "send_email") {
      area("techsales.inbox.email", "view");
      area("techsales.inbox.email", "create");
      if (a.template_id) row("email_templates", String(a.template_id));
    }
    if (["send_whatsapp", "share_material", "share_booking_link"].includes(action.type)) {
      area("techsales.inbox.whatsapp", "view");
      area("techsales.inbox.whatsapp", "create");
    }
    if (action.type === "create_survey_activity")
      row(
        a.source === "prospecting_questionnaire"
          ? "prospecting_questionnaires"
          : "survey_templates",
        String(a.source_id),
      );
    if (action.type === "add_to_sequence") row("sequences", String(a.sequence_id), "update");
    if (action.type === "share_material") row("sdr_materials", String(a.material_id));
    if (action.type === "share_booking_link") row("booking_pages", String(a.booking_page_id));
    if (action.type === "sdr_agent") {
      area("techsales.marketing.sdr_agent", "view");
      area("techsales.marketing.sdr_agent", "update");
      if (a.playbook_id) row("sdr_playbooks", String(a.playbook_id));
    }
    if (["send_slack", "send_teams"].includes(action.type)) {
      area("system.integrations", "view");
      area("system.integrations", "manage");
    }
    if (action.type === "webhook") {
      area("system.webhooks", "view");
      area("system.webhooks", "manage");
    }
  }
  await assertSalesWorker(client, "workflows", ctx.workflowId, refs);
  if (
    ctx.entity === "ats_applications" &&
    action &&
    [
      "create_person_from_candidate",
      "create_contract_document",
      "create_allocation",
      "create_payable_schedule",
      "create_receivable_invoice",
      "provision_workspace_user",
    ].includes(action.type)
  ) {
    const gate = await workRpc<{ ready: boolean; reason: string | null; hunting: boolean }>(
      client,
      "hiring_workflow_recruitment_check",
      { p_ws: ctx.workspaceId, p_application: ctx.entityId },
    );
    if (!gate.ready) throw new Error(gate.reason ?? "Recrutamento ainda não autorizado.");
    if (gate.hunting && action.type !== "create_receivable_invoice")
      throw new Error(
        "Hunting registra contratação pelo cliente; não cria vínculo, alocação, acesso ou obrigações internas automaticamente.",
      );
  }
}
