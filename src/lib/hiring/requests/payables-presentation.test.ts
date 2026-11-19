import { describe, expect, it } from "vitest";
import { installmentsProblem, selectedTotal, type PayLine } from "./payables-types";

const line = (o: Partial<PayLine> = {}): PayLine => ({
  key: "monthly:2026-10-01",
  type: "monthly",
  amount: 9300,
  blocking: null,
  source_clause: "Cláusula 4.1",
  ...o,
});
describe("payables presentation rules", () => {
  it("installments must close the obligation exactly to the cent", () => {
    expect(
      installmentsProblem(
        9300,
        [
          { amount: 4650, due_on: "2026-11-10" },
          { amount: 4650, due_on: "2026-11-10" },
        ],
        "2026-10-01",
      ),
    ).toBeNull();
    expect(
      installmentsProblem(9300, [{ amount: 9299.99, due_on: "2026-11-10" }], "2026-10-01"),
    ).toContain("exatamente");
  });
  it("due dates are explicit and never before the competence", () => {
    expect(
      installmentsProblem(100, [{ amount: 100, due_on: "2026-09-30" }], "2026-10-01"),
    ).toContain("Vencimento");
  });
  it("pending lines never count as zero in the selected total", () => {
    const lines = [
      line(),
      line({ key: "hourly:*", type: "hourly", amount: null, blocking: "no_closed_hours" }),
    ];
    expect(selectedTotal(lines, ["monthly:2026-10-01"])).toBe(9300);
    expect(selectedTotal(lines, ["monthly:2026-10-01", "hourly:*"])).toBeNull();
  });
});
