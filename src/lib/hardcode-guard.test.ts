// Prevenção de valores chumbados (Fase 5). Roda em `bun run test`, portanto no CI.
// Para uma exceção legítima, siga docs/architecture/hardcoded-values.md.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import colorBaseline from "../../scripts/hardcode-guard/color-baseline.json";
import domainAllowlist from "../../scripts/hardcode-guard/domain-allowlist.json";
import {
  CANONICAL_APP_ORIGIN,
  EMAIL_SENDER_DOMAIN,
  PRODUCTION_APP_HOSTS,
} from "./platform-domains";
import { DEFAULT_TIME_ZONE, DEFAULT_UTC_OFFSET_MS } from "./time-zone";
import { AI_PANEL_PAGE_SIZE, DB_PAGE_MAX_ROWS, STORAGE_QUOTA_BYTES } from "./limits";

const ROOT = process.cwd();
const GENERATED = ["src/integrations/supabase/", "src/routeTree.gen.ts"];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const files = walk(join(ROOT, "src"))
  .map((p) => relative(ROOT, p))
  .filter((p) => /\.(ts|tsx)$/.test(p) && !p.endsWith(".test.ts"))
  .filter((p) => !GENERATED.some((g) => p.startsWith(g)));
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

describe("prevenção de valores chumbados", () => {
  it("não contém identificadores de projeto nem URLs de preview", () => {
    const bad = files.filter((p) =>
      /czrmhtzaeonzjmbgbabz|68dcfa85-b6da|id-preview--[0-9a-f]|project--[0-9a-f]{8}/.test(read(p)),
    );
    expect(bad).toEqual([]);
  });

  it("não contém credenciais literais", () => {
    const secret =
      /sb_secret_[A-Za-z0-9]{10,}|sk-(?:proj-|ant-)?[A-Za-z0-9_-]{24,}|AKIA[0-9A-Z]{16}|xox[bp]-[0-9A-Za-z-]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----/;
    expect(files.filter((p) => secret.test(read(p)))).toEqual([]);
  });

  it("domínios próprios só aparecem em arquivos autorizados", () => {
    const allowed = new Set(domainAllowlist as string[]);
    const bad = files.filter(
      (p) => /wktechnology\.com\.br|wkconsultoria\.com\.br/.test(read(p)) && !allowed.has(p),
    );
    expect(bad, "Use src/lib/platform-domains.ts").toEqual([]);
  });

  it("cores avulsas não aumentam em telas", () => {
    const baseline = colorBaseline as Record<string, number>;
    const pattern = /\b(?:bg|text)-(?:white|black)\b|bg-\[#/g;
    const grew = files
      .filter((p) => p.endsWith(".tsx") && /^src\/(components|routes)\//.test(p))
      .map((p) => ({ p, n: read(p).match(pattern)?.length ?? 0 }))
      .filter(({ p, n }) => n > (baseline[p] ?? 0))
      .map(({ p, n }) => `${p}: ${n} (limite ${baseline[p] ?? 0})`);
    expect(grew, "Use tokens semânticos de src/styles.css").toEqual([]);
  });
});

describe("catálogos centrais", () => {
  it("domínios", () => {
    expect(CANONICAL_APP_ORIGIN).toBe("https://app.wktechnology.com.br");
    expect(PRODUCTION_APP_HOSTS.has("app.wktechnology.com.br")).toBe(true);
    expect(EMAIL_SENDER_DOMAIN.endsWith("wktechnology.com.br")).toBe(true);
  });
  it("fuso", () => {
    expect(DEFAULT_TIME_ZONE).toBe("America/Sao_Paulo");
    expect(DEFAULT_UTC_OFFSET_MS).toBe(3 * 3600 * 1000);
  });
  it("limites", () => {
    expect(STORAGE_QUOTA_BYTES).toBe(100 * 1024 * 1024);
    expect(DB_PAGE_MAX_ROWS).toBe(1000);
    expect(AI_PANEL_PAGE_SIZE).toBeGreaterThan(0);
  });
});
