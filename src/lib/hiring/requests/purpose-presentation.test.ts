import { expect, it } from "vitest";
import { changePreparationPurpose } from "./purpose-presentation";
import { emptyPreparation } from "./types";

it("changing client purpose clears commercial links and incompatible acceptance only in the local form", () => {
  const original = {
    ...emptyPreparation("supplier"),
    purpose: "client" as const,
    company_id: "supplier",
    project_id: "project",
    deal_id: "deal",
    commercial_contract_id: "sale",
    release_condition: "also_client_acceptance" as const,
  };
  const next = changePreparationPurpose(original, "internal");
  expect(next).toMatchObject({
    purpose: "internal",
    company_id: "supplier",
    project_id: "project",
    deal_id: null,
    commercial_contract_id: null,
    release_condition: "wk_acceptance_invoice",
  });
  expect(original.deal_id).toBe("deal");
});
it("professional purpose change never introduces a supplier financial condition", () => {
  expect(
    changePreparationPurpose(emptyPreparation("professional"), "shared_management")
      .release_condition,
  ).toBeNull();
});
