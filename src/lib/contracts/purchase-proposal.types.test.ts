import { expect, it } from "vitest";
import {
  createEmptyPurchaseProposalData,
  purchaseProposalDataSchema,
} from "./purchase-proposal.types";

const valid = () => ({
  ...createEmptyPurchaseProposalData(),
  scope: "Implementação técnica de compra",
  acceptanceCriteria: "Aceite expresso da entrega",
  hours: 8,
  hourlyRate: 75,
  businessDays: 2,
  milestones: [
    {
      id: "m1",
      title: "Entrega",
      description: "Escopo da entrega",
      acceptanceCriteria: "Verificação expressa",
      hours: 8,
      businessDays: 2,
    },
  ],
});
it("generic initial model contains no transaction sample or inherited sale fields", () => {
  const data = createEmptyPurchaseProposalData();
  expect(data.hours).toBe(0);
  expect(data.hourlyRate).toBe(0);
  expect(data.milestones).toEqual([]);
  expect(purchaseProposalDataSchema.safeParse(data).success).toBe(false);
});
it("valid own purchase data is admitted without a sale, quote or proposal link", () => {
  expect(purchaseProposalDataSchema.parse(valid()).hours).toBe(8);
});
it("rejects impossible dates and nonfinite financial fields before rendering", () => {
  for (const value of [
    { ...valid(), startsOn: "2026-02-31" },
    { ...valid(), hourlyRate: Infinity },
    { ...valid(), hours: NaN },
  ])
    expect(purchaseProposalDataSchema.safeParse(value).success).toBe(false);
});
it("rejects copied sale fields and ambiguous milestone totals", () => {
  expect(purchaseProposalDataSchema.safeParse({ ...valid(), saleTotal: 999 }).success).toBe(false);
  expect(purchaseProposalDataSchema.safeParse({ ...valid(), hours: 9 }).success).toBe(false);
});
it("rejects duplicate milestone identities and reversed execution dates", () => {
  const data = valid();
  expect(
    purchaseProposalDataSchema.safeParse({
      ...data,
      hours: 16,
      milestones: [data.milestones[0], data.milestones[0]],
    }).success,
  ).toBe(false);
  expect(
    purchaseProposalDataSchema.safeParse({ ...data, startsOn: "2026-11-28", endsOn: "2026-11-27" })
      .success,
  ).toBe(false);
});
it("rejects prices beyond exact monetary precision before compiling any PDF", () => {
  const data = valid();
  data.hours = 1000000;
  data.hourlyRate = 100000000;
  data.milestones[0].hours = 1000000;
  expect(purchaseProposalDataSchema.safeParse(data).success).toBe(false);
});
