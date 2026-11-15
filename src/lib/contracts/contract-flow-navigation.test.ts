import { expect, it } from "vitest";
import { isRedirect } from "@tanstack/react-router";
import { Route as legacy } from "@/routes/_authenticated/settings.contract-draft-approvers";
import { CONTRACTS_SIDEBAR_GROUPS } from "@/lib/menu-config-contracts";
import { canSeeHrMenu } from "@/lib/access-control/hr-menu-access";
import { resourcesForUrl } from "@/lib/menu-resources";
import { detectModuleFromPath } from "@/lib/modules/active-module";
import { prettifySegment } from "@/lib/breadcrumb-labels";
const path = "/contracts/contracting-flow";
const key = "techcontracts.contract_draft_approvers.manage.workspace";
it("contract flow stays in TechContracts with a translated breadcrumb and the existing resource", () => {
  const menu = CONTRACTS_SIDEBAR_GROUPS.flatMap((g) => g.items);
  expect(menu.find((i) => i.title === "Fluxo de contratação")?.url).toBe(path);
  expect(menu.some((i) => i.url === "/settings/contract-draft-approvers")).toBe(false);
  expect(detectModuleFromPath(path)).toBe("contracts");
  expect(path.split("/").filter(Boolean).map(prettifySegment)).toEqual([
    "Contratos",
    "Fluxo de contratação",
  ]);
  expect(resourcesForUrl(path)).toEqual(["techcontracts.contract_draft_approvers"]);
});
it("contract flow menu keeps its existing manage permission rather than contract-view access", () => {
  expect(canSeeHrMenu(path, new Set([key]), true)).toBe(true);
  expect(canSeeHrMenu(path, new Set(["techcontracts.contracts.view.workspace"]), true)).toBe(false);
  expect(canSeeHrMenu(path, new Set(), true)).toBe(false);
  expect(canSeeHrMenu(path, new Set([key]), false)).toBe(false);
});
it("old bookmarks replace the settings URL with the canonical contract flow without loading data", () => {
  let result: unknown;
  try {
    legacy.options.beforeLoad!({} as never);
  } catch (e) {
    result = e;
  }
  expect(isRedirect(result)).toBe(true);
  if (isRedirect(result)) {
    expect(result.options.to).toBe(path);
    expect(result.options.replace).toBe(true);
  }
});
