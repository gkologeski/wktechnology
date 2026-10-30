import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@tanstack/react-start/server", () => ({
  getRequest: () => {
    throw new Error("sem request");
  },
  setResponseStatus: () => undefined,
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: () => ({ insert: async () => ({ error: null }) }) },
}));

import { assertImportEntity, importKeysFor } from "@/lib/access-control/admin-gates.server";
import { PermissionDeniedError } from "@/lib/access-control/enforce.server";

const USER = "u-1";
const WS = "ws-1";

type World = {
  activeWorkspace: string;
  // chaves concedidas por workspace
  grants: Record<string, string[]>;
  denies?: Record<string, string[]>;
  inactive?: string[];
};

// Simula `user_has_permission`: membro ativo, deny prevalece, chave só no workspace pedido.
function fakeClient(world: World) {
  const calls: { ws: string; key: string }[] = [];
  const client = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { active_workspace_id: world.activeWorkspace },
            error: null,
          }),
        }),
      }),
    }),
    rpc: async (_fn: string, args: { _workspace_id: string; _permission_key: string }) => {
      calls.push({ ws: args._workspace_id, key: args._permission_key });
      const ws = args._workspace_id;
      if (world.inactive?.includes(ws)) return { data: false, error: null };
      if (world.denies?.[ws]?.includes(args._permission_key)) return { data: false, error: null };
      return { data: Boolean(world.grants[ws]?.includes(args._permission_key)), error: null };
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

describe("importação CSV — permissão no servidor", () => {
  it("csv import permits an authorized active member", async () => {
    const { client, calls } = fakeClient({
      activeWorkspace: WS,
      grants: { [WS]: ["techsales.contacts.create.own"] },
    });
    await expect(assertImportEntity(client, USER, "contacts")).resolves.toBeUndefined();
    expect(calls.every((c) => c.ws === WS)).toBe(true);
  });

  it("csv import refuses a member without the create key", async () => {
    const { client } = fakeClient({
      activeWorkspace: WS,
      grants: { [WS]: ["techsales.contacts.view.workspace"] },
    });
    await expect(assertImportEntity(client, USER, "contacts")).rejects.toBeInstanceOf(
      PermissionDeniedError,
    );
  });

  it("csv import refuses an explicit deny", async () => {
    const { client } = fakeClient({
      activeWorkspace: WS,
      grants: { [WS]: importKeysFor("leads") },
      denies: { [WS]: importKeysFor("leads") },
    });
    await expect(assertImportEntity(client, USER, "leads")).rejects.toBeInstanceOf(
      PermissionDeniedError,
    );
  });

  it("csv import refuses a key granted only in a foreign workspace", async () => {
    const { client, calls } = fakeClient({
      activeWorkspace: WS,
      grants: { "ws-other": importKeysFor("contacts") },
    });
    await expect(assertImportEntity(client, USER, "contacts")).rejects.toBeInstanceOf(
      PermissionDeniedError,
    );
    expect(calls.some((c) => c.ws === "ws-other")).toBe(false);
  });

  it("csv import refuses an inactive member", async () => {
    const { client } = fakeClient({
      activeWorkspace: WS,
      grants: { [WS]: importKeysFor("companies") },
      inactive: [WS],
    });
    await expect(assertImportEntity(client, USER, "companies")).rejects.toBeInstanceOf(
      PermissionDeniedError,
    );
  });
});
