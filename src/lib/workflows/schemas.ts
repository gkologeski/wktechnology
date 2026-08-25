// Schemas Zod isolados para import por server functions.
// Extraído de workflows.functions.ts porque o split transform do TanStack
// remove helpers de module-scope do bundle onde createServerFn é chamado.
import { z } from "zod";

export const EntityEnum = z.enum([
  "leads",
  "contacts",
  "companies",
  "deals",
  "tickets",
  "ats_jobs",
  "ats_candidates",
  "ats_applications",
  "ats_interviews",
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
]);

const WritableTableEnum = z.enum([
  "leads",
  "contacts",
  "companies",
  "deals",
  "tickets",
  "ats_jobs",
  "ats_candidates",
  "ats_applications",
  "ats_interviews",
  "activities",
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
]);

export const FilterSchema = z.object({
  field: z.string().min(1).max(100),
  op: z.enum(["eq", "neq", "in", "contains", "gt", "lt", "changed_to", "is_empty", "is_not_empty"]),
  value: z.unknown().optional(),
});

/** Profundidade máxima de agrupamento de condições (grupo dentro de grupo). */
export const MAX_CONDITION_DEPTH = 3;

type ConditionNode =
  | z.infer<typeof FilterSchema>
  | { logic: "and" | "or"; conditions: ConditionNode[] };

export const ConditionSchema: z.ZodType<ConditionNode> = z.lazy(() =>
  z.union([
    z.object({
      logic: z.enum(["and", "or"]),
      conditions: z.array(ConditionSchema).max(20),
    }),
    FilterSchema,
  ]),
);

function assertConditionDepth(nodes: unknown, depth = 1): void {
  if (depth > MAX_CONDITION_DEPTH)
    throw new Error("profundidade máxima de grupos de condições excedida");
  if (!Array.isArray(nodes)) return;
  for (const n of nodes) {
    if (n && typeof n === "object" && Array.isArray((n as { conditions?: unknown }).conditions)) {
      assertConditionDepth((n as { conditions: unknown[] }).conditions, depth + 1);
    }
  }
}

/** Lista de condições (aceita condições simples e grupos aninhados). */
export const ConditionListSchema = z
  .array(ConditionSchema)
  .max(20)
  .superRefine((val, ctx) => {
    try {
      assertConditionDepth(val);
    } catch (e) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: (e as Error).message });
    }
  });

export const EventEnum = z.enum(["created", "updated", "stage_changed"]);

export const TimeTriggerConfigSchema = z.object({
  kind: z.enum([
    "time_since_field",
    "no_activity_for",
    "stuck_in_stage_for",
    "field_unchanged_for",
  ]),
  field: z.string().max(100).optional(),
  amount: z.number().int().min(1).max(100_000),
  unit: z.enum(["minutes", "hours", "days"]),
  filters: ConditionListSchema.optional(),
});

export const TriggerSchema = z.object({
  event: EventEnum,
  filters: ConditionListSchema.default([]),
  reenroll: z
    .object({
      enabled: z.boolean(),
      events: z.array(EventEnum).max(3).optional(),
    })
    .optional(),
  goal_filters: ConditionListSchema.optional(),
  time_based: TimeTriggerConfigSchema.optional(),
});

type ActionInput = Record<string, unknown>;

export const SimpleActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("set_field"), field: z.string().min(1).max(100), value: z.unknown() }),
  z.object({
    type: z.literal("create_activity"),
    activity_type: z.string().max(50).optional(),
    subject: z.string().min(1).max(500),
    body: z.string().max(5000).optional(),
    due_in_days: z.number().int().min(0).max(365).optional(),
  }),
  z.object({
    type: z.literal("create_survey_activity"),
    source: z.enum(["survey_template", "prospecting_questionnaire"]),
    source_id: z.string().uuid(),
    subject: z.string().max(500).optional(),
    body: z.string().max(5000).optional(),
    due_in_days: z.number().int().min(0).max(365).optional(),
  }),
  z.object({
    type: z.literal("open_deal_dialog"),
    pipeline_id: z.string().uuid().optional(),
    stage_value: z.string().max(100).optional(),
    due_rule: z.enum(["last_business_day_of_month", "none"]).optional(),
    subject: z.string().max(500).optional(),
  }),
  z.object({ type: z.literal("assign_to"), user_id: z.string().uuid() }),
  z.object({ type: z.literal("rotate_assign"), rule_id: z.string().uuid() }),
  z.object({ type: z.literal("add_to_sequence"), sequence_id: z.string().uuid() }),
  z.object({
    type: z.literal("send_notification"),
    title: z.string().min(1).max(200),
    body: z.string().max(2000).optional(),
    user_id: z.string().uuid().optional(),
  }),
  z.object({
    type: z.literal("webhook"),
    url: z.string().url().max(500),
    payload: z.record(z.string(), z.unknown()).optional(),
  }),
  z.object({
    type: z.literal("delay"),
    amount: z.number().int().min(1).max(10080),
    unit: z.enum(["minutes", "hours", "days"]),
  }),
  z.object({
    type: z.literal("create_ats_job"),
    title: z.string().min(1).max(200),
    department: z.string().max(100).optional(),
    headcount: z.number().int().min(1).max(50).optional(),
    hiring_manager_id: z.string().uuid().optional(),
    recruiter_id: z.string().uuid().optional(),
    notify_user_id: z.string().uuid().optional(),
  }),
  z.object({
    type: z.literal("advance_ats_application_stage"),
    stage_value: z.string().min(1).max(100),
  }),
  z.object({
    type: z.literal("create_ats_candidate"),
    full_name: z.string().min(1).max(200),
    email: z.string().max(200).optional(),
    phone: z.string().max(50).optional(),
    source: z.string().max(50).optional(),
  }),
  z.object({
    type: z.literal("assign_recruiter"),
    user_id: z.string().uuid(),
    target: z.enum(["auto", "job", "candidate", "application", "interview"]).optional(),
  }),
  // Fase 1 — Criar entidade
  z.object({
    type: z.literal("create_lead"),
    first_name: z.string().min(1).max(120),
    last_name: z.string().max(120).optional(),
    email: z.string().max(200).optional(),
    phone: z.string().max(50).optional(),
    company_name: z.string().max(200).optional(),
    source: z.string().max(80).optional(),
    owner_id: z.string().uuid().optional(),
    extra_fields: z.record(z.string(), z.unknown()).optional(),
  }),
  z.object({
    type: z.literal("create_contact"),
    first_name: z.string().min(1).max(120),
    last_name: z.string().max(120).optional(),
    email: z.string().max(200).optional(),
    phone: z.string().max(50).optional(),
    job_title: z.string().max(120).optional(),
    company_name: z.string().max(200).optional(),
    owner_id: z.string().uuid().optional(),
    extra_fields: z.record(z.string(), z.unknown()).optional(),
  }),
  z.object({
    type: z.literal("create_company"),
    name: z.string().min(1).max(200),
    domain: z.string().max(200).optional(),
    industry: z.string().max(120).optional(),
    owner_id: z.string().uuid().optional(),
    extra_fields: z.record(z.string(), z.unknown()).optional(),
  }),
  z.object({
    type: z.literal("create_deal"),
    name: z.string().min(1).max(200),
    value: z.number().nonnegative().optional(),
    currency: z.string().max(10).optional(),
    pipeline_id: z.string().uuid().optional(),
    stage_id: z.string().uuid().optional(),
    owner_id: z.string().uuid().optional(),
    extra_fields: z.record(z.string(), z.unknown()).optional(),
  }),
  z.object({
    type: z.literal("create_ticket"),
    subject: z.string().min(1).max(300),
    description: z.string().max(5000).optional(),
    priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
    pipeline_id: z.string().uuid().optional(),
    assignee_id: z.string().uuid().optional(),
    extra_fields: z.record(z.string(), z.unknown()).optional(),
  }),
  z.object({
    type: z.literal("create_task"),
    subject: z.string().min(1).max(300),
    body: z.string().max(5000).optional(),
    due_in_days: z.number().int().min(0).max(365).optional(),
    assignee_id: z.string().uuid().optional(),
    extra_fields: z.record(z.string(), z.unknown()).optional(),
  }),

  // Fase 2 — CRM avançado
  z.object({
    type: z.literal("copy_field_from_association"),
    association: z.string().min(1).max(60),
    source_field: z.string().min(1).max(100),
    target_field: z.string().min(1).max(100),
  }),
  z.object({
    type: z.literal("associate_records"),
    association: z.string().min(1).max(60),
    target_id: z.string().min(1).max(200),
  }),
  z.object({
    type: z.literal("disassociate_records"),
    association: z.string().min(1).max(60),
  }),
  z.object({
    type: z.literal("clear_field"),
    field: z.string().min(1).max(100),
  }),
  z.object({
    type: z.literal("increment_field"),
    field: z.string().min(1).max(100),
    amount: z.number().int().min(-1_000_000).max(1_000_000),
  }),
  z.object({
    type: z.literal("send_email"),
    template_id: z.string().uuid().optional(),
    subject: z.string().min(1).max(300),
    body: z.string().min(1).max(20_000),
    to_field: z.string().max(100).optional(),
  }),
  z.object({
    type: z.literal("send_whatsapp"),
    template_name: z.string().max(200).optional(),
    body: z.string().max(4000).optional(),
    to_field: z.string().max(100).optional(),
  }),
  z.object({
    type: z.literal("delay_until_date"),
    field: z.string().min(1).max(100),
    offset_amount: z.number().int().min(-100_000).max(100_000).optional(),
    offset_unit: z.enum(["minutes", "hours", "days"]).optional(),
  }),
  // Fase 5 — Utilitários avançados
  z.object({
    type: z.literal("format_data"),
    op: z.enum([
      "upper",
      "lower",
      "trim",
      "date_add",
      "date_format",
      "number_round",
      "template_string",
    ]),
    source_field: z.string().max(100).optional(),
    target_var: z
      .string()
      .min(1)
      .max(60)
      .regex(/^[A-Za-z_][A-Za-z0-9_]*$/, "nome inválido"),
    template: z.string().max(4000).optional(),
    format: z.string().max(60).optional(),
    amount: z.number().min(-1_000_000).max(1_000_000).optional(),
    unit: z.enum(["minutes", "hours", "days"]).optional(),
  }),
  z.object({
    type: z.literal("send_slack"),
    channel: z.string().max(60).optional(),
    text: z.string().min(1).max(4000),
  }),
  z.object({
    type: z.literal("send_teams"),
    webhook_url: z.string().url().max(500),
    title: z.string().max(200).optional(),
    text: z.string().min(1).max(4000),
  }),
  z.object({
    type: z.literal("approval_step"),
    title: z.string().min(1).max(200),
    note: z.string().max(2000).optional(),
    approver_user_id: z.string().uuid().optional(),
    halt_on_reject: z.boolean().optional(),
  }),
  // Ações genéricas cross-módulo — funcionam sobre qualquer tabela da whitelist.
  z.object({
    type: z.literal("create_record"),
    table: WritableTableEnum,
    values: z.record(z.string(), z.unknown()),
    /** Se omitido, usa ctx.ownerId no campo owner_id (quando a tabela tem). */
    owner_id: z.string().uuid().optional(),
  }),
  z.object({
    type: z.literal("update_record"),
    table: WritableTableEnum,
    /** ID do registro alvo. Aceita tokens (ex: "{{id}}" no próprio registro). */
    target_id: z.string().min(1).max(200),
    values: z.record(z.string(), z.unknown()),
  }),
  z.object({
    type: z.literal("delete_record"),
    table: WritableTableEnum,
    target_id: z.string().min(1).max(200),
  }),
]);

const MAX_BRANCH_DEPTH = 3;

export function parseActionsAtDepth(input: unknown, depth: number): ActionInput[] {
  if (!Array.isArray(input)) throw new Error("actions deve ser um array");
  if (input.length > 20) throw new Error("máximo 20 ações por ramo");
  return input.map((raw) => parseActionAtDepth(raw, depth));
}

export function parseActionAtDepth(raw: unknown, depth: number): ActionInput {
  if (raw && typeof raw === "object") {
    const src = raw as ActionInput;
    if (src.type === "branch_if") {
      if (depth >= MAX_BRANCH_DEPTH) throw new Error("profundidade máxima de branch_if excedida");
      const filters = ConditionListSchema.parse(src.filters ?? []);
      const thenActions = parseActionsAtDepth(src.then ?? [], depth + 1);
      const elseActions = parseActionsAtDepth(src.else ?? [], depth + 1);
      return { type: "branch_if", filters, then: thenActions, else: elseActions };
    }
    if (src.type === "switch_by_value") {
      if (depth >= MAX_BRANCH_DEPTH) throw new Error("profundidade máxima excedida");
      const field = z.string().min(1).max(100).parse(src.field);
      const rawCases = Array.isArray(src.cases) ? src.cases : [];
      if (rawCases.length > 20) throw new Error("máximo 20 cases");
      const cases = rawCases.map((c) => {
        const co = (c ?? {}) as ActionInput;
        return {
          label: typeof co.label === "string" ? co.label : undefined,
          value: co.value,
          actions: parseActionsAtDepth(co.actions ?? [], depth + 1),
        };
      });
      const def = parseActionsAtDepth(src.default ?? [], depth + 1);
      return { type: "switch_by_value", field, cases, default: def };
    }
    if (src.type === "branch_multi") {
      if (depth >= MAX_BRANCH_DEPTH) throw new Error("profundidade máxima excedida");
      const rawBranches = Array.isArray(src.branches) ? src.branches : [];
      if (rawBranches.length > 10) throw new Error("máximo 10 branches");
      const branches = rawBranches.map((b) => {
        const bo = (b ?? {}) as ActionInput;
        return {
          label: typeof bo.label === "string" ? bo.label : undefined,
          filters: ConditionListSchema.parse(bo.filters ?? []),
          actions: parseActionsAtDepth(bo.actions ?? [], depth + 1),
        };
      });
      const elseActions = parseActionsAtDepth(src.else ?? [], depth + 1);
      return { type: "branch_multi", branches, else: elseActions };
    }
  }
  return SimpleActionSchema.parse(raw) as unknown as ActionInput;
}

export const SaveSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  entity: EntityEnum,
  enabled: z.boolean(),
  trigger: TriggerSchema,
  actions: z
    .array(z.unknown())
    .min(1)
    .max(20)
    .transform((arr) => parseActionsAtDepth(arr, 0)),
});
