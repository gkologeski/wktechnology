import { describe, expect, it } from "vitest";
import { previousRange, resolveAssignee, resolveDashboardRange } from "./dashboard-period";

const now = new Date(2026, 8, 25, 12);

describe("resolveDashboardRange", () => {
  it("usa últimos 30 dias por padrão", () => {
    expect(resolveDashboardRange({}, now).preset).toBe("last30");
  });
  it("mapeia period legado", () => {
    expect(resolveDashboardRange({ period: 7 }, now).preset).toBe("last7");
    expect(resolveDashboardRange({ period: 90 }, now).preset).toBe("last90");
  });
  it("aceita intervalo personalizado e ordena datas", () => {
    const r = resolveDashboardRange(
      { preset: "custom", from: "2026-09-10", to: "2026-09-01" },
      now,
    );
    expect(r.preset).toBe("custom");
    expect(r.range.from.getDate()).toBe(1);
    expect(r.range.to.getDate()).toBe(10);
  });
  it("personalizado inválido cai no padrão", () => {
    expect(resolveDashboardRange({ preset: "custom", from: "x" }, now).preset).toBe("last30");
  });
});

describe("previousRange", () => {
  it("tem mesma duração e termina antes do início", () => {
    const cur = { from: new Date(2026, 8, 11), to: new Date(2026, 8, 20, 23, 59, 59, 999) };
    const prev = previousRange(cur);
    expect(prev.to.getTime()).toBe(cur.from.getTime() - 1);
    expect(prev.to.getTime() - prev.from.getTime()).toBe(cur.to.getTime() - cur.from.getTime());
  });
});

describe("resolveAssignee", () => {
  it("mapeia escopo legado", () => {
    expect(resolveAssignee(undefined, "me")).toBe("__me__");
    expect(resolveAssignee(undefined, "team")).toBe("__all__");
    expect(resolveAssignee("abc", "me")).toBe("abc");
  });
});
