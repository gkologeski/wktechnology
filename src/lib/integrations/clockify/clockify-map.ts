// Planejamento puro da importação Clockify → TechProjects (sem banco, sem rede).
// Decide mapeamentos, segmentos, pendências e totais; o motor só executa o plano.
import {
  erpMinutesForSegment,
  isValidTimeZone,
  monthOf,
  parseIsoDuration,
  segmentByLocalDay,
  toEpochSeconds,
  type DaySegment,
} from "./clockify-time";

// ---------------------------------------------------------------- tipos de origem
export type CkRate = { amount?: number | null; currency?: string | null } | null | undefined;

export type CkUser = {
  id: string;
  email?: string | null;
  name?: string | null;
  status?: string | null;
  settings?: { timeZone?: string | null } | null;
};

export type CkProject = {
  id: string;
  name: string;
  clientId?: string | null;
  clientName?: string | null;
  archived?: boolean;
  billable?: boolean;
  note?: string | null;
  color?: string | null;
  public?: boolean;
  template?: boolean;
  hourlyRate?: CkRate;
  costRate?: CkRate;
  estimate?: { estimate?: string | null; type?: string | null } | null;
  timeEstimate?: { estimate?: string | null; type?: string | null; active?: boolean } | null;
  budgetEstimate?: { estimate?: number | null; type?: string | null; active?: boolean } | null;
  memberships?: Array<{
    userId: string;
    hourlyRate?: CkRate;
    costRate?: CkRate;
    membershipType?: string;
    membershipStatus?: string;
  }> | null;
  duration?: string | null;
};

export type CkTask = {
  id: string;
  name: string;
  projectId: string;
  status?: string | null;
  estimate?: string | null;
  assigneeIds?: string[] | null;
  billable?: boolean;
  hourlyRate?: CkRate;
  costRate?: CkRate;
};

export type CkTimeEntry = {
  id: string;
  userId: string;
  projectId?: string | null;
  taskId?: string | null;
  description?: string | null;
  billable?: boolean;
  isLocked?: boolean;
  type?: string | null;
  tagIds?: string[] | null;
  approvalRequestId?: string | null;
  hourlyRate?: CkRate;
  costRate?: CkRate;
  customFieldValues?: unknown;
  timeInterval?: { start?: string | null; end?: string | null; duration?: string | null } | null;
};

// ---------------------------------------------------------------- utilidades
export function normalizeEmail(email: string | null | undefined): string | null {
  const v = (email ?? "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : null;
}

export function normalizeName(name: string | null | undefined): string {
  return (name ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** JSON com chaves ordenadas: o mesmo dado gera o mesmo hash. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(",")}}`;
}

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Clockify envia valores em centavos (amount 2000 = 20,00). */
export function rateToUnits(rate: CkRate): { amount: number; currency: string } | null {
  if (!rate || typeof rate.amount !== "number" || !rate.currency) return null;
  return { amount: rate.amount / 100, currency: rate.currency.toUpperCase() };
}

// ---------------------------------------------------------------- usuários
export type WorkspaceMember = {
  user_id: string;
  email: string | null;
  status: string;
  name: string | null;
};

export type ExistingMapping = {
  external_id: string;
  target_id: string | null;
  decision: string;
  method: string;
};

export type UserMappingPlan = {
  external_id: string;
  label: string;
  target_id: string | null;
  method: "email" | "manual" | "created" | "none";
  decision: "auto" | "confirmed" | "ignore" | "pending";
  note: string | null;
  candidates: Array<{ user_id: string; name: string | null; status: string }>;
};

/**
 * E-mail normalizado + id do workspace. Decisões manuais (confirmed/ignore) são
 * preservadas. Duplicidades exigem revisão. Nunca cria usuário nem ativa acesso.
 */
export function planUserMappings(
  users: CkUser[],
  members: WorkspaceMember[],
  existing: ExistingMapping[],
): UserMappingPlan[] {
  const byEmail = new Map<string, WorkspaceMember[]>();
  for (const m of members) {
    const e = normalizeEmail(m.email);
    if (!e) continue;
    byEmail.set(e, [...(byEmail.get(e) ?? []), m]);
  }
  const ckByEmail = new Map<string, number>();
  for (const u of users) {
    const e = normalizeEmail(u.email);
    if (e) ckByEmail.set(e, (ckByEmail.get(e) ?? 0) + 1);
  }
  const prev = new Map(existing.map((e) => [e.external_id, e]));
  const plans = users.map<UserMappingPlan>((u) => {
    const label = (u.name?.trim() || u.email || u.id) as string;
    const email = normalizeEmail(u.email);
    const matches = email ? (byEmail.get(email) ?? []) : [];
    const candidates = matches.map((m) => ({ user_id: m.user_id, name: m.name, status: m.status }));
    const p = prev.get(u.id);
    if (p && (p.decision === "confirmed" || p.decision === "ignore")) {
      return {
        external_id: u.id,
        label,
        target_id: p.decision === "ignore" ? null : p.target_id,
        method: (p.method as UserMappingPlan["method"]) ?? "manual",
        decision: p.decision as "confirmed" | "ignore",
        note: null,
        candidates,
      };
    }
    if (!email) {
      return {
        external_id: u.id,
        label,
        target_id: null,
        method: "none",
        decision: "pending",
        note: "sem_email",
        candidates,
      };
    }
    if ((ckByEmail.get(email) ?? 0) > 1) {
      return {
        external_id: u.id,
        label,
        target_id: null,
        method: "none",
        decision: "pending",
        note: "email_duplicado_origem",
        candidates,
      };
    }
    if (matches.length === 1) {
      return {
        external_id: u.id,
        label,
        target_id: matches[0].user_id,
        method: "email",
        decision: "auto",
        note: null,
        candidates,
      };
    }
    return {
      external_id: u.id,
      label,
      target_id: null,
      method: "none",
      decision: "pending",
      note: matches.length > 1 ? "email_duplicado_destino" : "sem_membro",
      candidates,
    };
  });
  // Dois usuários do Clockify no mesmo membro do ERP: os dois voltam para revisão.
  const targetCount = new Map<string, number>();
  for (const p of plans) {
    if (p.target_id && p.decision === "auto")
      targetCount.set(p.target_id, (targetCount.get(p.target_id) ?? 0) + 1);
  }
  return plans.map((p) =>
    p.target_id && p.decision === "auto" && (targetCount.get(p.target_id) ?? 0) > 1
      ? { ...p, target_id: null, decision: "pending", method: "none", note: "membro_duplicado" }
      : p,
  );
}

// ---------------------------------------------------------------- clientes e projetos
export type NamedTarget = { id: string; name: string };

/** Nome igual vira só sugestão; vínculo exige confirmação manual. */
export function nameCandidates(name: string, targets: NamedTarget[]): NamedTarget[] {
  const key = normalizeName(name);
  if (!key) return [];
  return targets.filter((t) => normalizeName(t.name) === key).slice(0, 10);
}

export function projectStatusFor(p: CkProject): "active" | "done" {
  return p.archived ? "done" : "active";
}

export function projectPlannedHours(p: CkProject): number | null {
  const iso =
    p.timeEstimate?.active === false ? null : (p.timeEstimate?.estimate ?? p.estimate?.estimate);
  const secs = parseIsoDuration(iso ?? null);
  return secs && secs > 0 ? Math.round((secs / 3600) * 100) / 100 : null;
}

export function projectMetadata(p: CkProject, clientCompanyId: string | null) {
  return {
    clockify: {
      id: p.id,
      archived: !!p.archived,
      billable: p.billable ?? null,
      client_id: p.clientId ?? null,
      client_name: p.clientName ?? null,
      company_id: clientCompanyId,
      color: p.color ?? null,
      public: p.public ?? null,
      template: p.template ?? null,
      hourly_rate: rateToUnits(p.hourlyRate),
      cost_rate: rateToUnits(p.costRate),
      time_estimate: p.timeEstimate ?? p.estimate ?? null,
      budget_estimate: p.budgetEstimate ?? null,
    },
  };
}

export function taskStatusFor(t: CkTask): "done" | "todo" {
  return (t.status ?? "").toUpperCase() === "DONE" ? "done" : "todo";
}

// ---------------------------------------------------------------- apontamentos
export type EntryReason =
  | "running_timer"
  | "non_regular_type"
  | "no_project"
  | "unmapped_user"
  | "ignored_user"
  | "project_ignored"
  | "project_not_found"
  | "zero_duration"
  | "invalid_interval"
  | "overlap_source"
  | "segment_too_short";

export const ENTRY_REASON_LABEL: Record<string, string> = {
  running_timer: "Cronômetro em andamento (sem fim)",
  non_regular_type: "Pausa, feriado ou folga (não é hora de projeto)",
  no_project: "Sem projeto no Clockify",
  unmapped_user: "Pessoa sem vínculo no ERP",
  ignored_user: "Pessoa marcada para ignorar",
  project_ignored: "Projeto marcado para ignorar",
  project_not_found: "Projeto não encontrado na origem",
  zero_duration: "Duração zero",
  invalid_interval: "Intervalo inválido",
  overlap_source: "Sobreposição com outro apontamento do Clockify",
  overlap_existing: "Sobreposição com apontamento já existente no ERP",
  segment_too_short: "Trecho menor que 30 s (o ERP grava minutos)",
  manual_edit_conflict: "Editado no ERP depois da importação",
  segments_changed: "Mudou de dia no Clockify depois da importação",
  erp_deleted: "Excluído no ERP depois da importação",
  write_error: "Erro ao gravar no ERP",
  unsupported_entity: "Sem equivalente no ERP (preservado no staging)",
  timezone_fallback: "Fuso da pessoa inválido; usado o fuso padrão",
};

export type EntryContext = {
  userTimeZone: (userId: string) => string | null;
  defaultTimeZone: string;
  userDecision: (userId: string) => { target: string | null; decision: string } | undefined;
  projectDecision: (projectId: string) => { decision: string } | undefined;
  noProjectPolicy: "stage" | "fallback";
};

export type PlannedSegment = DaySegment & { erpMinutes: number; tooShort: boolean };

export type EntryPlan = {
  id: string;
  userId: string;
  projectId: string | null;
  status: "ready" | "pending_review" | "unsupported";
  reasons: string[];
  timeZone: string;
  sourceSeconds: number;
  segments: PlannedSegment[];
  importableSeconds: number;
  stagedSeconds: number;
  startUtc: number | null;
  endUtc: number | null;
  rate: { amount: number; currency: string } | null;
  cost: { amount: number; currency: string } | null;
};

export function planTimeEntry(e: CkTimeEntry, ctx: EntryContext): EntryPlan {
  const reasons: string[] = [];
  const start = toEpochSeconds(e.timeInterval?.start);
  const end = toEpochSeconds(e.timeInterval?.end);
  const tzRaw = ctx.userTimeZone(e.userId);
  const timeZone = isValidTimeZone(tzRaw) ? tzRaw : ctx.defaultTimeZone;
  if (tzRaw && !isValidTimeZone(tzRaw)) reasons.push("timezone_fallback");
  const base: Omit<
    EntryPlan,
    "status" | "reasons" | "segments" | "importableSeconds" | "stagedSeconds" | "sourceSeconds"
  > = {
    id: e.id,
    userId: e.userId,
    projectId: e.projectId ?? null,
    timeZone,
    startUtc: start,
    endUtc: end,
    rate: rateToUnits(e.hourlyRate),
    cost: rateToUnits(e.costRate),
  };
  if (start === null) {
    return {
      ...base,
      status: "pending_review",
      reasons: [...reasons, "invalid_interval"],
      segments: [],
      sourceSeconds: 0,
      importableSeconds: 0,
      stagedSeconds: 0,
    };
  }
  if (end === null) {
    // Timer aberto: nunca inventa fim nem para o cronômetro na origem.
    return {
      ...base,
      status: "pending_review",
      reasons: [...reasons, "running_timer"],
      segments: [],
      sourceSeconds: 0,
      importableSeconds: 0,
      stagedSeconds: 0,
    };
  }
  const sourceSeconds = Math.max(0, end - start);
  if (end < start) {
    return {
      ...base,
      status: "pending_review",
      reasons: [...reasons, "invalid_interval"],
      segments: [],
      sourceSeconds: 0,
      importableSeconds: 0,
      stagedSeconds: 0,
    };
  }
  const type = (e.type ?? "REGULAR").toUpperCase();
  const blockers: string[] = [];
  let unsupported = false;
  if (type !== "REGULAR") {
    blockers.push("non_regular_type");
    unsupported = true;
  }
  if (sourceSeconds === 0) blockers.push("zero_duration");
  if (!e.projectId && ctx.noProjectPolicy === "stage") blockers.push("no_project");
  if (e.projectId) {
    const pd = ctx.projectDecision(e.projectId);
    if (!pd) blockers.push("project_not_found");
    else if (pd.decision === "ignore") blockers.push("project_ignored");
  }
  const ud = ctx.userDecision(e.userId);
  if (!ud || (!ud.target && ud.decision !== "ignore")) blockers.push("unmapped_user");
  else if (ud.decision === "ignore") blockers.push("ignored_user");

  const segments = segmentByLocalDay(start, end, timeZone).map<PlannedSegment>((s) => {
    const erpMinutes = erpMinutesForSegment(s);
    return { ...s, erpMinutes, tooShort: erpMinutes === 0 };
  });
  if (blockers.length) {
    return {
      ...base,
      status: unsupported ? "unsupported" : "pending_review",
      reasons: [...reasons, ...blockers],
      segments,
      sourceSeconds,
      importableSeconds: 0,
      stagedSeconds: sourceSeconds,
    };
  }
  const shortSecs = segments.filter((s) => s.tooShort).reduce((a, s) => a + s.seconds, 0);
  if (shortSecs > 0) reasons.push("segment_too_short");
  return {
    ...base,
    status: "ready",
    reasons,
    segments,
    sourceSeconds,
    importableSeconds: sourceSeconds - shortSecs,
    stagedSeconds: shortSecs,
  };
}

/** Marca sobreposições dentro da própria origem (mesma pessoa). Entrada ordenada por início. */
export function markSourceOverlaps(
  plans: EntryPlan[],
  lastEndByUser = new Map<string, { end: number; id: string }>(),
) {
  for (const p of plans) {
    if (p.startUtc === null || p.endUtc === null || p.endUtc <= p.startUtc) continue;
    const prev = lastEndByUser.get(p.userId);
    if (prev && p.startUtc < prev.end) {
      if (p.status === "ready") {
        p.status = "pending_review";
        p.stagedSeconds = p.sourceSeconds;
        p.importableSeconds = 0;
      }
      if (!p.reasons.includes("overlap_source")) p.reasons.push("overlap_source");
    }
    if (!prev || p.endUtc > prev.end) lastEndByUser.set(p.userId, { end: p.endUtc, id: p.id });
  }
  return lastEndByUser;
}

// ---------------------------------------------------------------- totais e conciliação
export type Totals = {
  entries: number;
  sourceSeconds: number;
  importableSeconds: number;
  stagedSeconds: number;
  byReason: Record<string, { entries: number; seconds: number }>;
  byUser: Record<string, number>;
  byProject: Record<string, number>;
  byMonth: Record<string, number>;
  earnedByCurrency: Record<string, number>;
  costByCurrency: Record<string, number>;
  segments: number;
};

export function emptyTotals(): Totals {
  return {
    entries: 0,
    sourceSeconds: 0,
    importableSeconds: 0,
    stagedSeconds: 0,
    byReason: {},
    byUser: {},
    byProject: {},
    byMonth: {},
    earnedByCurrency: {},
    costByCurrency: {},
    segments: 0,
  };
}

const add = (o: Record<string, number>, k: string, v: number) => {
  o[k] = (o[k] ?? 0) + v;
};

/** Acumula um plano. Segundos por mês usam o mês local de cada segmento. */
export function accumulate(t: Totals, p: EntryPlan) {
  t.entries++;
  t.sourceSeconds += p.sourceSeconds;
  t.importableSeconds += p.importableSeconds;
  t.stagedSeconds += p.stagedSeconds;
  add(t.byUser, p.userId, p.sourceSeconds);
  add(t.byProject, p.projectId ?? "sem_projeto", p.sourceSeconds);
  for (const s of p.segments) add(t.byMonth, monthOf(s.localDate), s.seconds);
  t.segments += p.status === "ready" ? p.segments.filter((s) => !s.tooShort).length : 0;
  const reasonKey =
    p.status === "ready" ? null : (p.reasons.find((r) => r !== "timezone_fallback") ?? "outro");
  if (reasonKey) {
    const r = (t.byReason[reasonKey] ??= { entries: 0, seconds: 0 });
    r.entries++;
    r.seconds += p.sourceSeconds;
  }
  // Valores por moeda: nunca somar moedas diferentes.
  if (p.rate)
    add(t.earnedByCurrency, p.rate.currency, round2((p.rate.amount * p.sourceSeconds) / 3600));
  if (p.cost)
    add(t.costByCurrency, p.cost.currency, round2((p.cost.amount * p.sourceSeconds) / 3600));
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** Conciliação: totais da coleta x totais do relatório do Clockify, por pessoa. */
export function reconcileByUser(
  collected: Record<string, number>,
  reported: Record<string, number>,
): Array<{ userId: string; collected: number; reported: number; diff: number }> {
  const ids = new Set([...Object.keys(collected), ...Object.keys(reported)]);
  return Array.from(ids)
    .map((userId) => {
      const c = collected[userId] ?? 0;
      const r = reported[userId] ?? 0;
      return { userId, collected: c, reported: r, diff: c - r };
    })
    .filter((x) => x.diff !== 0);
}

// ---------------------------------------------------------------- reexecução
export type SegmentLink = {
  segment: number;
  target_id: string;
  source_hash: string;
  imported_snapshot: Record<string, unknown>;
};

export const SNAPSHOT_FIELDS = [
  "project_id",
  "task_id",
  "user_id",
  "entry_date",
  "start_time",
  "end_time",
  "duration_minutes",
  "description",
  "billable",
  "hourly_rate",
  "status",
] as const;

export function snapshotOf(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of SNAPSHOT_FIELDS) {
    const v = row[k];
    out[k] = v === undefined ? null : typeof v === "number" ? Number(v) : v;
  }
  return out;
}

export type RerunDecision =
  | { kind: "insert"; segments: number[] }
  | { kind: "update"; segments: number[] }
  | { kind: "skip" }
  | { kind: "conflict"; reason: "manual_edit_conflict" | "segments_changed" | "erp_deleted" };

/**
 * Política explícita: nunca sobrescreve edição feita no ERP; nunca recria o que foi
 * excluído no ERP; nunca apaga trecho. Mudança de divisão por dia vai para revisão.
 */
export function decideRerun(
  planSegments: number[],
  newHash: string,
  links: SegmentLink[],
  currentRows: Map<string, Record<string, unknown>>,
): RerunDecision {
  if (links.length === 0) return { kind: "insert", segments: planSegments };
  for (const l of links) {
    const row = currentRows.get(l.target_id);
    if (!row) return { kind: "conflict", reason: "erp_deleted" };
    if (stableStringify(snapshotOf(row)) !== stableStringify(snapshotOf(l.imported_snapshot))) {
      return { kind: "conflict", reason: "manual_edit_conflict" };
    }
  }
  const linked = new Set(links.map((l) => l.segment));
  const sameHash = links.every((l) => l.source_hash === newHash);
  if (sameHash) {
    const missing = planSegments.filter((s) => !linked.has(s));
    return missing.length ? { kind: "insert", segments: missing } : { kind: "skip" };
  }
  const sameShape =
    planSegments.length === links.length && planSegments.every((s) => linked.has(s));
  if (!sameShape) return { kind: "conflict", reason: "segments_changed" };
  return { kind: "update", segments: planSegments };
}
