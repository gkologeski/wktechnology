import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  SUPPRESSION_RELEASE_KEY,
  authorizeSuppressionRelease,
  loadSuppressionStats,
  releaseSuppression,
} from "./whatsapp-suppression-access";

/** Cliente simulado: membro ativo só em "wk"; chave efetiva conforme `permitted`. */
function client(opts: { member: boolean; permitted: boolean; rowWorkspace?: string }) {
  const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
    if (name === "is_workspace_member")
      return { data: opts.member && args._workspace === "wk", error: null };
    if (name === "user_has_permission") return { data: opts.permitted, error: null };
    if (name === "wa_release_number_suppression") return { data: null, error: null };
    return { data: null, error: null };
  });
  const query: Record<string, unknown> = {};
  Object.assign(query, {
    select: () => query,
    eq: () => query,
    is: () => query,
    gt: async () => ({ count: 3, error: null }),
    maybeSingle: async () => ({ data: { workspace_id: opts.rowWorkspace ?? "wk" }, error: null }),
  });
  const db = {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "actor" } }, error: null })) },
    rpc,
    from: vi.fn(() => query),
  };
  return { db: db as unknown as SupabaseClient, rpc };
}

describe("liberação de número bloqueado pela Meta", () => {
  it("allows active member with suppression release key", async () => {
    const { db, rpc } = client({ member: true, permitted: true });
    await releaseSuppression(db, "11111111-1111-1111-1111-111111111111");
    expect(rpc).toHaveBeenCalledWith("user_has_permission", {
      _user_id: "actor",
      _workspace_id: "wk",
      _permission_key: SUPPRESSION_RELEASE_KEY,
    });
    expect(rpc).toHaveBeenCalledWith("wa_release_number_suppression", {
      p_id: "11111111-1111-1111-1111-111111111111",
    });
  });
  it("rejects suppression release without key", async () => {
    const { db, rpc } = client({ member: true, permitted: false });
    await expect(releaseSuppression(db, "id")).rejects.toThrow("Sem permissão");
    expect(rpc).not.toHaveBeenCalledWith("wa_release_number_suppression", expect.anything());
  });
  it("rejects suppression release on explicit deny", async () => {
    // Deny prevalece: a chave efetiva volta falsa mesmo para cargo que a concedia.
    const { db, rpc } = client({ member: true, permitted: false });
    await expect(authorizeSuppressionRelease(db, "wk")).rejects.toThrow("Sem permissão");
    expect(rpc).not.toHaveBeenCalledWith("wa_release_number_suppression", expect.anything());
  });
  it("rejects suppression release in foreign workspace", async () => {
    const { db, rpc } = client({ member: true, permitted: true, rowWorkspace: "foreign" });
    await expect(releaseSuppression(db, "id")).rejects.toThrow("Membro ativo");
    expect(rpc).not.toHaveBeenCalledWith("user_has_permission", expect.anything());
    expect(rpc).not.toHaveBeenCalledWith("wa_release_number_suppression", expect.anything());
  });
  it("rejects suppression release for inactive member", async () => {
    const { db, rpc } = client({ member: false, permitted: true });
    await expect(releaseSuppression(db, "id")).rejects.toThrow("Membro ativo");
    expect(rpc).not.toHaveBeenCalledWith("wa_release_number_suppression", expect.anything());
  });
  it("stats require active membership and return only totals", async () => {
    await expect(
      loadSuppressionStats(client({ member: false, permitted: true }).db, "wk"),
    ).rejects.toThrow("Membro ativo");
    expect(await loadSuppressionStats(client({ member: true, permitted: false }).db, "wk")).toEqual(
      { noWhatsApp: 3, engagementLimit: 3 },
    );
  });
});
