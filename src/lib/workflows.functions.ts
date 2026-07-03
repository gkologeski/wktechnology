// Server functions para o builder de Workflows.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { tickWorkflows } from "@/lib/workflows/engine.server";
import { requireTool } from "@/lib/permissions.server";

const EntityEnum = z.enum([
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

const FilterSchema = z.object({
  field: z.string().min(1).max(100),
  op: z.enum(["eq", "neq", "in", "contains", "gt", "lt", "changed_to", "is_empty", "is_not_empty"]),
  value: z.unknown().optional(),
});

const EventEnum = z.enum(["created", "updated", "stage_changed"]);

const TriggerSchema = z.object({
  event: EventEnum,
  filters: z.array(FilterSchema).max(20).default([]),
  reenroll: z
    .object({
      enabled: z.boolean(),
      events: z.array(EventEnum).max(3).optional(),
    })
    .optional(),
});

// Zod union recursivo (branch_if contém arrays de WorkflowAction).
type ActionInput = Record<string, unknown>;

const SimpleActionSchema = z.discriminatedUnion("type", [
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
]);

// Limita profundidade da recursão para evitar payloads abusivos.
const MAX_BRANCH_DEPTH = 3;

function parseActionsAtDepth(input: unknown, depth: number): ActionInput[] {
  if (!Array.isArray(input)) throw new Error("actions deve ser um array");
  if (input.length > 20) throw new Error("máximo 20 ações por ramo");
  return input.map((raw) => parseActionAtDepth(raw, depth));
}

function parseActionAtDepth(raw: unknown, depth: number): ActionInput {
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


const SaveSchema = z.object({
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


export const listWorkflows = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("workflows")
      .select("id, name, entity, enabled, trigger, actions, updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);

    const since = new Date(Date.now() - 86_400_000).toISOString();
    const { data: runs } = await supabase
      .from("workflow_runs")
      .select("workflow_id, status")
      .gte("created_at", since);
    const stats = new Map<string, { total: number; errors: number }>();
    for (const r of runs ?? []) {
      const s = stats.get(r.workflow_id as string) ?? { total: 0, errors: 0 };
      s.total += 1;
      if (r.status === "error") s.errors += 1;
      stats.set(r.workflow_id as string, s);
    }
    return (data ?? []).map((w) => ({
      ...w,
      runs_24h: stats.get(w.id)?.total ?? 0,
      errors_24h: stats.get(w.id)?.errors ?? 0,
    }));
  });

export const saveWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => SaveSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireTool(userId, "manage_workflows");
    const payload = {
      owner_id: userId,
      name: data.name,
      entity: data.entity,
      enabled: data.enabled,
      trigger: data.trigger,
      actions: data.actions,
    } as never;
    if (data.id) {
      const { error } = await supabase.from("workflows").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supabase
      .from("workflows")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await requireTool(context.userId, "manage_workflows");
    const { error } = await context.supabase.from("workflows").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listRecentRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        workflowId: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(100).default(20),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("workflow_runs")
      .select("id, workflow_id, status, started_at, finished_at, error, log, created_at")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.workflowId) q = q.eq("workflow_id", data.workflowId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const triggerTickNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Roda como o usuário (RLS) — só processa eventos do owner_id dele.
    return await tickWorkflows(context.supabase, 50);
  });
