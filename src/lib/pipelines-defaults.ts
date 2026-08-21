// Etapas padrão de pipelines, compartilhadas entre cliente e servidor.
// Módulo client-safe (sem hooks, sem cliente Supabase) para poder ser
// importado tanto por src/lib/pipelines.ts quanto pelas server functions.
import { DEAL_STAGES } from "@/lib/crm";

export type PipelineStageSeed = {
  value: string;
  label: string;
  color?: string;
  probability?: number;
  type?: "open" | "open" | "won" | "lost";
};

const DEFAULT_STAGE_COLORS = [
  "var(--hs-stage-1)",
  "var(--hs-stage-2)",
  "var(--hs-stage-3)",
  "var(--hs-stage-4)",
  "var(--hs-stage-won)",
  "var(--hs-stage-lost)",
];
const DEFAULT_PROBABILITIES = [10, 30, 50, 70, 100, 0];
const DEFAULT_TYPES: Array<"open" | "won" | "lost"> = [
  "open",
  "open",
  "open",
  "open",
  "won",
  "lost",
];

export function defaultDealStages(): PipelineStageSeed[] {
  return DEAL_STAGES.map((s, i) => ({
    value: s.value,
    label: s.label,
    color: DEFAULT_STAGE_COLORS[i],
    probability: DEFAULT_PROBABILITIES[i],
    type: DEFAULT_TYPES[i],
  }));
}

export function defaultTicketStages(): PipelineStageSeed[] {
  return [
    { value: "new", label: "Novo", color: "var(--hs-stage-1)", type: "open" },
    { value: "open", label: "Em atendimento", color: "var(--hs-stage-2)", type: "open" },
    { value: "waiting", label: "Aguardando cliente", color: "var(--hs-stage-3)", type: "open" },
    { value: "resolved", label: "Resolvido", color: "var(--hs-stage-4)", type: "open" },
    { value: "closed", label: "Fechado", color: "var(--hs-stage-won)", type: "won" },
  ];
}

export function defaultLeadStages(): PipelineStageSeed[] {
  return [
    { value: "new", label: "Novo", color: "var(--hs-stage-1)", type: "open" },
    { value: "contacted", label: "Contatado", color: "var(--hs-stage-2)", type: "open" },
    { value: "qualified", label: "Qualificado", color: "var(--hs-stage-won)", type: "won" },
    {
      value: "disqualified",
      label: "Desqualificado",
      color: "var(--hs-stage-lost)",
      type: "lost",
    },
  ];
}

export const DEFAULT_PIPELINE_NAMES = {
  deal: "Pipeline padrão",
  lead: "Funil de Leads",
  ticket: "Pipeline de Tickets",
} as const;

export function defaultStagesFor(entity: "deal" | "lead" | "ticket"): PipelineStageSeed[] {
  if (entity === "ticket") return defaultTicketStages();
  if (entity === "lead") return defaultLeadStages();
  return defaultDealStages();
}
