// Texto do cartão "Ligação" na conversa da Inbox (puro).
export const CALL_TRANSCRIPT_MARKER = "\n\n— Transcrição —\n";
export const CALL_PREFIX = "📞 Ligação";

const STATUS_PT: Record<string, string> = {
  completed: "Concluída",
  no_answer: "Não atendeu",
  busy: "Ocupado",
  failed: "Falhou",
  canceled: "Cancelada",
};

export function formatDuration(sec: number | null | undefined): string {
  const s = Math.max(0, Math.round(sec ?? 0));
  const m = Math.floor(s / 60);
  return m ? `${m} min ${s % 60} s` : `${s} s`;
}

export function buildCallInboxBody(a: {
  status: string;
  duration_seconds: number | null;
  script_name: string | null;
  summary: string | null;
  transcript: string | null;
  meeting_when: string | null;
}): string {
  const head = [
    `${CALL_PREFIX} · ${STATUS_PT[a.status] ?? a.status} · ${formatDuration(a.duration_seconds)}`,
    a.script_name ? `Roteiro: ${a.script_name}` : null,
    a.meeting_when ? `Reunião marcada: ${a.meeting_when}` : null,
    `Resumo: ${a.summary?.trim() || "sem resumo"}`,
  ]
    .filter(Boolean)
    .join("\n");
  const t = a.transcript?.trim();
  return t ? head + CALL_TRANSCRIPT_MARKER + t : head;
}

export function splitCallInboxBody(body: string): { head: string; transcript: string | null } {
  const i = body.indexOf(CALL_TRANSCRIPT_MARKER);
  return i < 0
    ? { head: body, transcript: null }
    : { head: body.slice(0, i), transcript: body.slice(i + CALL_TRANSCRIPT_MARKER.length) };
}
