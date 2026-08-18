// Server functions do TechPeople — Sprint 3.
// Riscos psicossociais (NR-1) e incidentes de segurança/assédio.
// Todas as leituras/escritas passam por RLS sensível (can_view_person_sensitive
// e can_manage_person). Incidentes sem person_id ficam restritos a admins.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ============================================================
// Enums e labels
// ============================================================
export const PSYCH_METHODS = ["self_report", "manager", "hr", "anonymous_survey"] as const;
export const PSYCH_RISK_LEVELS = ["low", "moderate", "high", "critical"] as const;
export const PSYCH_STATUSES = ["open", "in_progress", "resolved", "archived"] as const;
export const INCIDENT_CATEGORIES = [
  "safety",
  "harassment",
  "discrimination",
  "psychosocial",
  "near_miss",
  "accident",
  "other",
] as const;
export const INCIDENT_SEVERITIES = ["low", "moderate", "high", "critical"] as const;
export const INCIDENT_STATUSES = ["open", "investigating", "resolved", "archived"] as const;

export type PsychMethod = (typeof PSYCH_METHODS)[number];
export type PsychRiskLevel = (typeof PSYCH_RISK_LEVELS)[number];
export type PsychStatus = (typeof PSYCH_STATUSES)[number];
export type IncidentCategory = (typeof INCIDENT_CATEGORIES)[number];
export type IncidentSeverity = (typeof INCIDENT_SEVERITIES)[number];
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export const PSYCH_METHOD_LABELS: Record<PsychMethod, string> = {
  self_report: "Autorrelato",
  manager: "Gestor",
  hr: "RH",
  anonymous_survey: "Pesquisa anônima",
};
export const PSYCH_RISK_LABELS: Record<PsychRiskLevel, string> = {
  low: "Baixo",
  moderate: "Moderado",
  high: "Alto",
  critical: "Crítico",
};
export const PSYCH_STATUS_LABELS: Record<PsychStatus, string> = {
  open: "Aberta",
  in_progress: "Em andamento",
  resolved: "Resolvida",
  archived: "Arquivada",
};
export const INCIDENT_CATEGORY_LABELS: Record<IncidentCategory, string> = {
  safety: "Segurança",
  harassment: "Assédio",
  discrimination: "Discriminação",
  psychosocial: "Psicossocial",
  near_miss: "Quase-acidente",
  accident: "Acidente",
  other: "Outro",
};
export const INCIDENT_SEVERITY_LABELS: Record<IncidentSeverity, string> = {
  low: "Baixa",
  moderate: "Moderada",
  high: "Alta",
  critical: "Crítica",
};
export const INCIDENT_STATUS_LABELS: Record<IncidentStatus, string> = {
  open: "Aberto",
  investigating: "Investigando",
  resolved: "Resolvido",
  archived: "Arquivado",
};

// Dimensões psicossociais canônicas (0–5, quanto maior pior o risco).
export const PSYCH_DIMENSIONS = [
  { key: "workload", label: "Carga de trabalho" },
  { key: "autonomy", label: "Autonomia" },
  { key: "clarity", label: "Clareza de papéis" },
  { key: "relationships", label: "Relacionamento com liderança/pares" },
  { key: "recognition", label: "Reconhecimento" },
  { key: "work_life", label: "Equilíbrio vida-trabalho" },
  { key: "psych_safety", label: "Segurança psicológica" },
] as const;

// ============================================================
// Row types
// ============================================================
export type PsychAssessmentRow = {
  id: string;
  person_id: string;
  owner_id: string;
  assessed_at: string;
  method: PsychMethod;
  dimensions: Record<string, number>;
  overall_score: number | null;
  risk_level: PsychRiskLevel;
  burnout_signals: boolean;
  harassment_signals: boolean;
  action_plan: string | null;
  follow_up_at: string | null;
  status: PsychStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type IncidentRow = {
  id: string;
  person_id: string | null;
  owner_id: string;
  occurred_at: string;
  category: IncidentCategory;
  severity: IncidentSeverity;
  is_confidential: boolean;
  title: string;
  description: string | null;
  location: string | null;
  witnesses: string | null;
  status: IncidentStatus;
  resolution: string | null;
  resolved_at: string | null;
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

function deriveRisk(dims: Record<string, number>): {
  overall: number | null;
  level: PsychRiskLevel;
} {
  const vals = Object.values(dims).filter(
    (v): v is number => typeof v === "number" && !Number.isNaN(v),
  );
  if (vals.length === 0) return { overall: null, level: "low" };
  const overall = vals.reduce((a, b) => a + b, 0) / vals.length;
  const level: PsychRiskLevel =
    overall >= 4 ? "critical" : overall >= 3 ? "high" : overall >= 2 ? "moderate" : "low";
  return { overall: Math.round(overall * 100) / 100, level };
}

// ============================================================
// PSYCHOSOCIAL ASSESSMENTS
// ============================================================
const psychUpsertSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  person_id: z.string().uuid(),
  assessed_at: z.string(),
  method: z.enum(PSYCH_METHODS).default("self_report"),
  dimensions: z.record(z.string(), z.number().min(0).max(5)).default({}),
  overall_score: z.number().min(0).max(5).nullable().optional(),
  risk_level: z.enum(PSYCH_RISK_LEVELS).optional(),
  burnout_signals: z.boolean().default(false),
  harassment_signals: z.boolean().default(false),
  action_plan: z.string().max(4000).nullable().optional(),
  follow_up_at: z.string().nullable().optional(),
  status: z.enum(PSYCH_STATUSES).default("open"),
  notes: z.string().max(4000).nullable().optional(),
});

export const listPsychAssessments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ person_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("people_psychosocial_assessments")
      .select("*")
      .eq("person_id", data.person_id)
      .order("assessed_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []) as unknown as PsychAssessmentRow[];
  });

export const upsertPsychAssessment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => psychUpsertSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const derived = deriveRisk(data.dimensions ?? {});
    const overall = data.overall_score ?? derived.overall;
    const level = data.risk_level ?? derived.level;

    const payload: Record<string, unknown> = {
      person_id: data.person_id,
      assessed_at: data.assessed_at,
      method: data.method,
      dimensions: data.dimensions ?? {},
      overall_score: overall,
      risk_level: level,
      burnout_signals: data.burnout_signals,
      harassment_signals: data.harassment_signals,
      action_plan: data.action_plan ?? null,
      follow_up_at: data.follow_up_at || null,
      status: data.status,
      notes: data.notes ?? null,
    };
    if (data.id) {
      const { error } = await supabase
        .from("people_psychosocial_assessments")
        .update(payload as never)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const ownerId = await resolveOwnerId(supabase, userId);
    const { data: row, error } = await supabase
      .from("people_psychosocial_assessments")
      .insert({ ...payload, workspace_id: ownerId, owner_id: ownerId, created_by: userId } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (row as { id: string }).id };
  });

export const deletePsychAssessment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("people_psychosocial_assessments")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// INCIDENTS
// ============================================================
const incidentUpsertSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  person_id: z.string().uuid().nullable().optional(),
  occurred_at: z.string(),
  category: z.enum(INCIDENT_CATEGORIES),
  severity: z.enum(INCIDENT_SEVERITIES).default("low"),
  is_confidential: z.boolean().default(true),
  title: z.string().min(2).max(200),
  description: z.string().max(8000).nullable().optional(),
  location: z.string().max(200).nullable().optional(),
  witnesses: z.string().max(1000).nullable().optional(),
  status: z.enum(INCIDENT_STATUSES).default("open"),
  resolution: z.string().max(4000).nullable().optional(),
});

export const listIncidents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ person_id: z.string().uuid().nullable().optional() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("people_incidents")
      .select("*")
      .order("occurred_at", { ascending: false });
    if (data.person_id) q = q.eq("person_id", data.person_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as unknown as IncidentRow[];
  });

export const upsertIncident = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => incidentUpsertSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const resolved_at =
      data.status === "resolved" || data.status === "archived" ? new Date().toISOString() : null;
    const payload: Record<string, unknown> = {
      person_id: data.person_id ?? null,
      occurred_at: data.occurred_at,
      category: data.category,
      severity: data.severity,
      is_confidential: data.is_confidential,
      title: data.title,
      description: data.description ?? null,
      location: data.location ?? null,
      witnesses: data.witnesses ?? null,
      status: data.status,
      resolution: data.resolution ?? null,
      resolved_at,
    };
    if (data.id) {
      const { error } = await supabase
        .from("people_incidents")
        .update(payload as never)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const ownerId = await resolveOwnerId(supabase, userId);
    const { data: row, error } = await supabase
      .from("people_incidents")
      .insert({ ...payload, owner_id: ownerId, created_by: userId } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (row as { id: string }).id };
  });

export const deleteIncident = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("people_incidents")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
