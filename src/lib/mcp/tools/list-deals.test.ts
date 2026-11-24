import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  calls: [] as Array<[string, ...unknown[]]>,
  rows: [] as Array<Record<string, unknown>>,
  error: null as null | string,
  workspaceError: null as null | string,
}));
vi.mock("@lovable.dev/mcp-js", () => ({ defineTool: (tool: unknown) => tool }));
vi.mock("../supabase", () => ({
  supabaseForUser: () => ({
    from: (table: string) => {
      state.calls.push(["from", table]);
      const query = {
        select: (columns: string) => {
          state.calls.push(["select", columns]);
          return query;
        },
        eq: (column: string, value: string) => {
          state.calls.push(["eq", column, value]);
          return query;
        },
        is: (column: string, value: null) => {
          state.calls.push(["is", column, value]);
          return query;
        },
        order: (column: string, options: unknown) => {
          state.calls.push(["order", column, options]);
          return query;
        },
        limit: (limit: number) => {
          state.calls.push(["limit", limit]);
          return query;
        },
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve({
            data: state.error ? null : state.rows,
            error: state.error ? { message: state.error } : null,
          }).then(resolve),
      };
      return query;
    },
  }),
  resolveWorkspaceId: async () => {
    if (state.workspaceError) throw Error(state.workspaceError);
    return "workspace-a";
  },
  unauthenticated: () => ({ isError: true, content: [{ type: "text", text: "Não autenticado" }] }),
}));
import tool from "./list-deals";
const invoke = tool as unknown as {
  handler: (
    input: { limit: number; stage?: string; company_id?: string },
    context: unknown,
  ) => Promise<{
    isError?: boolean;
    content: Array<{ type: string; text: string }>;
    structuredContent?: { deals: Array<Record<string, unknown>> };
  }>;
};
const context = { isAuthenticated: () => true, getUserId: () => "actor" };
beforeEach(() => {
  state.calls = [];
  state.rows = [];
  state.error = null;
  state.workspaceError = null;
});
it("MCP deals allows authorized rows from the protected field view", async () => {
  state.rows = [{ id: "deal-a", value: 1250 }];
  const result = await invoke.handler({ limit: 10 }, context);
  expect(result.structuredContent?.deals).toEqual(state.rows);
  expect(state.calls).toContainEqual(["from", "shared_fields_deals"]);
  expect(state.calls).toContainEqual(["eq", "workspace_id", "workspace-a"]);
  expect(state.calls).toContainEqual(["is", "deleted_at", null]);
  expect(state.calls).toContainEqual(["order", "updated_at", { ascending: false }]);
  expect(state.calls).toContainEqual(["limit", 10]);
});
it("MCP deals preserves the database result when permission is missing", async () => {
  state.error = "missing permission";
  const result = await invoke.handler({ limit: 10 }, context);
  expect(result.isError).toBe(true);
  expect(result.structuredContent).toBeUndefined();
  expect(state.calls.filter(([name]) => name === "from")).toEqual([
    ["from", "shared_fields_deals"],
  ]);
});
it("MCP deals preserves an explicit database deny without fallback", async () => {
  state.error = "explicit deny";
  const result = await invoke.handler({ limit: 10 }, context);
  expect(result.isError).toBe(true);
  expect(result.content[0].text).toBe("explicit deny");
  expect(state.calls.filter(([name]) => name === "from")).toHaveLength(1);
});
it("MCP deals does not fabricate foreign workspace rows hidden by RLS", async () => {
  const result = await invoke.handler({ limit: 10, company_id: "foreign-company" }, context);
  expect(result.structuredContent?.deals).toEqual([]);
  expect(state.calls).toContainEqual(["eq", "workspace_id", "workspace-a"]);
  expect(state.calls).toContainEqual(["eq", "company_id", "foreign-company"]);
});
it("MCP deals stops when workspace resolution rejects inactive membership", async () => {
  state.workspaceError = "inactive member";
  await expect(invoke.handler({ limit: 10 }, context)).rejects.toThrow("inactive member");
  expect(state.calls).toEqual([]);
});
it("MCP deals preserves masked monetary values as null in both response formats", async () => {
  state.rows = [{ id: "deal-a", value: null }];
  const result = await invoke.handler({ limit: 10 }, context);
  expect(result.structuredContent?.deals[0].value).toBeNull();
  expect(JSON.parse(result.content[0].text)[0].value).toBeNull();
});
it("MCP deals preserves optional stage and company filters", async () => {
  await invoke.handler({ limit: 50, stage: "qualification", company_id: "company-a" }, context);
  expect(state.calls).toContainEqual(["eq", "stage", "qualification"]);
  expect(state.calls).toContainEqual(["eq", "company_id", "company-a"]);
  expect(state.calls).toContainEqual(["limit", 50]);
});
it("MCP deals rejects unauthenticated calls before querying", async () => {
  const result = await invoke.handler({ limit: 10 }, { isAuthenticated: () => false });
  expect(result.isError).toBe(true);
  expect(state.calls).toEqual([]);
});
