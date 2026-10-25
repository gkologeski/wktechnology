import { describe, expect, it } from "vitest";
import { bookingReadiness, pricingLabel, qualificationFeasibility } from "./readiness";

const q = (pts: number[]) => ({
  id: `q${pts.join()}`,
  type: "single",
  weight: 1,
  options: pts.map((p, i) => ({ label: `o${i}`, points: p })),
});

describe("viabilidade da qualificação", () => {
  it("questionário + ICP ativos: Lead chega a 85, Contato a 50", () => {
    const f = qualificationFeasibility({
      questions: [q([25, 10]), q([25, 0])],
      icpEnabledCriteria: [{ points: 10 }],
      threshold: 60,
    });
    expect(f).toMatchObject({
      leadMax: 85,
      contactMax: 50,
      feasibleForLead: true,
      feasibleForContact: false,
    });
    expect(f.issues.join(" ")).toMatch(/Contato/);
  });
  it("sem ICP: limiar 60 é impossível e é sinalizado", () => {
    const f = qualificationFeasibility({
      questions: [q([25])],
      icpEnabledCriteria: [],
      threshold: 60,
    });
    expect(f.leadMax).toBe(50);
    expect(f.feasibleForLead).toBe(false);
    expect(f.issues.some((i) => i.includes("nunca será atingido"))).toBe(true);
  });
  it("sem questionário: nota sempre 0", () => {
    const f = qualificationFeasibility({
      questions: [],
      icpEnabledCriteria: [{ points: 5 }],
      threshold: 30,
    });
    expect(f.questionnairePossible).toBe(0);
    expect(f.leadMax).toBe(35);
  });
});

describe("preço", () => {
  it("zero ou ausente é sob proposta, nunca gratuito", () => {
    expect(pricingLabel(0)).toBe("Sob proposta");
    expect(pricingLabel(null)).toBe("Sob proposta");
    expect(pricingLabel(250)).not.toMatch(/gr[aá]tis|0/);
  });
});

describe("agenda", () => {
  const page = {
    active: true,
    workspace_id: "w1",
    owner_id: "u1",
    timezone: "America/Sao_Paulo",
    availability: { mon: [{ start: "09:00", end: "17:00" }] },
    calendar_account_id: "c1",
  };
  const cal = {
    provider: "google",
    owner_id: "u1",
    workspace_id: "w1",
    sync_enabled: true,
    last_status: "ok",
    has_refresh: true,
    can_write_events: true,
  };
  it("configuração completa passa", () => {
    expect(bookingReadiness({ page, workspaceId: "w1", hostActive: true, calendar: cal }).ok).toBe(
      true,
    );
  });
  it("agenda de outro workspace ou sem escrita falha", () => {
    const r = bookingReadiness({
      page,
      workspaceId: "w1",
      hostActive: true,
      calendar: { ...cal, workspace_id: "w2", can_write_events: false },
    });
    expect(r.ok).toBe(false);
    expect(r.checks.filter((c) => !c.ok).map((c) => c.key)).toEqual([
      "calendar_owner",
      "calendar_auth",
    ]);
  });
});

describe("permissões do Agente SDR", () => {
  const P = "techsales.marketing.sdr_agent";
  const sb = (granted: string[], active = true) => ({
    rpc: async (fn: string, args: { r?: string; a?: string }) => {
      if (fn === "sales_access_context")
        return {
          data: active
            ? {
                workspace: "w1",
                actor: "u",
                keys: Object.fromEntries(granted.map((k) => [k, true])),
              }
            : {},
          error: null,
        };
      const has = (action: string) =>
        ["own", "team", "workspace"].some((scope) =>
          granted.includes(`${args.r}.${action}.${scope}`),
        );
      if (fn === "sales_area_authorize")
        return has("view") && has(args.a ?? "")
          ? { data: true, error: null }
          : { data: null, error: { message: "forbidden" } };
      throw new Error("Unexpected RPC: " + fn);
    },
  });
  it("só leitura vê, mas não supervisiona nem exclui", async () => {
    const { requireSdr } = await import("./access.server");
    const s = sb([`${P}.view.own`]) as never;
    await expect(requireSdr(s, "u", "view")).resolves.toBe("w1");
    await expect(requireSdr(s, "u", "supervise")).rejects.toThrow("forbidden");
    await expect(requireSdr(s, "u", "delete")).rejects.toThrow("forbidden");
  });
  it("supervisão requer leitura e atualização da equipe ou workspace", async () => {
    const { requireSdr } = await import("./access.server");
    await expect(
      requireSdr(sb([`${P}.view.own`, `${P}.update.own`]) as never, "u", "supervise"),
    ).rejects.toThrow("supervisão");
    await expect(
      requireSdr(sb([`${P}.view.team`, `${P}.update.team`]) as never, "u", "supervise"),
    ).resolves.toBe("w1");
  });
  it("manage não substitui leitura, criação, edição e exclusão explícitas", async () => {
    const { requireSdr } = await import("./access.server");
    const m = sb([`${P}.manage.workspace`, `${P}.view.workspace`]) as never;
    await expect(requireSdr(m, "u", "manage")).resolves.toBe("w1");
    for (const action of ["create", "update", "delete", "supervise"] as const)
      await expect(requireSdr(m, "u", action)).rejects.toThrow();
  });
  it("inativo e workspace diferente falham antes de autorizar a ação", async () => {
    const { requireSdr, assertSdr } = await import("./access.server");
    await expect(
      requireSdr(sb([`${P}.view.workspace`], false) as never, "u", "view"),
    ).rejects.toThrow("Workspace ativo");
    await expect(
      assertSdr(sb([`${P}.view.workspace`]) as never, "u", "w2", "view"),
    ).rejects.toThrow("Workspace inválido");
  });
  it("sem nenhuma permissão: acesso negado", async () => {
    const { requireSdr } = await import("./access.server");
    await expect(requireSdr(sb([]) as never, "u", "view")).rejects.toThrow("forbidden");
  });
});
