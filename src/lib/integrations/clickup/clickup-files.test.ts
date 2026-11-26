import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ImportPreservationInput } from "@/lib/projects/imports/import-preservation.server";
import { prepareImportRecords } from "@/lib/projects/imports/import-preservation.server";
import { initialCollectCursor } from "./clickup-collection";
import { collectClickUpPage } from "./clickup-collection.server";
import { getClickUpSourceFileUrl, listClickUpSourceFiles } from "./clickup-files.server";

type Row = Record<string, unknown>;
const state = vi.hoisted(() => ({
  admin: null as unknown as SupabaseClient,
  ledger: new Map<string, Row>(),
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  get supabaseAdmin() {
    return state.admin;
  },
}));
vi.mock("@/lib/integrations/clickup/clickup-connection.server", () => ({
  getClickUpCredential: async () => "test-workspace-key",
}));
vi.mock("@/lib/projects/imports/import-preservation.server", async (original) => {
  const actual =
    await original<typeof import("@/lib/projects/imports/import-preservation.server")>();
  return {
    ...actual,
    preserveImportRecords: async (_db: unknown, input: ImportPreservationInput) => {
      for (const record of actual.prepareImportRecords(input.records))
        state.ledger.set(record.external_id, record);
    },
  };
});

const W = "aaaaaaaa-0000-4000-8000-00000000000a";
const U = "10000000-0000-4000-8000-000000000002";
const RUN = "20000000-0000-4000-8000-000000000003";
const manifests = new Map<string, Row>();
const objects = new Map<string, Uint8Array>();
const requests = vi.fn();

/** Query/storage adapter keeps actual manifests and bytes; production services perform the work. */
class MemoryQuery {
  filters: Array<(row: Row) => boolean> = [];
  saved: Row | null = null;
  constructor(readonly table: string) {}
  select() {
    return this;
  }
  eq(key: string, value: unknown) {
    this.filters.push((row) => row[key] === value);
    return this;
  }
  order() {
    return this;
  }
  rows() {
    const rows =
      this.table === "clickup_import_runs"
        ? [{ id: RUN, workspace_id: W, source_team_ids: ["11"] }]
        : [...manifests.values()];
    return rows.filter((row) => this.filters.every((filter) => filter(row)));
  }
  async maybeSingle() {
    return { data: this.rows()[0] ?? null, error: null };
  }
  async range(from: number, to: number) {
    return { data: this.rows().slice(from, to + 1), error: null };
  }
  upsert(input: Row) {
    const identity = `${input.workspace_id}:${input.team_id}:${input.file_key}`;
    const previous = manifests.get(identity);
    this.saved = { ...input, id: previous?.id ?? randomUUID() };
    manifests.set(identity, this.saved);
    return this;
  }
  async single() {
    return { data: this.saved, error: null };
  }
}
function client(): SupabaseClient {
  return {
    rpc: async (name: string) => ({
      data: name === "clickup_import_access" ? true : null,
      error: null,
    }),
    from: (table: string) => new MemoryQuery(table),
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string, bytes: Uint8Array) => {
          objects.set(`${bucket}/${path}`, new Uint8Array(bytes));
          return { data: { path }, error: null };
        },
        createSignedUrl: async (path: string) => ({
          data: { signedUrl: `https://private-storage.example.test/${bucket}/${path}` },
          error: objects.has(`${bucket}/${path}`) ? null : { message: "Missing object" },
        }),
      }),
    },
  } as unknown as SupabaseClient;
}
const ctx = () => ({ client: client(), workspaceId: W, userId: U });
function cursor() {
  return {
    ...initialCollectCursor([{ id: "11", name: "WK" }]),
    phase: "related" as const,
    relatedTask: { id: "task1", teamId: "11" },
    relatedStage: "attachments" as const,
  };
}
const json = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
beforeEach(() => {
  manifests.clear();
  objects.clear();
  state.ledger.clear();
  requests.mockReset();
  state.admin = client();
  vi.stubGlobal("fetch", requests);
});
afterEach(() => vi.unstubAllGlobals());

it("keeps separate bytes and accessible manifests for missing-ID attachments with identical metadata on different pages", async () => {
  const first = {
    title: "Evidence.pdf",
    size: 3,
    url: "https://attachments.clickup.com/first.pdf?signature=temporary",
  };
  const second = {
    ...first,
    url: "https://attachments.clickup.com/second.pdf?signature=temporary",
  };
  requests.mockImplementation(async (input: string | URL) => {
    const url = new URL(input);
    if (url.hostname === "api.clickup.com")
      return json(
        url.searchParams.get("cursor") === "page-two"
          ? { data: [second] }
          : { data: [first], next_cursor: "page-two" },
      );
    return new Response(new Uint8Array(url.pathname.includes("first") ? [1, 2, 3] : [9, 8, 7]), {
      headers: { "content-type": "application/pdf" },
    });
  });
  const c = cursor();
  await collectClickUpPage(ctx(), RUN, c);
  await collectClickUpPage(ctx(), RUN, c);
  expect(state.ledger.size).toBe(2);
  expect(manifests.size).toBe(2);
  expect(objects.size).toBe(2);
  const expected = [first, second].map(
    (payload, index) =>
      prepareImportRecords([
        {
          entity: "attachment",
          payload,
          observationKey: `task:task1:attachment:${index ? "page-two" : "first"}:0:0`,
        },
      ])[0]!.external_id,
  );
  expect(expected[0]).not.toBe(expected[1]);
  expect([...state.ledger.keys()]).toEqual(expected);
  expect([...manifests.values()].map((row) => row.attachment_id)).toEqual(expected);
  expect([...objects.values()].map((bytes) => [...bytes])).toEqual([
    [1, 2, 3],
    [9, 8, 7],
  ]);
  for (const externalId of expected) {
    const files = await listClickUpSourceFiles(ctx(), { sourceId: "11", externalId });
    expect(files).toHaveLength(1);
    expect(files[0]).toMatchObject({ status: "preserved", name: "Evidence.pdf", size: 3 });
    const opened = await getClickUpSourceFileUrl(ctx(), { id: files[0]!.id });
    expect(opened.url).toContain("private-storage.example.test/clickup-source-files/");
    expect(state.ledger.get(externalId)!.payload).not.toHaveProperty("id");
    expect(state.ledger.get(externalId)!.issues).toContain("missing_external_id");
  }
  // Replaying the first page reuses its own manifest; it cannot download or alias page two.
  await collectClickUpPage(ctx(), RUN, cursor());
  expect(manifests.size).toBe(2);
  expect(objects.size).toBe(2);
  expect(
    requests.mock.calls.filter((call) =>
      String(call[0]).startsWith("https://attachments.clickup.com/"),
    ),
  ).toHaveLength(2);
  expect(first).not.toHaveProperty("id");
  expect(second).not.toHaveProperty("id");
});
