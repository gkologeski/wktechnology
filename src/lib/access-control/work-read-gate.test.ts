import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { assertWorkTimeCan, workCanRead, workTimeCan } from "./work-read-gate.server";

const WS = "184b9435-0a9b-4334-9e89-8854dc883f5d";
const OTHER = "11111111-1111-4111-8111-111111111111";

/**
 * Simula o banco: work_area_authorize nega (42501) sem chave efetiva no workspace ativo;
 * work_time_context devolve as concessões de horas já com deny, membro ativo e workspace.
 */
const db = (o: {
  keys?: string[];
  deny?: string[];
  active?: boolean;
  activeWs?: string;
  recordWs?: string;
  timeGrants?: string[];
}) => {
  const active = o.active ?? true;
  const sameWs = (o.activeWs ?? WS) === (o.recordWs ?? WS);
  const effective = (o.keys ?? []).filter((k) => !(o.deny ?? []).includes(k));
  return {
    rpc: vi.fn(async (fn: string, a: Record<string, unknown>) => {
      if (fn === "work_area_authorize") {
        const ok =
          active &&
          sameWs &&
          effective.some((k) => k.startsWith(`${String(a["r"])}.${String(a["a"])}.`));
        return ok
          ? { data: WS, error: null }
          : { data: null, error: { code: "42501", message: "Sem permissão para esta ação." } };
      }
      if (fn === "work_time_context") {
        const grants = active && sameWs ? (o.timeGrants ?? []) : [];
        return {
          data: { workspace: WS, time_grants: Object.fromEntries(grants.map((g) => [g, true])) },
          error: null,
        };
      }
      return { data: null, error: { message: "inesperado" } };
    }),
  } as unknown as SupabaseClient;
};

describe("portão de leitura do TechProjects", () => {
  it("work read gate allows an authorized active member to list tasks", async () => {
    await expect(
      workCanRead(db({ keys: ["techprojects.tasks.view.own"] }), "techprojects.tasks"),
    ).resolves.toBe(true);
    await expect(workTimeCan(db({ timeGrants: ["view.own"] }), "view")).resolves.toBe(true);
  });
  it("work read gate denies listing without a view key", async () => {
    await expect(
      workCanRead(db({ keys: ["techprojects.projects.view.workspace"] }), "techprojects.tasks"),
    ).resolves.toBe(false);
    await expect(assertWorkTimeCan(db({ timeGrants: ["view.own"] }), "create")).rejects.toThrow(
      /Sem permissão/,
    );
  });
  it("work read gate denies listing under explicit deny", async () => {
    await expect(
      workCanRead(
        db({
          keys: ["techprojects.tasks.view.workspace"],
          deny: ["techprojects.tasks.view.workspace"],
        }),
        "techprojects.tasks",
      ),
    ).resolves.toBe(false);
  });
  it("work read gate denies listing for another workspace", async () => {
    await expect(
      workCanRead(
        db({ keys: ["techprojects.tasks.view.workspace"], activeWs: OTHER }),
        "techprojects.tasks",
      ),
    ).resolves.toBe(false);
    await expect(
      workTimeCan(db({ timeGrants: ["view.workspace"], activeWs: OTHER }), "view"),
    ).resolves.toBe(false);
  });
  it("work read gate denies listing for an inactive member", async () => {
    await expect(
      workCanRead(
        db({ keys: ["techprojects.projects.view.workspace"], active: false }),
        "techprojects.projects",
      ),
    ).resolves.toBe(false);
    await expect(
      assertWorkTimeCan(db({ timeGrants: ["create.own"], active: false }), "create"),
    ).rejects.toThrow(/Sem permissão/);
  });
});
