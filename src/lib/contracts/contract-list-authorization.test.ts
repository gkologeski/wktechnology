import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  denial: "",
  reads: [] as string[],
  rpc: [] as Array<[string, unknown]>,
}));
vi.mock("@tanstack/react-start", () => ({
  createServerOnlyFn: (f: unknown) => f,
  createMiddleware: () => {
    const b = { middleware: () => b, server: (f: unknown) => f };
    return b;
  },
  createServerFn: () => {
    let middleware: Array<(arg: unknown) => unknown> = [];
    const b = {
      middleware: (m: typeof middleware) => {
        middleware = m;
        return b;
      },
      inputValidator: () => b,
      handler: (fn: (arg: unknown) => unknown) => async (arg: Record<string, unknown>) => {
        const run = (index: number): unknown =>
          index === middleware.length
            ? fn(arg)
            : middleware[index]({ ...arg, next: () => run(index + 1) });
        return run(0);
      },
    };
    return b;
  },
}));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {} }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
import { listContracts } from "@/lib/contracts.functions";
const client = {
  rpc: async (name: string, args: unknown) => {
    state.rpc.push([name, args]);
    return { data: true, error: state.denial ? { message: state.denial } : null };
  },
  from: (table: string) => {
    state.reads.push(table);
    const q = {
      select: () => q,
      order: () => q,
      limit: () => q,
      then: (resolve: (r: unknown) => unknown) =>
        Promise.resolve({ data: [], error: null }).then(resolve),
    };
    return q;
  },
};
const invoke = () =>
  (listContracts as unknown as (args: unknown) => Promise<unknown>)({
    data: {},
    context: { userId: "actor", supabase: client },
  });
beforeEach(() => {
  state.denial = "";
  state.reads = [];
  state.rpc = [];
});
it("contract list allows authorized active member through the real middleware", async () => {
  await expect(invoke()).resolves.toEqual([]);
  expect(state.rpc).toEqual([
    ["work_area_authorize", { r: "techcontracts.contracts", a: "view", i: null }],
  ]);
  expect(state.reads).toEqual(["contracts"]);
});
it("contract list rejects missing permission before data access", async () => {
  state.denial = "missing permission";
  await expect(invoke()).rejects.toThrow("missing permission");
  expect(state.reads).toEqual([]);
});
it("contract list rejects explicit deny before data access", async () => {
  state.denial = "explicit deny";
  await expect(invoke()).rejects.toThrow("explicit deny");
  expect(state.reads).toEqual([]);
});
it("contract list rejects foreign workspace before data access", async () => {
  state.denial = "foreign workspace";
  await expect(invoke()).rejects.toThrow("foreign workspace");
  expect(state.reads).toEqual([]);
});
it("contract list rejects inactive membership before data access", async () => {
  state.denial = "inactive membership";
  await expect(invoke()).rejects.toThrow("inactive membership");
  expect(state.reads).toEqual([]);
});
