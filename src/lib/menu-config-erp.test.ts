import { describe, expect, it } from "vitest";
import { isWorkspacePathname } from "./menu-config-erp";

describe("isWorkspacePathname", () => {
  it("preserva o menu do módulo em rotas de automação", () => {
    expect(isWorkspacePathname("/settings/workflows")).toBe(false);
    expect(isWorkspacePathname("/settings/workflows/abc")).toBe(false);
    expect(isWorkspacePathname("/settings/sequences")).toBe(false);
  });
  it("mantém o shell do workspace nas demais configurações", () => {
    expect(isWorkspacePathname("/settings")).toBe(true);
    expect(isWorkspacePathname("/settings/teams")).toBe(true);
    expect(isWorkspacePathname("/settings/workflowsx")).toBe(true);
  });
});
