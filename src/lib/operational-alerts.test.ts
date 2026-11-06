import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadOperationalAlerts } from "./operational-alerts.server";

const W = "184b9435-0a9b-4334-9e89-8854dc883f5d";
function fixture(options: { permission?: boolean; deny?: boolean; foreign?: boolean; inactive?: boolean; failed?: boolean } = {}) {
  const reads: string[] = [];
  const filters: unknown[][] = [];
  const client = {
    rpc: vi.fn(async (name: string) => {
      const allowed = options.permission !== false && !options.deny && !options.foreign && !options.inactive;
      if (name === "is_workspace_member") return { data: !options.inactive && !options.foreign, error: null };
      if (name === "work_area_authorize") return allowed ? { data: W, error: null } : { data: null, error: { code: "42501", message: "Sem permissão" } };
      return { data: allowed, error: null };
    }),
    from: vi.fn((table: string) => {
      const query: Record<string, unknown> = {};
      for (const method of ["select", "eq", "in", "not", "lte", "gte", "lt", "neq", "order", "limit"]) query[method] = (...args: unknown[]) => {
        if (method === "eq") filters.push([table, ...args]);
        return query;
      };
      query.maybeSingle = async () => ({ data: { active_workspace_id: W }, error: null });
      query.then = (resolve: (v: unknown) => void) => {
        reads.push(table);
        // Delayed completion proves all four reads are launched together.
        return new Promise((done) => setTimeout(() => done(resolve({ data: [{ id: table }], error: options.failed ? { message: "failure" } : null })), 5));
      };
      return query;
    }),
  } as unknown as SupabaseClient;
  return { client, reads, filters };
}
describe("operational alerts user/RLS boundary", () => {
  it("alerts allow an authorized active workspace", async () => {
    const f = fixture();
    const pending = loadOperationalAlerts(f.client, "actor", new Date("2026-11-06T12:00:00Z"));
    await new Promise((r) => setTimeout(r, 1));
    expect(f.reads).toEqual(["contracts", "financial_entries", "projects", "project_milestones"]);
    const result = await pending;
    expect(result.overdueEntries).toEqual([{ id: "financial_entries" }]);
    for (const table of f.reads) expect(f.filters).toContainEqual([table, "workspace_id", W]);
  });
  it("alerts deny missing permission without querying protected rows", async () => {
    const f = fixture({ permission: false });
    expect((await loadOperationalAlerts(f.client, "actor")).overdueEntries).toEqual([]);
    expect(f.reads).toEqual([]);
  });
  it("alerts respect explicit deny without querying protected rows", async () => {
    const f = fixture({ deny: true });
    expect((await loadOperationalAlerts(f.client, "actor")).projectsAtRisk).toEqual([]);
    expect(f.reads).toEqual([]);
  });
  it("alerts reject another workspace before protected reads", async () => {
    const f = fixture({ foreign: true });
    await expect(loadOperationalAlerts(f.client, "actor")).rejects.toThrow("Membro ativo");
    expect(f.reads).toEqual([]);
  });
  it("alerts reject inactive membership before protected reads", async () => {
    const f = fixture({ inactive: true });
    await expect(loadOperationalAlerts(f.client, "actor")).rejects.toThrow("Membro ativo");
    expect(f.reads).toEqual([]);
  });
  it("query failures are not represented as zero alerts", async () => {
    await expect(loadOperationalAlerts(fixture({ failed: true }).client, "actor")).rejects.toThrow("carregar todos");
  });
});