import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  error: null as null | string,
  calls: [] as Array<[string, unknown]>,
  rows: [] as Array<Record<string, unknown>>,
}));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const builder = {
      middleware: () => builder,
      inputValidator: () => builder,
      handler: (handler: unknown) => handler,
    };
    return builder;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/lib/access-control/active-workspace.middleware", () => ({
  requireWorkspaceContext: () => ({}),
}));
import {
  searchEntityRecords,
  searchLegalEntities,
  searchSimpleRefs,
} from "@/lib/workflow-refs.functions";
const client = {
  from: (table: string) => {
    state.calls.push(["from", table]);
    const chain = {
      select: (value: unknown) => {
        state.calls.push(["select", value]);
        return chain;
      },
      order: () => chain,
      limit: () => chain,
      in: () => chain,
      eq: () => chain,
      ilike: (_key: string, value: unknown) => {
        state.calls.push(["ilike", value]);
        return chain;
      },
      or: (value: unknown) => {
        state.calls.push(["or", value]);
        return chain;
      },
      then: (resolve: (value: unknown) => unknown) =>
        Promise.resolve({
          data: state.rows,
          error: state.error ? { message: state.error } : null,
        }).then(resolve),
    };
    return chain;
  },
};
type Invoke = (args: {
  data: Record<string, unknown>;
  context: { supabase: typeof client };
}) => Promise<unknown>;
const entity = searchEntityRecords as unknown as Invoke;
const legal = searchLegalEntities as unknown as Invoke;
const simple = searchSimpleRefs as unknown as Invoke;
beforeEach(() => {
  state.error = null;
  state.calls = [];
  state.rows = [];
});
it("search allows rows supplied by the authorized user RLS client", async () => {
  state.rows = [
    { id: "lead", first_name: "Alice", last_name: "A", email: "alice@example.invalid" },
  ];
  await expect(
    entity({ data: { entity: "leads", q: "Alice" }, context: { supabase: client } }),
  ).resolves.toEqual([{ id: "lead", label: "Alice A" }]);
  expect(state.calls).toContainEqual([
    "or",
    'first_name.ilike."%Alice%",last_name.ilike."%Alice%",email.ilike."%Alice%",company_name.ilike."%Alice%"',
  ]);
});
it("search fails closed when RLS reports missing permission", async () => {
  state.error = "missing permission";
  await expect(
    entity({ data: { entity: "leads", q: "x" }, context: { supabase: client } }),
  ).rejects.toThrow("missing permission");
});
it("search fails closed on explicit database deny", async () => {
  state.error = "explicit deny";
  await expect(legal({ data: { q: "x" }, context: { supabase: client } })).rejects.toThrow(
    "explicit deny",
  );
});
it("search does not fabricate rows hidden by foreign workspace RLS", async () => {
  await expect(
    entity({ data: { entity: "ats_candidates", q: "x" }, context: { supabase: client } }),
  ).resolves.toEqual([]);
  expect(state.calls).toContainEqual(["from", "ats_candidates"]);
});
it("search fails closed when RLS reports inactive membership", async () => {
  state.error = "inactive member";
  await expect(
    simple({ data: { kind: "candidate", q: "x" }, context: { supabase: client } }),
  ).rejects.toThrow("inactive member");
});
it("search preserves direct ilike semantics outside raw OR filters", async () => {
  await entity({ data: { entity: "companies", q: "50%_" }, context: { supabase: client } });
  expect(state.calls).toContainEqual(["ilike", "%50\\%\\_%"]);
  expect(state.calls.some(([type]) => type === "or")).toBe(false);
});
it("search quotes malicious candidate and legal filters as data", async () => {
  const q = 'x),or(id.neq.null),"';
  await entity({ data: { entity: "ats_candidates", q }, context: { supabase: client } });
  expect(state.calls).toContainEqual([
    "or",
    'full_name.ilike."%x),or(id.neq.null),\\"%",email.ilike."%x),or(id.neq.null),\\"%"',
  ]);
  state.calls = [];
  await legal({ data: { q }, context: { supabase: client } });
  expect(state.calls).toContainEqual([
    "or",
    'name.ilike."%x),or(id.neq.null),\\"%",trade_name.ilike."%x),or(id.neq.null),\\"%",cnpj.ilike."%x),or(id.neq.null),\\"%"',
  ]);
});
