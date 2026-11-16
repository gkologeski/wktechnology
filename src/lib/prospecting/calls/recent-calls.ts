// "Chamadas recentes" da campanha: só tentativas já discadas (status ≠ queued),
// ordenadas pela hora de início (fallback: criação), no máximo `limit`.
export type RecentCallInput = { status: string; started_at?: string | null; created_at: string };

export function selectRecentCalls<T extends RecentCallInput>(rows: T[], limit = 50): T[] {
  const ts = (r: T) => Date.parse(r.started_at ?? r.created_at) || 0;
  return rows
    .filter((r) => r.status !== "queued")
    .sort((a, b) => ts(b) - ts(a))
    .slice(0, limit);
}

// Situação visual de uma chamada. `ended_reason` existe também em chamadas
// concluídas com sucesso, então não indica falha sozinho.
export type CallTone = "signed" | "failed" | "partial" | "sending" | "neutral";

const NO_ANSWER = /did-not-answer|voicemail|no-answer|busy/i;
const FAILURE = /failed|error|rejected|invalid/i;

export function callStatusView(
  status: string,
  endedReason?: string | null,
): { tone: CallTone; label: string } {
  const r = endedReason ?? "";
  if (status === "failed" || FAILURE.test(r)) return { tone: "failed", label: "Falhou" };
  if (NO_ANSWER.test(r)) return { tone: "partial", label: "Não atendeu" };
  if (status === "completed") return { tone: "signed", label: "Concluída" };
  if (status === "ringing" || status === "in_progress" || status === "dialing")
    return { tone: "sending", label: "Em andamento" };
  return { tone: "neutral", label: status };
}

const REASONS: Record<string, string> = {
  "customer-ended-call": "Cliente desligou",
  "assistant-ended-call": "Assistente encerrou",
  "silence-timed-out": "Encerrada por silêncio",
  "customer-did-not-answer": "Cliente não atendeu",
  "twilio-failed-to-connect-call": "Falha ao conectar",
  voicemail: "Caixa postal",
  "customer-busy": "Ocupado",
  "exceeded-max-duration": "Tempo máximo atingido",
};

export function callEndedReasonLabel(reason?: string | null): string | null {
  if (!reason) return null;
  if (/^stale active call/i.test(reason)) return "Sem retorno final do provedor";
  return REASONS[reason] ?? reason;
}
