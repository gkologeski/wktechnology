import { z } from "zod";

export type EconModality = "delivery" | "hourly" | "monthly" | "mixed";
export type EconComponentType = "delivery" | "hourly" | "monthly";
export type EconProration = "full_month" | "calendar_days";

export const econModalityLabel: Record<EconModality, string> = {
  delivery: "Por entrega (preço fechado)",
  hourly: "Por hora aprovada",
  monthly: "Mensal",
  mixed: "Misto",
};
export const econComponentLabel: Record<EconComponentType, string> = {
  delivery: "Entrega aceita",
  hourly: "Horas aprovadas",
  monthly: "Mensalidade",
};
export const econProrationLabel: Record<EconProration, string> = {
  full_month: "Mês integral",
  calendar_days: "Pró-rata por dias corridos do calendário",
};
export const econStatusLabel = {
  draft: "Rascunho",
  in_review: "Em revisão do Financeiro",
  approved: "Aprovado",
  rejected: "Rejeitado",
} as const;
export const econEventLabel = {
  submitted: "Enviado ao Financeiro",
  approved: "Aprovado",
  rejected: "Rejeitado",
} as const;
export const econIssueLabel: Record<string, string> = {
  ambiguous_employment:
    "Há outro contrato simultâneo para esta pessoa; revise o custo mensal antes de gerar obrigação",
  not_accepted: "Entrega ainda sem aceite da versão precificada",
  pending_time_sources: "Horas com aprovação, fechamento ou origem pendentes de conferência",
  delivery_version_changed: "Entrega mudou de versão; revise o plano",
};

export const econComponent = z
  .object({
    type: z.enum(["delivery", "hourly", "monthly"]),
    amount: z.number().positive().max(99_999_999),
    source_clause: z.string().trim().min(5).max(500),
    due_days: z.number().int().min(0).max(120),
    delivery_id: z.string().uuid().optional(),
    delivery_version: z.number().int().positive().optional(),
    project_id: z.string().uuid().optional(),
    proration: z.enum(["full_month", "calendar_days"]).optional(),
  })
  .strict();
export type EconComponent = z.infer<typeof econComponent>;

/** Client-side mirror of the server rules (the RPC remains authoritative). */
export function econComponentsProblem(
  modality: EconModality,
  list: EconComponent[],
): string | null {
  if (list.length === 0) return "Adicione ao menos um componente.";
  const types = new Set(list.map((c) => c.type));
  if (modality !== "mixed" && [...types].some((t) => t !== modality))
    return "Componentes não correspondem à modalidade escolhida.";
  if (modality === "mixed" && types.size < 2) return "Misto exige componentes de tipos distintos.";
  const sources = list.map((c) => c.source_clause.trim().toLowerCase());
  if (new Set(sources).size !== sources.length)
    return "Componentes não podem compartilhar a mesma fonte.";
  if (list.filter((c) => c.type === "monthly").length > 1) return "Apenas um componente mensal.";
  if (list.some((c) => c.type === "monthly" && !c.proration))
    return "Mensal exige regra explícita de pró-rata.";
  const deliveries = list.filter((c) => c.type === "delivery").map((c) => c.delivery_id);
  if (deliveries.some((d) => !d) || new Set(deliveries).size !== deliveries.length)
    return "Cada entrega precificada deve ser única e explícita.";
  const hours = list.filter((c) => c.type === "hourly");
  if (hours.length > 1 && hours.some((h) => !h.project_id))
    return "Componentes por hora precisam de projetos explícitos.";
  if (new Set(hours.map((h) => h.project_id ?? "*")).size !== hours.length)
    return "Componentes por hora precisam de projetos distintos.";
  if (modality === "mixed" && types.has("monthly") && hours.some((h) => !h.project_id))
    return "Misto com mensal exige horas restritas a projeto explícito.";
  return null;
}

/** Last closed months plus the current one (preview only), as YYYY-MM-01. */
export function econMonths(now = new Date(), count = 12): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++)
    out.push(
      new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)).toISOString().slice(0, 10),
    );
  return out;
}
export const econMonthLabel = (m: string) =>
  new Date(`${m}T12:00:00Z`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

export type EconVersion = {
  version: number;
  modality: EconModality;
  currency: string;
  effective_from: string;
  effective_to: string | null;
  components: Array<EconComponent & { delivery_hash?: string }>;
  source_reference: string;
  content_hash: string;
  change_reason: string | null;
  at: string;
  by: string | null;
  by_me: boolean;
};
export type EconContext = {
  started: boolean;
  proof_problem: string | null;
  kind: "professional" | "supplier";
  regime: string | null;
  release_condition: string | null;
  period: { starts_at: string; ends_at: string | null } | null;
  can_view: boolean;
  can_manage: boolean;
  can_decide: boolean;
  can_preview: boolean;
  can_close: boolean;
  finance_configured: boolean;
  finance_name: string | null;
  plan: { id: string; version: number; status: keyof typeof econStatusLabel } | null;
  versions: EconVersion[];
  events: Array<{
    version: number;
    kind: keyof typeof econEventLabel;
    reason: string;
    at: string;
    by: string | null;
  }>;
  provisions: Array<{
    id: string;
    period_from: string;
    revision: number;
    supersedes_id: string | null;
    currency: string;
    known: string | null;
    reason: string;
    closed_at: string;
    closed_by: string | null;
  }>;
  deliveries: Array<{ id: string; version: number; status: string; title: string | null }>;
  projects: Array<{ id: string; name: string }>;
};
export type EconLine = {
  type: EconComponentType;
  amount: number | null;
  issue?: string;
  source_clause: string;
  seconds?: number;
  days?: number;
  month_days?: number;
  due_on?: string;
  excluded?: { count: number; seconds: number; pending_count?: number };
};
export type EconPreview = {
  hash: string;
  currency: string;
  from: string;
  to: string;
  lines: EconLine[];
  totals: { known: number; unknown_lines: number };
  notice: string;
};
export const money = (v: number | string | null | undefined, currency: string) =>
  v === null || v === undefined
    ? "—"
    : Number(v).toLocaleString("pt-BR", { style: "currency", currency });
