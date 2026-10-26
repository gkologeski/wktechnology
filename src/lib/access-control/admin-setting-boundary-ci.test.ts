import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  boundary: undefined as
    | undefined
    | ((input: {
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
vi.mock("./checked-mutation-client", () => ({
  checkedMutationClient: (client: unknown) => client,
}));
import { requireAdminSetting } from "./admin-setting.middleware";
const W = "aaaaaaaa-0000-4000-8000-00000000000a",
  U = "10000000-0000-4000-8000-000000000002";
beforeEach(() => {
  vi.clearAllMocks();
  requireAdminSetting("system.phone_normalization");
});
const invoke = (error?: string) => {
  const rpc = vi
    .fn()
    .mockResolvedValue(
      error
        ? { data: null, error: { message: error } }
        : { data: { workspace: W, actor: U }, error: null },
    );
  const next = vi.fn().mockResolvedValue("allowed");
  return {
    rpc,
    next,
    result: state.boundary!({ context: { supabase: { rpc }, user: { id: U } }, next }),
  };
};
describe("mandatory CI API key server boundary", () => {
  it("admin setting boundary allows an authorized active workspace", async () => {
    const x = invoke();
    await expect(x.result).resolves.toBe("allowed");
    expect(x.rpc).toHaveBeenCalledWith("admin_setting_authorize", {
      r: "system.phone_normalization",
      a: "view",
    });
    expect(x.next).toHaveBeenCalledWith(
      expect.objectContaining({ context: expect.objectContaining({ settingWorkspaceId: W }) }),
    );
  });
  it("admin setting boundary rejects missing permission before the handler", async () => {
    const x = invoke("Permissão ausente");
    await expect(x.result).rejects.toThrow("Permissão ausente");
    expect(x.next).not.toHaveBeenCalled();
  });
  it("admin setting boundary rejects explicit deny before the handler", async () => {
    const x = invoke("Negado explicitamente");
    await expect(x.result).rejects.toThrow("Negado explicitamente");
    expect(x.next).not.toHaveBeenCalled();
  });
  it("admin setting boundary rejects foreign workspace before the handler", async () => {
    const x = invoke("Workspace incorreto");
    await expect(x.result).rejects.toThrow("Workspace incorreto");
    expect(x.next).not.toHaveBeenCalled();
  });
  it("admin setting boundary rejects inactive membership before the handler", async () => {
    const x = invoke("Membro inativo");
    await expect(x.result).rejects.toThrow("Membro inativo");
    expect(x.next).not.toHaveBeenCalled();
  });
});
