// Server functions para o módulo TechPeople — Sprint 2.
// Metas (people_goals), One-on-Ones (people_one_on_ones) e Avaliações do
// tomador (people_reviews). Todas as operações passam por RLS que exige
// gestor/admin/própria pessoa para leitura e gestor/admin para escrita.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { deleteByIdGuarded } from "@/lib/db/delete-guarded";

// ============================================================
// Types
// ============================================================
export const GOAL_METRIC_TYPES = ["kpi", "okr", "task"] as const;
export const GOAL_STATUSES = ["draft", "active", "done", "canceled"] as const;
export const REVIEW_CADENCES = ["monthly", "quarterly", "semiannual", "annual", "ad_hoc"] as const;
export const REVIEW_STATUSES = ["draft", "submitted", "acknowledged"] as const;
export const ONE_ON_ONE_STATUSES = ["scheduled", "held", "skipped", "canceled"] as const;

export type GoalMetricType = (typeof GOAL_METRIC_TYPES)[number];
export type GoalStatus = (typeof GOAL_STATUSES)[number];
export type ReviewCadence = (typeof REVIEW_CADENCES)[number];
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];
export type OneOnOneStatus = (typeof ONE_ON_ONE_STATUSES)[number];

export const GOAL_STATUS_LABELS: Record<GoalStatus, string> = {
  draft: "Rascunho",
  active: "Ativa",
  done: "Concluída",
  canceled: "Cancelada",
};
export const GOAL_METRIC_LABELS: Record<GoalMetricType, string> = {
  kpi: "KPI",
  okr: "OKR",
  task: "Entrega",
};
export const REVIEW_CADENCE_LABELS: Record<ReviewCadence, string> = {
  monthly: "Mensal",
  quarterly: "Trimestral",
  semiannual: "Semestral",
  annual: "Anual",
  ad_hoc: "Pontual",
};
export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  draft: "Rascunho",
  submitted: "Enviada",
  acknowledged: "Reconhecida",
};
export const ONE_ON_ONE_STATUS_LABELS: Record<OneOnOneStatus, string> = {
  scheduled: "Agendada",
  held: "Realizada",
  skipped: "Não realizada",
  canceled: "Cancelada",
};

export type GoalRow = {
  id: string;
  person_id: string;
  owner_id: string;
  title: string;
  description: string | null;
  metric_type: GoalMetricType;
  unit: string | null;
  target_value: number | null;
  current_value: number;
  progress_pct: number;
  period_start: string | null;
  period_end: string | null;
  status: GoalStatus;
  weight: number;
  created_at: string;
  updated_at: string;
};

export type ActionItem = { text: string; done: boolean; assignee_id?: string | null };

export type OneOnOneRow = {
  id: string;
  person_id: string;
  owner_id: string;
  manager_id: string | null;
  scheduled_at: string | null;
  held_at: string | null;
  duration_min: number | null;
  status: OneOnOneStatus;
  mood: number | null;
  agenda: string | null;
  notes: string | null;
  action_items: ActionItem[];
  private_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ReviewRatings = Record<string, number>;

export type ReviewRow = {
  id: string;
  person_id: string;
  owner_id: string;
  reviewer_id: string | null;
  reviewer_name: string | null;
  reviewer_role: string | null;
  cadence: ReviewCadence;
  period_start: string;
  period_end: string;
  ratings: ReviewRatings;
  overall_score: number | null;
  strengths: string | null;
  improvements: string | null;
  comments: string | null;
  status: ReviewStatus;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
};

// ============================================================
// Helpers
// ============================================================
type MinimalClient = { from: (t: string) => unknown };

async function resolveOwnerId(supabase: MinimalClient, userId: string): Promise<string> {
  const q = supabase.from("profiles") as {
    select: (c: string) => {
      eq: (
        k: string,
        v: string,
      ) => {
        maybeSingle: () => Promise<{ data: { active_workspace_id: string | null } | null }>;
      };
    };
  };
  const { data } = await q.select("active_workspace_id").eq("id", userId).maybeSingle();
  const ownerId = data?.active_workspace_id;
  if (!ownerId) throw new Error("Workspace ativo não encontrado");
  return ownerId;
}

// ============================================================
// GOALS
// ============================================================
const goalUpsertSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  person_id: z.string().uuid(),
  title: z.string().min(2).max(200),
  description: z.string().max(4000).nullable().optional(),
  metric_type: z.enum(GOAL_METRIC_TYPES).default("kpi"),
  unit: z.string().max(20).nullable().optional(),
  target_value: z.number().nullable().optional(),
  current_value: z.number().default(0),
  progress_pct: z.number().min(0).max(100).default(0),
  period_start: z.string().nullable().optional(),
  period_end: z.string().nullable().optional(),
  status: z.enum(GOAL_STATUSES).default("active"),
  weight: z.number().min(0).default(1),
});

export const listGoals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ person_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("people_goals")
      .select("*")
      .eq("person_id", data.person_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []) as GoalRow[];
  });

export const upsertGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => goalUpsertSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload: Record<string, unknown> = {
      person_id: data.person_id,
      title: data.title,
      description: data.description ?? null,
      metric_type: data.metric_type,
      unit: data.unit ?? null,
      target_value: data.target_value ?? null,
      current_value: data.current_value,
      progress_pct: data.progress_pct,
      period_start: data.period_start || null,
      period_end: data.period_end || null,
      status: data.status,
      weight: data.weight,
    };
    if (data.id) {
      const { error } = await supabase
        .from("people_goals")
        .update(payload as never)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const ownerId = await resolveOwnerId(supabase, userId);
    const { data: row, error } = await supabase
      .from("people_goals")
      .insert({ ...payload, owner_id: ownerId, created_by: userId } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (row as { id: string }).id };
  });

export const deleteGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await deleteByIdGuarded(
      context.supabase,
      "people_goals",
      data.id,
      "Você não tem permissão para excluir esta meta.",
    );
    return { ok: true };
  });

// ============================================================
// ONE-ON-ONES
// ============================================================
const actionItemSchema = z.object({
  text: z.string().min(1).max(500),
  done: z.boolean().default(false),
  assignee_id: z.string().uuid().nullable().optional(),
});

const oneOnOneUpsertSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  person_id: z.string().uuid(),
  manager_id: z.string().uuid().nullable().optional(),
  scheduled_at: z.string().nullable().optional(),
  held_at: z.string().nullable().optional(),
  duration_min: z.number().int().nonnegative().nullable().optional(),
  status: z.enum(ONE_ON_ONE_STATUSES).default("scheduled"),
  mood: z.number().int().min(1).max(5).nullable().optional(),
  agenda: z.string().max(4000).nullable().optional(),
  notes: z.string().max(8000).nullable().optional(),
  action_items: z.array(actionItemSchema).default([]),
  private_notes: z.string().max(4000).nullable().optional(),
});

export const listOneOnOnes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ person_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("people_one_on_ones")
      .select("*")
      .eq("person_id", data.person_id)
      .order("scheduled_at", { ascending: false, nullsFirst: false });
    if (error) throw new Error(error.message);
    return (rows ?? []) as unknown as OneOnOneRow[];
  });

export const upsertOneOnOne = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => oneOnOneUpsertSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload: Record<string, unknown> = {
      person_id: data.person_id,
      manager_id: data.manager_id ?? null,
      scheduled_at: data.scheduled_at || null,
      held_at: data.held_at || null,
      duration_min: data.duration_min ?? null,
      status: data.status,
      mood: data.mood ?? null,
      agenda: data.agenda ?? null,
      notes: data.notes ?? null,
      action_items: data.action_items,
      private_notes: data.private_notes ?? null,
    };
    if (data.id) {
      const { error } = await supabase
        .from("people_one_on_ones")
        .update(payload as never)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const ownerId = await resolveOwnerId(supabase, userId);
    const { data: row, error } = await supabase
      .from("people_one_on_ones")
      .insert({ ...payload, owner_id: ownerId, created_by: userId } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (row as { id: string }).id };
  });

export const deleteOneOnOne = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await deleteByIdGuarded(
      context.supabase,
      "people_one_on_ones",
      data.id,
      "Você não tem permissão para excluir este 1:1.",
    );
    return { ok: true };
  });

// ============================================================
// REVIEWS (avaliação do tomador)
// ============================================================
const reviewUpsertSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  person_id: z.string().uuid(),
  reviewer_id: z.string().uuid().nullable().optional(),
  reviewer_name: z.string().max(160).nullable().optional(),
  reviewer_role: z.string().max(120).nullable().optional(),
  cadence: z.enum(REVIEW_CADENCES).default("monthly"),
  period_start: z.string(),
  period_end: z.string(),
  ratings: z.record(z.string(), z.number().min(0).max(5)).default({}),
  overall_score: z.number().min(0).max(5).nullable().optional(),
  strengths: z.string().max(4000).nullable().optional(),
  improvements: z.string().max(4000).nullable().optional(),
  comments: z.string().max(4000).nullable().optional(),
  status: z.enum(REVIEW_STATUSES).default("draft"),
});

export const listReviews = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ person_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("people_reviews")
      .select("*")
      .eq("person_id", data.person_id)
      .order("period_end", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []) as unknown as ReviewRow[];
  });

export const upsertReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => reviewUpsertSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Calcula overall_score se ratings foi enviado e overall não veio.
    let overall = data.overall_score;
    if ((overall === null || overall === undefined) && data.ratings) {
      const vals = Object.values(data.ratings).filter(
        (v): v is number => typeof v === "number" && !Number.isNaN(v),
      );
      if (vals.length > 0) overall = vals.reduce((a, b) => a + b, 0) / vals.length;
    }

    const payload: Record<string, unknown> = {
      person_id: data.person_id,
      reviewer_id: data.reviewer_id ?? null,
      reviewer_name: data.reviewer_name ?? null,
      reviewer_role: data.reviewer_role ?? null,
      cadence: data.cadence,
      period_start: data.period_start,
      period_end: data.period_end,
      ratings: data.ratings ?? {},
      overall_score: overall ?? null,
      strengths: data.strengths ?? null,
      improvements: data.improvements ?? null,
      comments: data.comments ?? null,
      status: data.status,
      submitted_at: data.status === "submitted" ? new Date().toISOString() : null,
    };
    if (data.id) {
      const { error } = await supabase
        .from("people_reviews")
        .update(payload as never)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const ownerId = await resolveOwnerId(supabase, userId);
    const { data: row, error } = await supabase
      .from("people_reviews")
      .insert({ ...payload, owner_id: ownerId, created_by: userId } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (row as { id: string }).id };
  });

export const deleteReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await deleteByIdGuarded(
      context.supabase,
      "people_reviews",
      data.id,
      "Você não tem permissão para excluir esta avaliação.",
    );
    return { ok: true };
  });
