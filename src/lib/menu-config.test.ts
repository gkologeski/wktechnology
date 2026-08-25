// Garante que cada papel (admin, manager, member, platform admin) vê
// exatamente os itens corretos no Sidebar e em Configurações,
// sem vazamento entre níveis.
import { describe, expect, it } from "vitest";
import {
  SIDEBAR_GROUPS,
  SIDEBAR_PLATFORM_ITEMS,
  SETTINGS_GROUPS,
  permsForRole,
  visibleSidebarUrls,
  visibleSidebarPlatformUrls,
  visibleSettingsItems,
} from "./menu-config";

const ADMIN = permsForRole("admin");
const MANAGER = permsForRole("manager");
const MEMBER = permsForRole("member");
const PLATFORM_ADMIN = permsForRole("admin", true);

// URLs do Sidebar agrupadas por need esperado
// (hoje não há item admin-only no Sidebar — a importação do HubSpot virou Configurações)
const SIDEBAR_ADMIN_ONLY: string[] = [];
const SIDEBAR_MANAGER_PLUS = [
  "/dashboards",
  "/reports",
  "/analytics",
  "/campaigns/whatsapp",
  "/campaigns/email",
  "/landing-pages",
  "/prospecting",
  "/agents/sdr",
];

// Itens de Configurações por need esperado
const SETTINGS_PUBLIC = ["/settings", "/settings/email", "/settings/security", "/my-bug-reports"];
const SETTINGS_MANAGER_PLUS = [
  "/settings/calendars",
  "/settings/user-groups",
  "/settings/workflows",
  "/settings/sequences",
  "/settings/email-templates",
  "/settings/macros",
  "/settings/kb",
  "/settings/onboarding-templates",
];
const SETTINGS_ADMIN_ONLY = [
  "/settings/branding",
  "/settings/language",
  "/settings/billing",
  "/settings/pipelines",
  "/settings/custom-properties",
  "/settings/custom-objects",
  "/settings/teams",
  "/settings/permissions",
  "/marketplace",
  "/integrations",
  "/settings/whatsapp",
  "/settings/hubspot-sync",
  "/leads/import-hubspot",
];
const SETTINGS_PLATFORM_ONLY = [
  "/admin/status",
  "/admin/alerts",
  "/admin/security-scans",
  "/admin/quotas",
  "/admin/sandbox",
];

describe("Sidebar — visibilidade por papel", () => {
  it("member vê itens básicos e NÃO vê admin-only nem manager-plus", () => {
    const urls = visibleSidebarUrls(MEMBER);
    for (const u of SIDEBAR_ADMIN_ONLY) expect(urls).not.toContain(u);
    for (const u of SIDEBAR_MANAGER_PLUS) expect(urls).not.toContain(u);
    expect(urls).toContain("/dashboard");
    expect(urls).toContain("/leads");
    expect(visibleSidebarPlatformUrls(MEMBER)).toEqual([]);
  });

  it("manager vê manager-plus mas NÃO vê admin-only", () => {
    const urls = visibleSidebarUrls(MANAGER);
    for (const u of SIDEBAR_MANAGER_PLUS) expect(urls).toContain(u);
    for (const u of SIDEBAR_ADMIN_ONLY) expect(urls).not.toContain(u);
    expect(visibleSidebarPlatformUrls(MANAGER)).toEqual([]);
  });

  it("admin vê todos os itens não-plataforma e NÃO vê itens de plataforma", () => {
    const urls = visibleSidebarUrls(ADMIN);
    for (const u of [...SIDEBAR_MANAGER_PLUS, ...SIDEBAR_ADMIN_ONLY]) {
      expect(urls).toContain(u);
    }
    expect(visibleSidebarPlatformUrls(ADMIN)).toEqual([]);
  });

  it("platform admin vê tudo incluindo itens de plataforma", () => {
    const urls = visibleSidebarUrls(PLATFORM_ADMIN);
    const platUrls = visibleSidebarPlatformUrls(PLATFORM_ADMIN);
    for (const u of [...SIDEBAR_MANAGER_PLUS, ...SIDEBAR_ADMIN_ONLY]) {
      expect(urls).toContain(u);
    }
    expect(platUrls).toEqual(SIDEBAR_PLATFORM_ITEMS.map((i) => i.url));
  });
});

describe("Configurações — visibilidade por papel", () => {
  it("member vê apenas itens públicos (Minha conta + sem need)", () => {
    const items = visibleSettingsItems(MEMBER);
    for (const u of SETTINGS_PUBLIC) expect(items).toContain(u);
    for (const u of [...SETTINGS_MANAGER_PLUS, ...SETTINGS_ADMIN_ONLY, ...SETTINGS_PLATFORM_ONLY]) {
      expect(items).not.toContain(u);
    }
  });

  it("manager vê itens manager-plus mas NÃO vê admin-only nem plataforma", () => {
    const items = visibleSettingsItems(MANAGER);
    for (const u of [...SETTINGS_PUBLIC, ...SETTINGS_MANAGER_PLUS]) {
      expect(items).toContain(u);
    }
    for (const u of [...SETTINGS_ADMIN_ONLY, ...SETTINGS_PLATFORM_ONLY]) {
      expect(items).not.toContain(u);
    }
  });

  it("admin vê manager-plus + admin-only mas NÃO vê plataforma", () => {
    const items = visibleSettingsItems(ADMIN);
    for (const u of [...SETTINGS_PUBLIC, ...SETTINGS_MANAGER_PLUS, ...SETTINGS_ADMIN_ONLY]) {
      expect(items).toContain(u);
    }
    for (const u of SETTINGS_PLATFORM_ONLY) expect(items).not.toContain(u);
  });

  it("platform admin vê absolutamente tudo", () => {
    const items = visibleSettingsItems(PLATFORM_ADMIN);
    const all = SETTINGS_GROUPS.flatMap((g) => g.items.map((i) => i.to));
    expect(new Set(items)).toEqual(new Set(all));
  });
});

describe("Integridade da configuração de menus", () => {
  it("não há URLs duplicadas no Sidebar", () => {
    const urls = SIDEBAR_GROUPS.flatMap((g) => g.items.map((i) => i.url));
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("todo need declarado é um valor válido", () => {
    const valid = new Set([undefined, "admin", "manager", "platform"]);
    const allItems = [
      ...SIDEBAR_GROUPS.flatMap((g) => g.items),
      ...SIDEBAR_PLATFORM_ITEMS,
      ...SETTINGS_GROUPS.flatMap((g) => g.items),
    ];
    for (const it of allItems) expect(valid.has(it.need)).toBe(true);
  });
});
