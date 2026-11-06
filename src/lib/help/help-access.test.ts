import { describe, expect, it } from "vitest";
import {
  canEditHelp,
  canReadHelpArticle,
  canReadHelpModule,
  type HelpAccessInput,
} from "./help-access";
import { matchesRoutePattern, pickRouteArticle } from "./help-route-match";

const WS = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";

function base(over: Partial<HelpAccessInput> = {}): HelpAccessInput {
  return {
    activeWorkspaceId: WS,
    membershipStatus: "active",
    isPlatformAdmin: false,
    isWorkspaceAdmin: false,
    licensedModules: null,
    grants: [{ workspaceId: WS, key: "techsales.leads.view.own", effect: "allow" }],
    ...over,
  };
}

const article = {
  module_key: "crm",
  min_permission: "techsales.leads.view.own",
  is_published: true,
  audience: "internal",
};

describe("Ajuda — acesso por módulo e artigo", () => {
  it("allows active member with module key to read help", () => {
    expect(canReadHelpModule("crm", base())).toBe(true);
    expect(canReadHelpArticle(article, base())).toBe(true);
    expect(canReadHelpModule("core", base())).toBe(true);
  });

  it("denies help module without module key", () => {
    const input = base({ grants: [] });
    expect(canReadHelpModule("crm", input)).toBe(false);
    expect(canReadHelpArticle(article, input)).toBe(false);
    expect(canReadHelpModule("ats", base())).toBe(false);
  });

  it("denies help when explicit deny overrides grant", () => {
    const input = base({
      grants: [
        { workspaceId: WS, key: "techsales.leads.view.own", effect: "allow" },
        { workspaceId: WS, key: "techsales.leads.view.own", effect: "deny" },
      ],
    });
    expect(canReadHelpModule("crm", input)).toBe(false);
    expect(canReadHelpArticle(article, input)).toBe(false);
  });

  it("ignores help grants from foreign workspace", () => {
    const input = base({
      grants: [{ workspaceId: OTHER, key: "techsales.leads.view.own", effect: "allow" }],
    });
    expect(canReadHelpModule("crm", input)).toBe(false);
    expect(
      canEditHelp(
        base({
          grants: [{ workspaceId: OTHER, key: "techservice.kb.manage.workspace", effect: "allow" }],
        }),
      ),
    ).toBe(false);
  });

  it("denies help for inactive member", () => {
    const input = base({ membershipStatus: "inactive" });
    expect(canReadHelpModule("core", input)).toBe(false);
    expect(canReadHelpModule("crm", input)).toBe(false);
    expect(
      canEditHelp(
        base({
          membershipStatus: "inactive",
          grants: [{ workspaceId: WS, key: "techservice.kb.manage.workspace", effect: "allow" }],
        }),
      ),
    ).toBe(false);
  });

  it("hides unpublished, client and platform material from regular users", () => {
    expect(canReadHelpArticle({ ...article, is_published: false }, base())).toBe(false);
    expect(canReadHelpArticle({ ...article, audience: "client" }, base())).toBe(false);
    expect(canReadHelpModule("platform", base({ isWorkspaceAdmin: true }))).toBe(false);
    expect(canReadHelpModule("platform", base({ isPlatformAdmin: true }))).toBe(true);
  });

  it("respects module license and lets knowledge base editors edit", () => {
    expect(canReadHelpModule("crm", base({ licensedModules: ["ats"] }))).toBe(false);
    const editor = base({
      grants: [{ workspaceId: WS, key: "techservice.kb.update.workspace", effect: "allow" }],
    });
    expect(canEditHelp(editor)).toBe(true);
    expect(canEditHelp(base())).toBe(false);
  });
});

describe("Ajuda — botão ? por rota", () => {
  it("matches dynamic segments and prefers the most specific article", () => {
    expect(matchesRoutePattern("/leads/$id", "/leads/abc")).toBe(true);
    expect(matchesRoutePattern("/leads", "/leads/abc")).toBe(false);
    const rows = [
      { route_pattern: "/leads/$id", article_type: "howto", slug: "a" },
      { route_pattern: "/leads/new", article_type: "howto", slug: "b" },
    ];
    expect(pickRouteArticle(rows, "/leads/new")?.slug).toBe("b");
    expect(pickRouteArticle(rows, "/contacts")).toBeNull();
  });
});
