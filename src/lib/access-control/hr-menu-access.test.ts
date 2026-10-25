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
  "/compliance",
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

it.each([
  "/contracts",
  "/contracts/dashboard",
  "/projects",
  "/projects/tasks",
  "/projects/dashboard",
])("work menus require keys even for a legacy privileged role: %s", (path) => {
  expect(canSeeHrMenu(path, new Set(), true)).toBe(false);
  expect(canSeeHrMenu(path, new Set(["techprojects.projects.view.workspace"]), false)).toBe(false);
});
it("project dashboard accepts task view while project list remains independent", () => {
  const keys = new Set(["techprojects.tasks.view.own"]);
  expect(canSeeHrMenu("/projects/dashboard", keys, true)).toBe(true);
  expect(canSeeHrMenu("/projects", keys, true)).toBe(false);
});
