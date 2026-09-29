import { describe, expect, it } from "vitest";
import { SIDEBAR_GROUPS } from "./menu-config";
import { ATS_SIDEBAR_GROUPS } from "./menu-config-ats";
import { CONTRACTS_SIDEBAR_GROUPS } from "./menu-config-contracts";
import { ERP_SIDEBAR_GROUPS } from "./menu-config-erp";
import { FINANCE_SIDEBAR_GROUPS } from "./menu-config-finance";
import { PEOPLE_SIDEBAR_GROUPS } from "./menu-config-people";
import { PROJECTS_SIDEBAR_GROUPS } from "./menu-config-projects";
import { MODULES } from "./modules/registry";

describe("dashboards dos módulos", () => {
  const menus = [
    [SIDEBAR_GROUPS, "/dashboard"],
    [ATS_SIDEBAR_GROUPS, "/ats-dashboard"],
    [CONTRACTS_SIDEBAR_GROUPS, "/contracts/dashboard"],
    [PROJECTS_SIDEBAR_GROUPS, "/projects/dashboard"],
    [FINANCE_SIDEBAR_GROUPS, "/finance"],
    [PEOPLE_SIDEBAR_GROUPS, "/people/dashboard"],
    [ERP_SIDEBAR_GROUPS, "/home"],
  ] as const;

  it.each(menus)("mantém Visão geral e Dashboard no topo", (groups, url) => {
    expect(groups[0]?.label).toBe("Visão geral");
    expect(groups[0]?.items[0]).toMatchObject({ title: "Dashboard", url });
  });

  it("usa os novos dashboards como entrada dos módulos", () => {
    expect(MODULES.contracts.defaultRoute).toBe("/contracts/dashboard");
    expect(MODULES.projects.defaultRoute).toBe("/projects/dashboard");
    expect(MODULES.people.defaultRoute).toBe("/people/dashboard");
  });
});