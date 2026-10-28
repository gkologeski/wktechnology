import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("./contaazul-api.server", () => ({
  caFetch: vi.fn(),
  caFetchAll: vi.fn(),
  loadIntegration: vi.fn(),
  refreshTokens: vi.fn(),
  ContaAzulNotConnectedError: class extends Error {},
}));
import { assertFullImportAccess, decideRecordLinks } from "./contaazul-full-import.server";

const WS = "184b9435-0a9b-4334-9e89-8854dc883f5d";
const OTHER = "11111111-1111-4111-8111-111111111111";
const USER = "00000000-0000-4000-8000-000000000001";

/** Simula as funções do banco: conciliação de pessoas e autorização Conta Azul. */
function clients(opts: { people: (a: Record<string, string>) => boolean; finance: (a: Record<string, string>) => boolean }) {
  const client = {
    rpc: vi.fn(async (_fn: string, a: Record<string, string>) => ({ data: opts.people(a), error: null })),
  } as unknown as SupabaseClient;
  const admin = {
    rpc: vi.fn(async (_fn: string, a: Record<string, string>) => ({ data: opts.finance(a), error: null })),
  } as unknown as SupabaseClient;
  return { client, admin };
}

describe("importação completa Conta Azul — fronteira de acesso", () => {
  it("permite membro ativo com conciliação e importação financeira", async () => {
    const c = clients({ people: (a) => a["p_ws"] === WS, finance: (a) => a["p_ws"] === WS });
    await expect(assertFullImportAccess({ ...c, workspaceId: WS, userId: USER })).resolves.toBeUndefined();
  });
  it("nega sem a permissão de importação financeira", async () => {
    const c = clients({ people: () => true, finance: (a) => a["p_entity"] !== "payable" });
    await expect(assertFullImportAccess({ ...c, workspaceId: WS, userId: USER })).rejects.toThrow(/Sem permissão/);
  });
  it("nega quando há bloqueio explícito (deny)", async () => {
    const client = { rpc: vi.fn(async () => ({ data: null, error: { message: "denied" } })) } as unknown as SupabaseClient;
    const admin = { rpc: vi.fn(async () => ({ data: true, error: null })) } as unknown as SupabaseClient;
    await expect(assertFullImportAccess({ client, admin, workspaceId: WS, userId: USER })).rejects.toThrow(/Sem permissão/);
    expect(admin.rpc).not.toHaveBeenCalled();
  });
  it("nega outro workspace", async () => {
    const c = clients({ people: (a) => a["p_ws"] === WS, finance: (a) => a["p_ws"] === WS });
    await expect(assertFullImportAccess({ ...c, workspaceId: OTHER, userId: USER })).rejects.toThrow(/Sem permissão/);
  });
  it("nega membro inativo", async () => {
    const inactive = new Set([USER]);
    const c = clients({ people: (a) => !inactive.has(a["p_user"]!), finance: (a) => !inactive.has(a["p_user"]!) });
    await expect(assertFullImportAccess({ ...c, workspaceId: WS, userId: USER })).rejects.toThrow(/Sem permissão/);
  });

  it("revisão só aceita um dos lançamentos sugeridos", async () => {
    const c = clients({ people: () => true, finance: () => true });
    const update = vi.fn();
    const q: Record<string, unknown> = {};
    for (const k of ["select", "eq", "in"]) q[k] = () => q;
    q["then"] = (r: (v: unknown) => unknown) =>
      r({ data: [{ id: "r1", entity: "receivable", status: "review", candidates: [{ id: "L1" }] }], error: null });
    q["update"] = update;
    const admin = Object.assign(c.admin, { from: () => q }) as unknown as SupabaseClient;
    await expect(
      decideRecordLinks({ admin, client: c.client, workspaceId: WS, userId: USER }, ["r1"], "same", "99999999-9999-4999-8999-999999999999"),
    ).rejects.toThrow(/sugeridos/);
    expect(update).not.toHaveBeenCalled();
  });
});
