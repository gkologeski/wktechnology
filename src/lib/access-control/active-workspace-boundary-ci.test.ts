import { beforeEach, it, expect, vi } from "vitest";
const state = vi.hoisted(() => ({
  boundary: undefined as
    | undefined
    | ((i: {
        context: Record<string, unknown>;
        next: (v: unknown) => unknown;
      }) => Promise<unknown>),
}));
vi.mock("@tanstack/react-start", () => ({
  createMiddleware: () => ({
    middleware: () => ({
      server: (fn: typeof state.boundary) => {
        state.boundary = fn;
        return fn;
      },
    }),
  }),
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
import { requireWorkspaceContext } from "./active-workspace.middleware";
const U = "10000000-0000-4000-8000-000000000002",
  W = "aaaaaaaa-0000-4000-8000-00000000000a";
beforeEach(() => {
  vi.clearAllMocks();
  requireWorkspaceContext();
});
function invoke(data: Record<string, unknown> = {}, message?: string) {
  const rpc = vi.fn().mockResolvedValue({ data, error: message ? { message } : null }),
    next = vi.fn().mockResolvedValue("allowed");
  return {
    rpc,
    next,
    result: state.boundary!({ context: { supabase: { rpc }, userId: U }, next }),
  };
}
it("workspace context allows current active subject without business grants", async () => {
  const x = invoke({ actor: U, workspace: W });
  await expect(x.result).resolves.toBe("allowed");
  expect(x.next).toHaveBeenCalledWith(
    expect.objectContaining({ context: expect.objectContaining({ activeWorkspaceId: W }) }),
  );
});
it("workspace context rejects missing selected workspace", async () => {
  const x = invoke({ actor: U });
  await expect(x.result).rejects.toThrow();
  expect(x.next).not.toHaveBeenCalled();
});
it("workspace context rejects explicit database denial", async () => {
  const x = invoke({}, "Denied");
  await expect(x.result).rejects.toThrow("Denied");
  expect(x.next).not.toHaveBeenCalled();
});
it("workspace context rejects foreign actor", async () => {
  const x = invoke({ actor: "10000000-0000-4000-8000-000000000003", workspace: W });
  await expect(x.result).rejects.toThrow();
  expect(x.next).not.toHaveBeenCalled();
});
it("workspace context rejects inactive or unavailable actor", async () => {
  const x = invoke({ workspace: W });
  await expect(x.result).rejects.toThrow();
  expect(x.next).not.toHaveBeenCalled();
});
