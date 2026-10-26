import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  handlers: [] as Array<
    (x: { context: { supabase: unknown; userId: string } }) => Promise<unknown>
  >,
}));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    middleware: () => ({
      handler: (fn: (typeof state.handlers)[number]) => {
        state.handlers.push(fn);
        return fn;
      },
    }),
  }),
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
import { getMyPermissions } from "./permissions.functions";
const handler = getMyPermissions as unknown as (typeof state.handlers)[number];
const W = "aaaaaaaa-0000-4000-8000-00000000000a";
function run(error?: string, active = true) {
  const rpc = vi
    .fn()
    .mockImplementation((name: string) =>
      Promise.resolve(
        name === "work_access_context"
          ? { data: active ? { workspace: W } : {}, error: null }
          : error
            ? { data: null, error: { message: error } }
            : { data: ["system.automation.macros.view.own"], error: null },
      ),
    );
  return { rpc, result: handler({ context: { supabase: { rpc }, userId: "actor" } }) };
}
beforeEach(() => vi.clearAllMocks());
it("configuration server allows authorized active context", async () => {
  const x = run();
  await expect(x.result).resolves.toEqual({
    workspace_id: W,
    permissions: ["system.automation.macros.view.own"],
  });
  expect(x.rpc).toHaveBeenCalledWith("shared_configuration_permission_keys", { p_workspace: W });
});
it("configuration server rejects unavailable permissions without legacy fallback", async () => {
  const x = run("permission unavailable");
  await expect(x.result).rejects.toThrow("permission unavailable");
  expect(x.rpc).toHaveBeenCalledTimes(2);
});
it("configuration server propagates alias deny rather than fallback grants", async () => {
  const x = run("explicit deny");
  await expect(x.result).rejects.toThrow("explicit deny");
  expect(x.rpc).not.toHaveBeenCalledWith("current_user_permissions", expect.anything());
});
it("configuration server rejects foreign workspace at authoritative RPC", async () => {
  const x = run("Workspace indisponível.");
  await expect(x.result).rejects.toThrow("Workspace indisponível.");
});
it("configuration server returns no permissions for inactive context", async () => {
  const x = run(undefined, false);
  await expect(x.result).resolves.toEqual({ workspace_id: null, permissions: [] });
  expect(x.rpc).toHaveBeenCalledTimes(1);
});
