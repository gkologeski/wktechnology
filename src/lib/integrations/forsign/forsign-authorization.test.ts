import { beforeEach, describe, expect, it, vi } from "vitest";

const adminCalls: string[] = [];
vi.mock("@/integrations/supabase/client.server", () => {
  const chain = (table: string): any => {
    const c: any = {
      select: () => c,
      eq: () => c,
      in: () => c,
      order: () => c,
      limit: () => c,
      maybeSingle: async () => ({ data: null, error: null }),
      single: async () => ({ data: null, error: { message: "x" } }),
      insert: () => c,
      update: () => c,
      upsert: async () => ({ error: null }),
    };
    adminCalls.push(table);
    return c;
  };
  return { supabaseAdmin: { from: chain, rpc: async () => ({ data: null, error: null }) } };
});
vi.mock("@/lib/ai/provider-resolver.server", () => ({
  encryptApiKey: async (s: string) => `enc:${s}`,
  decryptApiKey: async (s: string) => s.replace(/^enc:/, ""),
}));
vi.mock("@/lib/view-as-guard.server", () => ({ assertNotReadOnlyView: async () => {} }));
vi.mock("@/lib/access-control/enforce.server", async () => {
  const actual: any = await vi.importActual("@/lib/access-control/enforce.server");
  return { ...actual, auditDenial: async () => {} };
});

import { getSettings, sendContract, FS_SETTINGS, FS_SEND } from "./forsign-service.server";

type Grants = { ws: string | null; keys: Set<string>; contextError?: string; gateError?: string };
function caller(g: Grants): any {
  return {
    from: () => {
      const c: any = {
        select: () => c,
        eq: () => c,
        maybeSingle: async () => ({
          data: g.ws ? { active_workspace_id: g.ws } : null,
          error: null,
        }),
      };
      return c;
    },
    rpc: async (fn: string, args: any) => {
      if (fn === "user_has_permission")
        return { data: g.keys.has(args._permission_key), error: null };
      if (fn === "is_read_only_view") return { data: false, error: null };
      if (fn === "hiring_contract_signature_context") {
        if (g.contextError)
          return { data: null, error: { message: g.contextError, code: "42501" } };
        return { data: { can_manage: true, hash: "a".repeat(64) }, error: null };
      }
      if (fn === "hiring_formalization_signature_gate" && g.gateError)
        return { data: null, error: { code: "42501", message: g.gateError } };
      if (fn === "log_access_denial" || fn.startsWith("log")) return { data: null, error: null };
      return { data: null, error: null };
    },
  };
}
const WS = "11111111-1111-4111-8111-111111111111";
const signers = [
  { name: "Cliente", email: "c@x.com", role: "Contratante" },
  { name: "WK", email: "w@x.com", role: "Contratada" },
];

beforeEach(() => {
  adminCalls.length = 0;
});

describe("ForSign — autorização", () => {
  it("forsign allows authorized active member", async () => {
    const r = await getSettings(caller({ ws: WS, keys: new Set([FS_SETTINGS]) }), "u1");
    expect(r.webhookUrl).toContain(`/api/public/forsign/webhook?w=${WS}`);
    expect(adminCalls).toContain("forsign_connections");
  });
  it("forsign rejects missing permission", async () => {
    await expect(getSettings(caller({ ws: WS, keys: new Set() }), "u1")).rejects.toThrow();
    expect(adminCalls).not.toContain("forsign_connections");
  });
  it("forsign rejects explicit deny", async () => {
    // Deny prevalece no banco: user_has_permission devolve false para a chave de envio mesmo com evidências.
    await expect(
      sendContract(
        caller({ ws: WS, keys: new Set(["techcontracts.signature_evidence.manage.workspace"]) }),
        "u1",
        { contractId: "c1", hash: "a".repeat(64), signers },
      ),
    ).rejects.toThrow();
    expect(adminCalls.filter((t) => t.startsWith("forsign") || t.startsWith("contract"))).toEqual(
      [],
    );
  });
  it("forsign rejects foreign workspace", async () => {
    await expect(
      sendContract(
        caller({
          ws: WS,
          keys: new Set([FS_SEND, "techcontracts.signature_evidence.manage.workspace"]),
          contextError: "Sem permissão",
        }),
        "u1",
        { contractId: "contrato-de-outro-workspace", hash: "a".repeat(64), signers },
      ),
    ).rejects.toThrow();
    expect(adminCalls.filter((t) => t.startsWith("forsign") || t.startsWith("contract"))).toEqual(
      [],
    );
  });
  it("forsign rejects inactive member", async () => {
    // Membro inativo: o banco não reconhece permissões efetivas.
    await expect(getSettings(caller({ ws: WS, keys: new Set() }), "inativo")).rejects.toThrow();
    await expect(
      sendContract(caller({ ws: WS, keys: new Set() }), "inativo", {
        contractId: "c1",
        hash: "a".repeat(64),
        signers,
      }),
    ).rejects.toThrow();
    expect(adminCalls.filter((t) => t.startsWith("forsign") || t.startsWith("contract"))).toEqual(
      [],
    );
  });
});

it("hiring ForSign current chain rejects before storage or external provider effect", async () => {
  await expect(
    sendContract(
      caller({
        ws: WS,
        keys: new Set([FS_SEND, "techcontracts.signature_evidence.manage.workspace"]),
        gateError: "Financeiro da revisão atual pendente",
      }),
      "u1",
      { contractId: "hiring", hash: "a".repeat(64), signers },
    ),
  ).rejects.toThrow("Financeiro");
  expect(adminCalls).toEqual([]);
});
