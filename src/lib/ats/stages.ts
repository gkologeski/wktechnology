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
