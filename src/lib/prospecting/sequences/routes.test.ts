import { expect, it } from "vitest";
import { salesRouteResources } from "@/lib/access-control/sales-route-map";
it("sequence direct URLs require the sequence resource before generic prospecting", () => {
  expect(salesRouteResources("/prospecting/sequences")).toEqual(["system.automation.sequences"]);
  expect(salesRouteResources("/prospecting/sequences?draft=example")).toEqual([
    "system.automation.sequences",
  ]);
});
