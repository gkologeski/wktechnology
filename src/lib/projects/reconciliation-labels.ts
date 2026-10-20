// Rótulos e regras puras da central de conciliação e do painel do TechProjects.
// Sem acesso a dados: pode ser importado por telas, servidor e testes.

export const RECON_PROVIDERS = ["all", "clockify", "jibble", "erp"] as const;
export type ReconProvider = (typeof RECON_PROVIDERS)[number];
export const PROVIDER_LABEL: Record<ReconProvider, string> = {
  all: "Todas as fontes",
  clockify: "Clockify",
  jibble: "Jibble",
  erp: "Lançado no ERP",
};

export const ISSUE_TYPES = [
  "date_before_2020",
  "non_positive_duration",
  "overlap",
  "possible_duplicate",
  "unknown_event",
  "long_interval",
  "open_interval",
  "no_project",
  "cross_source_duplicate",
  "hour_entry_unmatched",
  "staging_review",
] as const;
export type IssueType = (typeof ISSUE_TYPES)[number];
export const ISSUE_TYPE_LABEL: Record<IssueType, string> = {
  date_before_2020: "Data anterior a 2020",
  non_positive_duration: "Duração zero ou negativa",
  overlap: "Horário sobreposto",
  possible_duplicate: "Possível duplicidade",
  unknown_event: "Evento de ponto desconhecido",
  long_interval: "Intervalo muito longo",
  open_interval: "Entrada sem saída",
  no_project: "Sem projeto",
  cross_source_duplicate: "Coincide com outra fonte",
  hour_entry_unmatched: "Horas sem horário (Jibble) não cobertas",
  staging_review: "Registro em revisão na origem",
};

export const ISSUE_STATUSES = ["open", "deferred", "confirmed", "dismissed"] as const;
export type IssueStatus = (typeof ISSUE_STATUSES)[number];
export const ISSUE_STATUS_LABEL: Record<IssueStatus, string> = {
  open: "Aberto",
  deferred: "Adiado",
  confirmed: "Procedente",
  dismissed: "Descartado",
};
export const ISSUE_ACTIONS = ["confirm", "dismiss", "defer", "reopen"] as const;
export type IssueAction = (typeof ISSUE_ACTIONS)[number];
/** Confirmar e descartar exigem justificativa registrada. */
export const actionNeedsNote = (a: IssueAction) => a === "confirm" || a === "dismiss";

export const DIAGNOSIS_LABEL: Record<string, string> = {
  origin_payload: "A data já vem assim no registro bruto da origem; o importador não a alterou.",
  transformation_mismatch: "O registro bruto tem outra data: verificar a transformação.",
  no_raw: "Sem registro bruto disponível para comparar.",
};

/** Situação das horas no painel. Importado bloqueado nunca é tratado como aprovado/faturado. */
export const DASHBOARD_HOURS_STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  submitted: "Enviado",
  approved: "Aprovado",
  rejected: "Rejeitado",
  locked: "Travado",
  locked_import: "Importado bloqueado",
};
export const isApprovedHoursStatus = (status: string) => status === "approved";

export const PROJECT_STATUS_LABEL: Record<string, string> = {
  planning: "Planejamento",
  active: "Ativo",
  on_hold: "Em espera",
  done: "Concluído",
  cancelled: "Cancelado",
};

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 3700;

/** Valida um período ISO (inclusive). Retorna a mensagem de erro ou null. */
export function validateIsoRange(from: string, to: string): string | null {
  if (!ISO_DAY.test(from) || !ISO_DAY.test(to)) return "Datas inválidas.";
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return "Datas inválidas.";
  if (a > b) return "A data inicial deve ser anterior ou igual à final.";
  if ((b - a) / 86_400_000 > MAX_RANGE_DAYS) return "Período máximo de 10 anos.";
  return null;
}

/** Fuso IANA do formato aceito pelo servidor. */
export function isIanaTimeZone(tz: string): boolean {
  if (!/^[A-Za-z_]+(\/[A-Za-z0-9_+-]+){0,2}$/.test(tz)) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Mês corrente (1º ao último dia) no fuso informado. */
export function monthRangeInTimeZone(now: Date, tz: string): { from: string; to: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, "0");
  return { from: `${y}-${mm}-01`, to: `${y}-${mm}-${String(last).padStart(2, "0")}` };
}

/** Segundos exatos em h:mm:ss (sem arredondar para minutos). */
export function formatSeconds(total: number | null | undefined): string {
  if (total === null || total === undefined || !Number.isFinite(total)) return "—";
  const sign = total < 0 ? "-" : "";
  const abs = Math.round(Math.abs(total));
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const s = abs % 60;
  return `${sign}${h.toLocaleString("pt-BR")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function formatHours(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return "—";
  return `${(seconds / 3600).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h`;
}

/** CSV com separador ";" (Excel PT-BR) e escape de aspas/quebras. */
export function toCsv(
  header: string[],
  rows: Array<Array<string | number | null | undefined>>,
): string {
  const cell = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [header, ...rows].map((r) => r.map(cell).join(";")).join("\r\n");
}
