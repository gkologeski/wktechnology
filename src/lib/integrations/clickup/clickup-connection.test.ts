import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getClickUpConnectionState,
  getClickUpCredential,
  saveClickUpConnection,
} from "./clickup-connection.server";
import { getSources } from "./clickup-import.server";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  encrypt: vi.fn(async () => "fixture-ciphertext"),
  decrypt: vi.fn(async () => "scoped-private-test-key"),
}));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: mocks.from } }));
vi.mock("@/lib/ai/provider-resolver.server", () => ({
  encryptApiKey: mocks.encrypt,
  decryptApiKey: mocks.decrypt,
}));
const W = "aaaaaaaa-0000-4000-8000-00000000000a",
  B = "aaaaaaaa-0000-4000-8000-00000000000b",
  U = "10000000-0000-4000-8000-000000000002";
const network = vi.fn();
function client(allowed = true, error: unknown = null) {
  return {
    rpc: vi.fn(async () => ({ data: allowed, error })),
    from: vi.fn(() => {
      const q = { select: () => q, eq: () => q, order: async () => ({ data: [], error: null }) };
      return q;
    }),
  } as unknown as SupabaseClient;
}
const ctx = (db = client(), workspaceId = W) => ({ client: db, workspaceId, userId: U });
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CLICKUP_API_TOKEN", "global-key-must-not-cross-tenants");
  vi.stubEnv("AI_KEYS_ENCRYPTION_KEY", "fixture-key");
  vi.stubGlobal("fetch", network);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
const load = (row: unknown) =>
  mocks.from.mockImplementation(() => {
    const q = {
      select: () => q,
      eq: () => q,
      maybeSingle: async () => ({ data: row, error: null }),
    };
    return q;
  });

describe("ClickUp conexão cifrada por workspace", () => {
  it("connection permits authorized active actor and returns only that workspace credential", async () => {
    load({ key_ciphertext: "cipher", legacy_key: false, key_last4: "abcd" });
    expect(await getClickUpCredential(ctx())).toBe("scoped-private-test-key");
    expect(mocks.decrypt).toHaveBeenCalledWith("cipher");
    expect(network).not.toHaveBeenCalled();
  });
  it("connection rejects missing import permission before privileged reads", async () => {
    await expect(getClickUpCredential(ctx(client(false)))).rejects.toThrow(/Sem permissão/);
    expect(mocks.from).not.toHaveBeenCalled();
    expect(network).not.toHaveBeenCalled();
  });
  it("connection rejects explicit deny before any provider request", async () => {
    await expect(
      getClickUpCredential(ctx(client(true, { message: "explicit deny" }))),
    ).rejects.toThrow(/Sem permissão/);
    expect(mocks.from).not.toHaveBeenCalled();
    expect(network).not.toHaveBeenCalled();
  });
  it("connection rejects foreign workspace context before any credential is read", async () => {
    const db = {
      rpc: vi.fn(async (_fn: string, args: Record<string, string>) => ({
        data: args["p_ws"] === W,
        error: null,
      })),
    } as unknown as SupabaseClient;
    await expect(getClickUpCredential(ctx(db, B))).rejects.toThrow(/Sem permissão/);
    expect(mocks.from).not.toHaveBeenCalled();
    expect(network).not.toHaveBeenCalled();
  });
  it("connection rejects inactive membership before any provider request", async () => {
    await expect(getClickUpCredential(ctx(client(false, { message: "inactive" })))).rejects.toThrow(
      /Sem permissão/,
    );
    expect(mocks.from).not.toHaveBeenCalled();
    expect(network).not.toHaveBeenCalled();
  });
  it("another tenant with its own manage permission cannot consume the global legacy key", async () => {
    load(null);
    await expect(getSources(ctx(client(true), B))).rejects.toThrow(/Cadastre a conexão.*workspace/);
    expect(network).not.toHaveBeenCalled();
    expect(mocks.decrypt).not.toHaveBeenCalled();
  });
  it("legacy key needs a service-only persisted marker belonging to the exact workspace", async () => {
    load({ key_ciphertext: null, legacy_key: true, key_last4: null });
    expect(await getClickUpCredential(ctx())).toBe("global-key-must-not-cross-tenants");
    load({ key_ciphertext: null, legacy_key: false, key_last4: null });
    await expect(getClickUpCredential(ctx())).rejects.toThrow(/Cadastre/);
  });
  it("connection state never returns ciphertext or plaintext", async () => {
    load({ key_ciphertext: "private-cipher", legacy_key: false, key_last4: "abcd" });
    expect(await getClickUpConnectionState(ctx())).toEqual({
      configured: true,
      status: "configured",
      error: null,
      encryptionReady: true,
    });
    expect(mocks.decrypt).not.toHaveBeenCalled();
  });
  it("saving validates with official GET then encrypts the key and clears only source bindings", async () => {
    const saved: unknown[] = [];
    const deleted: unknown[] = [];
    mocks.from.mockImplementation((table: string) => ({
      upsert: async (value: unknown) => {
        saved.push({ table, value });
        return { error: null };
      },
      delete: () => ({
        eq: async (column: string, value: string) => {
          deleted.push({ table, column, value });
          return { error: null };
        },
      }),
    }));
    network.mockResolvedValue(
      new Response(JSON.stringify({ teams: [{ id: "11", name: "Authorized" }] }), {
        headers: { "content-type": "application/json" },
      }),
    );
    const key = "private-test-key-which-must-be-encrypted";
    expect(await saveClickUpConnection(ctx(), key)).toEqual({
      configured: true,
      status: "configured",
    });
    expect(network.mock.calls[0]![0].toString()).toBe("https://api.clickup.com/api/v2/team");
    expect(network.mock.calls[0]![1]).toMatchObject({
      method: "GET",
      redirect: "error",
      headers: { Authorization: key },
    });
    expect(saved).toEqual([
      {
        table: "clickup_import_connections",
        value: expect.objectContaining({
          workspace_id: W,
          key_ciphertext: "fixture-ciphertext",
          legacy_key: false,
        }),
      },
    ]);
    expect(JSON.stringify(saved)).not.toContain(key);
    expect(deleted).toEqual([
      { table: "clickup_import_source_bindings", column: "workspace_id", value: W },
    ]);
  });
  it("missing server encryption prevents provider calls and persistence", async () => {
    vi.stubEnv("AI_KEYS_ENCRYPTION_KEY", "");
    await expect(
      saveClickUpConnection(ctx(), "private-test-key-at-least-20-chars"),
    ).rejects.toThrow(/cifragem/);
    expect(network).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
