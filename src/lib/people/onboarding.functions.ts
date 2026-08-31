// Server functions do módulo TechPeople — Sprint 6 & 7.
// Onboarding & Offboarding: templates, planos, tarefas e automação.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { emitEvent } from "@/lib/events.server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { deleteByIdGuarded } from "@/lib/db/delete-guarded";

export const ONB_KINDS = ["onboarding", "offboarding"] as const;
export type OnbKind = (typeof ONB_KINDS)[number];
export const ONB_KIND_LABELS: Record<OnbKind, string> = {
  onboarding: "Admissão",
  offboarding: "Desligamento",
};

export const ONB_PLAN_STATUSES = ["not_started", "in_progress", "completed", "canceled"] as const;
export type OnbPlanStatus = (typeof ONB_PLAN_STATUSES)[number];
export const ONB_PLAN_STATUS_LABELS: Record<OnbPlanStatus, string> = {
  not_started: "Não iniciado",
  in_progress: "Em andamento",
  completed: "Concluído",
  canceled: "Cancelado",
};

export const ONB_TASK_STATUSES = ["pending", "in_progress", "done", "blocked", "skipped"] as const;
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
  is_critical?: boolean | null;
  revocation_system?: string | null;
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
  is_critical: boolean;
  revocation_system: string | null;
  created_at: string;
  updated_at: string;
};

type MinimalClient = { from: (t: string) => unknown };
async function resolveWorkspaceId(supabase: MinimalClient, userId: string): Promise<string> {
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
  is_critical: z.boolean().nullable().optional(),
  revocation_system: z.string().max(120).nullable().optional(),
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
  .inputValidator((i) => z.object({ kind: z.enum(ONB_KINDS).nullable().optional() }).parse(i ?? {}))
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
    await deleteByIdGuarded(
      context.supabase,
      "people_onboarding_templates",
      data.id,
      "Você não tem permissão para excluir este modelo de onboarding.",
    );
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
      const items = ((tpl as { items?: OnbTemplateItem[] } | null)?.items ??
        []) as OnbTemplateItem[];
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
        const { error: e2 } = await supabase.from("people_onboarding_tasks").insert(rows as never);
        if (e2) throw new Error(e2.message);
      }
    }
    return { id: planId };
  });

export const updateOnbPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => planSchema.partial().extend({ id: z.string().uuid() }).parse(i))
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
    await deleteByIdGuarded(
      context.supabase,
      "people_onboarding_plans",
      data.id,
      "Você não tem permissão para excluir este plano de onboarding.",
    );
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
  is_critical: z.boolean().nullable().optional(),
  revocation_system: z.string().max(120).nullable().optional(),
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
      is_critical: data.is_critical ?? false,
      revocation_system: data.revocation_system ?? null,
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
    z.object({ id: z.string().uuid(), status: z.enum(ONB_TASK_STATUSES) }).parse(i),
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
    await deleteByIdGuarded(
      context.supabase,
      "people_onboarding_tasks",
      data.id,
      "Você não tem permissão para excluir esta tarefa de onboarding.",
    );
    return { ok: true };
  });

// ============ SPRINT 7 — AUTOMAÇÃO ============
//
// Seleciona template padrão por kind + role_title/employment_type e materializa
// o plano automaticamente ao promover candidato (onboarding) ou ao mudar o
// status da pessoa para `offboarding` (offboarding). Emite eventos de domínio
// para permitir integração com workflows.

type AnyClient = SupabaseClient<never, never, never>;

async function pickDefaultTemplate(
  supabase: AnyClient,
  workspaceId: string,
  kind: OnbKind,
  hints: { role_title?: string | null; employment_type?: string | null },
): Promise<{ id: string; items: OnbTemplateItem[] } | null> {
  const { data } = await supabase
    .from("people_onboarding_templates")
    .select("id, role_title, employment_type, items")
    .eq("workspace_id", workspaceId)
    .eq("kind", kind)
    .eq("is_active", true);
  const rows = (data ?? []) as Array<{
    id: string;
    role_title: string | null;
    employment_type: string | null;
    items: OnbTemplateItem[] | null;
  }>;
  if (rows.length === 0) return null;
  const role = (hints.role_title ?? "").trim().toLowerCase();
  const empType = (hints.employment_type ?? "").trim().toLowerCase();
  // Preferência: match role_title + employment_type > role_title > employment_type > primeiro
  const score = (r: (typeof rows)[number]) => {
    let s = 0;
    if (role && r.role_title && r.role_title.trim().toLowerCase() === role) s += 2;
    if (empType && r.employment_type && r.employment_type.trim().toLowerCase() === empType) s += 1;
    return s;
  };
  rows.sort((a, b) => score(b) - score(a));
  const best = rows[0];
  return { id: best.id, items: (best.items ?? []) as OnbTemplateItem[] };
}

async function materializePlan(
  supabase: AnyClient,
  args: {
    userId: string;
    workspaceId: string;
    personId: string;
    kind: OnbKind;
    templateId: string | null;
    items: OnbTemplateItem[];
    startedAt?: string | null;
    notes?: string | null;
  },
): Promise<{ planId: string; taskCount: number }> {
  const startedAt = args.startedAt ?? new Date().toISOString().slice(0, 10);
  const { data: planRow, error } = await supabase
    .from("people_onboarding_plans")
    .insert({
      workspace_id: args.workspaceId,
      owner_id: args.userId,
      person_id: args.personId,
      template_id: args.templateId,
      kind: args.kind,
      status: "in_progress",
      started_at: startedAt,
      notes: args.notes ?? null,
    } as never)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const planId = (planRow as { id: string }).id;
  let taskCount = 0;
  if (args.items.length > 0) {
    const base = new Date(startedAt);
    const rows = args.items.map((it, idx) => {
      let due: string | null = null;
      if (typeof it.due_offset_days === "number") {
        const d = new Date(base);
        d.setDate(d.getDate() + it.due_offset_days);
        due = d.toISOString().slice(0, 10);
      }
      return {
        workspace_id: args.workspaceId,
        plan_id: planId,
        title: it.title,
        description: it.description ?? null,
        category: it.category ?? null,
        due_date: due,
        order_index: idx,
        status: "pending" as const,
        is_critical: it.is_critical ?? false,
        revocation_system: it.revocation_system ?? null,
      };
    });
    const { error: e2 } = await supabase.from("people_onboarding_tasks").insert(rows as never);
    if (e2) throw new Error(e2.message);
    taskCount = rows.length;
  }
  return { planId, taskCount };
}

/**
 * Verifica se já existe plano ativo/concluído do mesmo kind para essa pessoa.
 * Automação é idempotente: nunca cria um segundo plano do mesmo kind.
 */
async function hasExistingPlan(
  supabase: AnyClient,
  personId: string,
  kind: OnbKind,
): Promise<boolean> {
  const { data } = await supabase
    .from("people_onboarding_plans")
    .select("id")
    .eq("person_id", personId)
    .eq("kind", kind)
    .limit(1);
  return ((data ?? []) as unknown[]).length > 0;
}

/**
 * Server function chamada internamente ou pelo engine de workflows.
 * Cria automaticamente um plano do kind indicado usando o template padrão
 * (heurística role_title + employment_type). Idempotente por pessoa+kind.
 */
export const autoStartOnbPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        person_id: z.string().uuid(),
        kind: z.enum(ONB_KINDS),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    return runAutoStart(supabase as AnyClient, {
      userId,
      personId: data.person_id,
      kind: data.kind,
    });
  });

/**
 * Núcleo compartilhado da automação — reutilizável por outras server functions
 * (ex.: promoteCandidateToPerson, upsertPerson) sem passar pelo RPC.
 */
export async function runAutoStart(
  supabase: AnyClient,
  args: { userId: string; personId: string; kind: OnbKind },
): Promise<{
  status: "created" | "skipped_existing" | "skipped_no_template" | "skipped_missing_person";
  plan_id?: string;
  template_id?: string | null;
  task_count?: number;
}> {
  const { userId, personId, kind } = args;
  const { data: person } = await supabase
    .from("people")
    .select("id, owner_id, role_title, employment_type, hire_date, termination_date")
    .eq("id", personId)
    .maybeSingle();
  if (!person) return { status: "skipped_missing_person" };
  const p = person as {
    id: string;
    owner_id: string;
    role_title: string | null;
    employment_type: string | null;
    hire_date: string | null;
    termination_date: string | null;
  };
  if (await hasExistingPlan(supabase, personId, kind)) {
    return { status: "skipped_existing" };
  }
  const tpl = await pickDefaultTemplate(supabase, p.owner_id, kind, {
    role_title: p.role_title,
    employment_type: p.employment_type,
  });
  if (!tpl) return { status: "skipped_no_template" };
  const startedAt =
    kind === "onboarding"
      ? (p.hire_date ?? new Date().toISOString().slice(0, 10))
      : (p.termination_date ?? new Date().toISOString().slice(0, 10));
  const { planId, taskCount } = await materializePlan(supabase, {
    userId,
    workspaceId: p.owner_id,
    personId,
    kind,
    templateId: tpl.id,
    items: tpl.items,
    startedAt,
  });
  await emitEvent(supabase, {
    ownerId: p.owner_id,
    eventName: kind === "onboarding" ? "people.onboarding_started" : "people.offboarding_started",
    entityType: "person",
    entityId: personId,
    payload: {
      person_id: personId,
      plan_id: planId,
      template_id: tpl.id,
      task_count: taskCount,
      source: "auto",
    },
    dedupeKey: `people.${kind}_started:${personId}`,
  }).catch(() => undefined);
  return { status: "created", plan_id: planId, template_id: tpl.id, task_count: taskCount };
}

// ============ SPRINT 9 — OFFBOARDING TÉCNICO & COMPLIANCE ============
//
// Consolida o status de compliance de desligamento por pessoa:
// - Itens críticos (revogação de acessos, backup, termos) pendentes
// - Vencidos (due_date < hoje e não concluídos)
// - Progresso agregado
// Usado pelo painel de compliance na ficha 360° e para emitir alertas.

export type OffboardingComplianceTask = {
  id: string;
  plan_id: string;
  title: string;
  category: string | null;
  revocation_system: string | null;
  due_date: string | null;
  status: OnbTaskStatus;
  is_overdue: boolean;
};

export type OffboardingComplianceSummary = {
  has_plan: boolean;
  plan_id: string | null;
  plan_status: OnbPlanStatus | null;
  started_at: string | null;
  target_completion_date: string | null;
  totals: {
    total: number;
    done: number;
    critical_total: number;
    critical_pending: number;
    overdue: number;
  };
  critical_tasks: OffboardingComplianceTask[];
};

export const getOffboardingCompliance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ person_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }): Promise<OffboardingComplianceSummary> => {
    const { supabase } = context;
    const { data: planRow } = await supabase
      .from("people_onboarding_plans")
      .select("id, status, started_at, target_completion_date")
      .eq("person_id", data.person_id)
      .eq("kind", "offboarding")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const plan = planRow as {
      id: string;
      status: OnbPlanStatus;
      started_at: string | null;
      target_completion_date: string | null;
    } | null;
    if (!plan) {
      return {
        has_plan: false,
        plan_id: null,
        plan_status: null,
        started_at: null,
        target_completion_date: null,
        totals: { total: 0, done: 0, critical_total: 0, critical_pending: 0, overdue: 0 },
        critical_tasks: [],
      };
    }
    const { data: taskRows, error } = await supabase
      .from("people_onboarding_tasks")
      .select(
        "id, plan_id, title, category, revocation_system, due_date, status, is_critical, order_index",
      )
      .eq("plan_id", plan.id)
      .order("order_index", { ascending: true });
    if (error) throw new Error(error.message);
    const tasks = (taskRows ?? []) as Array<{
      id: string;
      plan_id: string;
      title: string;
      category: string | null;
      revocation_system: string | null;
      due_date: string | null;
      status: OnbTaskStatus;
      is_critical: boolean;
    }>;
    const today = new Date().toISOString().slice(0, 10);
    let total = 0;
    let done = 0;
    let criticalTotal = 0;
    let criticalPending = 0;
    let overdue = 0;
    const critical: OffboardingComplianceTask[] = [];
    for (const t of tasks) {
      total += 1;
      const isDone = t.status === "done" || t.status === "skipped";
      if (isDone) done += 1;
      const isOverdue = !isDone && !!t.due_date && t.due_date < today;
      if (isOverdue) overdue += 1;
      if (t.is_critical) {
        criticalTotal += 1;
        if (!isDone) criticalPending += 1;
        critical.push({
          id: t.id,
          plan_id: t.plan_id,
          title: t.title,
          category: t.category,
          revocation_system: t.revocation_system,
          due_date: t.due_date,
          status: t.status,
          is_overdue: isOverdue,
        });
      }
    }
    return {
      has_plan: true,
      plan_id: plan.id,
      plan_status: plan.status,
      started_at: plan.started_at,
      target_completion_date: plan.target_completion_date,
      totals: {
        total,
        done,
        critical_total: criticalTotal,
        critical_pending: criticalPending,
        overdue,
      },
      critical_tasks: critical,
    };
  });
