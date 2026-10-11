import { describe, expect, it } from "vitest";
import { metricFamily, percentile, routeFamily } from "./metrics";
describe("performance metrics", () => {
  it("never carries identifiers, filters or unknown query labels", () => {
    expect(metricFamily(["projects", { search: "secret client" }])).toBe("projects");
    expect(metricFamily(["secret@example.com", "token"])).toBe("other");
    expect(routeFamily("/leads/private-id?token=secret")).toBe("details");
    expect(routeFamily("/secret-customer")).toBe("other");
  });
  it("uses nearest rank without mutating the input", () => {
    const values = [10, 1, 5];
    expect(percentile(values, 0.95)).toBe(10);
    expect(percentile(values, 0.5)).toBe(5);
    expect(percentile([], 0.95)).toBe(0);
    expect(values).toEqual([10, 1, 5]);
  });
});
