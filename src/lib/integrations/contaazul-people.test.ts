import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("./contaazul-api.server", () => ({ caFetchAll: vi.fn(), getValidAccessToken: vi.fn() }));
import { assertPeopleAccess, decidePeopleLinks } from "./contaazul-people.server";

const WS = "184b9435-0a9b-4334-9e89-8854dc883f5d";
const USER = "00000000-0000-4000-8000-000000000001";

/** Simula a decisão do banco (contaazul_people_access) por cenário. */
function rpcClient(allowed: (args: Record<string, string>) => boolean) {
  return {
    rpc: vi.fn(async (_fn: string, args: Record<string, string>) => ({
      data: allowed(args),
      error: null,
    })),
  } as unknown as SupabaseClient;
}

describe("conciliação Conta Azul — fronteira de acesso", () => {
  it("permite membro ativo com a permissão no workspace", async () => {
    const c = rpcClient((a) => a["p_ws"] === WS && a["p_action"] === "manage");
    await expect(assertPeopleAccess(c, WS, USER, "manage")).resolves.toBeUndefined();
  });
  it("nega quem não tem a permissão", async () => {
    await expect(
      assertPeopleAccess(
        rpcClient(() => false),
        WS,
        USER,
        "view",
      ),
    ).rejects.toThrow(/Sem permissão/);
  });
  it("nega quando há bloqueio explícito (deny)", async () => {
    const c = {
      rpc: vi.fn(async () => ({ data: null, error: { message: "denied" } })),
    } as unknown as SupabaseClient;
    await expect(assertPeopleAccess(c, WS, USER, "manage")).rejects.toThrow(/Sem permissão/);
  });
  it("nega outro workspace", async () => {
    const c = rpcClient((a) => a["p_ws"] === WS);
    await expect(
      assertPeopleAccess(c, "11111111-1111-4111-8111-111111111111", USER, "view"),
    ).rejects.toThrow(/Sem permissão/);
  });
  it("nega membro inativo", async () => {
    const inactive = new Set([USER]);
    const c = rpcClient((a) => !inactive.has(a["p_user"]!));
    await expect(assertPeopleAccess(c, WS, USER, "view")).rejects.toThrow(/Sem permissão/);
  });

  it("não vincula a cadastro de outro workspace", async () => {
    const link = {
      id: "l1",
      person_kind: "company",
      status: "review",
      local_company_id: null,
      local_contact_id: null,
      candidates: [],
    };
    const update = vi.fn();
    const chain = (result: unknown) => {
      const q: Record<string, unknown> = {};
      for (const k of ["select", "eq", "in", "is"]) q[k] = () => q;
      q["maybeSingle"] = async () => result;
      q["then"] = (r: (v: unknown) => unknown) => r({ data: [link], error: null });
      q["update"] = update;
      return q;
    };
    const admin = {
      from: (t: string) => (t === "contaazul_person_links" ? chain(null) : chain({ data: null })),
    } as unknown as SupabaseClient;
    await expect(
      decidePeopleLinks(admin, {
        workspaceId: WS,
        userId: USER,
        client: rpcClient(() => true),
        ids: ["l1"],
        action: "choose",
        localId: "22222222-2222-4222-8222-222222222222",
      }),
    ).rejects.toThrow(/não pertence/);
    expect(update).not.toHaveBeenCalled();
  });
});
