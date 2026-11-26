import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
const W = "aaaaaaaa-0000-4000-8000-000000000001",
  U = "10000000-0000-4000-8000-000000000001";
const workspace = vi.hoisted(() => ({ value: "aaaaaaaa-0000-4000-8000-000000000001" }));
vi.mock("@/lib/active-workspace.server", () => ({
  resolveActiveWorkspace: vi.fn(async () => workspace.value),
}));
import { allowedImportProviders, authorizeImportJourney } from "./import-journey-access.server";
import {
  prepareImportRecords,
  preserveImportRecords,
  sanitizeImportPayload,
} from "./import-preservation.server";
import { normalizeJourneyCoverage } from "./import-journey-engine.server";

function client(decision: (args: Record<string, unknown>) => boolean, error?: string) {
  const rpc = vi.fn(async (_name: string, args: Record<string, unknown>) => ({
    data: error ? null : decision(args),
    error: error ? { message: error } : null,
  }));
  return {
    rpc,
    from: vi.fn(() => {
      throw new Error("Data read before permission gate");
    }),
  } as unknown as SupabaseClient & { rpc: typeof rpc };
}
beforeEach(() => {
  workspace.value = W;
});
describe("import journey authorization", () => {
  it("import journey permits an authorized active actor", async () => {
    const c = client(
      (a) =>
        a.p_ws === W && a.p_user === U && a.p_provider === "clockify" && a.p_action === "manage",
    );
    await expect(authorizeImportJourney(c, U, "clockify", true)).resolves.toMatchObject({
      workspaceId: W,
      userId: U,
    });
    expect(c.rpc).toHaveBeenCalledWith(
      "project_import_access",
      expect.objectContaining({ p_action: "manage", p_ws: W }),
    );
  });
  it("import journey rejects missing permission", async () => {
    const c = client(() => false);
    await expect(authorizeImportJourney(c, U, "clockify", true)).rejects.toThrow(/Sem permissão/);
    expect(c.from).not.toHaveBeenCalled();
  });
  it("import journey rejects explicit deny", async () => {
    const c = client(() => true, "Explicit deny");
    await expect(authorizeImportJourney(c, U, "jibble", true)).rejects.toThrow(/Explicit deny/);
    expect(c.from).not.toHaveBeenCalled();
  });
  it("import journey rejects a foreign workspace", async () => {
    workspace.value = "bbbbbbbb-0000-4000-8000-000000000001";
    const c = client((a) => a.p_ws === W);
    await expect(authorizeImportJourney(c, U, "clickup", false)).rejects.toThrow(/Sem permissão/);
    expect(c.from).not.toHaveBeenCalled();
  });
  it("import journey rejects inactive membership", async () => {
    const active = new Set<string>();
    const c = client((a) => active.has(String(a.p_user)));
    await expect(authorizeImportJourney(c, U, "clockify", false)).rejects.toThrow(/Sem permissão/);
    expect(c.from).not.toHaveBeenCalled();
  });
  it("does not include denied providers in aggregated status", async () => {
    const c = client((a) => a.p_provider === "clickup");
    await expect(allowedImportProviders(c, U)).resolves.toMatchObject({ providers: ["clickup"] });
  });
  it("fails closed on a permission resolver error", async () => {
    const c = client(() => false, "Database unavailable");
    await expect(allowedImportProviders(c, U)).rejects.toThrow("Database unavailable");
  });
});
describe("source preservation", () => {
  it("preserves open zero and negative intervals without inventing values", () => {
    const payload = {
      timeInterval: { start: "2026-11-19T18:00:00Z", end: null, duration: "-PT1H" },
      description: "erro original",
      zero: 0,
    };
    const [row] = prepareImportRecords([{ entity: "time_entry", externalId: "source-1", payload }]);
    expect(row.payload).toEqual(payload);
    expect(row.external_id).toBe("source-1");
  });
  it("keeps malformed objects with stable contextual identities and no same-page collapse", () => {
    const records = [
      { entity: "time_entry", payload: { bad: true }, observationKey: "page1:row0" },
      { entity: "time_entry", payload: { bad: true }, observationKey: "page1:row1" },
    ];
    const first = prepareImportRecords(records);
    expect(first).toHaveLength(2);
    expect(first[0].external_id).not.toBe(first[1].external_id);
    expect(prepareImportRecords(records).map((r) => r.external_id)).toEqual(
      first.map((r) => r.external_id),
    );
    expect(first[0].status).toBe("pending");
    expect(first[0].issues).toContain("missing_external_id");
  });
  it("does not truncate long business descriptions or nested arrays", () => {
    const payload = {
      description: "a".repeat(100000),
      comments: Array.from({ length: 1400 }, (_, i) => ({ id: i, text: `record ${i}` })),
    };
    expect(prepareImportRecords([{ entity: "task", externalId: "t", payload }])[0].payload).toEqual(
      payload,
    );
  });
  it("strips credentials and signed capabilities while retaining document content", () => {
    const value = {
      name: "fonte",
      api_key: "secret",
      nested: {
        Authorization: "Bearer secret",
        message:
          'Veja [arquivo](https://files.example.test/a.pdf?X-Amz-Signature=secret&part=2) e <a href="https://files.example.test/b?x=1&amp;token=secret">nota</a>.',
      },
    };
    const clean = sanitizeImportPayload(value);
    expect(JSON.stringify(clean)).not.toContain("secret");
    expect(JSON.stringify(clean)).toContain("arquivo");
    expect(JSON.stringify(clean)).toContain("part=2");
    expect(JSON.stringify(clean)).toContain("nota</a>");
  });
  it("retains unchanged ordinary URLs exactly", () => {
    const value = {
      url: "https://example.test",
      description: "Veja https://example.test/path?q=a%20b para detalhes",
    };
    expect(sanitizeImportPayload(value)).toEqual(value);
  });
  it("canonical hashes are independent of object property order", () => {
    const a = prepareImportRecords([
        { entity: "project", externalId: "x", payload: { b: 2, a: 1 } },
      ]),
      b = prepareImportRecords([{ entity: "project", externalId: "x", payload: { a: 1, b: 2 } }]);
    expect(a[0].payload_hash).toBe(b[0].payload_hash);
  });
  it("a failed preservation batch prevents advancing past unpreserved records", async () => {
    let calls = 0;
    const db = {
      rpc: vi.fn(async () => ({ error: ++calls === 2 ? { message: "disk failure" } : null })),
    } as unknown as SupabaseClient;
    await expect(
      preserveImportRecords(db, {
        workspaceId: W,
        provider: "clockify",
        sourceId: "source",
        runId: U,
        records: Array.from({ length: 250 }, (_, i) => ({
          entity: "task",
          externalId: String(i),
          payload: { id: i },
        })),
      }),
    ).rejects.toThrow(/preservar/);
    expect(calls).toBe(2);
  });
});
describe("coverage is evidence, not a finished worker flag", () => {
  it("a completed legacy worker without coverage is not integral", () => {
    expect(normalizeJourneyCoverage({ id: U, status: "completed" }).complete).toBe(false);
  });
  it("an inaccessible entity prevents integral coverage", () => {
    expect(
      normalizeJourneyCoverage({
        id: U,
        status: "completed",
        report: {
          coverage: { complete: true, gaps: [{ entity: "attachment", reason: "no access" }] },
        },
      }).complete,
    ).toBe(false);
  });
  it("accepts proved coverage with no gaps", () => {
    expect(
      normalizeJourneyCoverage({
        id: U,
        status: "completed",
        report: { coverage: { complete: true, gaps: [] } },
      }).complete,
    ).toBe(true);
  });
});
