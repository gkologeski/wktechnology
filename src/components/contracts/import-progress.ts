// Estado compartilhado de progresso da extração de contratos importados.
// Usado pelo wizard de importação e pelo visualizador local do arquivo.

export type ExtractionPhase =
  | "idle"
  | "preparing"
  | "text"
  | "ai"
  | "storing"
  | "draft"
  | "done"
  | "error";

export type ExtractionProgress = {
  phase: ExtractionPhase;
  /** 0–100, estimado por fase. */
  percent: number;
  /** Mensagem principal exibida ao usuário. */
  message: string;
  /** Detalhe secundário opcional (ex.: erro técnico resumido). */
  detail?: string | null;
};

export const IDLE_PROGRESS: ExtractionProgress = {
  phase: "idle",
  percent: 0,
  message: "Aguardando extração",
};

const PHASE_STEPS: Record<ExtractionPhase, { percent: number; message: string }> = {
  idle: { percent: 0, message: "Aguardando extração" },
  preparing: { percent: 5, message: "Preparando arquivo…" },
  text: { percent: 25, message: "Extraindo texto do documento…" },
  ai: { percent: 55, message: "Analisando com IA…" },
  storing: { percent: 80, message: "Guardando arquivo original…" },
  draft: { percent: 95, message: "Criando rascunho do contrato…" },
  done: { percent: 100, message: "Extração concluída." },
  error: { percent: 100, message: "Falha na extração." },
};

export function progressFor(phase: ExtractionPhase, detail?: string | null): ExtractionProgress {
  const step = PHASE_STEPS[phase];
  return { phase, percent: step.percent, message: step.message, detail: detail ?? null };
}

export function isExtracting(p: ExtractionProgress): boolean {
  return p.phase !== "idle" && p.phase !== "done" && p.phase !== "error";
}
