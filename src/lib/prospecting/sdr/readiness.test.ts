import { describe, expect, it, vi } from "vitest";
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
    expect(f).toMatchObject({ leadMax: 85, contactMax: 50, feasibleForLead: true, feasibleForContact: false });
    expect(f.issues.join(" ")).toMatch(/Contato/);
  });
  it("sem ICP: limiar 60 é impossível e é sinalizado", () => {
    const f = qualificationFeasibility({ questions: [q([25])], icpEnabledCriteria: [], threshold: 60 });
    expect(f.leadMax).toBe(50);
    expect(f.feasibleForLead).toBe(false);
    expect(f.issues.some((i) => i.includes("nunca será atingido"))).toBe(true);
  });
  it("sem questionário: nota sempre 0", () => {
    const f = qualificationFeasibility({ questions: [], icpEnabledCriteria: [{ points: 5 }], threshold: 30 });
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
    expect(bookingReadiness({ page, workspaceId: "w1", hostActive: true, calendar: cal }).ok).toBe(true);
  });
  it("agenda de outro workspace ou sem escrita falha", () => {
    const r = bookingReadiness({
      page,
      workspaceId: "w1",
      hostActive: true,
      calendar: { ...cal, workspace_id: "w2", can_write_events: false },
    });
    expect(r.ok).toBe(false);
    expect(r.checks.filter((c) => !c.ok).map((c) => c.key)).toEqual(["calendar_owner", "calendar_auth"]);
  });
});

vi.mock("@/lib/access-control/enforce.server", () => ({
  assertAnyPermission: vi.fn(async (sb: any, _u: string, ws: string, keys: string[]) => {
    for (const k of keys) {
      const { data } = await sb.rpc("user_has_permission", { _permission_key: k, _workspace_id: ws });
      if (data) return;
    }
    throw Object.assign(new Error("forbidden"), { status: 403 });
  }),
}));

describe("permissões do Agente SDR", () => {
  const sb = (granted: string[]) => ({
    rpc: async (fn: string, a: any) =>
      fn === "default_workspace_for_user"
        ? { data: "w1", error: null }
        : { data: granted.includes(a._permission_key), error: null },
  });
  it("só leitura vê, mas não supervisiona nem exclui", async () => {
    const { requireSdr } = await import("./access.server");
    const s = sb(["techsales.marketing.sdr_agent.view.own"]) as never;
    await expect(requireSdr(s, "u", "view")).resolves.toBe("w1");
    await expect(requireSdr(s, "u", "supervise")).rejects.toThrow("forbidden");
    await expect(requireSdr(s, "u", "delete")).rejects.toThrow("forbidden");
  });
  it("update.own não basta para supervisionar; manage concede tudo", async () => {
    const { requireSdr } = await import("./access.server");
    await expect(
      requireSdr(sb(["techsales.marketing.sdr_agent.update.own"]) as never, "u", "supervise"),
    ).rejects.toThrow();
    const m = sb(["techsales.marketing.sdr_agent.manage.workspace"]) as never;
    for (const a of ["view", "create", "update", "delete", "supervise"] as const)
      await expect(requireSdr(m, "u", a)).resolves.toBe("w1");
  });
  it("sem nenhuma permissão: acesso negado", async () => {
    const { requireSdr } = await import("./access.server");
    await expect(requireSdr(sb([]) as never, "u", "view")).rejects.toThrow("forbidden");
  });
});
