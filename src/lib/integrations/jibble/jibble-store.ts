// Contrato de armazenamento do motor Jibble. O motor só fala com esta interface: em produção
// `jibble-store.server.ts` (cliente privilegiado, sempre filtrado por workspace + provedor +
// organização), nos testes um armazenamento em memória.
import type { WorkspaceMember } from "../clockify/clockify-map";
import type { ErpEntry } from "./jibble-reconcile";

export type StagingInput = {
  entity_type: string;
  external_id: string;
  person_external_id?: string | null;
  period?: string | null;
  payload: unknown;
  payload_hash: string;
  status?: string;
  reason_code?: string | null;
  reason_detail?: string | null;
};

export type StagingRow = StagingInput & { id: string; status: string };

export type MappingRow = {
  entity_type: string;
  external_id: string;
  label: string | null;
  target_id: string | null;
  method: string;
  decision: string;
  candidates: unknown[];
  note: string | null;
};

export type LinkRow = {
  id: string;
  entity_type: string;
  external_id: string;
  segment: number;
  target_table: string;
  target_id: string;
  link_kind: "created" | "matched_existing";
  source_hash: string;
  created_run_id: string | null;
};

export type LinkInput = Omit<LinkRow, "id"> & {
  source_seconds?: number | null;
  source_start_utc?: string | null;
  source_end_utc?: string | null;
  source_offset?: string | null;
  local_date?: string | null;
  imported_snapshot?: Record<string, unknown>;
  meta?: Record<string, unknown>;
};

export type DuplicateInput = {
  external_id: string;
  segment: number;
  existing_entry_id: string;
  existing_source: string;
  existing_external_id: string | null;
  overlap_seconds: number;
  kind: "exact" | "overlap";
};

export type DuplicateRow = DuplicateInput & { decision: "pending" | "same_event" | "distinct" };

export type ApplyResult = Array<{ _key: string; id?: string; error?: string }>;

export type RunRow = {
  id: string;
  workspace_id: string;
  source_org_id: string;
  kind: "dry_run" | "import" | "rollback";
  status: string;
  phase: string;
  checkpoint: Record<string, unknown>;
  options: Record<string, unknown>;
  counts: Record<string, unknown>;
  report: Record<string, unknown> | null;
  requested_by: string;
  target_run_id: string | null;
};

export interface JibbleStore {
  upsertStaging(runId: string, rows: StagingInput[]): Promise<void>;
  stagingPage(
    entity: string,
    opts: { personId?: string; offset: number; limit: number; statuses?: string[] },
  ): Promise<StagingRow[]>;
  stagingPersonIds(entity: string): Promise<string[]>;
  setStagingStatus(
    entity: string,
    externalIds: string[],
    status: string,
    reason?: string | null,
    detail?: string | null,
  ): Promise<void>;
  loadMappings(entity: string): Promise<MappingRow[]>;
  upsertMappings(rows: MappingRow[]): Promise<void>;
  loadLinks(entity: string, externalIds: string[]): Promise<LinkRow[]>;
  insertLinks(runId: string, rows: LinkInput[]): Promise<void>;
  linksCreatedByRun(runId: string): Promise<LinkRow[]>;
  deleteLinks(ids: string[]): Promise<void>;
  upsertDuplicates(rows: DuplicateInput[]): Promise<void>;
  loadDuplicates(externalIds: string[]): Promise<DuplicateRow[]>;
  members(): Promise<WorkspaceMember[]>;
  /** Pares projeto:usuário que JÁ são membros (não foram criados pela importação). */
  existingMembers(pairs: Array<{ project_id: string; user_id: string }>): Promise<Set<string>>;
  /** Destinos com nome igual (sem diferenciar maiúsculas) aos rótulos — só sugestão. */
  namedTargets(
    kind: "client" | "project",
    labels: string[],
  ): Promise<Array<{ id: string; name: string }>>;
  erpEntries(userId: string, fromIso: string, toIso: string): Promise<ErpEntry[]>;
  applyErp(table: string, op: "insert" | "update", rows: unknown[]): Promise<ApplyResult>;
  rollback(ids: {
    entries: string[];
    members: string[];
    tasks: string[];
    projects: string[];
  }): Promise<Record<string, string[]>>;
  saveRun(id: string, patch: Partial<RunRow> & Record<string, unknown>): Promise<void>;
  isCancelRequested(id: string): Promise<boolean>;
}
