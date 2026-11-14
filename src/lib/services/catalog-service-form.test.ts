import { describe, expect, it } from "vitest";
import { catalogServiceUsesProfile, defaultBillingTypeFor } from "./catalog-service-form";

describe("catalog-service-form", () => {
  it("consultoria (projeto) não pede cargo", () => {
    expect(catalogServiceUsesProfile({ service_type: "project", unit: "hour" })).toBe(false);
  });
  it("outsourcing (recorrente) pede cargo", () => {
    expect(catalogServiceUsesProfile({ service_type: "recurring", unit: "hour" })).toBe(true);
  });
  it("hunting (avulso) pede cargo", () => {
    expect(catalogServiceUsesProfile({ service_type: "one_off", unit: "unit" })).toBe(true);
  });
  it("consultoria por hora sugere cobrança por uso", () => {
    expect(defaultBillingTypeFor({ service_type: "project", unit: "hour" })).toBe("usage_based");
  });
  it("projeto por unidade sugere por entrega", () => {
    expect(defaultBillingTypeFor({ service_type: "project", unit: "unit" })).toBe("milestone");
  });
  it("hunting sugere cobrança única", () => {
    expect(defaultBillingTypeFor({ service_type: "one_off", unit: "unit" })).toBe("one_time");
  });
  it("outsourcing sugere recorrente", () => {
    expect(defaultBillingTypeFor({ service_type: "recurring", unit: "hour" })).toBe("recurring");
  });
});
