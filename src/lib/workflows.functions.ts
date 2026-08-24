import { conditionsSummary, evaluateConditions } from "@/lib/workflows/conditions";
// Server functions para o builder de Workflows.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { tickWorkflows, processEvent } from "@/lib/workflows/engine.server";
import { assertWorkflowsManage, assertWorkflowsDelete } from "@/lib/access-control/admin-gates.server";
import { SaveSchema } from "@/lib/workflows/schemas";
import type { WorkflowFilter, WorkflowAction, WorkflowTrigger } from "@/lib/workflows/types";

const EntityTableEnum = z.enum([
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

// Aplica um filtro simples no snapshot do registro (subset do evalFilter do engine,
// suficiente para bulk-enroll do lado do servidor).
function passesFilter(row: Record<string, unknown>, f: WorkflowFilter): boolean {
  const v = row?.[f.field];
  switch (f.op) {
    case "eq":
      return v === f.value;
    case "neq":
      return v !== f.value;
    case "contains":
      return (
        typeof v === "string" &&
        typeof f.value === "string" &&
        v.toLowerCase().includes(f.value.toLowerCase())
      );
    case "gt":
      return typeof v === "number" && typeof f.value === "number" && v > f.value;
    case "lt":
      return typeof v === "number" && typeof f.value === "number" && v < f.value;
    case "in": {
      const list =
        typeof f.value === "string"
          ? f.value.split(",").map((s) => s.trim())
          : Array.isArray(f.value)
            ? f.value
            : [];
      return list.includes(v as never);
    }
    case "is_empty":
      return v == null || v === "";
    case "is_not_empty":
      return !(v == null || v === "");
    case "changed_to":
      return v === f.value; // sem "before" em bulk enroll
    default:
      return true;
  }
}

export const listWorkflows = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("workflows")
      .select(
        "id, name, entity, enabled, status, published_version, last_published_at, trigger, actions, goal_filters, draft_trigger, draft_actions, draft_goal_filters, updated_at",
      )
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
    return (data ?? []).map((w) => {
      const draftActions = (w as { draft_actions?: unknown }).draft_actions ?? w.actions;
      const draftTrigger = (w as { draft_trigger?: unknown }).draft_trigger ?? w.trigger;
      const draftGoal =
        (w as { draft_goal_filters?: unknown }).draft_goal_filters ?? w.goal_filters;
      const hasDraftChanges =
        JSON.stringify(draftActions ?? []) !== JSON.stringify(w.actions ?? []) ||
        JSON.stringify(draftTrigger ?? {}) !== JSON.stringify(w.trigger ?? {}) ||
        JSON.stringify(draftGoal ?? []) !== JSON.stringify(w.goal_filters ?? []);
      return {
        ...w,
        draft_actions: draftActions,
        draft_trigger: draftTrigger,
        draft_goal_filters: draftGoal,
        has_draft_changes: hasDraftChanges,
        runs_24h: stats.get(w.id)?.total ?? 0,
        errors_24h: stats.get(w.id)?.errors ?? 0,
      };
    });
  });

export const saveWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => SaveSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertWorkflowsManage(supabase, userId);
    // Fase 4: escritas do builder vão SEMPRE para o rascunho. A versão viva (actions/trigger/goal_filters)
    // só muda via publishWorkflow. Toggle de enabled/name/entity é aplicado direto, sem mexer em status.
    const updatePayload = {
      name: data.name,
      entity: data.entity,
      enabled: data.enabled,
      draft_trigger: data.trigger,
      draft_actions: data.actions,
      draft_goal_filters: (data.trigger as unknown as WorkflowTrigger).goal_filters ?? [],
    } as never;
    if (data.id) {
      const { error } = await supabase.from("workflows").update(updatePayload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    // Novo workflow: começa como 'draft' até primeira publicação.
    const insertPayload = {
      ...(updatePayload as Record<string, unknown>),
      owner_id: userId,
      status: "draft",
      trigger: {},
      actions: [],
      goal_filters: [],
    } as never;
    const { data: row, error } = await supabase
      .from("workflows")
      .insert(insertPayload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const publishWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertWorkflowsManage(supabase, userId);
    const { data: wf, error: getErr } = await supabase
      .from("workflows")
      .select("id, draft_trigger, draft_actions, draft_goal_filters, published_version")
      .eq("id", data.id)
      .maybeSingle();
    if (getErr) throw new Error(getErr.message);
    if (!wf) throw new Error("Workflow não encontrado");
    const { error } = await supabase
      .from("workflows")
      .update({
        trigger: wf.draft_trigger ?? {},
        actions: wf.draft_actions ?? [],
        goal_filters: wf.draft_goal_filters ?? [],
        status: "published",
        published_version: (wf.published_version ?? 0) + 1,
        last_published_at: new Date().toISOString(),
      } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true, version: (wf.published_version ?? 0) + 1 };
  });

export const discardDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertWorkflowsManage(context.supabase, context.userId);
    const { data: wf, error: getErr } = await context.supabase
      .from("workflows")
      .select("trigger, actions, goal_filters")
      .eq("id", data.id)
      .maybeSingle();
    if (getErr) throw new Error(getErr.message);
    if (!wf) throw new Error("Workflow não encontrado");
    const { error } = await context.supabase
      .from("workflows")
      .update({
        draft_trigger: wf.trigger,
        draft_actions: wf.actions,
        draft_goal_filters: wf.goal_filters,
        status: "published",
      } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertWorkflowsDelete(context.supabase, context.userId);
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

// Fase 4 — histórico de enrollment por registro (ex: um lead específico).
export const listRecordEnrollments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        entity: EntityTableEnum,
        entityId: z.string().uuid(),
        limit: z.number().int().min(1).max(100).default(50),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("workflow_runs")
      .select("id, workflow_id, status, started_at, finished_at, error, log, created_at, is_test")
      .eq("entity", data.entity)
      .eq("entity_id", data.entityId)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// Fase 4 — dry-run: executa o workflow (versão rascunho) contra um registro real,
// registra a execução com is_test=true e não persiste ações que gravam em produção.
// Estratégia: usa um cliente wrapper que intercepta writes; para v1, apenas produz
// um log estático caminhando pelas ações.
export const testWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        workflowId: z.string().uuid(),
        entity: EntityTableEnum,
        entityId: z.string().uuid(),
        useDraft: z.boolean().default(true),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertWorkflowsManage(context.supabase, context.userId);
    const { data: wf, error: wfErr } = await context.supabase
      .from("workflows")
      .select("id, entity, trigger, actions, draft_trigger, draft_actions")
      .eq("id", data.workflowId)
      .maybeSingle();
    if (wfErr) throw new Error(wfErr.message);
    if (!wf) throw new Error("Workflow não encontrado");
    if (wf.entity !== data.entity) throw new Error("Entidade do workflow difere do registro");

    // Snapshot do registro.
    const { data: rec, error: recErr } = await context.supabase
      .from(data.entity as never)
      .select("*")
      .eq("id", data.entityId)
      .maybeSingle();
    if (recErr) throw new Error(recErr.message);
    if (!rec) throw new Error("Registro não encontrado");

    const actions = ((data.useDraft ? wf.draft_actions : wf.actions) ?? []) as WorkflowAction[];
    const trigger = ((data.useDraft ? wf.draft_trigger : wf.trigger) ??
      {}) as unknown as WorkflowTrigger;

    // Log simulado: filtros do trigger + lista linear das ações (branches expandidos).
    const log: Array<{ step: string; ok: boolean; note?: string }> = [];
    const triggerFilters = trigger.filters ?? [];
    const triggerOk = evaluateConditions(triggerFilters, (f) =>
      passesFilter(rec as Record<string, unknown>, f),
    );
    log.push({
      step: `Trigger: ${trigger.event ?? "?"} (${conditionsSummary(triggerFilters)})`,
      ok: triggerOk,
      note: triggerOk
        ? "registro passa nos filtros do gatilho"
        : "registro NÃO passa nos filtros do gatilho",
    });

    const walk = (list: WorkflowAction[], depth = 0) => {
      for (const a of list) {
        const prefix = "  ".repeat(depth);
        if (a.type === "branch_if") {
          const passes = evaluateConditions(a.filters, (f) =>
            passesFilter(rec as Record<string, unknown>, f),
          );
          log.push({
            step: `${prefix}branch_if (${conditionsSummary(a.filters)}) → ${passes ? "então" : "senão"}`,
            ok: true,
          });
          walk(passes ? a.then : a.else, depth + 1);
        } else if (a.type === "switch_by_value") {
          const v = (rec as Record<string, unknown>)[a.field];
          const match = a.cases.find((c) => c.value === v);
          log.push({
            step: `${prefix}switch_by_value(${a.field}=${String(v)}) → ${match ? (match.label ?? String(match.value)) : "default"}`,
            ok: true,
          });
          walk(match ? match.actions : a.default, depth + 1);
        } else if (a.type === "branch_multi") {
          const hit = a.branches.find((b) =>
            evaluateConditions(b.filters, (f) => passesFilter(rec as Record<string, unknown>, f)),
          );
          log.push({
            step: `${prefix}branch_multi → ${hit ? (hit.label ?? "ramo") : "senão"}`,
            ok: true,
          });
          walk(hit ? hit.actions : a.else, depth + 1);
        } else {
          log.push({ step: `${prefix}${a.type}`, ok: true, note: "(simulado — não executado)" });
        }
      }
    };
    walk(actions);

    // Persiste como run de teste para aparecer no histórico do registro.
    await context.supabase.from("workflow_runs").insert({
      owner_id: context.userId,
      workflow_id: data.workflowId,
      event_id: "00000000-0000-0000-0000-000000000000",
      entity: data.entity,
      entity_id: data.entityId,
      status: triggerOk ? "success" : "skipped",
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
      log: log as never,
      is_test: true,
    } as never);

    return { ok: true, triggerOk, log };
  });

// Fase 4 — aplicar workflow aos registros existentes que batem no gatilho.
// Enfileira eventos sintéticos "created" em workflow_events; o tick normal processa.
export const bulkEnrollWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        workflowId: z.string().uuid(),
        limit: z.number().int().min(1).max(500).default(200),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertWorkflowsManage(supabase, userId);

    const { data: wf, error: wfErr } = await supabase
      .from("workflows")
      .select("id, entity, trigger, status")
      .eq("id", data.workflowId)
      .maybeSingle();
    if (wfErr) throw new Error(wfErr.message);
    if (!wf) throw new Error("Workflow não encontrado");
    if (wf.status !== "published")
      throw new Error("Publique o workflow antes de aplicar aos existentes");

    const trigger = (wf.trigger ?? {}) as unknown as WorkflowTrigger;
    const filters = trigger.filters ?? [];

    const { data: records, error: recErr } = await supabase
      .from(wf.entity as never)
      .select("*")
      .limit(data.limit);
    if (recErr) throw new Error(recErr.message);

    let enqueued = 0;
    for (const rec of (records ?? []) as Record<string, unknown>[]) {
      if (!evaluateConditions(filters, (f) => passesFilter(rec, f))) continue;
      const { error: evErr } = await supabase.from("workflow_events").insert({
        owner_id: userId,
        entity: wf.entity,
        entity_id: rec.id as string,
        event_type: "created",
        after: rec as never,
        before: null,
      } as never);
      if (!evErr) enqueued += 1;
    }

    // Processa imediatamente (limita a `enqueued` para não pegar backlog alheio de outros triggers).
    const tickRes = await tickWorkflows(supabase, Math.max(enqueued, 1));
    return { enqueued, processed: tickRes.processed };
  });

export const triggerTickNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Roda como o usuário (RLS) — só processa eventos do owner_id dele.
    return await tickWorkflows(context.supabase, 50);
  });

// Fase 5b — lista aprovações pendentes do usuário atual (owner-scoped via RLS).
export const listPendingApprovals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("workflow_approvals")
      .select(
        "id, workflow_id, run_id, entity, entity_id, title, note, approver_user_id, status, created_at, workflows(name)",
      )
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// Fase 5b — aprovar/rejeitar. Se aprovado, enfileira evento de retomada.
export const decideApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        approvalId: z.string().uuid(),
        decision: z.enum(["approved", "rejected"]),
        comment: z.string().max(2000).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: appr, error: getErr } = await supabase
      .from("workflow_approvals")
      .select(
        "id, owner_id, workflow_id, run_id, entity, entity_id, status, resume_cursor, event_snapshot",
      )
      .eq("id", data.approvalId)
      .maybeSingle();
    if (getErr) throw new Error(getErr.message);
    if (!appr) throw new Error("Aprovação não encontrada");
    if (appr.status !== "pending") throw new Error("Aprovação já foi decidida");

    const { error: updErr } = await supabase
      .from("workflow_approvals")
      .update({
        status: data.decision,
        decided_at: new Date().toISOString(),
        decided_by: userId,
        decision_comment: data.comment ?? null,
      } as never)
      .eq("id", data.approvalId);
    if (updErr) throw new Error(updErr.message);

    if (data.decision === "approved") {
      const snap = (appr.event_snapshot ?? {}) as { after?: unknown; before?: unknown };
      await supabase.from("workflow_events").insert({
        owner_id: appr.owner_id,
        entity: appr.entity,
        entity_id: appr.entity_id,
        event_type: "created",
        before: (snap.before ?? null) as never,
        after: (snap.after ?? null) as never,
        resume_workflow_id: appr.workflow_id,
        resume_cursor: appr.resume_cursor,
      } as never);
      await tickWorkflows(supabase, 5);
    } else if (appr.run_id) {
      await supabase
        .from("workflow_runs")
        .update({
          status: "rejected" as never,
          finished_at: new Date().toISOString(),
          error: `Aprovação rejeitada${data.comment ? `: ${data.comment}` : ""}`,
        })
        .eq("id", appr.run_id);
    }
    return { ok: true };
  });

// Suprime warning de import não usado quando processEvent futuramente for referenciado.
void processEvent;
