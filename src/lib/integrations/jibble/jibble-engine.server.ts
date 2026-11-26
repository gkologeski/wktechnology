// Motor do importador Jibble: inventário → simulação → gravação em lotes → desfazer.
// Retomável por checkpoint, idempotente pelo vínculo (workspace+provider+org+entidade+id),
// nunca sobrescreve edição do ERP, nunca inventa saída e nunca resolve duplicidade sozinho.
import { nameCandidates, sha256Hex, stableStringify } from "../clockify/clockify-map";
import { epochToIso, erpMinutesForSegment, parseIsoDuration } from "../clockify/clockify-time";
import { JibbleApiError, type JibbleClient } from "./jibble-client";
import { JB_NOT_IMPORTED, planPersonMappings, type JbPerson } from "./jibble-map";
import {
  accumulateInterval,
  emptyJbTotals,
  findCrossSourceDuplicates,
  flattenTimesheetSummary,
  reconcileDays,
  type DayDivergence,
  type JbTotals,
} from "./jibble-reconcile";
import {
  reconstructIntervals,
  segmentInterval,
  type JbInterval,
  type JbTimeEntry,
} from "./jibble-reconstruct";
import {
  COLLECT_SPECS,
  DRY_PHASES,
  IMPORT_PHASES,
  PAGE_SIZE,
  ROLLBACK_PHASES,
  WINDOW_SPECS,
} from "./jibble-specs";
import type {
  DuplicateInput,
  JibbleStore,
  LinkInput,
  MappingRow,
  RunRow,
  StagingInput,
} from "./jibble-store";
import { buildJibbleUrl, monthWindows } from "./jibble-urls";
import type { preserveImportRecords } from "@/lib/projects/imports/import-preservation.server";
import type { preserveJibbleScreenshot } from "./jibble-files.server";

export type JbRunOptions = {
  fromDate: string | null;
  erpStatus: "locked" | "draft";
  billable: boolean;
  maxIntervalHours: number;
};

export function defaultJbOptions(p?: Partial<JbRunOptions>): JbRunOptions {
  return {
    fromDate: p?.fromDate ?? null,
    erpStatus: p?.erpStatus ?? "locked",
    billable: p?.billable ?? false,
    maxIntervalHours: p?.maxIntervalHours ?? 16,
  };
}

type Capability = {
  count: number;
  capability: "ok" | "unavailable" | "rejected";
  status?: number | null;
};

type ImportTotals = {
  inserted: number;
  segmentsSkippedExisting: number;
  matchedExisting: number;
  projectsCreated: number;
  tasksCreated: number;
  membersLinked: number;
  errors: number;
};

export type Checkpoint = {
  skipFetch?: boolean;
  spec?: number;
  window?: number;
  nextUrl?: string | null;
  lastPageHash?: string;
  skip?: number;
  ids?: string[];
  index?: number;
  orgCreatedAt?: string | null;
  orgTimeZone?: string | null;
  inventory?: Record<string, Capability>;
  totals?: JbTotals;
  pending?: Record<string, number>;
  anomalies?: Record<string, number>;
  duplicates?: { exact: number; overlap: number };
  reconcile?: {
    matchedDays: number;
    divergentDays: number;
    daysWithoutTimesheet: number;
    samples: Array<DayDivergence & { personId: string }>;
  };
  importTotals?: ImportTotals;
  rollback?: Record<string, number>;
  retryAt?: number;
  requests?: number;
  retries?: number;
  screenshotFiles?: { preserved: number; pending: number };
};

export type EngineDeps = {
  store: JibbleStore;
  client: JibbleClient;
  now?: () => number;
  budgetMs?: number;
  today?: string;
  /** Production supplies the durable ledger before normalization or validation. */
  preserveRecords?: (input: Parameters<typeof preserveImportRecords>[1]) => Promise<void>;
  preserveScreenshot?: (
    input: Parameters<typeof preserveJibbleScreenshot>[1],
  ) => Promise<{ preserved: boolean }>;
};

class Pause extends Error {}

const ACTIVE_DECISIONS = new Set(["auto", "confirmed"]);

function itemExternalId(item: unknown): string | null {
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;
  const source = item as Record<string, unknown>;
  const id = source.id ?? source.exportId;
  return typeof id === "string" && id.length > 0 && id.length <= 200 ? id.toLowerCase() : null;
}

export function jibbleSourceIssues(entity: string, payload: unknown): string[] {
  const issues: string[] = [];
  if (!itemExternalId(payload)) issues.push("missing_external_id");
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    return [...issues, "invalid_source_record"];
  const item = payload as Record<string, unknown>;
  if (entity === "time_entry") {
    if (typeof item.personId !== "string" || !item.personId) issues.push("unmapped_person");
    if (typeof item.time !== "string" || !Number.isFinite(Date.parse(item.time)))
      issues.push("invalid_time");
  }
  if (entity === "hour_entry") issues.push("manual_adjustment_review");
  return issues;
}

export function jibbleCoverage(
  inventory: Record<string, Capability> | undefined,
  files?: { preserved: number; pending: number },
) {
  const entries = Object.entries(inventory ?? {});
  const gaps: Array<{ entity: string; reason: string; status: number | null }> = entries
    .filter(([, cap]) => cap.capability !== "ok")
    .map(([entity, cap]) => ({ entity, reason: cap.capability, status: cap.status ?? null }));
  for (const entity of [
    "organization",
    ...COLLECT_SPECS.map((spec) => spec.entity),
    ...WINDOW_SPECS.map((spec) => spec.entity),
  ]) {
    if (!inventory?.[entity])
      gaps.push({
        entity,
        reason: "A entidade ainda não foi consultada nesta execução.",
        status: null,
      });
  }
  if (!entries.length)
    gaps.push({
      entity: "inventory",
      reason: "Inventário da origem ainda não comprovado.",
      status: null,
    });
  if (
    (files?.pending ?? 0) > 0 ||
    ((inventory?.screenshot?.count ?? 0) > 0 &&
      (!files || files.preserved < inventory!.screenshot.count))
  )
    gaps.push({
      entity: "screenshot_content",
      reason:
        "Parte do conteúdo das capturas ainda não foi obtida; consulte as pendências de arquivos.",
      status: null,
    });
  return { complete: gaps.length === 0, gaps };
}

function bump(map: Record<string, number>, key: string, n = 1) {
  map[key] = (map[key] ?? 0) + n;
}

export class JibbleEngine {
  private now: () => number;
  private run!: RunRow;
  private cp!: Checkpoint;
  private opts!: JbRunOptions;
  private maps: Record<string, Map<string, MappingRow>> | null = null;
  private names: Map<string, string> | null = null;

  constructor(private deps: EngineDeps) {
    this.now = deps.now ?? (() => Date.now());
  }

  private phases(): readonly string[] {
    return this.run.kind === "dry_run"
      ? DRY_PHASES
      : this.run.kind === "import"
        ? IMPORT_PHASES
        : ROLLBACK_PHASES;
  }

  private nextPhase() {
    const list = this.phases();
    this.run.phase = list[list.indexOf(this.run.phase) + 1] ?? "done";
    for (const k of ["spec", "window", "nextUrl", "lastPageHash", "skip", "ids", "index"] as const)
      delete this.cp[k];
  }

  private async save(extra: Partial<RunRow> & Record<string, unknown> = {}) {
    await this.deps.store.saveRun(this.run.id, {
      phase: this.run.phase,
      checkpoint: this.cp as Record<string, unknown>,
      heartbeat_at: new Date(this.now()).toISOString(),
      ...extra,
    });
  }

  /** Avança até o orçamento de tempo acabar. Erros de API viram pausa/falha legível. */
  async advance(run: RunRow): Promise<{ status: string; phase: string }> {
    this.run = { ...run };
    this.cp = { ...(run.checkpoint as Checkpoint) };
    this.opts = defaultJbOptions(run.options as Partial<JbRunOptions>);
    const deadline = this.now() + (this.deps.budgetMs ?? 18_000);
    if (this.cp.retryAt && this.now() < this.cp.retryAt)
      return { status: run.status, phase: run.phase };
    delete this.cp.retryAt;
    if (run.status === "queued")
      await this.deps.store.saveRun(run.id, {
        status: "running",
        started_at: new Date(this.now()).toISOString(),
      });
    try {
      while (this.now() < deadline) {
        if (await this.deps.store.isCancelRequested(run.id)) {
          await this.save({ status: "cancelled", finished_at: new Date(this.now()).toISOString() });
          return { status: "cancelled", phase: this.run.phase };
        }
        if (this.run.phase === "done") {
          await this.save({
            status: "completed",
            finished_at: new Date(this.now()).toISOString(),
            report: this.buildReport(),
            counts: this.counts(),
          });
          return { status: "completed", phase: "done" };
        }
        await this.step();
        this.cp.requests = this.deps.client.requests;
        this.cp.retries = this.deps.client.retries;
        await this.save({ counts: this.counts() });
      }
      return { status: "running", phase: this.run.phase };
    } catch (e) {
      if (e instanceof JibbleApiError && ["rate_limited", "network", "server"].includes(e.code)) {
        this.cp.retryAt = e.retryAt ?? this.now() + 30_000;
        await this.save({ error: e.message });
        return { status: "running", phase: this.run.phase };
      }
      if (e instanceof Pause) return { status: "running", phase: this.run.phase };
      const msg = e instanceof Error ? e.message.slice(0, 300) : "Falha desconhecida.";
      await this.save({
        status: "failed",
        error: msg,
        finished_at: new Date(this.now()).toISOString(),
      });
      return { status: "failed", phase: this.run.phase };
    }
  }

  private counts() {
    return {
      coverage: jibbleCoverage(this.cp.inventory, this.cp.screenshotFiles),
      screenshotFiles: this.cp.screenshotFiles ?? null,
      inventory: this.cp.inventory ?? {},
      totals: this.cp.totals ?? null,
      pending: this.cp.pending ?? {},
      importTotals: this.cp.importTotals ?? null,
      requests: this.cp.requests ?? 0,
      retries: this.cp.retries ?? 0,
    };
  }

  private buildReport() {
    const coverage = jibbleCoverage(this.cp.inventory, this.cp.screenshotFiles);
    return {
      coverage,
      screenshotFiles: this.cp.screenshotFiles ?? null,
      inventory: this.cp.inventory ?? {},
      totals: this.cp.totals ?? emptyJbTotals(),
      pending: this.cp.pending ?? {},
      anomalies: this.cp.anomalies ?? {},
      duplicates: this.cp.duplicates ?? { exact: 0, overlap: 0 },
      reconcile: this.cp.reconcile ?? null,
      importTotals: this.cp.importTotals ?? null,
      rollback: this.cp.rollback ?? null,
      notImported: [
        ...JB_NOT_IMPORTED,
        ...(coverage.gaps.some(
          ({ entity }) => entity === "screenshot" || entity === "screenshot_content",
        )
          ? [
              {
                entity: "Arquivos de capturas de tela",
                reason:
                  "Há capturas sem conteúdo recebido. As disponíveis são preservadas em armazenamento privado; confira as pendências de acesso ou transferência. Links temporários não são guardados.",
              },
            ]
          : []),
      ],
      requests: this.cp.requests ?? 0,
      retries: this.cp.retries ?? 0,
    };
  }

  private async step() {
    switch (this.run.phase) {
      case "start":
        // Recalcular prévia: reaproveita o staging já lido, sem nova leitura do Jibble.
        if (this.run.kind === "dry_run" && this.cp.skipFetch) {
          this.run.phase = "mappings";
          return;
        }
        return this.nextPhase();
      case "organization":
        return this.organization();
      case "collect":
        return this.collect();
      case "windows":
        return this.windows();
      case "mappings":
        return this.mappings();
      case "intervals":
        return this.intervals(false);
      case "projects_write":
        return this.projectsWrite();
      case "intervals_write":
        return this.intervals(true);
      case "rollback":
        return this.rollback();
      case "report":
        return this.nextPhase();
      default:
        this.run.phase = "done";
    }
  }

  // ------------------------------------------------------------ coleta
  private async stage(
    entity: string,
    items: Array<Record<string, unknown>>,
    extra?: (i: Record<string, unknown>) => Partial<StagingInput>,
    preserve = true,
    observationPrefix?: string,
  ) {
    const rows: StagingInput[] = [];
    const records: Parameters<typeof preserveImportRecords>[1]["records"] = [];
    for (const [index, item] of items.entries()) {
      const payload = entity === "screenshot" ? { ...item, url: undefined } : item;
      const object = item && typeof item === "object" && !Array.isArray(item) ? item : {};
      const e = extra?.(object) ?? {};
      const external_id = e.external_id ?? itemExternalId(item);
      const issues = jibbleSourceIssues(entity, item).filter(
        (reason) => reason !== "missing_external_id" || !external_id,
      );
      records.push({
        entity,
        externalId: external_id,
        payload: item,
        status: issues.length ? "pending" : "received",
        issues,
        sourcePersonId: e.person_external_id ?? null,
        observationKey: `${observationPrefix ?? `${this.run.phase}:${this.cp.spec ?? 0}:${this.cp.window ?? 0}:${this.cp.skip ?? 0}`}:${index}`,
      });
      if (!external_id) continue;
      rows.push({
        entity_type: entity,
        external_id,
        person_external_id: e.person_external_id ?? null,
        period: e.period ?? null,
        payload,
        payload_hash: await sha256Hex(stableStringify(payload)),
        status: "staged",
      });
    }
    // Originals are persisted before canonical staging. A validation failure cannot erase evidence.
    if (preserve)
      await this.deps.preserveRecords?.({
        workspaceId: this.run.workspace_id,
        provider: "jibble",
        sourceId: this.run.source_org_id,
        runId: this.run.id,
        records,
      });
    if (entity === "screenshot") {
      const files = (this.cp.screenshotFiles ??= { preserved: 0, pending: 0 });
      for (const record of records) {
        const result = await this.deps.preserveScreenshot?.({
          workspaceId: this.run.workspace_id,
          sourceId: this.run.source_org_id,
          runId: this.run.id,
          payload: record.payload,
          observationKey: record.observationKey,
        });
        if (result?.preserved) files.preserved++;
        else files.pending++;
      }
    }
    if (rows.length) await this.deps.store.upsertStaging(this.run.id, rows);
    const inv = (this.cp.inventory ??= {});
    inv[entity] ??= { count: 0, capability: "ok" };
    inv[entity].count += rows.length;
  }

  private markUnavailable(entity: string, e: JibbleApiError) {
    const inv = (this.cp.inventory ??= {});
    inv[entity] = {
      count: inv[entity]?.count ?? 0,
      capability: e.code === "bad_request" ? "rejected" : "unavailable",
      status: e.status,
    };
  }

  private async organization() {
    const url = buildJibbleUrl("workspace", "/v1/Organizations");
    const { items } = await this.deps.client.page<Record<string, unknown>>(url);
    const org = items.find(
      (o) => String(o.id).toLowerCase() === this.run.source_org_id.toLowerCase(),
    );
    if (!org) throw new Error("A organização autenticada não corresponde à origem escolhida.");
    await this.stage("organization", [org]);
    this.cp.orgCreatedAt = (org.createdAt as string | undefined) ?? null;
    this.cp.orgTimeZone = (org["ICultureSettings/TimeZone"] as string | undefined) ?? null;
    this.nextPhase();
  }

  /** Uma página; devolve true quando a coleção acabou. */
  private async pageOnce(
    entity: string,
    firstUrl: string,
    paged: boolean,
    extra?: (i: Record<string, unknown>) => Partial<StagingInput>,
    flatten?: (items: Array<Record<string, unknown>>) => Array<Record<string, unknown>>,
    pageSize = PAGE_SIZE,
  ): Promise<boolean> {
    const url = this.cp.nextUrl ?? firstUrl;
    try {
      const page = await this.deps.client.page<Record<string, unknown>>(url);
      const observationPrefix = `${entity}:${await sha256Hex(url)}`;
      if (flatten) {
        await this.deps.preserveRecords?.({
          workspaceId: this.run.workspace_id,
          provider: "jibble",
          sourceId: this.run.source_org_id,
          runId: this.run.id,
          records: page.items.map((payload, index) => ({
            entity: "timesheet_summary",
            payload,
            status: "received",
            observationKey: `${observationPrefix}:${index}`,
            externalId:
              typeof payload?.personId === "string"
                ? `${payload.personId}:${new URL(firstUrl).searchParams.get("date") ?? ""}`
                : null,
            sourcePersonId: typeof payload?.personId === "string" ? payload.personId : null,
          })),
        });
      }
      await this.stage(
        entity,
        flatten ? flatten(page.items) : page.items,
        extra,
        !flatten,
        observationPrefix,
      );
      if (!paged) return true;
      const pageHash = await sha256Hex(stableStringify(page.items));
      if (page.items.length && this.cp.lastPageHash === pageHash)
        throw new Error(
          "O Jibble repetiu uma página sem confirmar o fim. Os registros estão preservados e a cobertura está incompleta.",
        );
      this.cp.lastPageHash = pageHash;
      if (page.nextUrl) {
        if (page.nextUrl === url)
          throw new Error(
            "O Jibble repetiu o link de paginação. Os registros estão preservados, mas a cobertura não foi concluída.",
          );
        this.cp.nextUrl = page.nextUrl;
        this.cp.skip = (this.cp.skip ?? 0) + page.items.length;
        return false;
      }
      this.cp.nextUrl = null;
      if (page.count !== null && page.count > (this.cp.skip ?? 0) + page.items.length) {
        if (!page.items.length)
          throw new Error(
            "O Jibble informou mais registros, mas retornou uma página vazia. A cobertura está incompleta.",
          );
        this.cp.skip = (this.cp.skip ?? 0) + page.items.length;
        return false;
      }
      if (page.items.length >= pageSize) {
        this.cp.skip = (this.cp.skip ?? 0) + pageSize;
        return false;
      }
      return true;
    } catch (e) {
      if (
        e instanceof JibbleApiError &&
        ["bad_request", "forbidden", "not_found"].includes(e.code)
      ) {
        this.markUnavailable(entity, e);
        return true;
      }
      throw e;
    }
  }

  private pagedQuery(paged: boolean, pageSize = PAGE_SIZE) {
    return paged
      ? { $top: String(pageSize), $skip: String(this.cp.skip ?? 0), $count: "true" }
      : {};
  }

  private async collect() {
    const spec = COLLECT_SPECS[this.cp.spec ?? 0];
    if (!spec) return this.nextPhase();
    const url = buildJibbleUrl(spec.service, spec.path, {
      ...spec.query,
      ...this.pagedQuery(spec.paged, spec.entity === "screenshot" ? 1 : PAGE_SIZE),
    });
    const extra = (item: Record<string, unknown>): Partial<StagingInput> => ({
      person_external_id:
        spec.entity === "person"
          ? itemExternalId(item)
          : spec.entity === "screenshot"
            ? itemExternalId(item.person)
            : typeof item.personId === "string"
              ? item.personId.toLowerCase()
              : null,
      period:
        typeof item.belongsToDate === "string"
          ? item.belongsToDate
          : typeof item.date === "string"
            ? item.date
            : null,
    });
    const done = await this.pageOnce(
      spec.entity,
      url,
      spec.paged,
      extra,
      undefined,
      spec.entity === "screenshot" ? 1 : PAGE_SIZE,
    );
    if (done) {
      this.cp.spec = (this.cp.spec ?? 0) + 1;
      this.cp.skip = 0;
      this.cp.nextUrl = null;
      delete this.cp.lastPageHash;
    }
  }

  private async windows() {
    const spec = WINDOW_SPECS[this.cp.spec ?? 0];
    if (!spec) return this.nextPhase();
    const from = (this.opts.fromDate ?? this.cp.orgCreatedAt ?? "1970-01-01").slice(0, 10);
    const list = monthWindows(
      from,
      this.deps.today ?? new Date(this.now()).toISOString().slice(0, 10),
    );
    const w = list[this.cp.window ?? 0];
    const inv = this.cp.inventory?.[spec.entity];
    if (!w || (inv && inv.capability !== "ok")) {
      this.cp.spec = (this.cp.spec ?? 0) + 1;
      this.cp.window = 0;
      this.cp.skip = 0;
      this.cp.nextUrl = null;
      delete this.cp.lastPageHash;
      return;
    }
    const url = buildJibbleUrl(spec.service, spec.path, {
      ...spec.query(w.from, w.to),
      ...this.pagedQuery(spec.paged, spec.entity === "screenshot" ? 1 : PAGE_SIZE),
    });
    const str = (v: unknown) => (typeof v === "string" ? v : null);
    const extra = (i: Record<string, unknown>): Partial<StagingInput> => {
      if (spec.entity === "timesheet_day")
        return {
          external_id: `${str(i.personId)}:${str(i.date)}`.toLowerCase(),
          person_external_id: str(i.personId)?.toLowerCase() ?? null,
          period: str(i.date),
        };
      if (spec.entity === "screenshot")
        return {
          person_external_id: str((i.person as { id?: string } | null)?.id)?.toLowerCase() ?? null,
          period: str(i.time)?.slice(0, 10) ?? null,
        };
      return {
        person_external_id: str(i.personId)?.toLowerCase() ?? null,
        period: str(i.belongsToDate) ?? str(i.date),
      };
    };
    const flatten =
      spec.entity === "timesheet_day"
        ? (rows: Array<Record<string, unknown>>) =>
            rows.flatMap((r) =>
              ((r.daily as Array<Record<string, unknown>> | undefined) ?? []).map((d) => ({
                ...d,
                personId: r.personId,
                person: r.person ?? null,
              })),
            )
        : undefined;
    const done = await this.pageOnce(
      spec.entity,
      url,
      spec.paged,
      extra,
      flatten,
      spec.entity === "screenshot" ? 1 : PAGE_SIZE,
    );
    if (done) {
      this.cp.window = (this.cp.window ?? 0) + 1;
      this.cp.skip = 0;
      this.cp.nextUrl = null;
      delete this.cp.lastPageHash;
    }
  }

  // ------------------------------------------------------------ mapeamentos
  private async allStaging(entity: string, personId?: string) {
    const out: Array<{ external_id: string; payload: Record<string, unknown> }> = [];
    for (let offset = 0; ; offset += 1000) {
      const page = await this.deps.store.stagingPage(entity, { personId, offset, limit: 1000 });
      out.push(
        ...page.map((r) => ({
          external_id: r.external_id,
          payload: r.payload as Record<string, unknown>,
        })),
      );
      if (page.length < 1000) break;
    }
    return out;
  }

  private async mappings() {
    const store = this.deps.store;
    const people = (await this.allStaging("person")).map((r) => ({
      ...(r.payload as JbPerson),
      id: r.external_id,
    }));
    const plans = planPersonMappings(
      people,
      await store.members(),
      await store.loadMappings("person"),
    );
    await store.upsertMappings(
      plans.map((p) => ({
        entity_type: "person",
        external_id: p.external_id,
        label: p.label,
        target_id: p.target_id,
        method: p.method,
        decision: p.decision,
        candidates: p.candidates,
        note: p.note,
      })),
    );
    for (const kind of ["client", "project"] as const) {
      const prev = new Map((await store.loadMappings(kind)).map((m) => [m.external_id, m]));
      const staged = await this.allStaging(kind);
      const targets = await store.namedTargets(
        kind,
        staged.map((r) => String(r.payload.name ?? "")).filter(Boolean),
      );
      const rows: MappingRow[] = [];
      for (const r of staged) {
        const label = String(r.payload.name ?? r.external_id);
        const p = prev.get(r.external_id);
        if (p && p.decision !== "pending") continue;
        rows.push({
          entity_type: kind,
          external_id: r.external_id,
          label,
          target_id: null,
          method: "none",
          decision: "pending",
          candidates: nameCandidates(label, targets),
          note: null,
        });
      }
      if (rows.length) await store.upsertMappings(rows);
    }
    this.nextPhase();
  }

  private async loadMaps() {
    if (this.maps) return this.maps;
    const out: Record<string, Map<string, MappingRow>> = {};
    for (const k of ["person", "project", "client"])
      out[k] = new Map((await this.deps.store.loadMappings(k)).map((m) => [m.external_id, m]));
    this.maps = out;
    const names = new Map<string, string>();
    for (const a of await this.allStaging("activity"))
      names.set(a.external_id, String(a.payload.name ?? "Atividade"));
    this.names = names;
    return out;
  }

  // ------------------------------------------------------------ gravação de projetos
  private async projectsWrite() {
    const maps = await this.loadMaps();
    const toCreate = [...maps.project.values()].filter((m) => m.decision === "create");
    const existing = new Set(
      (
        await this.deps.store.loadLinks(
          "project",
          toCreate.map((m) => m.external_id),
        )
      ).map((l) => l.external_id),
    );
    const projects = new Map(
      (await this.allStaging("project")).map((p) => [p.external_id, p.payload]),
    );
    const it = (this.cp.importTotals ??= {
      inserted: 0,
      segmentsSkippedExisting: 0,
      matchedExisting: 0,
      projectsCreated: 0,
      tasksCreated: 0,
      membersLinked: 0,
      errors: 0,
    });
    const rows = toCreate
      .filter((m) => !existing.has(m.external_id))
      .map((m) => {
        const p = projects.get(m.external_id) ?? {};
        const client = (p.client as { id?: string } | null)?.id?.toLowerCase();
        return {
          _key: m.external_id,
          row: {
            name: String(p.name ?? m.label ?? "Projeto Jibble"),
            description: null,
            status: String(p.status ?? "").toLowerCase() === "archived" ? "done" : "active",
            owner_id: this.run.requested_by,
            metadata: {
              jibble: {
                id: m.external_id,
                code: p.code ?? null,
                status: p.status ?? null,
                client_id: client ?? null,
                company_id: client ? (maps.client.get(client)?.target_id ?? null) : null,
              },
            },
          },
        };
      });
    if (rows.length) {
      const res = await this.deps.store.applyErp("projects", "insert", rows);
      const links: LinkInput[] = [];
      for (const r of res) {
        if (!r.id) {
          it.errors++;
          continue;
        }
        it.projectsCreated++;
        links.push(this.link("project", r._key, 0, "projects", r.id, "created"));
      }
      await this.deps.store.insertLinks(this.run.id, links);
    }
    this.nextPhase();
  }

  private link(
    entity: string,
    externalId: string,
    segment: number,
    table: string,
    targetId: string,
    kind: "created" | "matched_existing",
    extra: Partial<LinkInput> = {},
  ): LinkInput {
    return {
      entity_type: entity,
      external_id: externalId,
      segment,
      target_table: table,
      target_id: targetId,
      link_kind: kind,
      source_hash: extra.source_hash ?? "",
      created_run_id: this.run.id,
      ...extra,
    };
  }

  // ------------------------------------------------------------ intervalos por pessoa
  private async intervals(write: boolean) {
    if (!this.cp.ids) {
      this.cp.ids = (await this.deps.store.stagingPersonIds("time_entry")).sort();
      this.cp.index = 0;
      if (!write) {
        this.cp.totals = emptyJbTotals();
        this.cp.pending = {};
        this.cp.anomalies = {};
        this.cp.duplicates = { exact: 0, overlap: 0 };
        this.cp.reconcile = {
          matchedDays: 0,
          divergentDays: 0,
          daysWithoutTimesheet: 0,
          samples: [],
        };
      } else {
        this.cp.pending = {};
        this.cp.importTotals ??= {
          inserted: 0,
          segmentsSkippedExisting: 0,
          matchedExisting: 0,
          projectsCreated: 0,
          tasksCreated: 0,
          membersLinked: 0,
          errors: 0,
        };
      }
      return;
    }
    const personId = this.cp.ids[this.cp.index ?? 0];
    if (!personId) return this.nextPhase();
    await this.processPerson(personId, write);
    this.cp.index = (this.cp.index ?? 0) + 1;
  }

  private async processPerson(personId: string, write: boolean) {
    const store = this.deps.store;
    const maps = await this.loadMaps();
    const events = (await this.allStaging("time_entry", personId)).map((r) => ({
      ...(r.payload as JbTimeEntry),
      id: r.external_id,
    }));
    const person = (await this.allStaging("person", personId))[0]?.payload as JbPerson | undefined;
    const tz = person?.timeZone ?? this.cp.orgTimeZone ?? null;
    const { intervals, anomalies } = reconstructIntervals(personId, events, {
      maxSeconds: this.opts.maxIntervalHours * 3600,
    });
    const byReason = new Map<string, string[]>();
    for (const a of anomalies) {
      const ids = byReason.get(a.reason) ?? [];
      ids.push(a.eventId);
      byReason.set(a.reason, ids);
    }
    for (const [reason, ids] of byReason) {
      await store.setStagingStatus("time_entry", ids, "pending_review", reason);
      if (!write) bump(this.cp.anomalies!, reason, ids.length);
    }

    const pm = maps.person.get(personId);
    const userTarget = pm && ACTIVE_DECISIONS.has(pm.decision) ? pm.target_id : null;
    const projectLinks = new Map(
      (
        await store.loadLinks("project", [
          ...new Set(intervals.map((i) => i.projectId ?? "").filter(Boolean)),
        ])
      ).map((l) => [l.external_id, l.target_id]),
    );
    const projectTarget = (jbProject: string | null): string | null | "create" => {
      if (!jbProject) return null;
      const m = maps.project.get(jbProject);
      if (!m) return null;
      if (ACTIVE_DECISIONS.has(m.decision)) return m.target_id;
      if (m.decision === "create") return projectLinks.get(jbProject) ?? (write ? null : "create");
      return null;
    };

    const ids = intervals.map((i) => i.id);
    const links = await store.loadLinks("interval", ids);
    const linkBy = new Map<string, typeof links>();
    for (const l of links) linkBy.set(l.external_id, [...(linkBy.get(l.external_id) ?? []), l]);
    const decided = await store.loadDuplicates(ids);
    const work = intervals.filter((i) => i.kind === "work" && i.endUtc != null);
    const entries =
      userTarget && work.length
        ? await store.erpEntries(
            userTarget,
            epochToIso(Math.min(...work.map((i) => i.startUtc)) - 1),
            epochToIso(Math.max(...work.map((i) => i.endUtc!)) + 1),
          )
        : [];

    const staged: StagingInput[] = [];
    const newDups: DuplicateInput[] = [];
    const inserts: Array<{
      _key: string;
      row: Record<string, unknown>;
      iv: JbInterval;
      seg: number;
      hash: string;
      meta: Partial<LinkInput>;
    }> = [];
    const matched: LinkInput[] = [];

    for (const iv of intervals) {
      if (!write) accumulateInterval(this.cp.totals!, iv);
      const segs = segmentInterval(iv, tz);
      const hash = await sha256Hex(stableStringify(iv));
      let status: string = iv.status === "open" ? "staged" : iv.status;
      let reason: string | null = iv.reasons[0] ?? null;
      const target = projectTarget(iv.projectId);
      if (iv.kind === "break") {
        status = "skipped";
        reason = iv.paid ? "paid_break" : "break";
      } else if (iv.status === "ready") {
        const prev = linkBy.get(iv.id) ?? [];
        if (!userTarget) [status, reason] = ["pending_review", "unmapped_person"];
        else if (!target) [status, reason] = ["pending_review", "project_not_mapped"];
        else if (prev.length && prev.every((l) => l.source_hash === hash))
          [status, reason] = ["imported", null];
        else if (prev.length) [status, reason] = ["pending_review", "source_changed"];
        else {
          let blocked = false;
          for (const seg of segs) {
            const hits = findCrossSourceDuplicates(
              seg,
              target === "create" ? null : target,
              entries,
            );
            const segDecisions = decided.filter(
              (d) => d.external_id === iv.id && d.segment === seg.index,
            );
            for (const h of hits) {
              if (!segDecisions.some((d) => d.existing_entry_id === h.entryId)) {
                newDups.push({
                  external_id: iv.id,
                  segment: seg.index,
                  existing_entry_id: h.entryId,
                  existing_source: h.source,
                  existing_external_id: h.externalId,
                  overlap_seconds: h.overlapSeconds,
                  kind: h.kind,
                });
                if (!write) this.cp.duplicates![h.kind]++;
              }
            }
            const pendingHit = hits.some((h) => {
              const d = segDecisions.find((x) => x.existing_entry_id === h.entryId);
              return !d || d.decision === "pending";
            });
            const same = segDecisions.find((d) => d.decision === "same_event");
            if (pendingHit) blocked = true;
            else if (write && same)
              matched.push(
                this.link(
                  "interval",
                  iv.id,
                  seg.index,
                  "project_time_entries",
                  same.existing_entry_id,
                  "matched_existing",
                  {
                    source_hash: hash,
                    meta: { provenance: [same.existing_source, "jibble"] },
                  },
                ),
              );
            else if (write && target !== "create")
              inserts.push({
                _key: `${iv.id}:${seg.index}`,
                iv,
                seg: seg.index,
                hash,
                meta: {
                  source_seconds: seg.seconds,
                  source_start_utc: epochToIso(seg.startUtc),
                  source_end_utc: epochToIso(seg.endUtc),
                  source_offset: iv.startOffset,
                  local_date: seg.localDate,
                },
                row: {
                  project_id: target,
                  task_id: null,
                  user_id: userTarget,
                  entry_date: seg.localDate,
                  start_time: seg.dstMismatch ? null : seg.startTime,
                  end_time: seg.dstMismatch ? null : seg.endTime,
                  duration_minutes: erpMinutesForSegment(seg),
                  description: iv.note,
                  billable: this.opts.billable,
                  hourly_rate: null,
                  external_id: `jibble:${iv.id}:${seg.index}`,
                  status: this.opts.erpStatus,
                  created_by: this.run.requested_by,
                  started_at: epochToIso(seg.startUtc),
                  stopped_at: epochToIso(seg.endUtc),
                },
              });
          }
          if (blocked) [status, reason] = ["pending_review", "cross_source_duplicate"];
          else status = write ? "imported" : "ready";
        }
      }
      if (status === "pending_review" || status === "staged")
        bump(this.cp.pending!, reason ?? "outro");
      staged.push({
        entity_type: "interval",
        external_id: iv.id,
        person_external_id: personId,
        period: iv.belongsToDate,
        payload: { ...iv, timeZone: tz, segments: segs.map((s) => ({ ...s })) },
        payload_hash: hash,
        status,
        reason_code: reason,
      });
    }

    if (newDups.length) await store.upsertDuplicates(newDups);
    if (write) {
      await this.attachTasks(inserts);
      await this.writeInserts(inserts, staged);
      if (matched.length) {
        await store.insertLinks(this.run.id, matched);
        this.cp.importTotals!.matchedExisting += matched.length;
      }
    }
    if (staged.length) await store.upsertStaging(this.run.id, staged);
    // The unified queue reads originals, not reconstructed intervals. Carry operational
    // review reasons back to source events without changing the evidence or inventing hours.
    const pendingSources = new Map<string, string>();
    for (const [reason, eventIds] of byReason)
      for (const eventId of eventIds) pendingSources.set(eventId, reason);
    const readySources = new Set<string>();
    for (const row of staged) {
      const payload =
        row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
          ? (row.payload as Record<string, unknown>)
          : {};
      const eventIds = [payload.startEventId, payload.endEventId].filter(
        (id): id is string => typeof id === "string" && !!id,
      );
      if (row.status === "pending_review" || (row.status === "staged" && row.reason_code)) {
        for (const eventId of eventIds)
          if (!pendingSources.has(eventId))
            pendingSources.set(eventId, row.reason_code ?? "awaiting_review");
      } else if (row.status && ["ready", "imported", "skipped"].includes(row.status)) {
        for (const eventId of eventIds) readySources.add(eventId);
      }
    }
    const sourceReasons = new Map<string, string[]>();
    for (const [eventId, reason] of pendingSources) {
      const ids = sourceReasons.get(reason) ?? [];
      ids.push(eventId);
      sourceReasons.set(reason, ids);
    }
    for (const [reason, eventIds] of sourceReasons)
      await store.setStagingStatus("time_entry", eventIds, "pending_review", reason);
    const readyIds = [...readySources].filter((eventId) => !pendingSources.has(eventId));
    if (readyIds.length) await store.setStagingStatus("time_entry", readyIds, "ready", null);
    if (!write) await this.reconcilePerson(personId, intervals);
  }

  /** Atividade do Jibble → tarefa no projeto (criada uma vez, vínculo idempotente). */
  private async attachTasks(inserts: Array<{ iv: JbInterval; row: Record<string, unknown> }>) {
    const store = this.deps.store;
    const pairs = new Map<string, { project: string; activity: string }>();
    for (const i of inserts)
      if (i.iv.activityId && i.iv.projectId)
        pairs.set(`${i.iv.projectId}:${i.iv.activityId}`, {
          project: String(i.row.project_id),
          activity: i.iv.activityId,
        });
    if (!pairs.size) return;
    const have = new Map(
      (await store.loadLinks("task", [...pairs.keys()])).map((l) => [l.external_id, l.target_id]),
    );
    const missing = [...pairs.entries()].filter(([k]) => !have.has(k));
    if (missing.length) {
      const res = await store.applyErp(
        "project_tasks",
        "insert",
        missing.map(([k, v]) => ({
          _key: k,
          row: {
            project_id: v.project,
            title: this.names?.get(v.activity) ?? "Atividade do Jibble",
            status: "todo",
          },
        })),
      );
      const links: LinkInput[] = [];
      for (const r of res)
        if (r.id) {
          have.set(r._key, r.id);
          links.push(this.link("task", r._key, 0, "project_tasks", r.id, "created"));
          this.cp.importTotals!.tasksCreated++;
        } else this.cp.importTotals!.errors++;
      await store.insertLinks(this.run.id, links);
    }
    for (const i of inserts)
      if (i.iv.activityId && i.iv.projectId)
        i.row.task_id = have.get(`${i.iv.projectId}:${i.iv.activityId}`) ?? null;
  }

  private async writeInserts(
    inserts: Array<{
      _key: string;
      row: Record<string, unknown>;
      iv: JbInterval;
      seg: number;
      hash: string;
      meta: Partial<LinkInput>;
    }>,
    staged: StagingInput[],
  ) {
    if (!inserts.length) return;
    const store = this.deps.store;
    const it = this.cp.importTotals!;
    // Membro do projeto: cria só quem ainda não é membro; vínculo "created" só para esses,
    // então o desfazer nunca remove um membro que já existia.
    const pairs = new Map<string, { project_id: string; user_id: string }>();
    for (const i of inserts)
      pairs.set(`${i.row.project_id}:${i.row.user_id}`, {
        project_id: String(i.row.project_id),
        user_id: String(i.row.user_id),
      });
    const linked = new Set(
      (await store.loadLinks("member", [...pairs.keys()])).map((l) => l.external_id),
    );
    const already = await store.existingMembers([...pairs.values()]);
    const missing = [...pairs.entries()].filter(([k]) => !linked.has(k) && !already.has(k));
    if (missing.length) {
      const res = await store.applyErp(
        "project_members",
        "insert",
        missing.map(([k, v]) => ({ _key: k, row: { ...v, role_in_project: "contributor" } })),
      );
      await store.insertLinks(
        this.run.id,
        res
          .filter((r) => r.id)
          .map((r) => this.link("member", r._key, 0, "project_members", r.id!, "created")),
      );
      it.membersLinked += res.filter((r) => r.id).length;
    }
    const res = await store.applyErp(
      "project_time_entries",
      "insert",
      inserts.map((i) => ({ _key: i._key, row: i.row })),
    );
    const byKey = new Map(inserts.map((i) => [i._key, i]));
    const links: LinkInput[] = [];
    const failed = new Map<string, string>();
    for (const r of res) {
      const src = byKey.get(r._key)!;
      if (r.id) {
        it.inserted++;
        links.push(
          this.link("interval", src.iv.id, src.seg, "project_time_entries", r.id, "created", {
            ...src.meta,
            source_hash: src.hash,
            imported_snapshot: { ...src.row },
          }),
        );
      } else {
        it.errors++;
        failed.set(src.iv.id, (r.error ?? "").slice(0, 160));
      }
    }
    await store.insertLinks(this.run.id, links);
    for (const s of staged)
      if (failed.has(s.external_id)) {
        s.status = "pending_review";
        s.reason_code = "write_error";
        s.reason_detail = failed.get(s.external_id) ?? null;
        bump(this.cp.pending!, "write_error");
      }
  }

  private async reconcilePerson(personId: string, intervals: JbInterval[]) {
    const he = (await this.allStaging("hour_entry", personId))
      .filter((h) => String(h.payload.status ?? "Active").toLowerCase() !== "archived")
      .map((h) => ({
        date: String(h.payload.date ?? ""),
        seconds: parseIsoDuration(h.payload.duration as string) ?? 0,
      }));
    const ts = flattenTimesheetSummary([
      {
        personId,
        daily: (await this.allStaging("timesheet_day", personId)).map(
          (t) => t.payload as { date?: string; tracked?: string },
        ),
      },
    ]);
    const r = reconcileDays(intervals, he, ts);
    const rc = this.cp.reconcile!;
    rc.matchedDays += r.matchedDays;
    rc.divergentDays += r.divergences.length;
    rc.daysWithoutTimesheet += r.daysWithoutTimesheet;
    for (const d of r.divergences) if (rc.samples.length < 100) rc.samples.push({ ...d, personId });
  }

  // ------------------------------------------------------------ desfazer
  private async rollback() {
    const store = this.deps.store;
    if (!this.run.target_run_id) throw new Error("Execução alvo ausente.");
    const links = (await store.linksCreatedByRun(this.run.target_run_id)).filter(
      (l) => l.link_kind === "created",
    );
    const pick = (t: string) => links.filter((l) => l.target_table === t).map((l) => l.target_id);
    const deleted = await store.rollback({
      entries: pick("project_time_entries"),
      members: pick("project_members"),
      tasks: pick("project_tasks"),
      projects: pick("projects"),
    });
    const gone = new Set(Object.values(deleted).flat());
    const removed = links.filter((l) => gone.has(l.target_id));
    await store.deleteLinks(removed.map((l) => l.id));
    const intervals = [
      ...new Set(removed.filter((l) => l.entity_type === "interval").map((l) => l.external_id)),
    ];
    if (intervals.length) await store.setStagingStatus("interval", intervals, "ready", null);
    this.cp.rollback = Object.fromEntries(Object.entries(deleted).map(([k, v]) => [k, v.length]));
    this.cp.rollback.kept = links.length - removed.length;
    this.nextPhase();
  }
}
