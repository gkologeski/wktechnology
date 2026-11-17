import { beforeEach, describe, expect, it, vi } from "vitest";
// Exercise the real save validator, middleware and handler; provider authorization
// decisions are returned by the real shared_area_authorize boundary (SQL acceptance separately).
const state = vi.hoisted(() => ({
  permission: null as
    | null
    | ((input: { context: unknown; next: (input: unknown) => unknown }) => Promise<unknown>),
  save: null as null | {
    validate: (input: unknown) => unknown;
    handle: (input: unknown) => Promise<unknown>;
  },
}));
vi.mock("@tanstack/react-start", () => ({
  createMiddleware: () => ({
    middleware: () => ({
      server: (fn: NonNullable<typeof state.permission>) => {
        state.permission = fn;
        return fn;
      },
    }),
  }),
  createServerFn: () => {
    const definition = {
      validate: (input: unknown) => input,
      handle: async (_input: unknown): Promise<unknown> => null,
    };
    const builder = {
      middleware: () => builder,
      inputValidator: (fn: typeof definition.validate) => {
        definition.validate = fn;
        return builder;
      },
      handler: (fn: typeof definition.handle) => {
        definition.handle = fn;
        state.save = definition;
        return definition;
      },
    };
    return builder;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/lib/access-control/checked-mutation-client", () => ({
  checkedMutationClient: (client: unknown) => client,
}));
vi.mock("@/lib/active-workspace.server", () => ({
  resolveActiveWorkspace: () => "aaaaaaaa-0000-4000-8000-00000000000a",
}));
import { saveBranding } from "../branding.functions";
void saveBranding;
const row = {
  theme: {
    layout: "attio",
    light: { primary: "#1557A0" },
    assets: { logo_light: "https://example.com/logo.svg" },
  },
};
beforeEach(() => vi.clearAllMocks());
function invoke(error?: string, input: unknown = row) {
  const rpc = vi
    .fn()
    .mockResolvedValue(
      error
        ? { data: null, error: { message: error } }
        : { data: { workspace: "aaaaaaaa-0000-4000-8000-00000000000a" }, error: null },
    );
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const from = vi.fn().mockReturnValue({ upsert });
  const context = { supabase: { rpc, from }, userId: "user-a", user: { id: "user-a" } };
  const next = vi.fn(async ({ context: guarded }: { context: unknown }) =>
    state.save!.handle({ context: guarded, data: state.save!.validate(input) }),
  );
  const result = state.permission!({ context, next: next as (input: unknown) => unknown });
  return { result, rpc, upsert, from, next };
}
describe("workspace layout save authorization", () => {
  it("allows an authorized active member and saves only the resolved workspace", async () => {
    const call = invoke();
    await expect(call.result).resolves.toEqual({ ok: true });
    expect(call.rpc).toHaveBeenCalledWith("shared_area_authorize", {
      r: "system.branding",
      a: "update",
    });
    expect(call.from).toHaveBeenCalledWith("workspace_branding");
    expect(call.upsert).toHaveBeenCalledWith(
      { owner_id: "user-a", workspace_id: "aaaaaaaa-0000-4000-8000-00000000000a", ...row },
      { onConflict: "workspace_id" },
    );
  });
  it("rejects missing permission before reading or writing branding", async () => {
    const call = invoke("Permissão ausente");
    await expect(call.result).rejects.toThrow("Permissão ausente");
    expect(call.upsert).not.toHaveBeenCalled();
    expect(call.next).not.toHaveBeenCalled();
  });
  it("rejects explicit deny before reading or writing branding", async () => {
    const call = invoke("Negado explicitamente");
    await expect(call.result).rejects.toThrow("Negado explicitamente");
    expect(call.upsert).not.toHaveBeenCalled();
    expect(call.next).not.toHaveBeenCalled();
  });
  it("rejects foreign workspace before reading or writing branding", async () => {
    const call = invoke("Workspace indisponível");
    await expect(call.result).rejects.toThrow("Workspace indisponível");
    expect(call.upsert).not.toHaveBeenCalled();
    expect(call.next).not.toHaveBeenCalled();
  });
  it("rejects inactive member before reading or writing branding", async () => {
    const call = invoke("Membro inativo");
    await expect(call.result).rejects.toThrow("Membro inativo");
    expect(call.upsert).not.toHaveBeenCalled();
    expect(call.next).not.toHaveBeenCalled();
  });
  it("rejects an editor draft loaded in another workspace", async () => {
    const call = invoke(undefined, {
      ...row,
      expected_workspace_id: "aaaaaaaa-0000-4000-8000-00000000000b",
    });
    await expect(call.result).rejects.toThrow("O workspace mudou");
    expect(call.upsert).not.toHaveBeenCalled();
  });
  it("does not persist the expected-workspace transport field", async () => {
    const call = invoke(undefined, {
      ...row,
      expected_workspace_id: "aaaaaaaa-0000-4000-8000-00000000000a",
    });
    await expect(call.result).resolves.toEqual({ ok: true });
    expect(call.upsert.mock.calls[0][0]).not.toHaveProperty("expected_workspace_id");
  });
  it("rejects arbitrary layouts and ignores a supplied workspace id", () => {
    expect(() => state.save!.validate({ theme: { layout: "custom-script" } })).toThrow();
    expect(state.save!.validate({ ...row, workspace_id: "workspace-b" })).not.toHaveProperty(
      "workspace_id",
    );
  });
});
