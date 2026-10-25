import { describe, it, expect } from "vitest";
import { canViewSalesRoute, salesRouteResources } from "./sales-route-map";
describe("shared areas follow the permission matrix", () => {
  it("requires workspace view for configuration, without accepting unrelated own scope", () => {
    expect(
      canViewSalesRoute("/settings/permissions", new Set(["system.roles.view.own"]), true),
    ).toBe(false);
    expect(
      canViewSalesRoute("/settings/permissions", new Set(["system.roles.view.workspace"]), true),
    ).toBe(true);
    expect(
      canViewSalesRoute("/settings/branding", new Set(["system.branding.update.workspace"]), true),
    ).toBe(false);
    expect(
      canViewSalesRoute("/settings/branding", new Set(["system.branding.view.workspace"]), false),
    ).toBe(false);
  });
  it("preserves record scopes and keeps personal MFA outside workspace configuration gates", () => {
    expect(canViewSalesRoute("/files", new Set(["system.files.view.own"]), true)).toBe(true);
    expect(canViewSalesRoute("/files", new Set(), true)).toBe(false);
    expect(salesRouteResources("/settings/security")).toBeUndefined();
    expect(salesRouteResources("/settings/integrations/ai?tab=credentials")).toEqual([
      "system.ai_settings",
    ]);
  });
});
