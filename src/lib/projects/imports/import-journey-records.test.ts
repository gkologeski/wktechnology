import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  authorize: vi.fn(),
  rpc: vi.fn(),
  evidence: vi.fn(),
  source: vi.fn(),
}));
vi.mock("./import-journey-access.server", () => ({ authorizeImportJourney: m.authorize }));
vi.mock("@/lib/access-control/work-core.server", () => ({ workRpc: m.rpc }));
vi.mock("./import-journey-evidence.server", () => ({
  listJourneyEvidence: m.evidence,
  resolveImportSourceName: m.source,
}));
import { getJourneyRecord } from "./import-journey-records.server";

const record = {
  id: "record-a",
  workspace_id: "workspace-a",
  provider: "clockify",
  source_id: "source-a",
  entity_type: "time_entry",
  external_id: "entry-a",
  label: "Current source entry",
  status: "ready",
  issues: [],
  last_seen_at: "2026-11-26T12:00:00Z",
  version_count: 3,
  current_version_number: 1,
  payload: { description: "Current original" },
  target_id: null,
  target_type: null,
  review_assignee_id: null,
};
const versions = [
  {
    id: "current-version",
    workspace_id: "workspace-a",
    record_id: record.id,
    version_number: 1,
    payload: record.payload,
  },
  {
    id: "legacy-version-2",
    workspace_id: "workspace-a",
    record_id: record.id,
    version_number: 2,
    payload: { description: "Older snapshot two" },
  },
  {
    id: "legacy-version-3",
    workspace_id: "workspace-a",
    record_id: record.id,
    version_number: 3,
    payload: { description: "Older snapshot three" },
  },
];
function fixture(withCurrent = true) {
  const queries: Array<{ table: string; columns: string; filters: Array<[string, unknown]> }> = [];
  const db = {
    from: vi.fn((table: string) => {
      const query = { table, columns: "", filters: [] as Array<[string, unknown]> };
      queries.push(query);
      const chain = {
        select: (columns: string) => {
          query.columns = columns;
          return chain;
        },
        eq: (column: string, value: unknown) => {
          query.filters.push([column, value]);
          return chain;
        },
        maybeSingle: async () => {
          const rows: Array<Record<string, unknown>> =
            table === "project_import_records"
              ? [record]
              : versions.filter((version) => withCurrent || version.id !== "current-version");
          const row = rows.find((item) =>
            query.filters.every(([column, value]) => item[column] === value),
          );
          return {
            data: row
              ? Object.fromEntries(query.columns.split(",").map((column) => [column, row[column]]))
              : null,
            error: null,
          };
        },
      };
      return chain;
    }),
  } as unknown as SupabaseClient;
  return { ctx: { client: db, workspaceId: "workspace-a", userId: "actor-a" }, queries };
}
beforeEach(() => {
  vi.clearAllMocks();
  m.authorize.mockResolvedValue({ workspaceId: "workspace-a" });
  m.rpc.mockResolvedValue(true);
  m.source.mockResolvedValue("Authorized Clockify organization");
  m.evidence.mockImplementation(async (_ctx: unknown, input: { kind: string }) =>
    input.kind === "versions"
      ? {
          versions: [...versions]
            .reverse()
            .map((version) => ({ id: version.id, at: "now", hash: version.id })),
          history: [],
          nextCursor: "older-page",
        }
      : {
          versions: [],
          history: [{ actor: "Reviewer", at: "now", note: "Reviewed" }],
          nextCursor: null,
        },
  );
});
it("uses the explicit current pointer when backfill increases total versions and the first page starts with historical evidence", async () => {
  const { ctx, queries } = fixture();
  const detail = await getJourneyRecord(ctx, record.id);
  expect(detail).toMatchObject({
    versionCount: 3,
    currentVersionId: "current-version",
    original: record.payload,
    sourceName: "Authorized Clockify organization",
    versionsCursor: "older-page",
    historyCursor: null,
  });
  expect(detail.versions[0].id).toBe("legacy-version-3");
  expect(queries.find((query) => query.table === "project_import_records")?.columns).toContain(
    "current_version_number",
  );
  expect(
    queries.find((query) => query.table === "project_import_record_versions")?.filters,
  ).toEqual([
    ["workspace_id", ctx.workspaceId],
    ["record_id", record.id],
    ["version_number", 1],
  ]);
  expect(m.authorize).toHaveBeenCalledWith(ctx.client, ctx.userId, "clockify", false);
});
it("viewing historical evidence preserves the current pointer used by optimistic review", async () => {
  const { ctx } = fixture();
  const detail = await getJourneyRecord(ctx, record.id, "legacy-version-3");
  expect(detail.original).toEqual({ description: "Older snapshot three" });
  expect(detail.currentVersionId).toBe("current-version");
  expect(detail.versionCount).toBe(3);
});
it("fails explicitly when the current pointer is unavailable rather than substituting the first historical version", async () => {
  const { ctx } = fixture(false);
  await expect(getJourneyRecord(ctx, record.id)).rejects.toThrow("confirmar a versão");
});
