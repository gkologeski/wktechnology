import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { assertClickUpImport, runStep } from "./clickup-import.server";

const WS = "184b9435-0a9b-4334-9e89-8854dc883f5d";
const OTHER = "11111111-1111-4111-8111-111111111111";
const USER = "00000000-0000-4000-8000-000000000001";
const RUN = "22222222-2222-4222-8222-222222222222";

/** Simula clickup_import_access no banco por cenário; registra as demais RPCs chamadas. */
const client = (allowed: (a: Record<string, string>) => boolean, error: unknown = null) => {
  const calls: string[] = [];
  const c = {
    calls,
    rpc: vi.fn(async (fn: string, a: Record<string, string>) => {
      calls.push(fn);
      if (fn === "clickup_import_access") return { data: error ? null : allowed(a), error };
      return { data: { ok: true }, error: null };
    }),
  };
  return c as unknown as SupabaseClient & { calls: string[] };
};

describe("importador ClickUp — fronteira de acesso", () => {
  it("permite membro ativo com a permissão de gerenciar o importador do ClickUp", async () => {
    const c = client((a) => a["p_ws"] === WS && a["p_action"] === "manage");
    await expect(assertClickUpImport(c, WS, USER, "manage")).resolves.toBeUndefined();
    await expect(
      runStep({ client: c, workspaceId: WS, userId: USER }, "apply", RUN),
    ).resolves.toEqual({
      ok: true,
    });
    expect(c.calls).toContain("clickup_import_apply_step");
  });
  it("nega quem não tem a permissão do importador do ClickUp", async () => {
    const c = client(() => false);
    await expect(
      runStep({ client: c, workspaceId: WS, userId: USER }, "rollback", RUN),
    ).rejects.toThrow(/Sem permissão/);
    expect(c.calls).not.toContain("clickup_import_rollback_step");
  });
  it("nega quando há bloqueio explícito (deny) no importador do ClickUp", async () => {
    const c = client(() => true, { message: "denied" });
    await expect(assertClickUpImport(c, WS, USER, "view")).rejects.toThrow(/Sem permissão/);
    expect(c.calls).not.toContain("clickup_import_apply_step");
  });
  it("nega o importador do ClickUp de outro workspace", async () => {
    const c = client((a) => a["p_ws"] === WS);
    await expect(
      runStep({ client: c, workspaceId: OTHER, userId: USER }, "assignees", RUN),
    ).rejects.toThrow(/Sem permissão/);
    expect(c.calls).not.toContain("clickup_import_sync_assignees");
  });
  it("nega o importador do ClickUp a membro inativo", async () => {
    const inactive = new Set([USER]);
    const c = client((a) => !inactive.has(a["p_user"]!));
    await expect(assertClickUpImport(c, WS, USER, "manage")).rejects.toThrow(/Sem permissão/);
  });
});
