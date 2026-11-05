import { describe, expect, it } from "vitest";
import { canReadHelpArticle, type HelpAccessInput } from "./help-access";
import { normalizeRoutePath } from "../../../tests/help-coverage/help-coverage";

const workspace = "11111111-1111-1111-1111-111111111111";
const other = "22222222-2222-2222-2222-222222222222";

describe.each([
  ["projects", "techprojects.projects.view.workspace"],
  ["finance", "techfinance.entries.view.workspace"],
])("Ajuda %s — autorização", (module, key) => {
  const input: HelpAccessInput = {
    activeWorkspaceId: workspace,
    membershipStatus: "active",
    isPlatformAdmin: false,
    isWorkspaceAdmin: false,
    licensedModules: [module],
    grants: [{ workspaceId: workspace, key, effect: "allow" }],
  };
  const article = {
    module_key: module,
    min_permission: key,
    is_published: true,
    audience: "internal",
  };
  it("permite membro ativo autorizado", () => {
    expect(canReadHelpArticle(article, input)).toBe(true);
  });
  it("nega sem a chave", () => {
    expect(canReadHelpArticle(article, { ...input, grants: [] })).toBe(false);
  });
  it("deny prevalece", () => {
    expect(
      canReadHelpArticle(article, {
        ...input,
        grants: [...input.grants, { workspaceId: workspace, key, effect: "deny" }],
      }),
    ).toBe(false);
  });
  it("nega chave de outro workspace", () => {
    expect(
      canReadHelpArticle(article, {
        ...input,
        grants: [{ workspaceId: other, key, effect: "allow" }],
      }),
    ).toBe(false);
  });
  it("nega membro inativo", () => {
    expect(canReadHelpArticle(article, { ...input, membershipStatus: "inactive" })).toBe(false);
  });
});

describe("Ajuda — caminhos oficiais do roteador", () => {
  it("remove o escape de layout sem modificar o URL público", () => {
    expect(normalizeRoutePath("/_authenticated/projects_/$id/financeiro")).toBe(
      "/projects/$id/financeiro",
    );
    expect(normalizeRoutePath("/_authenticated/sourcing/sequences_/$id")).toBe(
      "/sourcing/sequences/$id",
    );
  });
});
