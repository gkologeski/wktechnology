import { expect, it } from "vitest";
import { emptyPreparation } from "./types";
import { changeAdditionalDeal, setPrimaryDeal } from "./additional-deals";
const base = { ...emptyPreparation("supplier"), purpose: "client" as const, deal_id: "main" };
it("adds an additional deal but never repeats the main or an existing one", () => {
  const one = changeAdditionalDeal(base, null, "extra");
  expect(one.additional_deal_ids).toEqual(["extra"]);
  expect(changeAdditionalDeal(one, null, "main").additional_deal_ids).toEqual(["extra"]);
  expect(changeAdditionalDeal(one, null, "extra").additional_deal_ids).toEqual(["extra"]);
});
it("clearing an additional deal removes only that deal", () => {
  const two = { ...base, additional_deal_ids: ["a", "b"] };
  expect(changeAdditionalDeal(two, "a", null).additional_deal_ids).toEqual(["b"]);
});
it("limits additional deals to 20", () => {
  const full = { ...base, additional_deal_ids: Array.from({ length: 20 }, (_, i) => `d${i}`) };
  expect(changeAdditionalDeal(full, null, "new").additional_deal_ids).toHaveLength(20);
});
it("clearing the main deal clears additional deals; picking an additional as main dedupes", () => {
  const two = { ...base, additional_deal_ids: ["a", "b"] };
  expect(setPrimaryDeal(two, null).additional_deal_ids).toEqual([]);
  expect(setPrimaryDeal(two, "a")).toMatchObject({ deal_id: "a", additional_deal_ids: ["b"] });
});
