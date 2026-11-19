import { describe, expect, it } from "vitest";
import { econComponentsProblem, econMonths, type EconComponent } from "./economics-types";

const m = (o: Partial<EconComponent> = {}): EconComponent => ({
  type: "monthly",
  amount: 9300,
  source_clause: "Cláusula 4.1",
  due_days: 10,
  proration: "calendar_days",
  ...o,
});
describe("economic plan presentation rules", () => {
  it("requires components matching the explicit modality", () => {
    expect(econComponentsProblem("delivery", [m()])).toContain("modalidade");
    expect(econComponentsProblem("monthly", [m()])).toBeNull();
  });
  it("mixed needs distinct types and sources and explicit hour projects with monthly", () => {
    expect(econComponentsProblem("mixed", [m()])).toContain("tipos distintos");
    const h: EconComponent = {
      type: "hourly",
      amount: 120,
      source_clause: "Cláusula 4.1",
      due_days: 5,
    };
    expect(econComponentsProblem("mixed", [m(), h])).toContain("mesma fonte");
    expect(
      econComponentsProblem("mixed", [m(), { ...h, source_clause: "Cláusula 4.2" }]),
    ).toContain("projeto explícito");
  });
  it("monthly needs an explicit proration rule", () => {
    expect(econComponentsProblem("monthly", [m({ proration: undefined })])).toContain("pró-rata");
  });
  it("lists the current month first and then closed months", () => {
    expect(econMonths(new Date(Date.UTC(2026, 0, 15)), 2)).toEqual(["2026-01-01", "2025-12-01"]);
  });
});
