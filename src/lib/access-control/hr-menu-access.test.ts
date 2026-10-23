import { expect, it } from "vitest";
import { canSeeHrMenu } from "./hr-menu-access";
it("offboarding is independent of onboarding access", () => {
  const keys = new Set(["techpeople.onboarding.view.workspace"]);
  expect(canSeeHrMenu("/people/onboarding", keys, true)).toBe(true);
  expect(canSeeHrMenu("/people/offboarding", keys, true)).toBe(false);
});
it.each([
  "/people",
  "/people/onboarding",
  "/people/offboarding",
  "/people/onboarding-templates",
  "/candidates",
])("no role fallback without effective key for %s", (path) => {
  expect(canSeeHrMenu(path, new Set(), true)).toBe(false);
});
it("permission load failure hides even a previously allowed menu", () => {
  expect(canSeeHrMenu("/candidates", new Set(["techhire.candidates.view.workspace"]), false)).toBe(
    false,
  );
});
it("does not change menus outside this batch", () => {
  expect(canSeeHrMenu("/deals", new Set(), false)).toBe(true);
});
