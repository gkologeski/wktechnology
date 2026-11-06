import { describe, expect, it } from "vitest";
import { canReadHelpArticle, type HelpAccessInput } from "./help-access";

const workspace = "11111111-1111-1111-1111-111111111111";
const key = "techcontracts.contracts.view.own";
const input: HelpAccessInput = {
  activeWorkspaceId: workspace,
  membershipStatus: "active",
  isPlatformAdmin: false,
  isWorkspaceAdmin: false,
  licensedModules: ["contracts"],
  grants: [{ workspaceId: workspace, key, effect: "allow" }],
};
const article = {
  module_key: "contracts",
  min_permission: null,
  is_published: true,
  audience: "internal",
};

describe("Ajuda TechContracts — leitura do conteúdo oficial", () => {
  it("allows contracts help for an active licensed member", () => {
    expect(canReadHelpArticle(article, input)).toBe(true);
  });
  it("denies contracts help without a module permission", () => {
    expect(canReadHelpArticle(article, { ...input, grants: [] })).toBe(false);
  });
  it("denies contracts help when the module permission is explicitly denied", () => {
    expect(
      canReadHelpArticle(article, {
        ...input,
        grants: [...input.grants, { workspaceId: workspace, key, effect: "deny" }],
      }),
    ).toBe(false);
  });
  it("denies contracts help with only a foreign workspace grant", () => {
    expect(
      canReadHelpArticle(article, {
        ...input,
        grants: [{ workspaceId: "22222222-2222-2222-2222-222222222222", key, effect: "allow" }],
      }),
    ).toBe(false);
  });
  it("denies contracts help for an inactive workspace member", () => {
    expect(canReadHelpArticle(article, { ...input, membershipStatus: "inactive" })).toBe(false);
  });
});
