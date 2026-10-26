import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { formatDateOnly } from "./crm";
import { resolveE2EEnvironment } from "../../scripts/e2e-environment.mjs";

describe("civil financial dates", () => {
  it("preserves day, month and year for date-only entries", () => {
    for (const [input, expected] of [
      ["2026-10-26", "26/10/2026"],
      ["2024-02-29", "29/02/2024"],
      ["2026-01-01", "01/01/2026"],
    ])
      expect(formatDateOnly(input)).toBe(expected);
    expect(formatDateOnly(null)).toBe("—");
  });
});

describe("home navigation destinations", () => {
  it("only renders metric links with a declared route", () => {
    const source = readFileSync("src/routes/_authenticated/home.index.tsx", "utf8");
    const mapping = source.slice(
      source.indexOf("function drillDownFor"),
      source.indexOf("function KpiTile"),
    );
    const tree = readFileSync("src/routeTree.gen.ts", "utf8");
    for (const [, path] of mapping.matchAll(/:\s*"(\/[^"]+)"/g))
      expect(tree, path).toMatch(new RegExp("'" + path + "/?'"));
    expect(mapping).not.toContain('"/finance/entries"');
  });
});

describe("isolated E2E configuration", () => {
  const env = {
    E2E_BASE_URL: "http://127.0.0.1:5175",
    E2E_SUPABASE_URL: "http://127.0.0.1:54521",
    E2E_SUPABASE_ANON_KEY: "fixture",
  };
  it("uses explicit local endpoints and matching storage key", () => {
    expect(resolveE2EEnvironment(env)).toMatchObject({
      apiURL: env.E2E_SUPABASE_URL,
      baseURL: env.E2E_BASE_URL,
      storageKey: "sb-127-auth-token",
    });
  });
  it("refuses missing configuration even with a production application environment", () => {
    expect(() => resolveE2EEnvironment({ SUPABASE_URL: "https://production.supabase.co" })).toThrow(
      /explicit/,
    );
  });
  it("refuses production database or frontend and credential-bearing URLs", () => {
    for (const patch of [
      { E2E_SUPABASE_URL: "https://production.supabase.co" },
      { E2E_BASE_URL: "https://app.wktechnology.com.br" },
      { E2E_BASE_URL: "http://user:pass@localhost:5175" },
      { E2E_BASE_URL: "http://localhost.evil.invalid" },
    ])
      expect(() => resolveE2EEnvironment({ ...env, ...patch })).toThrow(/forbidden/);
  });
});
