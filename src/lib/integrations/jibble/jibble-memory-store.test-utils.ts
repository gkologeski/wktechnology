// Armazenamento em memória que cumpre o contrato JibbleStore, para testar o motor sem banco.
import type { WorkspaceMember } from "../clockify/clockify-map";
import type { ErpEntry } from "./jibble-reconcile";
import type {
  ApplyResult,
  DuplicateRow,
  JibbleStore,
  LinkRow,
  MappingRow,
  RunRow,
  StagingRow,
} from "./jibble-store";

let seq = 0;
const id = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;

export type ErpRow = Record<string, unknown> & { id: string; table: string };

export class MemoryStore implements JibbleStore {
  staging = new Map<string, StagingRow>();
  mappings = new Map<string, MappingRow>();
  links: LinkRow[] = [];
  duplicates: DuplicateRow[] = [];
  erp: ErpRow[] = [];
  runs = new Map<string, RunRow & Record<string, unknown>>();
  applyCalls = 0;

  constructor(
    public membersList: WorkspaceMember[] = [],
    public targets: {
      client: Array<{ id: string; name: string }>;
      project: Array<{ id: string; name: string }>;
    } = {
      client: [],
      project: [],
    },
  ) {}

  async upsertStaging(_runId: string, rows: Parameters<JibbleStore["upsertStaging"]>[1]) {
    for (const r of rows) {
      const key = `${r.entity_type}|${r.external_id}`;
      const prev = this.staging.get(key);
      this.staging.set(key, { ...prev, ...r, id: prev?.id ?? id(), status: r.status ?? "staged" });
    }
  }
  async stagingPage(
    entity: string,
    o: { personId?: string; offset: number; limit: number; statuses?: string[] },
  ) {
    return [...this.staging.values()]
      .filter((r) => r.entity_type === entity)
      .filter((r) => !o.personId || r.person_external_id === o.personId)
      .filter((r) => !o.statuses || o.statuses.includes(r.status))
      .sort((a, b) => (a.external_id < b.external_id ? -1 : 1))
      .slice(o.offset, o.offset + o.limit);
  }
  async stagingPersonIds(entity: string) {
    return [
      ...new Set(
        [...this.staging.values()]
          .filter((r) => r.entity_type === entity && r.person_external_id)
          .map((r) => r.person_external_id as string),
      ),
    ];
  }
  async setStagingStatus(entity: string, ids: string[], status: string, reason?: string | null) {
    for (const x of ids) {
      const r = this.staging.get(`${entity}|${x}`);
      if (r) Object.assign(r, { status, reason_code: reason ?? null });
    }
  }
  async loadMappings(entity: string) {
    return [...this.mappings.values()].filter((m) => m.entity_type === entity);
  }
  async upsertMappings(rows: MappingRow[]) {
    for (const r of rows) this.mappings.set(`${r.entity_type}|${r.external_id}`, { ...r });
  }
  async loadLinks(entity: string, ids: string[]) {
    const set = new Set(ids);
    return this.links.filter((l) => l.entity_type === entity && set.has(l.external_id));
  }
  async insertLinks(_runId: string, rows: Parameters<JibbleStore["insertLinks"]>[1]) {
    for (const r of rows) {
      if (
        this.links.some(
          (l) =>
            l.entity_type === r.entity_type &&
            l.external_id === r.external_id &&
            l.segment === r.segment,
        )
      )
        continue;
      this.links.push({ ...r, id: id() });
    }
  }
  async linksCreatedByRun(runId: string) {
    return this.links.filter((l) => l.created_run_id === runId);
  }
  async deleteLinks(ids: string[]) {
    const s = new Set(ids);
    this.links = this.links.filter((l) => !s.has(l.id));
  }
  async upsertDuplicates(rows: Parameters<JibbleStore["upsertDuplicates"]>[0]) {
    for (const r of rows) {
      if (
        this.duplicates.some(
          (d) =>
            d.external_id === r.external_id &&
            d.segment === r.segment &&
            d.existing_entry_id === r.existing_entry_id,
        )
      )
        continue;
      this.duplicates.push({ ...r, decision: "pending" });
    }
  }
  async loadDuplicates(ids: string[]) {
    const s = new Set(ids);
    return this.duplicates.filter((d) => s.has(d.external_id));
  }
  async members() {
    return this.membersList;
  }
  async existingMembers(pairs: Array<{ project_id: string; user_id: string }>) {
    const out = new Set<string>();
    for (const p of pairs)
      if (
        this.erp.some(
          (e) =>
            e.table === "project_members" &&
            e.project_id === p.project_id &&
            e.user_id === p.user_id,
        )
      )
        out.add(`${p.project_id}:${p.user_id}`);
    return out;
  }
  async namedTargets(kind: "client" | "project") {
    return this.targets[kind];
  }
  async erpEntries(userId: string, fromIso: string, toIso: string): Promise<ErpEntry[]> {
    return this.erp
      .filter((e) => e.table === "project_time_entries" && e.user_id === userId)
      .filter((e) => String(e.started_at) < toIso && String(e.stopped_at) > fromIso)
      .map((e) => ({
        id: e.id,
        source: (e.source as string) ?? "import",
        external_id: (e.external_id as string) ?? null,
        project_id: (e.project_id as string) ?? null,
        started_at: e.started_at as string,
        stopped_at: e.stopped_at as string,
      }));
  }
  async applyErp(table: string, _op: "insert" | "update", rows: unknown[]): Promise<ApplyResult> {
    this.applyCalls++;
    return (rows as Array<{ _key: string; row: Record<string, unknown> }>).map((r) => {
      const ext = r.row.external_id;
      if (table === "project_time_entries" && this.erp.some((e) => e.external_id === ext))
        return { _key: r._key, error: "duplicate key value violates unique constraint" };
      const rowId = id();
      this.erp.push({
        ...r.row,
        id: rowId,
        table,
        source: table === "project_time_entries" ? "import" : undefined,
      });
      return { _key: r._key, id: rowId };
    });
  }
  async rollback(ids: {
    entries: string[];
    members: string[];
    tasks: string[];
    projects: string[];
  }) {
    const del = (list: string[], table: string, guard: (e: ErpRow) => boolean) => {
      const s = new Set(list);
      const gone = this.erp
        .filter((e) => e.table === table && s.has(e.id) && guard(e))
        .map((e) => e.id);
      this.erp = this.erp.filter((e) => !gone.includes(e.id));
      return gone;
    };
    const entries = del(ids.entries, "project_time_entries", (e) =>
      String(e.external_id ?? "").startsWith("jibble:"),
    );
    const tasks = del(ids.tasks, "project_tasks", (t) => !this.erp.some((e) => e.task_id === t.id));
    const members = del(
      ids.members,
      "project_members",
      (m) =>
        !this.erp.some(
          (e) =>
            e.table === "project_time_entries" &&
            e.project_id === m.project_id &&
            e.user_id === m.user_id,
        ),
    );
    const projects = del(
      ids.projects,
      "projects",
      (p) => !this.erp.some((e) => e.project_id === p.id),
    );
    return { entries, tasks, projects, members };
  }
  async saveRun(runId: string, patch: Record<string, unknown>) {
    const r = this.runs.get(runId);
    if (r) Object.assign(r, patch);
  }
  async isCancelRequested(runId: string) {
    return this.runs.get(runId)?.status === "cancel_requested";
  }
}
