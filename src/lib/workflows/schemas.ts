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
]);

export const FilterSchema = z.object({
  field: z.string().min(1).max(100),
  op: z.enum(["eq", "neq", "in", "contains", "gt", "lt", "changed_to", "is_empty", "is_not_empty"]),
  value: z.unknown().optional(),
});

export const EventEnum = z.enum(["created", "updated", "stage_changed"]);

export const TriggerSchema = z.object({
  event: EventEnum,
  filters: z.array(FilterSchema).max(20).default([]),
  reenroll: z
    .object({
      enabled: z.boolean(),
      events: z.array(EventEnum).max(3).optional(),
    })
    .optional(),
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
  }),
  z.object({
    type: z.literal("create_company"),
    name: z.string().min(1).max(200),
    domain: z.string().max(200).optional(),
    industry: z.string().max(120).optional(),
    owner_id: z.string().uuid().optional(),
  }),
  z.object({
    type: z.literal("create_deal"),
    name: z.string().min(1).max(200),
    value: z.number().nonnegative().optional(),
    currency: z.string().max(10).optional(),
    pipeline_id: z.string().uuid().optional(),
    stage_id: z.string().uuid().optional(),
    owner_id: z.string().uuid().optional(),
  }),
  z.object({
    type: z.literal("create_ticket"),
    subject: z.string().min(1).max(300),
    description: z.string().max(5000).optional(),
    priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
    pipeline_id: z.string().uuid().optional(),
    assignee_id: z.string().uuid().optional(),
  }),
  z.object({
    type: z.literal("create_task"),
    subject: z.string().min(1).max(300),
    body: z.string().max(5000).optional(),
    due_in_days: z.number().int().min(0).max(365).optional(),
    assignee_id: z.string().uuid().optional(),
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
]);


const MAX_BRANCH_DEPTH = 3;

export function parseActionsAtDepth(input: unknown, depth: number): ActionInput[] {
  if (!Array.isArray(input)) throw new Error("actions deve ser um array");
  if (input.length > 20) throw new Error("máximo 20 ações por ramo");
  return input.map((raw) => parseActionAtDepth(raw, depth));
}

export function parseActionAtDepth(raw: unknown, depth: number): ActionInput {
  if (raw && typeof raw === "object" && (raw as ActionInput).type === "branch_if") {
    if (depth >= MAX_BRANCH_DEPTH) throw new Error("profundidade máxima de branch_if excedida");
    const src = raw as ActionInput;
    const filters = z.array(FilterSchema).max(20).parse(src.filters ?? []);
    const thenActions = parseActionsAtDepth(src.then ?? [], depth + 1);
    const elseActions = parseActionsAtDepth(src.else ?? [], depth + 1);
    return { type: "branch_if", filters, then: thenActions, else: elseActions };
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
