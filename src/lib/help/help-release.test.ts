import { describe, expect, it } from "vitest";
import { assertHelpReleaseAccess, shouldReleaseArticle } from "./help-release";
import type { HelpAccessInput } from "./help-access";

const input: HelpAccessInput = {
  activeWorkspaceId: "11111111-1111-1111-1111-111111111111",
  membershipStatus: "active",
  isPlatformAdmin: false,
  isWorkspaceAdmin: false,
  licensedModules: null,
  grants: [
    {
      workspaceId: "11111111-1111-1111-1111-111111111111",
      key: "techservice.kb.update.workspace",
      effect: "allow",
    },
  ],
};

describe("Publicação editorial da Ajuda", () => {
  it("permite editor ativo autorizado", () => {
    expect(() => assertHelpReleaseAccess(input)).not.toThrow();
  });
  it("nega sem chave", () => {
    expect(() => assertHelpReleaseAccess({ ...input, grants: [] })).toThrow();
  });
  it("nega deny explícito", () => {
    expect(() =>
      assertHelpReleaseAccess({
        ...input,
        grants: [...input.grants, { workspaceId: input.activeWorkspaceId ?? "", key: "techservice.kb.update.workspace", effect: "deny" }],
      }),
    ).toThrow();
  });
  it("nega chave de outro workspace", () => {
    expect(() =>
      assertHelpReleaseAccess({
        ...input,
        grants: [{ key: "techservice.kb.update.workspace", effect: "allow", workspaceId: "22222222-2222-2222-2222-222222222222" }],
      }),
    ).toThrow();
  });
  it("nega membro inativo", () => {
    expect(() => assertHelpReleaseAccess({ ...input, membershipStatus: "inactive" })).toThrow();
  });
  it("preserva versões iguais ou mais recentes e aplica somente versões novas", () => {
    expect(shouldReleaseArticle({ version: 3 }, { version: 2 })).toBe(false);
    expect(shouldReleaseArticle({ version: 2 }, { version: 2 })).toBe(false);
    expect(shouldReleaseArticle({ version: 1 }, { version: 2 })).toBe(true);
    expect(shouldReleaseArticle(undefined, { version: 1 })).toBe(true);
  });
});
