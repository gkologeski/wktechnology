// Motor retomável do importador Clockify → TechProjects. Server-only.
// Cada chamada trabalha por no máximo ~18 s, salva checkpoint e devolve o controle.
// Fases de prévia só leem o Clockify e gravam staging; a importação só roda a partir
// de uma prévia confirmada e escreve em lotes idempotentes.
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_TIME_ZONE } from "@/lib/time-zone";
import {
  ClockifyApiError,
  ClockifyClient,
  minIntervalForPlan,
  type FetchLike,
} from "./clockify-client";
import { clockifyBases, isClockifyId, type ClockifyRegion } from "./clockify-urls";
import {
  accumulate,
  decideRerun,
  emptyTotals,
  markSourceOverlaps,
  nameCandidates,
  planTimeEntry,
  planUserMappings,
  projectMetadata,
  projectPlannedHours,
  projectStatusFor,
  rateToUnits,
  reconcileByUser,
  sha256Hex,
  snapshotOf,
  stableStringify,
  taskStatusFor,
  type CkProject,
  type CkTask,
  type CkTimeEntry,
  type CkUser,
  type EntryPlan,
  type SegmentLink,
  type Totals,
  type WorkspaceMember,
} from "./clockify-map";
import { epochToIso, parseIsoDuration } from "./clockify-time";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Db = SupabaseClient<any, "public", any>;

export type StagingEntity =
  | "workspace"
  | "user"
  | "group"
  | "client"
  | "project"
  | "task"
  | "tag"
  | "custom_field"
  | "approval_request"
  | "time_entry"
  | "expense"
  | "invoice"
  | "holiday"
  | "time_off_policy";

export type Capability = "collected" | "empty" | "forbidden" | "not_available" | "failed" | "not_collected";

type Q = Record<string, string | number | boolean | string[] | undefined>;

type CollectSpec = {
  phase: string;
  entity: StagingEntity;
  label: string;
  path: (ws: string) => string;
  variants: Q[];
  paged: boolean;
  pageSize: number;
  required: boolean;
};

/** Inventário por capacidade. Itens fora desta lista aparecem como "não coletado". */
export const COLLECT_SPECS: CollectSpec[] = [
  { phase: "users", entity: "user", label: "Usuários e vínculos", path: (w) => `/workspaces/${w}/users`, variants: [{ status: "ALL", memberships: "ALL", "include-roles": "false" }, { status: "ALL", "account-statuses": "LIMITED", memberships: "ALL", "include-roles": "false" }], paged: true, pageSize: 100, required: true },
  { phase: "groups", entity: "group", label: "Grupos", path: (w) => `/workspaces/${w}/user-groups`, variants: [{}], paged: true, pageSize: 100, required: false },
  { phase: "clients", entity: "client", label: "Clientes", path: (w) => `/workspaces/${w}/clients`, variants: [{ archived: "false" }, { archived: "true" }], paged: true, pageSize: 100, required: false },
  { phase: "projects", entity: "project", label: "Projetos (inclui arquivados)", path: (w) => `/workspaces/${w}/projects`, variants: [{ hydrated: true }, { hydrated: true, archived: true }], paged: true, pageSize: 100, required: true },
  { phase: "tags", entity: "tag", label: "Etiquetas", path: (w) => `/workspaces/${w}/tags`, variants: [{ archived: false }, { archived: true }], paged: true, pageSize: 100, required: false },
  { phase: "custom_fields", entity: "custom_field", label: "Campos personalizados", path: (w) => `/workspaces/${w}/custom-fields`, variants: [{}], paged: false, pageSize: 0, required: false },
  { phase: "approvals", entity: "approval_request", label: "Aprovações", path: (w) => `/workspaces/${w}/approval-requests`, variants: [{ status: "PENDING" }, { status: "APPROVED" }, { status: "WITHDRAWN_APPROVAL" }], paged: true, pageSize: 100, required: false },
  { phase: "expenses", entity: "expense", label: "Despesas", path: (w) => `/workspaces/${w}/expenses`, variants: [{}], paged: true, pageSize: 100, required: false },
  { phase: "invoices", entity: "invoice", label: "Faturas", path: (w) => `/workspaces/${w}/invoices`, variants: [{}], paged: true, pageSize: 100, required: false },
  { phase: "holidays", entity: "holiday", label: "Feriados", path: (w) => `/workspaces/${w}/holidays`, variants: [{}], paged: false, pageSize: 0, required: false },
  { phase: "time_off_policies", entity: "time_off_policy", label: "Políticas de folga", path: (w) => `/workspaces/${w}/time-off/policies`, variants: [{}], paged: true, pageSize: 50, required: false },
];

/** Dados que esta versão não coleta, com o motivo (mostrados no inventário). */
export const NOT_COLLECTED: Array<{ entity: string; label: string; reason: string }> = [
  { entity: "time_off_requests", label: "Pedidos de folga", reason: "A leitura no Clockify é por POST de consulta; fica para uma próxima versão." },
  { entity: "attendance", label: "Presença (attendance)", reason: "Disponível só como relatório; não é importado." },
  { entity: "logins", label: "Logins e senhas", reason: "Autenticação do Clockify não é transferível." },
  { entity: "roles", label: "Papéis de administrador do Clockify", reason: "Não são replicados: o acesso no ERP segue o RBAC do workspace." },
];

export const DRY_PHASES = [
  "workspace",
  ...COLLECT_SPECS.map((s) => s.phase).slice(0, 4),
  "tasks",
  ...COLLECT_SPECS.map((s) => s.phase).slice(4),
  "time_entries",
  "in_progress",
  "reconcile",
  "mappings",
  "plan",
  "done",
] as const;

export const IMPORT_PHASES = ["projects_write", "members_write", "tasks_write", "entries_write", "done"] as const;

export type RunOptions = {
  refetch: boolean;
  noProjectPolicy: "stage" | "fallback";
  erpStatus: "locked" | "draft";
  targetCurrency: string;
  defaultTimeZone: string;
};

export function defaultOptions(partial?: Partial<RunOptions>): RunOptions {
  return {
    refetch: partial?.refetch ?? true,
    noProjectPolicy: partial?.noProjectPolicy === "fallback" ? "fallback" : "stage",
    erpStatus: partial?.erpStatus === "draft" ? "draft" : "locked",
    targetCurrency: (partial?.targetCurrency ?? "BRL").toUpperCase().slice(0, 3),
    defaultTimeZone: partial?.defaultTimeZone || DEFAULT_TIME_ZONE,
  };
}

export type Checkpoint = {
  variant?: number;
  page?: number;
  index?: number;
  ids?: string[];
  offset?: number;
  lastEnd?: { end: number; id: string } | null;
  lastRequestAt?: number;
  waitUntil?: number;
  minStart?: number | null;
  maxStart?: number | null;
  collectedByUser?: Record<string, number>;
  inProgress?: number;
  totals?: Totals;
  preview?: PreviewCounters;
  reportChunk?: number;
  reportedByUser?: Record<string, number>;
  importTotals?: ImportTotals;
};

type PreviewCounters = {
  segmentsToInsert: number;
  entriesToUpdate: number;
  entriesUnchanged: number;
  conflicts: Record<string, number>;
  overlapExisting: number;
};

type ImportTotals = {
  inserted: number;
  updated: number;
  unchanged: number;
  failed: number;
  conflicts: Record<string, number>;
  secondsImported: number;
  byUser: Record<string, number>;
  byProject: Record<string, number>;
  byMonth: Record<string, number>;
  projectsCreated: number;
  projectsLinked: number;
  tasksCreated: number;
  membersAdded: number;
  errors: Array<{ entry: string; reason: string }>;
};

type RunRow = {
  id: string;
  workspace_id: string;
  source_workspace_id: string;
  kind: "dry_run" | "import";
  status: string;
  phase: string;
  checkpoint: Checkpoint;
  options: Partial<RunOptions>;
  counts: Record<string, unknown>;
  requested_by: string;
  preview_run_id: string | null;
};

export type EngineDeps = {
  db: Db;
  apiKey: string;
  region: ClockifyRegion;
  subdomain: string | null;
  plan: string | null;
  fetch?: FetchLike;
  now?: () => number;
  budgetMs?: number;
  sleep?: (ms: number) => Promise<void>;
  /** E-mails dos membros do workspace (servidor resolve via Auth). */
  memberEmails: (userIds: string[]) => Promise<Map<string, string>>;
};

const BUDGET_MS = 18_000;

class Pause extends Error {}

// ------------------------------------------------------------------ helpers de banco
async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>, max = 200_000): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < max; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

function extractItems(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    for (const v of Object.values(data as Record<string, unknown>)) {
      if (Array.isArray(v)) return v;
      if (v && typeof v === "object") {
        for (const w of Object.values(v as Record<string, unknown>)) if (Array.isArray(w)) return w;
      }
    }
  }
  return [];
}

function itemId(item: unknown): string | null {
  const o = item as { id?: unknown; approvalRequest?: { id?: unknown } } | null;
  const id = o?.id ?? o?.approvalRequest?.id;
  return isClockifyId(id) ? (id as string).toLowerCase() : null;
}

// ------------------------------------------------------------------ motor
export class ClockifyEngine {
  private client: ClockifyClient;
  private now: () => number;
  private deadline: number;
  private run!: RunRow;
  private opts!: RunOptions;

  constructor(private deps: EngineDeps) {
    this.now = deps.now ?? (() => Date.now());
    this.deadline = this.now() + (deps.budgetMs ?? BUDGET_MS);
    this.client = new ClockifyClient({
      apiKey: deps.apiKey,
      bases: clockifyBases(deps.region, deps.subdomain),
      fetch: deps.fetch,
      now: this.now,
      sleep: deps.sleep,
      minIntervalMs: minIntervalForPlan(deps.plan),
    });
  }

  private get db() {
    return this.deps.db;
  }
  private get ws() {
    return this.run.source_workspace_id;
  }
  private get cp() {
    return this.run.checkpoint;
  }
  private timeLeft() {
    return this.deadline - this.now() > 1500;
  }

  /** Avança a execução. Devolve o estado salvo. */
  async advance(run: RunRow): Promise<RunRow> {
    this.run = { ...run, checkpoint: { ...(run.checkpoint ?? {}) } };
    this.opts = defaultOptions(run.options);
    this.client.lastRequestAt = this.cp.lastRequestAt ?? 0;
    if (this.cp.waitUntil && this.cp.waitUntil > this.now()) return this.run;
    delete this.cp.waitUntil;
    if (this.run.status === "queued") {
      this.run.status = "running";
      await this.save({ started_at: new Date(this.now()).toISOString() });
    }
    try {
      while (this.timeLeft()) {
        if (await this.cancelRequested()) {
          this.run.status = "cancelled";
          await this.save({ finished_at: new Date(this.now()).toISOString() });
          return this.run;
        }
        const done = await this.step();
        if (done) break;
      }
    } catch (e) {
      if (e instanceof Pause) {
        // checkpoint já salvo
      } else if (e instanceof ClockifyApiError && e.code === "rate_limited") {
        this.cp.waitUntil = e.retryAt ?? this.now() + 60_000;
      } else if (e instanceof ClockifyApiError && (e.code === "network" || e.code === "server")) {
        this.cp.waitUntil = this.now() + 30_000;
        await this.save({ error: e.message });
        return this.run;
      } else {
        this.run.status = "failed";
        const msg = e instanceof Error ? e.message : String(e);
        await this.save({ error: msg.slice(0, 500), finished_at: new Date(this.now()).toISOString() });
        return this.run;
      }
    }
    this.cp.lastRequestAt = this.client.lastRequestAt;
    await this.save({});
    return this.run;
  }

  private async cancelRequested(): Promise<boolean> {
    const { data } = await this.db.from("clockify_import_runs").select("status").eq("id", this.run.id).maybeSingle();
    return data?.status === "cancel_requested";
  }

  private async save(extra: Record<string, unknown>) {
    this.cp.lastRequestAt = this.client.lastRequestAt;
    const base = {
      phase: this.run.phase,
      checkpoint: this.cp,
      counts: this.run.counts,
      heartbeat_at: new Date(this.now()).toISOString(),
      updated_at: new Date(this.now()).toISOString(),
    };
    // Pausa/cancelamento pedidos durante o trabalho prevalecem sobre o estado em memória.
    const from = this.run.status === "cancelled" ? ["queued", "running", "cancel_requested"] : ["queued", "running"];
    const { data, error } = await this.db
      .from("clockify_import_runs")
      .update({ ...base, status: this.run.status, ...extra })
      .eq("id", this.run.id)
      .in("status", from)
      .select("id");
    if (error) throw new Error(error.message);
    if (!data?.length) {
      const { error: e2 } = await this.db
        .from("clockify_import_runs")
        .update(base)
        .eq("id", this.run.id)
        .in("status", ["paused", "cancel_requested"]);
      if (e2) throw new Error(e2.message);
    }
  }

  private nextPhase(list: readonly string[]) {
    const i = list.indexOf(this.run.phase);
    this.run.phase = list[i + 1] ?? "done";
    for (const k of ["variant", "page", "index", "ids", "offset", "lastEnd", "reportChunk"] as const) delete this.cp[k];
  }

  private setCapability(entity: string, cap: Capability, count?: number, detail?: string) {
    const caps = (this.run.counts.capabilities ??= {}) as Record<string, unknown>;
    const prev = caps[entity] as { count?: number } | undefined;
    caps[entity] = { status: cap, count: count ?? prev?.count ?? 0, detail: detail ?? null };
  }

  private bumpCount(entity: string, n: number) {
    const caps = (this.run.counts.capabilities ??= {}) as Record<string, { status: Capability; count: number; detail: string | null }>;
    const c = (caps[entity] ??= { status: "collected", count: 0, detail: null });
    c.count += n;
    if (c.status === "empty" && c.count > 0) c.status = "collected";
  }

  private async step(): Promise<boolean> {
    if (this.run.phase === "start") this.run.phase = this.run.kind === "dry_run" ? (this.opts.refetch ? "workspace" : "mappings") : "projects_write";
    if (this.run.phase === "done") return this.finish();
    if (this.run.kind === "dry_run") return this.dryStep();
    return this.importStep();
  }

  private async finish(): Promise<boolean> {
    this.run.status = "completed";
    const report = this.run.kind === "dry_run" ? await this.buildPreviewReport() : this.buildImportReport();
    await this.save({ report, finished_at: new Date(this.now()).toISOString() });
    return true;
  }

  // ------------------------------------------------------------ prévia
  private async dryStep(): Promise<boolean> {
    const phase = this.run.phase;
    if (phase === "workspace") {
      const { data } = await this.client.get<Record<string, unknown>>(`/workspaces/${this.ws}`);
      await this.stage("workspace", [data]);
      this.setCapability("workspace", "collected", 1);
      const plan = (data.featureSubscriptionType as string | undefined) ?? null;
      this.run.counts.plan = plan;
      this.nextPhase(DRY_PHASES);
      return false;
    }
    const spec = COLLECT_SPECS.find((s) => s.phase === phase);
    if (spec) return this.collect(spec);
    if (phase === "tasks") return this.collectTasks();
    if (phase === "time_entries") return this.collectEntries();
    if (phase === "in_progress") {
      try {
        const r = await this.client.page<unknown>(`/workspaces/${this.ws}/time-entries/status/in-progress`, 1, 1000);
        this.cp.inProgress = r.items.length;
      } catch (e) {
        if (!(e instanceof ClockifyApiError) || e.code === "rate_limited") throw e;
        this.cp.inProgress = undefined;
      }
      this.nextPhase(DRY_PHASES);
      return false;
    }
    if (phase === "reconcile") return this.reconcile();
    if (phase === "mappings") {
      await this.buildMappings();
      this.nextPhase(DRY_PHASES);
      return false;
    }
    if (phase === "plan") return this.planEntries(false);
    this.nextPhase(DRY_PHASES);
    return false;
  }

  private async stage(entity: StagingEntity, items: unknown[]) {
    const rows = [];
    for (const item of items) {
      const id = itemId(item);
      if (!id) {
        this.run.counts.invalid_ids = Number(this.run.counts.invalid_ids ?? 0) + 1;
        continue;
      }
      rows.push({
        workspace_id: this.run.workspace_id,
        source_workspace_id: this.ws,
        entity_type: entity,
        external_id: id,
        payload: item,
        payload_hash: await sha256Hex(stableStringify(item)),
        last_run_id: this.run.id,
        last_seen_at: new Date(this.now()).toISOString(),
      });
    }
    // Deduplica dentro do lote (variações de filtro podem repetir o mesmo item).
    const unique = Array.from(new Map(rows.map((r) => [r.external_id, r])).values());
    for (let i = 0; i < unique.length; i += 500) {
      const { error } = await this.db
        .from("clockify_staging_records")
        .upsert(unique.slice(i, i + 500), { onConflict: "workspace_id,source_workspace_id,entity_type,external_id" });
      if (error) throw new Error(error.message);
    }
    return unique.length;
  }

  private async collect(spec: CollectSpec): Promise<boolean> {
    const variant = this.cp.variant ?? 0;
    const page = this.cp.page ?? 1;
    if (variant >= spec.variants.length) {
      const caps = (this.run.counts.capabilities ?? {}) as Record<string, { status: string; count: number }>;
      if (!caps[spec.entity]) this.setCapability(spec.entity, "empty", 0);
      else if (caps[spec.entity].count > 0) {
        // Variações de filtro (ex.: ativos + arquivados) podem repetir itens: conta os distintos.
        const seen = await fetchAll<{ external_id: string }>((f, t) =>
          this.db
            .from("clockify_staging_records")
            .select("external_id")
            .eq("workspace_id", this.run.workspace_id)
            .eq("source_workspace_id", this.ws)
            .eq("entity_type", spec.entity)
            .eq("last_run_id", this.run.id)
            .range(f, t),
        );
        caps[spec.entity].count = seen.length;
      }
      this.nextPhase(DRY_PHASES);
      return false;
    }
    try {
      let items: unknown[];
      let last: boolean;
      if (spec.paged) {
        const r = await this.client.page<unknown>(spec.path(this.ws), page, spec.pageSize, spec.variants[variant]);
        items = extractItems(r.items);
        last = r.lastPage;
        // Proteção: endpoint que ignora paginação devolve sempre a mesma página.
        if (page > 1 && items.length && items.every((i) => (this.cp.ids ?? []).includes(itemId(i) ?? ""))) last = true;
        this.cp.ids = items.map((i) => itemId(i) ?? "").slice(0, 200);
      } else {
        const { data } = await this.client.get<unknown>(spec.path(this.ws), spec.variants[variant]);
        items = extractItems(data);
        last = true;
      }
      const n = await this.stage(spec.entity, items);
      this.bumpCount(spec.entity, n);
      if (last) {
        this.cp.variant = variant + 1;
        this.cp.page = 1;
      } else this.cp.page = page + 1;
    } catch (e) {
      if (!(e instanceof ClockifyApiError) || e.code === "rate_limited" || e.code === "network" || e.code === "server") throw e;
      if (spec.required && variant === 0 && (e.code === "unauthorized" || e.code === "forbidden")) {
        throw new Error(`${spec.label}: ${e.message}`);
      }
      const caps = (this.run.counts.capabilities ?? {}) as Record<string, { count?: number }>;
      if ((caps[spec.entity]?.count ?? 0) > 0) {
        // Uma variação do filtro falhou, mas outra já trouxe dados: registra sem zerar.
        const c = caps[spec.entity] as { detail?: string | null };
        c.detail = `Filtro ${variant + 1}: ${e.message}`;
      } else {
        const cap: Capability = e.code === "forbidden" || e.code === "unauthorized" ? "forbidden" : e.code === "not_found" || e.code === "bad_request" ? "not_available" : "failed";
        this.setCapability(spec.entity, cap, undefined, e.message);
      }
      this.cp.variant = variant + 1;
      this.cp.page = 1;
    }
    return false;
  }

  private async stagingIds(entity: StagingEntity): Promise<string[]> {
    const rows = await fetchAll<{ external_id: string }>((f, t) =>
      this.db
        .from("clockify_staging_records")
        .select("external_id")
        .eq("workspace_id", this.run.workspace_id)
        .eq("source_workspace_id", this.ws)
        .eq("entity_type", entity)
        .order("external_id")
        .range(f, t),
    );
    return rows.map((r) => r.external_id);
  }

  private async collectTasks(): Promise<boolean> {
    if (!this.cp.ids) {
      this.cp.ids = await this.stagingIds("project");
      this.cp.index = 0;
      this.cp.page = 1;
      this.setCapability("task", "empty", 0);
    }
    const ids = this.cp.ids;
    const i = this.cp.index ?? 0;
    if (i >= ids.length) {
      this.nextPhase(DRY_PHASES);
      return false;
    }
    const page = this.cp.page ?? 1;
    try {
      const r = await this.client.page<CkTask>(`/workspaces/${this.ws}/projects/${ids[i]}/tasks`, page, 200);
      const n = await this.stage("task", r.items.map((t) => ({ ...t, projectId: t.projectId ?? ids[i] })));
      this.bumpCount("task", n);
      if (r.lastPage) {
        this.cp.index = i + 1;
        this.cp.page = 1;
      } else this.cp.page = page + 1;
    } catch (e) {
      if (!(e instanceof ClockifyApiError) || ["rate_limited", "network", "server"].includes(e.code)) throw e;
      this.setCapability("task", "failed", undefined, e.message);
      this.cp.index = i + 1;
      this.cp.page = 1;
    }
    return false;
  }

  private async collectEntries(): Promise<boolean> {
    if (!this.cp.ids) {
      this.cp.ids = await this.stagingIds("user");
      this.cp.index = 0;
      this.cp.page = 1;
      this.cp.collectedByUser = {};
      this.cp.minStart = null;
      this.cp.maxStart = null;
      this.setCapability("time_entry", "empty", 0);
    }
    const ids = this.cp.ids;
    const i = this.cp.index ?? 0;
    if (i >= ids.length) {
      this.nextPhase(DRY_PHASES);
      return false;
    }
    const page = this.cp.page ?? 1;
    try {
      const size = (this.run.counts.entry_page_size as number | undefined) ?? 200;
      const r = await this.client.page<CkTimeEntry>(`/workspaces/${this.ws}/user/${ids[i]}/time-entries`, page, size, { hydrated: false });
      const n = await this.stage("time_entry", r.items);
      this.bumpCount("time_entry", n);
      for (const e of r.items) {
        const s = e.timeInterval?.start ? Math.round(Date.parse(e.timeInterval.start) / 1000) : null;
        const en = e.timeInterval?.end ? Math.round(Date.parse(e.timeInterval.end) / 1000) : null;
        if (s !== null) {
          this.cp.minStart = this.cp.minStart == null ? s : Math.min(this.cp.minStart, s);
          this.cp.maxStart = this.cp.maxStart == null ? s : Math.max(this.cp.maxStart, s);
        }
        if (s !== null && en !== null && en > s) {
          const byU = (this.cp.collectedByUser ??= {});
          byU[e.userId] = (byU[e.userId] ?? 0) + (en - s);
        }
      }
      if (r.lastPage) {
        this.cp.index = i + 1;
        this.cp.page = 1;
      } else this.cp.page = page + 1;
    } catch (e) {
      if (!(e instanceof ClockifyApiError) || ["rate_limited", "network", "server"].includes(e.code)) throw e;
      if (e.code === "unauthorized") throw new Error(`Apontamentos: ${e.message}`);
      if (e.code === "bad_request" && (this.run.counts.entry_page_size ?? 200) !== 50) {
        // Tamanho de página recusado: volta ao padrão documentado (50) e repete.
        this.run.counts.entry_page_size = 50;
        this.cp.page = 1;
        return false;
      }
      // 403 de um usuário específico: registra e segue (diagnóstico, não zero silencioso).
      const failed = ((this.run.counts.time_entry_user_errors ??= []) as Array<{ user: string; error: string }>);
      failed.push({ user: ids[i], error: e.message });
      this.setCapability("time_entry", "collected", undefined, `${failed.length} pessoa(s) sem acesso aos apontamentos`);
      this.cp.index = i + 1;
      this.cp.page = 1;
    }
    return false;
  }

  /** Relatório resumido do Clockify (POST de leitura) para conferir os segundos por pessoa. */
  private async reconcile(): Promise<boolean> {
    const min = this.cp.minStart;
    const max = this.cp.maxStart;
    if (min == null || max == null) {
      this.setCapability("report_summary", "empty", 0);
      this.nextPhase(DRY_PHASES);
      return false;
    }
    const YEAR = 365 * 86400;
    const chunk = this.cp.reportChunk ?? 0;
    const from = min + chunk * YEAR;
    if (from > max) {
      this.setCapability("report_summary", "collected", chunk);
      this.nextPhase(DRY_PHASES);
      return false;
    }
    const to = Math.min(from + YEAR, max + 86400 * 2);
    try {
      const res = await this.client.report<{ groupOne?: Array<{ _id?: string; duration?: number }> }>(
        `/workspaces/${this.ws}/reports/summary`,
        {
          dateRangeStart: new Date(from * 1000).toISOString(),
          dateRangeEnd: new Date(to * 1000 - 1).toISOString(),
          timeZone: "UTC",
          amountShown: "HIDE_AMOUNT",
          exportType: "JSON",
          summaryFilter: { groups: ["USER"] },
        },
      );
      const byU = (this.cp.reportedByUser ??= {});
      for (const g of res.groupOne ?? []) {
        if (g._id && typeof g.duration === "number") byU[g._id] = (byU[g._id] ?? 0) + Math.round(g.duration);
      }
      this.cp.reportChunk = chunk + 1;
    } catch (e) {
      if (!(e instanceof ClockifyApiError) || ["rate_limited", "network", "server"].includes(e.code)) throw e;
      this.setCapability("report_summary", e.code === "forbidden" ? "forbidden" : "not_available", 0, e.message);
      this.cp.reportedByUser = undefined;
      this.nextPhase(DRY_PHASES);
    }
    return false;
  }

  // ------------------------------------------------------------ mapeamentos
  private async loadStaging<T>(entity: StagingEntity): Promise<Array<{ id: string; external_id: string; payload: T; payload_hash: string; status: string }>> {
    return fetchAll((f, t) =>
      this.db
        .from("clockify_staging_records")
        .select("id, external_id, payload, payload_hash, status")
        .eq("workspace_id", this.run.workspace_id)
        .eq("source_workspace_id", this.ws)
        .eq("entity_type", entity)
        .order("external_id")
        .range(f, t),
    );
  }

  private async loadMappings(entity: "user" | "client" | "project") {
    return fetchAll<{ external_id: string; target_id: string | null; decision: string; method: string; label: string | null }>((f, t) =>
      this.db
        .from("clockify_mappings")
        .select("external_id, target_id, decision, method, label")
        .eq("workspace_id", this.run.workspace_id)
        .eq("source_workspace_id", this.ws)
        .eq("entity_type", entity)
        .range(f, t),
    );
  }

  private async upsertMappings(rows: Array<Record<string, unknown>>) {
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await this.db
        .from("clockify_mappings")
        .upsert(rows.slice(i, i + 500), { onConflict: "workspace_id,source_workspace_id,entity_type,external_id" });
      if (error) throw new Error(error.message);
    }
  }

  private async buildMappings() {
    const ws = this.run.workspace_id;
    // Usuários: e-mail normalizado contra membros do workspace (qualquer status).
    const users = (await this.loadStaging<CkUser>("user")).map((r) => r.payload);
    const members = await fetchAll<{ user_id: string; status: string }>((f, t) =>
      this.db.from("workspace_members").select("user_id, status").eq("workspace_id", ws).range(f, t),
    );
    const ids = members.map((m) => m.user_id);
    const emails = await this.deps.memberEmails(ids);
    const profiles = ids.length
      ? await fetchAll<{ id: string; full_name: string | null }>((f, t) =>
          this.db.from("profiles").select("id, full_name").in("id", ids.slice(0, 1000)).range(f, t),
        )
      : [];
    const nameById = new Map(profiles.map((p) => [p.id, p.full_name]));
    const wm: WorkspaceMember[] = members.map((m) => ({
      user_id: m.user_id,
      status: m.status,
      email: emails.get(m.user_id) ?? null,
      name: nameById.get(m.user_id) ?? null,
    }));
    const prevUsers = await this.loadMappings("user");
    const plans = planUserMappings(users, wm, prevUsers);
    await this.upsertMappings(
      plans.map((p) => ({
        workspace_id: ws,
        source_workspace_id: this.ws,
        entity_type: "user",
        external_id: p.external_id,
        label: p.label,
        target_id: p.target_id,
        method: p.method,
        decision: p.decision,
        note: p.note,
        candidates: p.candidates,
      })),
    );

    // Clientes: só sugestões por nome exato normalizado; nunca vínculo automático.
    const clients = (await this.loadStaging<{ id: string; name: string }>("client")).map((r) => r.payload);
    const prevClients = new Map((await this.loadMappings("client")).map((m) => [m.external_id, m]));
    const clientRows: Array<Record<string, unknown>> = [];
    for (let i = 0; i < clients.length; i += 10) {
      const part = clients.slice(i, i + 10);
      const found = await Promise.all(
        part.map(async (c) => {
          const term = (c.name ?? "").replace(/[%_\\]/g, "").trim();
          if (!term) return [] as Array<{ id: string; name: string }>;
          const { data } = await this.db.from("companies").select("id, name").eq("workspace_id", ws).ilike("name", term).limit(10);
          return (data ?? []) as Array<{ id: string; name: string }>;
        }),
      );
      part.forEach((c, k) => {
        const prev = prevClients.get(c.id);
        const keep = prev && (prev.decision === "confirmed" || prev.decision === "ignore");
        clientRows.push({
          workspace_id: ws,
          source_workspace_id: this.ws,
          entity_type: "client",
          external_id: c.id,
          label: c.name,
          target_id: keep ? prev!.target_id : null,
          method: keep ? prev!.method : "none",
          decision: keep ? prev!.decision : "pending",
          candidates: nameCandidates(c.name, found[k]),
        });
      });
    }
    await this.upsertMappings(clientRows);

    // Projetos: padrão "criar"; nome igual a projeto do ERP é só sugestão.
    const projects = (await this.loadStaging<CkProject>("project")).map((r) => r.payload);
    const erpProjects = await fetchAll<{ id: string; name: string }>((f, t) =>
      this.db.from("projects").select("id, name").eq("workspace_id", ws).range(f, t),
    );
    const prevProjects = new Map((await this.loadMappings("project")).map((m) => [m.external_id, m]));
    await this.upsertMappings(
      projects.map((p) => {
        const prev = prevProjects.get(p.id);
        const keep = prev && prev.decision !== "pending";
        return {
          workspace_id: ws,
          source_workspace_id: this.ws,
          entity_type: "project",
          external_id: p.id,
          label: p.name,
          target_id: keep ? prev!.target_id : null,
          method: keep ? prev!.method : "none",
          decision: keep ? prev!.decision : "create",
          candidates: nameCandidates(p.name, erpProjects),
        };
      }),
    );
  }

  // ------------------------------------------------------------ apontamentos (prévia e escrita)
  private async entryContext() {
    const users = await this.loadStaging<CkUser>("user");
    const tz = new Map(users.map((u) => [u.external_id, u.payload.settings?.timeZone ?? null]));
    const um = new Map((await this.loadMappings("user")).map((m) => [m.external_id, m]));
    const pm = new Map((await this.loadMappings("project")).map((m) => [m.external_id, m]));
    return {
      users: users.map((u) => u.external_id),
      ctx: {
        userTimeZone: (id: string) => tz.get(id) ?? null,
        defaultTimeZone: this.opts.defaultTimeZone,
        userDecision: (id: string) => {
          const m = um.get(id);
          return m ? { target: m.target_id, decision: m.decision } : undefined;
        },
        projectDecision: (id: string) => {
          const m = pm.get(id);
          return m ? { decision: m.decision } : undefined;
        },
        noProjectPolicy: this.opts.noProjectPolicy,
      },
      userTarget: (id: string) => um.get(id)?.target_id ?? null,
    };
  }

  private async userEntriesPage(userId: string, offset: number, size: number) {
    const { data, error } = await this.db
      .from("clockify_staging_records")
      .select("id, external_id, payload, payload_hash")
      .eq("workspace_id", this.run.workspace_id)
      .eq("source_workspace_id", this.ws)
      .eq("entity_type", "time_entry")
      .eq("payload->>userId", userId)
      .order("payload->timeInterval->>start", { ascending: true })
      .order("external_id", { ascending: true })
      .range(offset, offset + size - 1);
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{ id: string; external_id: string; payload: CkTimeEntry; payload_hash: string }>;
  }

  private async linksFor(externalIds: string[]) {
    if (!externalIds.length) return new Map<string, SegmentLink[]>();
    const { data, error } = await this.db
      .from("clockify_import_links")
      .select("external_id, segment, target_id, source_hash, imported_snapshot")
      .eq("workspace_id", this.run.workspace_id)
      .eq("source_workspace_id", this.ws)
      .eq("entity_type", "time_entry")
      .in("external_id", externalIds);
    if (error) throw new Error(error.message);
    const map = new Map<string, SegmentLink[]>();
    for (const l of (data ?? []) as Array<SegmentLink & { external_id: string }>) {
      map.set(l.external_id, [...(map.get(l.external_id) ?? []), l]);
    }
    return map;
  }

  private async erpRows(ids: string[]) {
    const map = new Map<string, Record<string, unknown>>();
    for (let i = 0; i < ids.length; i += 200) {
      const { data, error } = await this.db
        .from("project_time_entries")
        .select("id, project_id, task_id, user_id, entry_date, start_time, end_time, duration_minutes, description, billable, hourly_rate, status")
        .eq("workspace_id", this.run.workspace_id)
        .in("id", ids.slice(i, i + 200));
      if (error) throw new Error(error.message);
      for (const r of data ?? []) map.set((r as { id: string }).id, r as Record<string, unknown>);
    }
    return map;
  }

  /** Apontamentos já existentes no ERP da pessoa (para prever sobreposições). */
  private async erpIntervals(userId: string) {
    const rows = await fetchAll<{ id: string; entry_date: string; start_time: string | null; end_time: string | null }>((f, t) =>
      this.db
        .from("project_time_entries")
        .select("id, entry_date, start_time, end_time")
        .eq("workspace_id", this.run.workspace_id)
        .eq("user_id", userId)
        .not("start_time", "is", null)
        .range(f, t),
    );
    const byDate = new Map<string, Array<{ id: string; s: string; e: string }>>();
    for (const r of rows) {
      if (!r.start_time || !r.end_time) continue;
      byDate.set(r.entry_date, [...(byDate.get(r.entry_date) ?? []), { id: r.id, s: r.start_time, e: r.end_time }]);
    }
    return byDate;
  }

  private async setStagingStatus(groups: Map<string, string[]>) {
    for (const [key, ids] of groups) {
      const [status, reason, detail] = key.split("|");
      for (let i = 0; i < ids.length; i += 200) {
        const { error } = await this.db
          .from("clockify_staging_records")
          .update({ status, reason_code: reason || null, reason_detail: detail || null, last_run_id: this.run.id })
          .in("id", ids.slice(i, i + 200));
        if (error) throw new Error(error.message);
      }
    }
  }

  /** Percorre os apontamentos por pessoa e ordem de início. `write` grava no ERP. */
  private async planEntries(write: boolean): Promise<boolean> {
    const { users, ctx, userTarget } = await this.entryContext();
    if (!this.cp.ids) {
      this.cp.ids = users;
      this.cp.index = 0;
      this.cp.offset = 0;
      this.cp.lastEnd = null;
      if (write) this.cp.importTotals ??= emptyImportTotals();
      else {
        this.cp.totals = emptyTotals();
        this.cp.preview = { segmentsToInsert: 0, entriesToUpdate: 0, entriesUnchanged: 0, conflicts: {}, overlapExisting: 0 };
      }
    }
    const projectTargets = write ? await this.projectTargets() : new Map<string, string>();
    const taskTargets = write ? await this.taskTargets() : new Map<string, string>();
    const fallbackProject = write ? projectTargets.get(this.ws) ?? null : null;

    while (this.timeLeft()) {
      if (await this.cancelRequested()) throw new Pause();
      const ids = this.cp.ids!;
      const i = this.cp.index ?? 0;
      if (i >= ids.length) {
        this.nextPhase(write ? IMPORT_PHASES : DRY_PHASES);
        return false;
      }
      const ckUser = ids[i];
      const target = userTarget(ckUser);
      const rows = await this.userEntriesPage(ckUser, this.cp.offset ?? 0, 200);
      if (!rows.length) {
        this.cp.index = i + 1;
        this.cp.offset = 0;
        this.cp.lastEnd = null;
        await this.save({});
        continue;
      }
      const plans = rows.map((r) => planTimeEntry(r.payload, ctx));
      const lastEnd = new Map<string, { end: number; id: string }>();
      if (this.cp.lastEnd) lastEnd.set(ckUser, this.cp.lastEnd);
      markSourceOverlaps(plans, lastEnd);
      this.cp.lastEnd = lastEnd.get(ckUser) ?? null;

      const links = await this.linksFor(rows.map((r) => r.external_id));
      const linkedTargets = Array.from(links.values()).flat().map((l) => l.target_id);
      const current = await this.erpRows(linkedTargets);
      const erpByDate = target && !write ? await this.erpIntervals(target) : null;
      const ownTargets = new Set(linkedTargets);

      const statusGroups = new Map<string, string[]>();
      const push = (k: string, id: string) => statusGroups.set(k, [...(statusGroups.get(k) ?? []), id]);
      const inserts: Array<{ _key: string; row: Record<string, unknown> }> = [];
      const updates: Array<{ _key: string; id: string; row: Record<string, unknown> }> = [];
      const meta = new Map<string, { plan: EntryPlan; hash: string; staging: string; entry: CkTimeEntry }>();

      rows.forEach((r, k) => {
        const p = plans[k];
        if (!write) accumulate(this.cp.totals!, p);
        if (p.status !== "ready") {
          push(`${p.status}|${p.reasons.filter((x) => x !== "timezone_fallback")[0] ?? ""}|`, r.id);
          return;
        }
        // Sobreposição com o ERP (prévia): ignora os próprios trechos já importados.
        if (erpByDate) {
          const hit = p.segments.find((s) =>
            !s.tooShort && !s.dstMismatch &&
            (erpByDate.get(s.localDate) ?? []).some((x) => !ownTargets.has(x.id) && x.s < (s.endTime === "24:00:00" ? "24:00:00" : s.endTime) && x.e > s.startTime),
          );
          if (hit) {
            this.cp.preview!.overlapExisting++;
            push(`pending_review|overlap_existing|${hit.localDate}`, r.id);
            return;
          }
        }
        const segs = p.segments.filter((s) => !s.tooShort).map((s) => s.index);
        const decision = decideRerun(segs, r.payload_hash, links.get(r.external_id) ?? [], current);
        if (!write) {
          const pv = this.cp.preview!;
          if (decision.kind === "insert") pv.segmentsToInsert += decision.segments.length;
          else if (decision.kind === "update") pv.entriesToUpdate++;
          else if (decision.kind === "skip") pv.entriesUnchanged++;
          else pv.conflicts[decision.reason] = (pv.conflicts[decision.reason] ?? 0) + 1;
          push(
            decision.kind === "conflict"
              ? `pending_review|${decision.reason}|`
              : decision.kind === "skip"
                ? "imported||"
                : `ready|${p.reasons.includes("segment_too_short") ? "segment_too_short" : ""}|`,
            r.id,
          );
          return;
        }
        const it = this.cp.importTotals!;
        if (decision.kind === "skip") {
          it.unchanged++;
          push("imported||", r.id);
          return;
        }
        if (decision.kind === "conflict") {
          it.conflicts[decision.reason] = (it.conflicts[decision.reason] ?? 0) + 1;
          push(`pending_review|${decision.reason}|`, r.id);
          return;
        }
        const projectId = r.payload.projectId ? projectTargets.get(r.payload.projectId) : fallbackProject;
        if (!projectId || !target) {
          push(`pending_review|${!target ? "unmapped_user" : "project_not_found"}|`, r.id);
          return;
        }
        meta.set(r.external_id, { plan: p, hash: r.payload_hash, staging: r.id, entry: r.payload });
        const segLinks = new Map((links.get(r.external_id) ?? []).map((l) => [l.segment, l]));
        for (const s of p.segments) {
          if (!decision.segments.includes(s.index)) continue;
          const rate = p.rate && p.rate.currency === this.opts.targetCurrency ? p.rate.amount : null;
          const row: Record<string, unknown> = {
            project_id: projectId,
            task_id: r.payload.taskId ? (taskTargets.get(r.payload.taskId) ?? null) : null,
            user_id: target,
            entry_date: s.localDate,
            start_time: s.dstMismatch ? null : s.startTime,
            end_time: s.dstMismatch ? null : s.endTime,
            duration_minutes: s.erpMinutes,
            description: r.payload.description?.trim() || null,
            billable: r.payload.billable ?? true,
            hourly_rate: rate,
            external_id: `clockify:${r.external_id}:${s.index}`,
            status: this.opts.erpStatus,
            created_by: this.run.requested_by,
            started_at: epochToIso(s.startUtc),
            stopped_at: epochToIso(s.endUtc),
          };
          const key = `${r.external_id}:${s.index}`;
          if (decision.kind === "update") updates.push({ _key: key, id: segLinks.get(s.index)!.target_id, row });
          else inserts.push({ _key: key, row });
        }
      });

      if (write && (inserts.length || updates.length)) {
        await this.writeSegments(inserts, updates, meta, push);
      }
      await this.setStagingStatus(statusGroups);
      this.cp.offset = (this.cp.offset ?? 0) + rows.length;
      await this.save({});
    }
    return false;
  }

  private async writeSegments(
    inserts: Array<{ _key: string; row: Record<string, unknown> }>,
    updates: Array<{ _key: string; id: string; row: Record<string, unknown> }>,
    meta: Map<string, { plan: EntryPlan; hash: string; staging: string; entry: CkTimeEntry }>,
    push: (k: string, id: string) => void,
  ) {
    const it = this.cp.importTotals!;
    const results: Array<{ _key: string; id?: string; error?: string }> = [];
    for (const [op, list] of [["insert", inserts], ["update", updates]] as const) {
      for (let i = 0; i < list.length; i += 200) {
        const { data, error } = await this.db.rpc("clockify_import_apply", {
          p_workspace: this.run.workspace_id,
          p_table: "project_time_entries",
          p_op: op,
          p_rows: list.slice(i, i + 200),
        });
        if (error) throw new Error(error.message);
        results.push(...((data ?? []) as typeof results));
      }
    }
    const okIds = results.filter((r) => r.id).map((r) => r.id!);
    const fresh = await this.erpRows(okIds);
    const failedEntries = new Map<string, string>();
    const linkRows: Array<Record<string, unknown>> = [];
    for (const r of results) {
      const [extId, segRaw] = r._key.split(":");
      const m = meta.get(extId);
      if (!m) continue;
      const seg = m.plan.segments.find((s) => s.index === Number(segRaw))!;
      if (r.error || !r.id) {
        it.failed++;
        const reason = /Já existe um apontamento/.test(r.error ?? "") ? "overlap_existing" : "write_error";
        failedEntries.set(extId, reason === "overlap_existing" ? `${reason}|${seg.localDate}` : `${reason}|${(r.error ?? "").slice(0, 160)}`);
        if (it.errors.length < 200) it.errors.push({ entry: extId, reason });
        continue;
      }
      const isUpdate = updates.some((u) => u._key === r._key);
      if (isUpdate) it.updated++;
      else it.inserted++;
      it.secondsImported += seg.seconds;
      add(it.byUser, m.entry.userId, seg.seconds);
      add(it.byProject, m.entry.projectId ?? "sem_projeto", seg.seconds);
      add(it.byMonth, seg.localDate.slice(0, 7), seg.seconds);
      linkRows.push({
        workspace_id: this.run.workspace_id,
        source_workspace_id: this.ws,
        entity_type: "time_entry",
        external_id: extId,
        segment: seg.index,
        target_table: "project_time_entries",
        target_id: r.id,
        source_hash: m.hash,
        imported_snapshot: snapshotOf(fresh.get(r.id) ?? {}),
        source_seconds: seg.seconds,
        source_start_utc: epochToIso(seg.startUtc),
        source_end_utc: epochToIso(seg.endUtc),
        source_timezone: m.plan.timeZone,
        local_date: seg.localDate,
        last_run_id: this.run.id,
        meta: {
          entry_seconds: m.plan.sourceSeconds,
          segments_total: m.plan.segments.length,
          dst_wallclock_mismatch: seg.dstMismatch,
          tag_ids: m.entry.tagIds ?? [],
          approval_request_id: m.entry.approvalRequestId ?? null,
          is_locked: m.entry.isLocked ?? null,
          custom_field_values: m.entry.customFieldValues ?? null,
          hourly_rate: m.plan.rate,
          cost_rate: m.plan.cost,
        },
      });
    }
    for (let i = 0; i < linkRows.length; i += 500) {
      const { error } = await this.db
        .from("clockify_import_links")
        .upsert(linkRows.slice(i, i + 500), { onConflict: "workspace_id,source_workspace_id,entity_type,external_id,segment" });
      if (error) throw new Error(error.message);
    }
    for (const [extId, m] of meta) {
      const f = failedEntries.get(extId);
      if (f) push(`pending_review|${f}`, m.staging);
      else push(`imported|${m.plan.reasons.includes("segment_too_short") ? "segment_too_short" : ""}|`, m.staging);
    }
  }

  // ------------------------------------------------------------ importação: projetos, membros, tarefas
  private async projectTargets(): Promise<Map<string, string>> {
    const rows = await fetchAll<{ external_id: string; target_id: string }>((f, t) =>
      this.db
        .from("clockify_import_links")
        .select("external_id, target_id")
        .eq("workspace_id", this.run.workspace_id)
        .eq("source_workspace_id", this.ws)
        .eq("entity_type", "project")
        .range(f, t),
    );
    return new Map(rows.map((r) => [r.external_id, r.target_id]));
  }

  private async taskTargets(): Promise<Map<string, string>> {
    const rows = await fetchAll<{ external_id: string; target_id: string }>((f, t) =>
      this.db
        .from("clockify_import_links")
        .select("external_id, target_id")
        .eq("workspace_id", this.run.workspace_id)
        .eq("source_workspace_id", this.ws)
        .eq("entity_type", "task")
        .range(f, t),
    );
    return new Map(rows.map((r) => [r.external_id, r.target_id]));
  }

  private async apply(table: string, op: "insert" | "update", rows: Array<Record<string, unknown>>) {
    const out: Array<{ _key: string; id?: string; error?: string }> = [];
    for (let i = 0; i < rows.length; i += 100) {
      const { data, error } = await this.db.rpc("clockify_import_apply", {
        p_workspace: this.run.workspace_id,
        p_table: table,
        p_op: op,
        p_rows: rows.slice(i, i + 100),
      });
      if (error) throw new Error(error.message);
      out.push(...((data ?? []) as typeof out));
    }
    return out;
  }

  private async insertLinks(rows: Array<Record<string, unknown>>) {
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await this.db
        .from("clockify_import_links")
        .upsert(rows.slice(i, i + 500), { onConflict: "workspace_id,source_workspace_id,entity_type,external_id,segment" });
      if (error) throw new Error(error.message);
    }
  }

  private async importStep(): Promise<boolean> {
    this.cp.importTotals ??= emptyImportTotals();
    const it = this.cp.importTotals;
    const ws = this.run.workspace_id;
    if (this.run.phase === "projects_write") {
      const projects = await this.loadStaging<CkProject>("project");
      const mappings = new Map((await this.loadMappings("project")).map((m) => [m.external_id, m]));
      const clientMap = new Map((await this.loadMappings("client")).map((m) => [m.external_id, m]));
      const existing = await this.projectTargets();
      const toCreate: Array<Record<string, unknown>> = [];
      const linkRows: Array<Record<string, unknown>> = [];
      const statusGroups = new Map<string, string[]>();
      const push = (k: string, id: string) => statusGroups.set(k, [...(statusGroups.get(k) ?? []), id]);
      for (const p of projects) {
        const m = mappings.get(p.external_id);
        if (!m || m.decision === "ignore") {
          push("skipped|project_ignored|", p.id);
          continue;
        }
        if (existing.has(p.external_id)) {
          push("imported||", p.id);
          continue;
        }
        const client = p.payload.clientId ? clientMap.get(p.payload.clientId) : undefined;
        const companyId = client && client.decision === "confirmed" ? client.target_id : null;
        if (m.decision === "confirmed" && m.target_id) {
          linkRows.push(this.linkRow("project", p.external_id, "projects", m.target_id, p.payload_hash, { linked_existing: true }));
          it.projectsLinked++;
          push("imported||", p.id);
          continue;
        }
        toCreate.push({
          _key: p.external_id,
          row: {
            owner_id: this.run.requested_by,
            name: p.payload.name,
            description: p.payload.note?.trim() || null,
            status: projectStatusFor(p.payload),
            planned_hours: projectPlannedHours(p.payload),
            metadata: projectMetadata(p.payload, companyId),
          },
        });
      }
      // Projeto de apoio para apontamentos sem projeto, só se a política pedir.
      if (this.opts.noProjectPolicy === "fallback" && !existing.has(this.ws)) {
        toCreate.push({
          _key: this.ws,
          row: {
            owner_id: this.run.requested_by,
            name: "Clockify — sem projeto",
            description: "Apontamentos do Clockify que não tinham projeto.",
            status: "done",
            metadata: { clockify: { fallback: true, workspace_id: this.ws } },
          },
        });
      }
      const res = await this.apply("projects", "insert", toCreate);
      const staged = new Map(projects.map((p) => [p.external_id, p]));
      for (const r of res) {
        const sp = staged.get(r._key);
        if (r.error || !r.id) {
          if (sp) push(`pending_review|write_error|${(r.error ?? "").slice(0, 160)}`, sp.id);
          continue;
        }
        it.projectsCreated++;
        linkRows.push(this.linkRow("project", r._key, "projects", r.id, sp?.payload_hash ?? "fallback", {}));
        if (sp) push("imported||", sp.id);
      }
      await this.insertLinks(linkRows);
      await this.setStagingStatus(statusGroups);
      this.nextPhase(IMPORT_PHASES);
      return false;
    }
    if (this.run.phase === "members_write") {
      const projects = await this.loadStaging<CkProject>("project");
      const targets = await this.projectTargets();
      const um = new Map((await this.loadMappings("user")).map((m) => [m.external_id, m]));
      const rows: Array<Record<string, unknown>> = [];
      for (const p of projects) {
        const pid = targets.get(p.external_id);
        if (!pid) continue;
        for (const mem of p.payload.memberships ?? []) {
          const m = um.get(mem.userId);
          if (!m?.target_id || m.decision === "ignore" || m.decision === "pending") continue;
          const bill = rateToUnits(mem.hourlyRate);
          const cost = rateToUnits(mem.costRate);
          rows.push({
            _key: `${p.external_id}:${mem.userId}`,
            row: {
              project_id: pid,
              user_id: m.target_id,
              role_in_project: "contributor",
              bill_rate_hour: bill && bill.currency === this.opts.targetCurrency ? bill.amount : null,
              cost_rate_hour: cost && cost.currency === this.opts.targetCurrency ? cost.amount : null,
            },
          });
        }
      }
      const res = await this.apply("project_members", "insert", rows);
      it.membersAdded += res.filter((r) => r.id).length;
      this.nextPhase(IMPORT_PHASES);
      return false;
    }
    if (this.run.phase === "tasks_write") {
      const tasks = await this.loadStaging<CkTask>("task");
      const targets = await this.projectTargets();
      const existing = await this.taskTargets();
      const um = new Map((await this.loadMappings("user")).map((m) => [m.external_id, m]));
      const statusGroups = new Map<string, string[]>();
      const push = (k: string, id: string) => statusGroups.set(k, [...(statusGroups.get(k) ?? []), id]);
      const rows: Array<Record<string, unknown>> = [];
      const staged = new Map(tasks.map((t) => [t.external_id, t]));
      for (const t of tasks) {
        if (existing.has(t.external_id)) {
          push("imported||", t.id);
          continue;
        }
        const pid = targets.get(t.payload.projectId);
        if (!pid) {
          push("skipped|project_ignored|", t.id);
          continue;
        }
        const assignees = (t.payload.assigneeIds ?? [])
          .map((a) => um.get(a))
          .filter((m) => m?.target_id && m.decision !== "ignore" && m.decision !== "pending")
          .map((m) => m!.target_id as string);
        const secs = parseIsoDuration(t.payload.estimate ?? null);
        rows.push({
          _key: t.external_id,
          row: {
            project_id: pid,
            title: t.payload.name,
            status: taskStatusFor(t.payload),
            estimated_hours: secs && secs > 0 ? Math.round((secs / 3600) * 100) / 100 : null,
            assignee_id: assignees[0] ?? null,
            assignee_ids: assignees,
          },
        });
      }
      const res = await this.apply("project_tasks", "insert", rows);
      const links: Array<Record<string, unknown>> = [];
      for (const r of res) {
        const st = staged.get(r._key);
        if (!r.id) {
          if (st) push(`pending_review|write_error|${(r.error ?? "").slice(0, 160)}`, st.id);
          continue;
        }
        it.tasksCreated++;
        links.push(this.linkRow("task", r._key, "project_tasks", r.id, st?.payload_hash ?? "", {}));
        if (st) push("imported||", st.id);
      }
      await this.insertLinks(links);
      await this.setStagingStatus(statusGroups);
      this.nextPhase(IMPORT_PHASES);
      return false;
    }
    if (this.run.phase === "entries_write") return this.planEntries(true);
    this.nextPhase(IMPORT_PHASES);
    void ws;
    return false;
  }

  private linkRow(entity: string, externalId: string, table: string, targetId: string, hash: string, meta: Record<string, unknown>) {
    return {
      workspace_id: this.run.workspace_id,
      source_workspace_id: this.ws,
      entity_type: entity,
      external_id: externalId,
      segment: 0,
      target_table: table,
      target_id: targetId,
      source_hash: hash,
      imported_snapshot: {},
      last_run_id: this.run.id,
      meta,
    };
  }

  // ------------------------------------------------------------ relatórios
  private async statusCounts() {
    const out: Record<string, Record<string, number>> = {};
    const reasons: Record<string, number> = {};
    const rows = await fetchAll<{ entity_type: string; status: string; reason_code: string | null; last_run_id: string | null }>((f, t) =>
      this.db
        .from("clockify_staging_records")
        .select("entity_type, status, reason_code, last_run_id")
        .eq("workspace_id", this.run.workspace_id)
        .eq("source_workspace_id", this.ws)
        .range(f, t),
    );
    let missing = 0;
    for (const r of rows) {
      const e = (out[r.entity_type] ??= {});
      e[r.status] = (e[r.status] ?? 0) + 1;
      if (r.entity_type === "time_entry" && r.reason_code) reasons[r.reason_code] = (reasons[r.reason_code] ?? 0) + 1;
      if (this.opts.refetch && r.last_run_id !== this.run.id && r.entity_type !== "time_entry") missing++;
    }
    return { byEntity: out, entryReasons: reasons, notSeenThisRun: this.run.kind === "dry_run" && this.opts.refetch ? missing : null };
  }

  private async buildPreviewReport() {
    const mappings = await fetchAll<{ entity_type: string; decision: string }>((f, t) =>
      this.db
        .from("clockify_mappings")
        .select("entity_type, decision")
        .eq("workspace_id", this.run.workspace_id)
        .eq("source_workspace_id", this.ws)
        .range(f, t),
    );
    const mapSummary: Record<string, Record<string, number>> = {};
    for (const m of mappings) {
      const e = (mapSummary[m.entity_type] ??= {});
      e[m.decision] = (e[m.decision] ?? 0) + 1;
    }
    return {
      generated_at: new Date(this.now()).toISOString(),
      options: this.opts,
      plan: this.run.counts.plan ?? null,
      capabilities: this.run.counts.capabilities ?? {},
      not_collected: NOT_COLLECTED,
      time_entry_user_errors: this.run.counts.time_entry_user_errors ?? [],
      in_progress: this.cp.inProgress ?? null,
      mappings: mapSummary,
      totals: this.cp.totals ?? emptyTotals(),
      preview: this.cp.preview ?? null,
      reconciliation: this.cp.reportedByUser
        ? { status: "ok", diffs: reconcileByUser(this.cp.collectedByUser ?? {}, this.cp.reportedByUser) }
        : { status: "unavailable", diffs: [] },
      staging: await this.statusCounts(),
      range: { min: this.cp.minStart ?? null, max: this.cp.maxStart ?? null },
    };
  }

  private buildImportReport() {
    return {
      generated_at: new Date(this.now()).toISOString(),
      options: this.opts,
      import: this.cp.importTotals ?? emptyImportTotals(),
    };
  }
}

function add(o: Record<string, number>, k: string, v: number) {
  o[k] = (o[k] ?? 0) + v;
}

function emptyImportTotals(): ImportTotals {
  return {
    inserted: 0,
    updated: 0,
    unchanged: 0,
    failed: 0,
    conflicts: {},
    secondsImported: 0,
    byUser: {},
    byProject: {},
    byMonth: {},
    projectsCreated: 0,
    projectsLinked: 0,
    tasksCreated: 0,
    membersAdded: 0,
    errors: [],
  };
}
