import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ workspace: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let parse: (input: unknown) => unknown = (input) => input;
    const builder = {
      middleware: () => builder,
      inputValidator: (validate: typeof parse) => {
        parse = validate;
        return builder;
      },
      handler: (handler: (args: unknown) => unknown) => (args: { data: unknown }) =>
        handler({ ...args, data: parse(args.data) }),
    };
    return builder;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/lib/active-workspace.server", () => ({ resolveActiveWorkspace: state.workspace }));
vi.mock("@/lib/access-control/work-permission.middleware", () => ({
  requireWorkPermission: () => ({}),
}));
vi.mock("@/lib/access-control/enforce.server", () => ({ assertAnyPermission: vi.fn() }));
vi.mock("@/lib/access-control/work-cost-projection", () => ({ workCostTable: vi.fn() }));
vi.mock("@/lib/db/delete-guarded", () => ({ deleteByIdGuarded: vi.fn() }));
import { getProjectTaskById } from "../projects.functions";

const W = "aaaaaaaa-1111-4111-8111-111111111111";
const T = "bbbbbbbb-1111-4111-8111-111111111111";
const U = "cccccccc-1111-4111-8111-111111111111";
const OTHER = "dddddddd-1111-4111-8111-111111111111";
function fixture({
  key = true,
  deny = false,
  active = true,
  rowWorkspace = W,
  error = null as unknown,
} = {}) {
  const allowed = key && !deny && active;
  const filters: Record<string, unknown> = {};
  const row = { id: T, workspace_id: rowWorkspace, title: "Tarefa fora da primeira página" };
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn((key: string, value: unknown) => {
      filters[key] = value;
      return query;
    }),
    maybeSingle: vi.fn(async () => ({
      data: !error && filters.workspace_id === rowWorkspace && filters.id === T ? row : null,
      error,
    })),
  };
  const supabase = {
    from: vi.fn(() => query),
    rpc: vi.fn(async () => ({
      data: allowed ? W : null,
      error: allowed ? null : { code: "42501", message: "Sem permissão" },
    })),
  };
  const invoke = (data: unknown = { id: T }) =>
    (getProjectTaskById as unknown as (args: unknown) => Promise<unknown>)({
      data,
      context: { userId: U, supabase },
    });
  return { supabase, query, invoke, row };
}
beforeEach(() => {
  vi.clearAllMocks();
  state.workspace.mockResolvedValue(W);
});
it("reads the exact authorized task with the user client and active workspace, independent of pagination", async () => {
  const f = fixture();
  await expect(f.invoke()).resolves.toEqual(f.row);
  expect(f.supabase.rpc).toHaveBeenCalledExactlyOnceWith("work_area_authorize", {
    r: "techprojects.tasks",
    a: "view",
    i: null,
  });
  expect(state.workspace).toHaveBeenCalledExactlyOnceWith(U);
  expect(f.supabase.from).toHaveBeenCalledExactlyOnceWith("project_tasks");
  expect(f.query.eq.mock.calls).toEqual([
    ["workspace_id", W],
    ["id", T],
  ]);
});
it.each([
  { reason: "without a view key", key: false },
  { reason: "under explicit deny", deny: true },
  { reason: "for inactive membership", active: false },
])("returns no task and does not query records $reason", async (authorization) => {
  const f = fixture(authorization);
  await expect(f.invoke()).resolves.toBeNull();
  expect(f.supabase.from).not.toHaveBeenCalled();
  expect(state.workspace).not.toHaveBeenCalled();
});
it("does not expose a task from another workspace", async () => {
  const f = fixture({ rowWorkspace: OTHER });
  await expect(f.invoke()).resolves.toBeNull();
  expect(f.query.eq).toHaveBeenCalledWith("workspace_id", W);
});
it("does not fall back to a list or another record after lookup failure", async () => {
  const error = { message: "Leitura indisponível" };
  const f = fixture({ error });
  await expect(f.invoke()).rejects.toEqual(error);
  expect(f.supabase.from).toHaveBeenCalledTimes(1);
});
it("rejects malformed deep-link IDs before any authorization or data query", async () => {
  const f = fixture();
  await expect(async () => f.invoke({ id: "not-a-uuid" })).rejects.toThrow();
  expect(f.supabase.rpc).not.toHaveBeenCalled();
  expect(f.supabase.from).not.toHaveBeenCalled();
});
