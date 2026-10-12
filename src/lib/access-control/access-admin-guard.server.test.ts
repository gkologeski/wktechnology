import { describe, it, expect, vi, beforeEach } from "vitest";

const state = { readOnly: false, member: null as null | { role: string; status: string } };

vi.mock("@/lib/active-workspace.server", () => ({
  resolveActiveWorkspace: async () => "ws-fixture",
}));
vi.mock("@/lib/view-as.server", () => ({ logBlockedWrite: async () => {} }));
vi.mock("@/integrations/supabase/client.server", () => {
  const q: Record<string, unknown> = {};
  q.select = () => q;
  q.eq = () => q;
  q.is = () => q;
  q.order = () => q;
  q.limit = () => q;
  q.maybeSingle = async () => ({ data: state.member, error: null });
  return { supabaseAdmin: { from: () => q } };
});

import { assertActiveWorkspaceAdmin } from "./access-admin-guard.server";
import { VIEW_AS_READ_ONLY_MESSAGE } from "@/lib/view-as-guard.server";

function client(isAdminV2 = true) {
  return {
    rpc: async (fn: string) =>
      fn === "is_read_only_view"
        ? { data: state.readOnly, error: null }
        : { data: isAdminV2, error: null },
    auth: { getUser: async () => ({ data: { user: { id: "u-fixture" } } }) },
  };
}

describe("assertActiveWorkspaceAdmin", () => {
  beforeEach(() => {
    state.readOnly = false;
    state.member = { role: "admin", status: "active" };
  });

  it("admin ativo normal passa e recebe o workspace ativo", async () => {
    await expect(assertActiveWorkspaceAdmin(client(), "u-fixture")).resolves.toBe("ws-fixture");
  });

  it("sessão Ver como somente leitura de alvo admin é barrada", async () => {
    state.readOnly = true;
    await expect(assertActiveWorkspaceAdmin(client(), "u-fixture")).rejects.toThrow(
      VIEW_AS_READ_ONLY_MESSAGE,
    );
  });

  it("admin com membership inativa é barrado mesmo se is_workspace_admin_v2 aceitar", async () => {
    state.member = { role: "admin", status: "inactive" };
    await expect(assertActiveWorkspaceAdmin(client(true), "u-fixture")).rejects.toThrow(
      /Apenas administradores/,
    );
  });

  it("sem membership (ex.: platform admin/criador) é barrado", async () => {
    state.member = null;
    await expect(assertActiveWorkspaceAdmin(client(true), "u-fixture")).rejects.toThrow(
      /Apenas administradores/,
    );
  });

  it("membro comum ativo é barrado", async () => {
    state.member = { role: "member", status: "active" };
    await expect(assertActiveWorkspaceAdmin(client(true), "u-fixture")).rejects.toThrow(
      /Apenas administradores/,
    );
  });
});
