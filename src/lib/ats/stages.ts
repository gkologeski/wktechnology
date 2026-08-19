// Estágios padrão do pipeline ATS. Workspace pode customizar.
export type AtsStage = {
  value: string;
  label: string;
  color?: string;
  type?: "open" | "won" | "lost";
};

export const DEFAULT_ATS_STAGES: AtsStage[] = [
  { value: "applied", label: "Aplicado", color: "var(--hs-stage-1)", type: "open" },
  { value: "screening", label: "Triagem", color: "var(--hs-stage-2)", type: "open" },
  { value: "interview_hr", label: "Entrevista RH", color: "var(--hs-stage-3)", type: "open" },
  { value: "interview_tech", label: "Entrevista técnica", color: "var(--hs-stage-3)", type: "open" },
  { value: "test", label: "Teste", color: "var(--hs-stage-4)", type: "open" },
  { value: "offer", label: "Proposta", color: "var(--hs-stage-4)", type: "open" },
  { value: "hired", label: "Contratado", color: "var(--hs-stage-won)", type: "won" },
  { value: "rejected", label: "Rejeitado", color: "var(--hs-stage-lost)", type: "lost" },
];

export const ATS_JOB_STATUSES = [
  { value: "draft", label: "Rascunho" },
  { value: "published", label: "Publicada" },
  { value: "on_hold", label: "Em pausa" },
  { value: "filled", label: "Preenchida" },
  { value: "closed", label: "Encerrada" },
] as const;

export type AtsJobStatus = (typeof ATS_JOB_STATUSES)[number]["value"];

/** Slugs historicamente usados como etapa de contratação. */
const WON_STAGE_FALLBACKS = new Set(["profissional_contratado", "hired", "contratado"]);
/** Slugs historicamente usados como etapa de perda/rejeição. */
const LOST_STAGE_FALLBACKS = new Set(["vaga_cancelada", "rejected", "rejeitado", "declined"]);

/** Normaliza o campo `stages` de um pipeline (jsonb) em uma lista utilizável. */
export function parseAtsStages(raw: unknown): AtsStage[] {
  if (!Array.isArray(raw)) return [];
  const out: AtsStage[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const s = item as Partial<AtsStage>;
    if (typeof s.value !== "string" || s.value.length === 0) continue;
    out.push({
      value: s.value,
      label: typeof s.label === "string" && s.label ? s.label : s.value,
      color: typeof s.color === "string" ? s.color : undefined,
      type: s.type === "won" || s.type === "lost" ? s.type : "open",
    });
  }
  return out;
}

/** Primeira etapa do pipeline (onde novas candidaturas entram). */
export function firstAtsStageValue(rawStages: unknown): string {
  const stages = parseAtsStages(rawStages);
  const open = stages.find((s) => s.type === "open") ?? stages[0];
  return open?.value ?? DEFAULT_ATS_STAGES[0].value;
}

/**
 * Classifica uma etapa como aberta, ganha (contratado) ou perdida (rejeitado).
 * Usa o `type` declarado no pipeline e, na ausência dele, os slugs conhecidos.
 */
export function atsStageOutcome(rawStages: unknown, value: string): "open" | "won" | "lost" {
  const stage = parseAtsStages(rawStages).find((s) => s.value === value);
  if (stage && (stage.type === "won" || stage.type === "lost")) return stage.type;
  if (WON_STAGE_FALLBACKS.has(value)) return "won";
  if (LOST_STAGE_FALLBACKS.has(value)) return "lost";
  return "open";
}

/** Etapa de contratação do pipeline (para marcar candidatura como contratada). */
export function wonAtsStageValue(rawStages: unknown): string | null {
  const stages = parseAtsStages(rawStages);
  const won = stages.find((s) => s.type === "won") ?? stages.find((s) => WON_STAGE_FALLBACKS.has(s.value));
  return won?.value ?? null;
}
