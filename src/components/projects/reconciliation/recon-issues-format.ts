// Rótulos e textos da fila de pendências (apresentação pura).
import {
  DIAGNOSIS_LABEL,
  ISSUE_STATUS_LABEL,
  formatSeconds,
  type IssueAction,
  type IssueStatus,
} from "@/lib/projects/reconciliation-labels";

export const PAGE = 50;
export type StatusFilter = IssueStatus | "pending" | "all";
export const STATUS_FILTER_LABEL: Record<StatusFilter, string> = {
  pending: "Abertos e adiados",
  all: "Todos",
  ...ISSUE_STATUS_LABEL,
};
export const tone = (s: string) =>
  s === "open" ? "onhold" : s === "deferred" ? "draft" : s === "confirmed" ? "open" : "closed";
export const ACTION_LABEL: Record<IssueAction, string> = {
  confirm: "Confirmar procedente",
  dismiss: "Descartar",
  defer: "Adiar",
  reopen: "Reabrir",
};

export function detailText(type: string, d: Record<string, unknown>): string {
  if (type === "date_before_2020") return DIAGNOSIS_LABEL[String(d.diagnosis)] ?? "";
  if (type === "hour_entry_unmatched")
    return `Horas sem horário ${formatSeconds(Number(d.hour_entries_day_seconds))} × intervalos ${formatSeconds(Number(d.intervals_day_seconds))} no dia. Ainda não vira apontamento: a regra para horas sem horário não foi definida.`;
  if (type === "possible_duplicate")
    return `Mesmo horário em ${Number(d.group_size)} registros (${(d.providers as string[] | undefined)?.join(", ") ?? ""}).`;
  if (type === "overlap")
    return `Sobreposição de ${formatSeconds(Number(d.overlap_seconds))}${d.forced_reason ? " · gravado por exceção autorizada" : ""}.`;
  if (type === "non_positive_duration")
    return `Duração ${formatSeconds(Number(d.seconds))}${d.forced_reason ? " · gravado por exceção autorizada" : ""}.`;
  return String(d.reason_detail ?? d.event_type ?? "");
}

/** Baixa um CSV no navegador (BOM para o Excel abrir acentos). */
export function downloadCsv(csv: string, filename: string) {
  const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
