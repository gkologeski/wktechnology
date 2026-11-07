import { beforeEach, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const builder = {
      middleware: () => builder,
      inputValidator: () => builder,
      handler: (fn: unknown) => fn,
    };
    return builder;
  },
}));
vi.mock("@/lib/active-workspace.server", () => ({ resolveActiveWorkspace: () => "workspace-a" }));
vi.mock("@/lib/access-control/sales-permission.middleware", () => ({
  requireSalesPermission: vi.fn(),
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/lib/workflows/engine.server", () => ({ tickWorkflows: vi.fn(), processEvent: vi.fn() }));
vi.mock("@/lib/workflows/caller-tick.server", () => ({ tickForWorkflowCaller: vi.fn() }));
vi.mock("@/lib/access-control/admin-gates.server", () => ({
  assertWorkflowsManage: vi.fn(),
  assertWorkflowsDelete: vi.fn(),
}));

import { listWorkflows, listRecentRuns, listRecordEnrollments } from "../workflows.functions";
import { assertSalesAnyArea } from "@/lib/access-control/sales-core.server";
import type { SupabaseClient } from "@supabase/supabase-js";

const calls: { table: string; method: string; args: unknown[] }[] = [];
function client(
  statsError = false,
  workflows = [{ id: "wf-a", actions: [], trigger: {}, goal_filters: [] }],
  runs: { id: string; workflow_id: string; created_at: string }[] = [],
) {
  return {
    from: (table: string) => {
      const q: Record<string, unknown> = {};
      let workflowId: string | undefined;
      let limit = 20;
      for (const method of ["select", "eq", "in", "gte", "order", "limit"]) {
        q[method] = (...args: unknown[]) => {
          calls.push({ table, method, args });
          if (method === "eq" && args[0] === "workflow_id") workflowId = String(args[1]);
          if (method === "limit") limit = Number(args[0]);
          return q;
        };
      }
      q.then = (resolve: (value: unknown) => void) =>
        resolve({
          data:
            table === "workflows"
              ? workflows
              : runs
                  .filter((r) => r.workflow_id === workflowId)
                  .sort((a, b) => b.created_at.localeCompare(a.created_at))
                  .slice(0, limit),
          error: table === "workflow_runs" && statsError ? { message: "timeout" } : null,
        });
      return q;
    },
  };
}
type ReadHandler = (input: {
  context: { supabase: ReturnType<typeof client>; userId: string };
  data?: Record<string, unknown>;
}) => Promise<unknown>;
beforeEach(() => {
  calls.length = 0;
});
it("keeps workflows available with unknown statistics on a run-query failure", async () => {
  const rows = await (listWorkflows as unknown as ReadHandler)({
    context: { supabase: client(true), userId: "actor" },
  });
  expect(rows).toEqual([expect.objectContaining({ id: "wf-a", runs_24h: null, errors_24h: null })]);
  expect(calls).toContainEqual({
    table: "workflow_runs",
    method: "in",
    args: ["workflow_id", ["wf-a"]],
  });
});
it("merges indexed per-workflow reads into the globally newest requested runs", async () => {
  const rows = await (listRecentRuns as unknown as ReadHandler)({
    context: {
      supabase: client(
        false,
        [
          { id: "wf-a", actions: [], trigger: {}, goal_filters: [] },
          { id: "wf-b", actions: [], trigger: {}, goal_filters: [] },
        ],
        [
          { id: "old", workflow_id: "wf-a", created_at: "2026-11-01" },
          { id: "newest", workflow_id: "wf-b", created_at: "2026-11-07" },
          { id: "middle", workflow_id: "wf-a", created_at: "2026-11-06" },
        ],
      ),
      userId: "actor",
    },
    data: { limit: 2 },
  });
  expect(rows).toEqual([
    { id: "newest", workflow_id: "wf-b", created_at: "2026-11-07" },
    { id: "middle", workflow_id: "wf-a", created_at: "2026-11-06" },
  ]);
});
it("restricts recent runs to active workspace and visible workflow ids", async () => {
  await (listRecentRuns as unknown as ReadHandler)({
    context: { supabase: client(), userId: "actor" },
    data: { limit: 20 },
  });
  expect(calls).toContainEqual({
    table: "workflow_runs",
    method: "eq",
    args: ["workspace_id", "workspace-a"],
  });
  expect(calls).toContainEqual({
    table: "workflow_runs",
    method: "eq",
    args: ["workflow_id", "wf-a"],
  });
});
it("does not read runs for a foreign or invisible workflow", async () => {
  const rows = await (listRecentRuns as unknown as ReadHandler)({
    context: { supabase: client(), userId: "actor" },
    data: { limit: 20, workflowId: "foreign" },
  });
  expect(rows).toEqual([]);
  expect(calls.some((c) => c.table === "workflow_runs")).toBe(false);
});
it("restricts record enrollment history to the active workspace", async () => {
  await (listRecordEnrollments as unknown as ReadHandler)({
    context: { supabase: client(), userId: "actor" },
    data: { limit: 20, entity: "leads", entityId: "lead" },
  });
  expect(calls).toContainEqual({
    table: "workflow_runs",
    method: "eq",
    args: ["workspace_id", "workspace-a"],
  });
});
it("skips run statistics when no workflow is visible", async () => {
  expect(
    await (listWorkflows as unknown as ReadHandler)({
      context: { supabase: client(false, []), userId: "actor" },
    }),
  ).toEqual([]);
  expect(calls.some((c) => c.table === "workflow_runs")).toBe(false);
});
it("workflow view permits an authorized active actor", async () => {
  const rpc = vi
    .fn()
    .mockResolvedValue({ data: { workspace: "workspace-a", actor: "actor" }, error: null });
  await assertSalesAnyArea({ rpc } as unknown as SupabaseClient, "system.workflows", "view");
  expect(rpc).toHaveBeenCalledWith("sales_area_authorize", {
    r: "system.workflows",
    a: "view",
    t: null,
    i: null,
  });
});
it("workflow view rejects missing permission", async () => {
  const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "missing permission" } });
  await expect(
    assertSalesAnyArea({ rpc } as unknown as SupabaseClient, "system.workflows", "view"),
  ).rejects.toThrow("missing permission");
});
it("workflow view rejects explicit deny", async () => {
  const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "explicit deny" } });
  await expect(
    assertSalesAnyArea({ rpc } as unknown as SupabaseClient, "system.workflows", "view"),
  ).rejects.toThrow("explicit deny");
});
it("workflow view rejects a foreign workspace", async () => {
  const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "foreign workspace" } });
  await expect(
    assertSalesAnyArea({ rpc } as unknown as SupabaseClient, "system.workflows", "view"),
  ).rejects.toThrow("foreign workspace");
});
it("workflow view rejects inactive membership", async () => {
  const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "inactive membership" } });
  await expect(
    assertSalesAnyArea({ rpc } as unknown as SupabaseClient, "system.workflows", "view"),
  ).rejects.toThrow("inactive membership");
});
