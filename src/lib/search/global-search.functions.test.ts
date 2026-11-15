import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), signal: new AbortController().signal }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let parse = (x: unknown) => x;
    const b = {
      middleware: () => b,
      inputValidator: (p: (x: unknown) => unknown) => {
        parse = p;
        return b;
      },
      handler: (h: (x: unknown) => unknown) => (x: { data: unknown; context: unknown }) =>
        h({ ...x, data: parse(x.data) }),
    };
    return b;
  },
}));
vi.mock("@tanstack/react-start/server", () => ({ getRequest: () => ({ signal: m.signal }) }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
import { globalSearch } from "./global-search.functions";
function result(data: unknown, error: unknown = null) {
  const q: Record<string, unknown> = {};
  for (const op of ["select", "eq", "in", "limit", "or", "ilike", "abortSignal"]) q[op] = () => q;
  q.then = (resolve: (x: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve({ data, error }).then(resolve, reject);
  return q;
}
const run = (data: unknown) =>
  (
    globalSearch as unknown as (
      x: unknown,
    ) => Promise<{ groups: Array<{ items: Array<{ entity_id: string }> }>; partial: boolean }>
  )({ data, context: { supabase: { rpc: m.rpc, from: m.from }, userId: "u" } });
beforeEach(() => {
  vi.clearAllMocks();
  m.rpc.mockImplementation((name: string) =>
    result(
      name === "work_access_context"
        ? { workspace: "w", actor: "u", keys: { "techsales.activities.view.own": true } }
        : name === "global_search_candidate_ids"
          ? ["a"]
          : [{ id: "b", snippet: "conteúdo" }],
    ),
  );
  m.from.mockReturnValue(
    result([
      { id: "a", subject: "Assunto", type: "email" },
      { id: "b", subject: "Outro assunto", type: "email" },
    ]),
  );
});
it("subject request never waits for or invokes body search", async () => {
  await run({ q: "Helix", types: ["activity"], activityPart: "subject" });
  expect(m.rpc.mock.calls.some((x) => x[0] === "global_search_activity_body_ids")).toBe(false);
  expect(m.rpc.mock.calls.some((x) => x[0] === "global_search_candidate_ids")).toBe(true);
});
it("content request does not repeat subject discovery", async () => {
  await run({ q: "Helix", types: ["activity"], activityPart: "content" });
  expect(m.rpc.mock.calls.some((x) => x[0] === "global_search_activity_body_ids")).toBe(true);
  expect(m.rpc.mock.calls.some((x) => x[0] === "global_search_candidate_ids")).toBe(false);
});
it("missing resource permission short-circuits discovery and record reads", async () => {
  m.rpc.mockReturnValue(result({ workspace: "w", actor: "u", keys: {} }));
  expect((await run({ q: "Helix", types: ["activity"] })).groups).toEqual([]);
  expect(m.rpc).toHaveBeenCalledTimes(1);
  expect(m.from).not.toHaveBeenCalled();
});
it("body failure is partial while successful subject hits are preserved", async () => {
  const original = m.rpc.getMockImplementation()!;
  m.rpc.mockImplementation((name: string, ...args: unknown[]) =>
    name === "global_search_activity_body_ids"
      ? result(null, { message: "timeout" })
      : original(name, ...args),
  );
  const r = await run({ q: "Helix", types: ["activity"] });
  expect(r.partial).toBe(true);
  expect(r.groups[0].items.length).toBeGreaterThan(0);
});
it("rejects foreign caller context before any business reads", async () => {
  m.rpc.mockReturnValue(
    result({
      workspace: "w",
      actor: "other",
      keys: { "techsales.activities.view.workspace": true },
    }),
  );
  await expect(run({ q: "Helix", types: ["activity"] })).rejects.toThrow("Sem acesso");
  expect(m.from).not.toHaveBeenCalled();
});
