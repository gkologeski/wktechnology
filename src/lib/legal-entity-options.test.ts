import { expect, it } from "vitest";
import { legalEntityAssignmentOptions } from "./legal-entity-options";

const entities = [
  { id: "wk", active: true },
  { id: "fluxo", active: false },
];
it("new records cannot select the inactive Fluxo entity", () => {
  expect(legalEntityAssignmentOptions(entities).map((row) => row.id)).toEqual(["wk"]);
});
it("editing preserves the already saved inactive entity", () => {
  expect(legalEntityAssignmentOptions(entities, "fluxo").map((row) => row.id)).toEqual([
    "wk",
    "fluxo",
  ]);
});
it("assignment filtering does not delete historical entities", () => {
  legalEntityAssignmentOptions(entities);
  expect(entities).toEqual([
    { id: "wk", active: true },
    { id: "fluxo", active: false },
  ]);
});
