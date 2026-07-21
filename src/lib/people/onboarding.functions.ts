// Server functions do módulo TechPeople — Sprint 6.
// Onboarding & Offboarding: templates, planos e tarefas.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const ONB_KINDS = ["onboarding", "offboarding"] as const;
export type OnbKind = (typeof ONB_KINDS)[number];
export const ONB_KIND_LABELS: Record<OnbKind, string> = {
  onboarding: "Admissão",
  offboarding: "Desligamento",
};

export const ONB_PLAN_STATUSES = [
  "not_started",
  "in_progress",
  "completed",
  "canceled",
] as const;
export type OnbPlanStatus = (typeof ONB_PLAN_STATUSES)[number];
export const ONB_PLAN_STATUS_LABELS: Record<OnbPlanStatus, string> = {
  not_started: "Não iniciado",
  in_progress: "Em andamento",
  completed: "Concluído",
  canceled: "Cancelado",
};

export const ONB_TASK_STATUSES = [
  "pending",
  "in_progress",
  "done",
  "blocked",
  "skipped",
] as const;
export type OnbTaskStatus = (typeof ONB_TASK_STATUSES)[number];
export const ONB_TASK_STATUS_LABELS: Record<OnbTaskStatus, string> = {
  pending: "Pendente",
  in_progress: "Em andamento",
  done: "Concluída",
  blocked: "Bloqueada",
  skipped: "Ignorada",
};

export type OnbTemplateItem = {
  title: string;
  description?: string | null;
  category?: string | null;
  due_offset_days?: number | null;
};

export type OnbTemplateRow = {
  id: string;
  workspace_id: string;
  owner_id: string;
  name: string;
  kind: OnbKind;
  role_title: string | null;
  employment_type: string | null;
  description: string | null;
  is_active: boolean;
  items: OnbTemplateItem[];
  created_at: string;
  updated_at: string;
};

export type OnbPlanRow = {
  id: string;
  workspace_id: string;
  owner_id: string;
  person_id: string;
  template_id: string | null;
  kind: OnbKind;
  status: OnbPlanStatus;
  started_at: string | null;
  target_completion_date: string | null;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  person_name?: string | null;
  progress?: { total: number; done: number };
};

export type OnbTaskRow = {
  id: string;
  workspace_id: string;
  plan_id: string;
  title: string;
  description: string | null;
  category: string | null;
  assignee_id: string | null;
  due_date: string | null;
  status: OnbTaskStatus;
  completed_at: string | null;
  completed_by: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
};

type MinimalClient = { from: (t: string) => unknown };
async function resolveWorkspaceId(
  supabase: MinimalClient,
  userId: string,
): Promise<string> {
  const q = supabase.from("profiles") as {
    select: (c: string) => {
      eq: (
        k: string,
        v: string,
      ) => {
        maybeSingle: () => Promise<{
          data: { active_workspace_id: string | null } | null;
        }>;
      };
    };
  };
  const { data } = await q.select("active_workspace_id").eq("id", userId).maybeSingle();
  const wsId = data?.active_workspace_id;
  if (!wsId) throw new Error("Workspace ativo não encontrado");
  return wsId;
}

// ============ TEMPLATES ============

const templateItemSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  category: z.string().max(80).nullable().optional(),
  due_offset_days: z.number().int().nullable().optional(),
});

const templateSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  name: z.string().min(2).max(200),
  kind: z.enum(ONB_KINDS),
  role_title: z.string().max(200).nullable().optional(),
  employment_type: z.string().max(40).nullable().optional(),
  description: z.string().max(4000).nullable().optional(),
  is_active: z.boolean().default(true),
  items: z.array(templateItemSchema).default([]),
});

export const listOnbTemplates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({ kind: z.enum(ONB_KINDS).nullable().optional() })
      .parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("people_onboarding_templates")
      .select("*")
      .order("name", { ascending: true });
    if (data.kind) q = q.eq("kind", data.kind);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as OnbTemplateRow[];
  });

export const upsertOnbTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => templateSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload: Record<string, unknown> = {
      name: data.name,
      kind: data.kind,
      role_title: data.role_title ?? null,
      employment_type: data.employment_type ?? null,
      description: data.description ?? null,
      is_active: data.is_active,
      items: data.items,
    };
    if (data.id) {
      const { error } = await supabase
        .from("people_onboarding_templates")
        .update(payload as never)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const workspace_id = await resolveWorkspaceId(supabase, userId);
    const { data: row, error } = await supabase
      .from("people_onboarding_templates")
      .insert({ ...payload, workspace_id, owner_id: userId } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (row as { id: string }).id };
  });

export const deleteOnbTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("people_onboarding_templates")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ PLANS ============

const planSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  person_id: z.string().uuid(),
  template_id: z.string().uuid().nullable().optional(),
  kind: z.enum(ONB_KINDS),
  status: z.enum(ONB_PLAN_STATUSES).default("in_progress"),
  started_at: z.string().nullable().optional(),
  target_completion_date: z.string().nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
});

export const listOnbPlans = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        person_id: z.string().uuid().nullable().optional(),
        status: z.enum(ONB_PLAN_STATUSES).nullable().optional(),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("people_onboarding_plans")
      .select("*, people(full_name)")
      .order("created_at", { ascending: false });
    if (data.person_id) q = q.eq("person_id", data.person_id);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const plans = (rows ?? []) as (OnbPlanRow & {
      people?: { full_name: string | null } | null;
    })[];
    if (plans.length === 0) return [] as OnbPlanRow[];
    const ids = plans.map((p) => p.id);
    const { data: taskRows } = await context.supabase
      .from("people_onboarding_tasks")
      .select("plan_id,status")
      .in("plan_id", ids);
    const progressByPlan = new Map<string, { total: number; done: number }>();
    for (const t of (taskRows ?? []) as { plan_id: string; status: string }[]) {
      const cur = progressByPlan.get(t.plan_id) ?? { total: 0, done: 0 };
      cur.total += 1;
      if (t.status === "done" || t.status === "skipped") cur.done += 1;
      progressByPlan.set(t.plan_id, cur);
    }
    return plans.map((p) => ({
      ...p,
      person_name: p.people?.full_name ?? null,
      progress: progressByPlan.get(p.id) ?? { total: 0, done: 0 },
    })) as OnbPlanRow[];
  });

export const getOnbPlanWithTasks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: plan, error } = await context.supabase
      .from("people_onboarding_plans")
      .select("*, people(full_name)")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!plan) throw new Error("Plano não encontrado");
    const { data: tasks, error: e2 } = await context.supabase
      .from("people_onboarding_tasks")
      .select("*")
      .eq("plan_id", data.id)
      .order("order_index", { ascending: true });
    if (e2) throw new Error(e2.message);
    return {
      plan: plan as OnbPlanRow & { people?: { full_name: string | null } | null },
      tasks: (tasks ?? []) as OnbTaskRow[],
    };
  });

/**
 * Cria um plano a partir de um template, materializando as tarefas.
 * Se template_id é null, cria plano vazio.
 */
export const createOnbPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => planSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspace_id = await resolveWorkspaceId(supabase, userId);
    const startedAt = data.started_at ?? new Date().toISOString().slice(0, 10);
    const { data: planRow, error } = await supabase
      .from("people_onboarding_plans")
      .insert({
        workspace_id,
        owner_id: userId,
        person_id: data.person_id,
        template_id: data.template_id ?? null,
        kind: data.kind,
        status: data.status,
        started_at: startedAt,
        target_completion_date: data.target_completion_date ?? null,
        notes: data.notes ?? null,
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const planId = (planRow as { id: string }).id;

    if (data.template_id) {
      const { data: tpl } = await supabase
        .from("people_onboarding_templates")
        .select("items")
        .eq("id", data.template_id)
        .maybeSingle();
      const items = ((tpl as { items?: OnbTemplateItem[] } | null)?.items ?? []) as OnbTemplateItem[];
      if (items.length > 0) {
        const base = new Date(startedAt);
        const rows = items.map((it, idx) => {
          let due: string | null = null;
          if (typeof it.due_offset_days === "number") {
            const d = new Date(base);
            d.setDate(d.getDate() + it.due_offset_days);
            due = d.toISOString().slice(0, 10);
          }
          return {
            workspace_id,
            plan_id: planId,
            title: it.title,
            description: it.description ?? null,
            category: it.category ?? null,
            due_date: due,
            order_index: idx,
            status: "pending" as const,
          };
        });
        const { error: e2 } = await supabase
          .from("people_onboarding_tasks")
          .insert(rows as never);
        if (e2) throw new Error(e2.message);
      }
    }
    return { id: planId };
  });

export const updateOnbPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    planSchema
      .partial()
      .extend({ id: z.string().uuid() })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const payload: Record<string, unknown> = { ...rest };
    if (rest.status === "completed") payload.completed_at = new Date().toISOString();
    const { error } = await context.supabase
      .from("people_onboarding_plans")
      .update(payload as never)
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { id };
  });

export const deleteOnbPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("people_onboarding_plans")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ TASKS ============

const taskSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  plan_id: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(4000).nullable().optional(),
  category: z.string().max(80).nullable().optional(),
  assignee_id: z.string().uuid().nullable().optional(),
  due_date: z.string().nullable().optional(),
  status: z.enum(ONB_TASK_STATUSES).default("pending"),
  order_index: z.number().int().default(0),
});

export const upsertOnbTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => taskSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload: Record<string, unknown> = {
      plan_id: data.plan_id,
      title: data.title,
      description: data.description ?? null,
      category: data.category ?? null,
      assignee_id: data.assignee_id ?? null,
      due_date: data.due_date || null,
      status: data.status,
      order_index: data.order_index,
    };
    if (data.status === "done") {
      payload.completed_at = new Date().toISOString();
      payload.completed_by = userId;
    } else {
      payload.completed_at = null;
      payload.completed_by = null;
    }
    if (data.id) {
      const { error } = await supabase
        .from("people_onboarding_tasks")
        .update(payload as never)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: plan } = await supabase
      .from("people_onboarding_plans")
      .select("workspace_id")
      .eq("id", data.plan_id)
      .maybeSingle();
    const workspace_id = (plan as { workspace_id: string } | null)?.workspace_id;
    if (!workspace_id) throw new Error("Plano não encontrado");
    const { data: row, error } = await supabase
      .from("people_onboarding_tasks")
      .insert({ ...payload, workspace_id } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (row as { id: string }).id };
  });

export const setOnbTaskStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({ id: z.string().uuid(), status: z.enum(ONB_TASK_STATUSES) })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload: Record<string, unknown> = { status: data.status };
    if (data.status === "done") {
      payload.completed_at = new Date().toISOString();
      payload.completed_by = userId;
    } else {
      payload.completed_at = null;
      payload.completed_by = null;
    }
    const { error } = await supabase
      .from("people_onboarding_tasks")
      .update(payload as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteOnbTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("people_onboarding_tasks")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
