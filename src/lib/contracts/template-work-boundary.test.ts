import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  handler: undefined as
    | undefined
    | ((input: { context: { supabase: unknown }; next: () => unknown }) => Promise<unknown>),
}));
vi.mock("@tanstack/react-start", () => ({
  createMiddleware: () => ({
    middleware: () => ({
      server: (fn: typeof state.handler) => {
        state.handler = fn;
        return fn;
      },
    }),
  }),
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
import { requireWorkPermission } from "@/lib/access-control/work-permission.middleware";
beforeEach(() => {
  vi.clearAllMocks();
});
async function invoke(error?: string) {
  for (const [resource, action] of [
    ["techcontracts.imports", "manage"],
    ["techcontracts.contract_templates", "create"],
  ]) {
    requireWorkPermission(resource, action);
    const rpc = vi
      .fn()
      .mockResolvedValue(
        error ? { data: null, error: { message: error } } : { data: true, error: null },
      );
    const next = vi.fn().mockResolvedValue("authorized");
    const result = state.handler!({ context: { supabase: { rpc } }, next });
    if (error) {
      await expect(result).rejects.toThrow(error);
      expect(next).not.toHaveBeenCalled();
    } else {
      await expect(result).resolves.toBe("authorized");
      expect(next).toHaveBeenCalledOnce();
    }
    expect(rpc).toHaveBeenCalledWith("work_area_authorize", { r: resource, a: action, i: null });
  }
}
it("template import boundary allows an authorized active member", async () => {
  await expect(invoke()).resolves.toBeUndefined();
});
it("template import boundary rejects missing permission", async () => {
  await expect(invoke("Permissão ausente")).resolves.toBeUndefined();
});
it("template import boundary respects explicit deny", async () => {
  await expect(invoke("Deny explícito")).resolves.toBeUndefined();
});
it("template import boundary isolates foreign workspace", async () => {
  await expect(invoke("Workspace incorreto")).resolves.toBeUndefined();
});
it("template import boundary rejects inactive membership", async () => {
  await expect(invoke("Membro inativo")).resolves.toBeUndefined();
});
