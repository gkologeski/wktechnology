import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the TanStack server helpers so enforce.server.ts can import them in Node.
vi.mock("@tanstack/react-start/server", () => ({
  getRequest: () => {
    throw new Error("no request in test");
  },
  setResponseStatus: vi.fn(),
}));

// Mock the admin client dynamic import used by auditDenial.
const insertMock = vi.fn(() => Promise.resolve({ error: null }));
const fromMock = vi.fn(() => ({ insert: insertMock }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: fromMock },
}));

import {
  assertPermission,
  assertAnyPermission,
  PermissionDeniedError,
  PERMISSION_DENIED_CODE,
  hasPermission,
} from "./enforce.server";

type RpcResult = { data: boolean | null; error: null | { message: string } };

function makeSupabase(rpcResults: Record<string, boolean>) {
  return {
    rpc: vi.fn(async (_fn: string, args: { _permission_key: string }): Promise<RpcResult> => {
      return { data: Boolean(rpcResults[args._permission_key]), error: null };
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

beforeEach(() => {
  insertMock.mockClear();
  fromMock.mockClear();
});

describe("assertPermission", () => {
  it("passa quando o usuário tem a permissão (admin/bypass RLS)", async () => {
    const supabase = makeSupabase({ "techservice.services.view.workspace": true });
    await expect(
      assertPermission(supabase, "user-1", "ws-1", "techservice.services.view.workspace"),
    ).resolves.toBeUndefined();
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("lança PermissionDeniedError com status 403 e code PERMISSION_DENIED", async () => {
    const supabase = makeSupabase({});
    let caught: unknown;
    try {
      await assertPermission(supabase, "user-1", "ws-1", "techservice.services.delete.workspace");
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(PermissionDeniedError);
    const err = caught as PermissionDeniedError;
    expect(err.status).toBe(403);
    expect(err.code).toBe(PERMISSION_DENIED_CODE);
    expect(err.permissionKeys).toEqual(["techservice.services.delete.workspace"]);
    expect(err.message).toContain("Você não tem permissão");
    expect(err.message).toContain("techservice.services.delete.workspace");
  });

  it("grava audit em access_audit_log quando nega", async () => {
    const supabase = makeSupabase({});
    await expect(
      assertPermission(supabase, "user-42", "ws-9", "techservice.kb.delete.workspace"),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
    expect(fromMock).toHaveBeenCalledWith("access_audit_log");
    expect(insertMock).toHaveBeenCalledTimes(1);
    const payload = insertMock.mock.calls[0][0] as {
      workspace_id: string;
      actor_id: string;
      action: string;
      entity_type: string;
      details: { permission_keys: string[] };
    };
    expect(payload.workspace_id).toBe("ws-9");
    expect(payload.actor_id).toBe("user-42");
    expect(payload.action).toBe("permission_denied");
    expect(payload.entity_type).toBe("permission");
    expect(payload.details.permission_keys).toEqual(["techservice.kb.delete.workspace"]);
  });

  it("não bloqueia mesmo se a auditoria falhar", async () => {
    const supabase = makeSupabase({});
    insertMock.mockImplementationOnce(() => Promise.reject(new Error("audit down")));
    await expect(
      assertPermission(supabase, "u", "w", "techservice.services.view.workspace"),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
  });
});

describe("assertAnyPermission", () => {
  it("passa se ao menos uma das chaves está concedida (fallback own)", async () => {
    const supabase = makeSupabase({ "techservice.services.view.own": true });
    await expect(
      assertAnyPermission(supabase, "u", "w", [
        "techservice.services.view.workspace",
        "techservice.services.view.own",
      ]),
    ).resolves.toBeUndefined();
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("bloqueia com 403 quando NENHUMA das chaves está concedida (usuário sem cargo)", async () => {
    const supabase = makeSupabase({});
    let caught: unknown;
    try {
      await assertAnyPermission(supabase, "u", "w", [
        "techservice.services.update.workspace",
        "techservice.services.update.own",
      ]);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(PermissionDeniedError);
    expect((caught as PermissionDeniedError).status).toBe(403);
    // Auditoria recebe TODAS as chaves testadas.
    expect(insertMock).toHaveBeenCalledTimes(1);
    const payload = insertMock.mock.calls[0][0] as {
      details: { permission_keys: string[] };
    };
    expect(payload.details.permission_keys).toEqual([
      "techservice.services.update.workspace",
      "techservice.services.update.own",
    ]);
  });

  it("faz short-circuit ao encontrar a primeira chave permitida", async () => {
    const supabase = makeSupabase({ "techservice.kb.view.workspace": true });
    await assertAnyPermission(supabase, "u", "w", [
      "techservice.kb.view.workspace",
      "techservice.kb.manage.workspace",
    ]);
    // Só 1 RPC deve ter sido feita (a primeira já retornou true).
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
  });
});

describe("hasPermission", () => {
  it("retorna boolean sem lançar", async () => {
    const yes = makeSupabase({ "x.y.z": true });
    const no = makeSupabase({});
    expect(await hasPermission(yes, "u", "w", "x.y.z")).toBe(true);
    expect(await hasPermission(no, "u", "w", "x.y.z")).toBe(false);
  });
});
