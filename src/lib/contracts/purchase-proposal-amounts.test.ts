import { expect, it } from "vitest";
import { purchaseProposalAmounts } from "./purchase-proposal-amounts";

it("rounds the decimal product as PostgreSQL and closes milestone cents deterministically", () => {
  const amounts = purchaseProposalAmounts({
    hours: 3,
    hourlyRate: 0.335,
    milestones: [{ hours: 1 }, { hours: 1 }, { hours: 1 }],
  });
  expect(amounts).toEqual({ total: 1.01, totalCents: 101, milestones: [0.34, 0.34, 0.33] });
});
it("does not accumulate floating point errors from fractional effort", () => {
  expect(
    purchaseProposalAmounts({
      hours: 0.3,
      hourlyRate: 3.35,
      milestones: [{ hours: 0.1 }, { hours: 0.2 }],
    }),
  ).toEqual({ total: 1.01, totalCents: 101, milestones: [0.34, 0.67] });
});
it("distributes residual cents without negative or excess delivery values", () => {
  const result = purchaseProposalAmounts({
    hours: 0.5,
    hourlyRate: 0.6,
    milestones: Array.from({ length: 50 }, () => ({ hours: 0.01 })),
  });
  expect(result.totalCents).toBe(30);
  expect(result.milestones.every((value) => value >= 0)).toBe(true);
  expect(result.milestones.reduce((sum, amount) => sum + Math.round(amount * 100), 0)).toBe(30);
});
it("supports exponent decimal representations and empty unsaved forms", () => {
  expect(
    purchaseProposalAmounts({ hours: 1e-6, hourlyRate: 1e8, milestones: [{ hours: 1e-6 }] }).total,
  ).toBe(100);
  expect(purchaseProposalAmounts({ hours: 0, hourlyRate: 0, milestones: [] }).total).toBe(0);
});
it("fails instead of silently losing precision on extreme economic values", () => {
  expect(() =>
    purchaseProposalAmounts({ hours: 1000000, hourlyRate: 100000000, milestones: [] }),
  ).toThrow("precisão monetária");
});
