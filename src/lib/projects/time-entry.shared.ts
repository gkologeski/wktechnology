// Helpers puros de apontamento de horas do TechProjects.
// Client-safe: sem acesso a banco, usado por telas e por testes.

export const TIME_ENTRY_STATUS = ["draft", "submitted", "approved", "rejected", "locked"] as const;
export type TimeEntryStatus = (typeof TIME_ENTRY_STATUS)[number];

export const TIME_ENTRY_STATUS_LABEL: Record<TimeEntryStatus, string> = {
  draft: "Rascunho",
  submitted: "Enviado",
  approved: "Aprovado",
  rejected: "Devolvido",
  locked: "Travado",
};

export const TIME_ENTRY_SOURCE_LABEL: Record<string, string> = {
  manual: "Manual",
  timer: "Cronômetro",
  api: "API",
  integration: "Integração",
  import: "Importação",
};

export const TIME_ENTRY_KIND_LABEL: Record<string, string> = {
  interval: "Início e fim",
  duration: "Só duração",
  timer: "Cronômetro",
};

/** Alertas gravados pelo banco no apontamento (revisão humana, nunca correção automática). */
export const REVIEW_FLAG_LABEL: Record<string, string> = {
  unpositioned: "Sem horário: sobreposição não verificável",
  daily_excess: "Acima do limite diário da política",
  overlap: "Sobrepõe outro apontamento",
  dst_ambiguous: "Troca de horário de verão: horário local omitido (UTC preservado)",
};

/** Importado bloqueado é histórico: nunca é tratado como aprovado nem faturado. */
export function isImportedLocked(e: { status?: string | null; source?: string | null }): boolean {
  return e.status === "locked" && e.source === "import";
}

/** Só rascunho e devolvido aceitam edição direta; o resto passa pelo fluxo. */
export function isEditableEntry(e: {
  status?: string | null;
  period_closing_id?: string | null;
}): boolean {
  if (e.period_closing_id) return false;
  return e.status === "draft" || e.status === "rejected" || e.status === "submitted";
}

/** "09:00" ou "09:00:00" → minutos desde a meia-noite. Retorna null se inválido. */
export function parseClock(value: string | null | undefined): number | null {
  if (!value) return null;
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** minutos desde a meia-noite → "09:00". */
export function formatClock(minutes: number): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** Duração entre dois horários do dia, em minutos. null quando inválida. */
export function durationMinutes(
  start: string | null | undefined,
  end: string | null | undefined,
): number | null {
  const s = parseClock(start);
  const e = parseClock(end);
  if (s === null || e === null) return null;
  if (e <= s) return null;
  return e - s;
}

/** 210 → "3h30". */
export function formatMinutes(minutes: number | null | undefined): string {
  const total = Math.max(0, Math.round(minutes ?? 0));
  return `${Math.floor(total / 60)}h${String(total % 60).padStart(2, "0")}`;
}

/** Segundos exatos → "3:30:15" (sem arredondar a base; só formata). */
export function formatSeconds(seconds: number | null | undefined): string {
  const total = Math.max(0, Math.floor(seconds ?? 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** "1h30", "1:30", "90m", "1.5" ou "1,5" (horas) → segundos. null se inválido. */
export function parseDurationInput(value: string): number | null {
  const v = value.trim().toLowerCase().replace(",", ".");
  if (!v) return null;
  let m = /^(\d{1,2})\s*h\s*(\d{1,2})?\s*(?:m(?:in)?)?$/.exec(v);
  if (m) return Number(m[1]) * 3600 + Number(m[2] ?? 0) * 60;
  m = /^(\d{1,2}):(\d{2})$/.exec(v);
  if (m) return Number(m[2]) < 60 ? Number(m[1]) * 3600 + Number(m[2]) * 60 : null;
  m = /^(\d{1,4})\s*m(?:in)?$/.exec(v);
  if (m) return Number(m[1]) * 60;
  m = /^(\d{1,2}(?:\.\d{1,2})?)$/.exec(v);
  if (m) return Math.round(Number(m[1]) * 3600);
  return null;
}

/** Horas decimais → minutos inteiros. */
export function hoursToMinutes(hours: number | null | undefined): number {
  return Math.max(0, Math.round((hours ?? 0) * 60));
}

/** Jornada do People em segundos por dia da semana. Nula = não configurada. */
export type WorkSchedule = Partial<
  Record<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun", number>
> & {
  tz?: string;
};

const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

export type AllocationSlice = {
  allocation_pct: number | null;
  starts_at: string | null;
  ends_at: string | null;
};

/**
 * Meta do dia em minutos, derivada da jornada configurada no People e das alocações vigentes.
 * Sem jornada configurada devolve null ("capacidade não configurada"): nenhuma jornada é presumida.
 * Feriados e ausências não existem como cadastro no People hoje; não são descontados.
 */
export function expectedMinutesForDate(
  isoDate: string,
  allocations: AllocationSlice[],
  schedule: WorkSchedule | null,
): number | null {
  if (!schedule) return null;
  const key = WEEKDAY_KEYS[new Date(`${isoDate}T12:00:00`).getDay()]!;
  const baseMinutes = Math.round((schedule[key] ?? 0) / 60);
  if (baseMinutes === 0) return 0;
  const active = allocations.filter(
    (a) => (!a.starts_at || a.starts_at <= isoDate) && (!a.ends_at || a.ends_at >= isoDate),
  );
  if (active.length === 0) return baseMinutes;
  const pct = active.reduce((acc, a) => acc + (a.allocation_pct ?? 100), 0);
  const capped = Math.min(100, Math.max(0, pct));
  return Math.round((baseMinutes * capped) / 100);
}

/** Meta acumulada de um intervalo de datas (inclusive); null se a jornada não está configurada. */
export function expectedMinutesForRange(
  from: string,
  to: string,
  allocations: AllocationSlice[],
  schedule: WorkSchedule | null,
): number | null {
  if (!schedule) return null;
  let total = 0;
  for (const d of eachIsoDate(from, to))
    total += expectedMinutesForDate(d, allocations, schedule) ?? 0;
  return total;
}

/** Lista de datas YYYY-MM-DD entre `from` e `to`, inclusive. */
export function eachIsoDate(from: string, to: string): string[] {
  const out: string[] = [];
  const cur = new Date(`${from}T12:00:00Z`);
  const end = new Date(`${to}T12:00:00Z`);
  while (cur <= end) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

/** Detecta sobreposição com apontamentos já existentes no mesmo dia. */
export function findOverlap(
  entries: { id?: string; start_time: string | null; end_time: string | null }[],
  candidate: { id?: string; start_time: string; end_time: string },
): { start_time: string; end_time: string } | null {
  const cs = parseClock(candidate.start_time);
  const ce = parseClock(candidate.end_time);
  if (cs === null || ce === null) return null;
  for (const e of entries) {
    if (candidate.id && e.id === candidate.id) continue;
    const s = parseClock(e.start_time);
    const en = parseClock(e.end_time);
    if (s === null || en === null) continue;
    if (s < ce && en > cs) return { start_time: formatClock(s), end_time: formatClock(en) };
  }
  return null;
}

/** Mensagem do banco sem o código técnico do prefixo (ex.: "SUBMIT_STALE: ..."). */
export function cleanDbError(message: string | null | undefined): string {
  const m = (message ?? "").trim();
  return m.replace(/^[A-Z_]{4,}:\s*/, "") || "Não foi possível concluir a operação.";
}

/** Fuso IANA do navegador (ou São Paulo quando indisponível). */
export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo";
  } catch {
    return "America/Sao_Paulo";
  }
}

/** Plano de cópia da semana: só itens válidos, sem aprovação e sem repetir o que já existe. */
export type CopyCandidate = {
  id: string;
  entry_date: string;
  project_id: string;
  task_id: string | null;
  start_time: string | null;
  end_time: string | null;
  duration_seconds: number | null;
  entry_kind: string | null;
  source: string | null;
  status: string | null;
};

export function planWeekCopy(
  source: CopyCandidate[],
  target: Pick<
    CopyCandidate,
    "entry_date" | "project_id" | "task_id" | "start_time" | "end_time"
  >[],
  dayOffset: number,
): {
  copy: (CopyCandidate & { target_date: string })[];
  skipped: { id: string; reason: string }[];
} {
  const shift = (iso: string) => {
    const d = new Date(`${iso}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + dayOffset);
    return d.toISOString().slice(0, 10);
  };
  const copy: (CopyCandidate & { target_date: string })[] = [];
  const skipped: { id: string; reason: string }[] = [];
  for (const e of source) {
    if (e.source === "import") {
      skipped.push({ id: e.id, reason: "Importado: histórico não é copiado" });
      continue;
    }
    if (e.entry_kind === "timer" && (!e.start_time || !e.end_time)) {
      skipped.push({ id: e.id, reason: "Cronômetro sem horário local" });
      continue;
    }
    const td = shift(e.entry_date);
    const dup = target.some(
      (t) =>
        t.entry_date === td &&
        t.project_id === e.project_id &&
        t.task_id === e.task_id &&
        (t.start_time ?? null) === (e.start_time ?? null) &&
        (t.end_time ?? null) === (e.end_time ?? null),
    );
    if (dup) {
      skipped.push({ id: e.id, reason: "Já existe na semana de destino" });
      continue;
    }
    if (e.start_time && e.end_time) {
      const clash = target.some(
        (t) =>
          t.entry_date === td &&
          t.start_time &&
          t.end_time &&
          (parseClock(t.start_time) ?? 0) < (parseClock(e.end_time) ?? 0) &&
          (parseClock(t.end_time) ?? 0) > (parseClock(e.start_time) ?? 0),
      );
      if (clash) {
        skipped.push({ id: e.id, reason: "Sobreporia um apontamento existente" });
        continue;
      }
    }
    copy.push({ ...e, target_date: td });
  }
  return { copy, skipped };
}
