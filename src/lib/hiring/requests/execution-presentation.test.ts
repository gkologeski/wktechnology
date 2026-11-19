import { describe, expect, it } from "vitest";
import { executionSummary } from "./execution-panel";
const start = {
  id: "s",
  starts_at: "2026-11-20",
  ends_at: null,
  reason: "Justificativa real",
  revision: 2,
  authorized_at: "2026-11-19T10:00:00Z",
  authorized_by_name: "Gestor",
  signature_intact: true,
};
describe("execution presentation", () => {
  it("started summary states no automatic access, invites or finance", () => {
    expect(executionSummary({ status: "started", start })).toContain(
      "sem acessos, convites ou financeiro",
    );
  });
  it("broken signature after start is shown as blocked allocations", () => {
    expect(
      executionSummary({ status: "started", start: { ...start, signature_intact: false } }),
    ).toContain("alocações bloqueadas");
  });
});
