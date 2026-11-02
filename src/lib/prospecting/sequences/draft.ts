import { z } from "zod";
import { isBlockedFilterColumn } from "@/lib/whatsapp/campaign-audience";
export const SEQUENCE_RESOURCE = "system.automation.sequences";
const id = z.string().uuid();
const nullableId = id.nullable().default(null);
const text = (max: number) => z.string().max(max);
const filter = z
  .object({
    entity: z.enum(["leads", "contacts", "companies", "deals"]),
    column: z
      .string()
      .min(1)
      .max(100)
      .refine((c) => !isBlockedFilterColumn(c), "Campo não permitido."),
    op: z.enum(["eq", "neq", "ilike", "not_ilike", "gte", "lte", "is_null", "is_not_null"]),
    value: text(200),
    values: z.array(text(200)).max(20).optional(),
  })
  .strict();
const stepBase = { id, title: z.string().trim().min(1).max(120) };
export const stepSchema = z.discriminatedUnion("type", [
  z
    .object({
      ...stepBase,
      type: z.literal("email"),
      accountId: nullableId,
      subject: text(255),
      body: text(10000),
      thread: z.enum(["new", "reply"]).default("new"),
    })
    .strict(),
  z
    .object({
      ...stepBase,
      type: z.literal("whatsapp"),
      accountId: nullableId,
      templateName: text(512),
      language: text(20),
      variables: z.record(text(1000)),
      agentId: nullableId,
    })
    .strict(),
  z
    .object({
      ...stepBase,
      type: z.literal("wait"),
      duration: z.number().int().min(1).max(365),
      unit: z.enum(["hours", "days", "business_days"]),
      source: z.enum(["previous", "any"]),
      onReply: z.enum(["agent", "human"]),
    })
    .strict(),
  z
    .object({
      ...stepBase,
      type: z.literal("call"),
      mode: z.enum(["human", "automatic"]),
      assigneeId: nullableId,
      scriptId: nullableId,
      notes: text(5000),
      attempts: z.number().int().min(1).max(5),
    })
    .strict(),
  z
    .object({
      ...stepBase,
      type: z.literal("condition"),
      criteria: z.enum(["replied", "has_email", "has_whatsapp", "call_answered", "meeting_booked"]),
      yes: z.enum(["agent", "human", "end", "next"]),
      no: z.enum(["next", "human", "end"]),
    })
    .strict(),
  z
    .object({
      ...stepBase,
      type: z.literal("task"),
      assigneeId: nullableId,
      notes: text(5000),
      dueDays: z.number().int().min(0).max(365),
    })
    .strict(),
  z
    .object({ ...stepBase, type: z.literal("agent"), agentId: nullableId, objective: text(3000) })
    .strict(),
  z.object({ ...stepBase, type: z.literal("end"), reason: text(120) }).strict(),
]);
export const definitionSchema = z
  .object({
    schemaVersion: z.literal(1),
    audience: z
      .object({
        base: z.enum(["leads", "contacts"]),
        groups: z
          .array(
            z.object({ logic: z.enum(["and", "or"]), filters: z.array(filter).max(20) }).strict(),
          )
          .max(10),
        groupsLogic: z.enum(["and", "or"]),
        excludeCustomers: z.boolean(),
        excludeOpenDeals: z.boolean(),
        excludeOtherSequences: z.boolean(),
        entry: z.enum(["fixed", "dynamic"]),
      })
      .strict(),
    steps: z.array(stepSchema).min(1).max(50),
    settings: z
      .object({
        minimumIntervalSeconds: z.number().int().min(1).max(3600).optional(),
        dailyLimit: z.number().int().min(1).max(1000).optional(),
        stopOnReply: z.boolean(),
        stopOnMeeting: z.boolean(),
        timezone: z
          .string()
          .min(1)
          .max(80)
          .refine((v) => {
            try {
              new Intl.DateTimeFormat("pt-BR", { timeZone: v });
              return true;
            } catch {
              return false;
            }
          }, "Fuso inválido."),
        businessDays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
        start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        agentId: nullableId,
      })
      .strict(),
  })
  .strict()
  .superRefine((d, c) => {
    if (new Set(d.steps.map((s) => s.id)).size !== d.steps.length)
      c.addIssue({
        code: "custom",
        message: "Cada etapa precisa de um identificador único.",
        path: ["steps"],
      });
    if (d.settings.start >= d.settings.end)
      c.addIssue({
        code: "custom",
        message: "O fim do expediente deve ser posterior ao início.",
        path: ["settings", "end"],
      });
    if (new TextEncoder().encode(JSON.stringify(d)).length > 64000)
      c.addIssue({ code: "custom", message: "Rascunho excede 64 KB." });
  });
export const saveDraftSchema = z
  .object({
    id,
    expectedRevision: z.number().int().min(0),
    workspaceId: id,
    name: z.string().trim().min(1).max(120),
    definition: definitionSchema,
  })
  .strict();
export type SequenceStep = z.infer<typeof stepSchema>;
export type SequenceDefinition = z.infer<typeof definitionSchema>;
export type SaveDraft = z.infer<typeof saveDraftSchema>;
export type SequenceDraft = {
  id: string;
  workspace_id: string;
  owner_id: string;
  name: string;
  revision: number;
  definition: SequenceDefinition;
  updated_at: string;
  can_edit: boolean;
};
export const STEP_LABELS: Record<SequenceStep["type"], string> = {
  email: "Enviar e-mail",
  whatsapp: "Enviar WhatsApp",
  wait: "Aguardar resposta",
  call: "Realizar chamada",
  condition: "Verificar condição",
  task: "Criar tarefa",
  agent: "Encaminhar ao agente",
  end: "Encerrar sequência",
};
export function newStep(type: SequenceStep["type"]): SequenceStep {
  const base = { id: crypto.randomUUID(), title: STEP_LABELS[type] };
  switch (type) {
    case "email":
      return { ...base, type, accountId: null, subject: "", body: "", thread: "new" };
    case "whatsapp":
      return {
        ...base,
        type,
        accountId: null,
        templateName: "",
        language: "pt_BR",
        variables: {},
        agentId: null,
      };
    case "wait":
      return { ...base, type, duration: 24, unit: "hours", source: "previous", onReply: "agent" };
    case "call":
      return {
        ...base,
        type,
        mode: "human",
        assigneeId: null,
        scriptId: null,
        notes: "",
        attempts: 1,
      };
    case "condition":
      return { ...base, type, criteria: "replied", yes: "agent", no: "next" };
    case "task":
      return { ...base, type, assigneeId: null, notes: "", dueDays: 1 };
    case "agent":
      return { ...base, type, agentId: null, objective: "" };
    case "end":
      return { ...base, type, reason: "Cadência concluída" };
  }
}
export function newDefinition(): SequenceDefinition {
  return {
    schemaVersion: 1,
    audience: {
      base: "contacts",
      groups: [],
      groupsLogic: "or",
      excludeCustomers: true,
      excludeOpenDeals: true,
      excludeOtherSequences: true,
      entry: "fixed",
    },
    steps: [
      newStep("email"),
      newStep("wait"),
      newStep("whatsapp"),
      newStep("wait"),
      newStep("call"),
      newStep("end"),
    ],
    settings: {
      minimumIntervalSeconds: 60,
      dailyLimit: 100,
      stopOnReply: true,
      stopOnMeeting: true,
      timezone: "America/Sao_Paulo",
      businessDays: [1, 2, 3, 4, 5],
      start: "09:00",
      end: "18:00",
      agentId: null,
    },
  };
}

export const operationsInput = z
  .object({
    workspaceId: z.string().uuid(),
    versionId: z.string().uuid(),
    cohortId: z.string().uuid().optional(),
    page: z.number().int().min(0).max(10000).default(0),
  })
  .strict();
export const operationInput = z
  .object({
    workspaceId: z.string().uuid(),
    versionId: z.string().uuid(),
    id: z.string().uuid(),
    action: z.enum([
      "start",
      "discard",
      "pause",
      "resume",
      "cancel",
      "retry",
      "reconcile",
      "answered",
      "no_answer",
    ]),
  })
  .strict();
