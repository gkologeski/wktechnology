#!/usr/bin/env bun
// Cobertura da Área de Ajuda: toda tela autenticada oficial precisa de artigo
// vinculado por route_pattern; todo artigo precisa de module_key válido e das
// seções obrigatórias do template. Fonte dos artigos: docs/help/<módulo>/<slug>.md
// (o mesmo conteúdo gravado no banco pelas migrations de seed da Fase 2).
// Uso: bun run help:coverage [--module crm] [--json]
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { MODULE_ROUTES } from "./module-routes";

const ROOT = process.cwd();
const ROUTES_DIR = join(ROOT, "src/routes");
const HELP_DIR = join(ROOT, "docs/help");
const MODULES = ["crm", "ats", "people", "contracts", "projects", "finance", "core", "platform"];
const TYPES = ["overview", "howto", "reference", "faq", "quickstart", "troubleshooting"];
const HOWTO_SECTIONS = [
  "**Para que serve:**",
  "**Quem pode fazer:**",
  "**Onde fica:**",
  "**Antes de começar:**",
  "## Passo a passo",
  "## Resultado esperado",
  "## Regras e limites",
  "## Erros comuns",
  "## Relacionados",
];
// Somente o que é oficial entra na Ajuda: protótipos ficam fora (decisão de 05/11/2026).
const EXCLUDED = [/\/prototype(\/|$)/];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

export function normalizeRoutePath(raw: string): string {
  const segs = raw
    .split("/")
    .filter((s) => s && !s.startsWith("_") && !/^\(.*\)$/.test(s))
    .map((s) => s.replace(/_$/, ""));
  return "/" + segs.join("/");
}

export function listScreenRoutes(): string[] {
  const out = new Set<string>();
  for (const file of walk(ROUTES_DIR)) {
    if (!/\.tsx?$/.test(file) || file.includes("routeTree.gen")) continue;
    const rel = relative(ROUTES_DIR, file);
    if (rel.startsWith("api") || !rel.startsWith("_authenticated")) continue;
    const src = readFileSync(file, "utf8");
    const m = /createFileRoute\(\s*["'`]([^"'`]+)["'`]\s*\)/.exec(src);
    if (!m || !/component\s*:/.test(src)) continue; // redirecionamentos e layouts puros
    if (/<Outlet\s*\/>/.test(src) && !/useQuery|useSuspenseQuery|<form|<table/i.test(src)) continue;
    const path = normalizeRoutePath(m[1]);
    if (path === "/" || EXCLUDED.some((r) => r.test(path))) continue;
    out.add(path.length > 1 ? path.replace(/\/$/, "") : path);
  }
  return [...out].sort();
}

type Article = { file: string; meta: Record<string, string>; body: string };

export function parseArticle(file: string, text: string): Article {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text);
  const meta: Record<string, string> = {};
  if (m) {
    for (const line of m[1].split("\n")) {
      const kv = /^([a-z_]+):\s*(.*)$/.exec(line.trim());
      if (kv) meta[kv[1]] = kv[2].replace(/^["']|["']$/g, "");
    }
  }
  return { file, meta, body: m ? m[2] : text };
}

export function listArticles(): Article[] {
  let files: string[] = [];
  try {
    files = walk(HELP_DIR);
  } catch {
    return [];
  }
  return files
    .filter((f) => f.endsWith(".md") && relative(HELP_DIR, f).includes("/"))
    .map((f) => parseArticle(relative(ROOT, f), readFileSync(f, "utf8")));
}

function patternMatches(pattern: string, path: string): boolean {
  const a = pattern.replace(/\/$/, "").split("/");
  const b = path.split("/");
  return a.length === b.length && a.every((s, i) => s.startsWith("$") || s === b[i]);
}

function main() {
  const args = process.argv.slice(2);
  const only = args.includes("--module") ? args[args.indexOf("--module") + 1] : null;
  const routes = listScreenRoutes();
  const articles = listArticles().filter((a) => !only || a.meta.module_key === only);

  const invalidModule = articles.filter((a) => !MODULES.includes(a.meta.module_key ?? ""));
  const badMeta = articles.filter(
    (a) => !a.meta.slug || !a.meta.title || !TYPES.includes(a.meta.article_type ?? ""),
  );
  const missingSections = articles
    .map((a) => ({
      file: a.file,
      missing: (a.meta.article_type === "howto" ? HOWTO_SECTIONS : ["# "]).filter(
        (s) => !a.body.includes(s),
      ),
    }))
    .filter((x) => x.missing.length > 0);
  const published = articles.filter((a) => a.meta.is_published !== "false" && a.meta.route_pattern);
  const uncovered = routes.filter(
    (r) => !published.some((a) => patternMatches(a.meta.route_pattern!, r)),
  );
  // Com --module, mede a cobertura das telas daquele módulo (inventário aprovado).
  const moduleRoutes = only ? MODULE_ROUTES[only] : null;
  const uncoveredScoped = only
    ? (moduleRoutes ?? []).filter(
        (r) => !published.some((a) => patternMatches(a.meta.route_pattern!, r)),
      )
    : uncovered;

  const report = {
    routes: moduleRoutes ? moduleRoutes.length : routes.length,
    articles: articles.length,
    covered: moduleRoutes
      ? moduleRoutes.length - uncoveredScoped.length
      : routes.length - uncovered.length,
    uncovered: uncoveredScoped,
    invalidModule: invalidModule.map((a) => a.file),
    invalidMetadata: badMeta.map((a) => a.file),
    missingSections,
  };
  if (args.includes("--json")) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`Telas oficiais autenticadas: ${report.routes}`);
    console.log(`Artigos encontrados: ${report.articles}`);
    console.log(`Telas cobertas: ${report.covered}/${report.routes}`);
    if (uncoveredScoped.length)
      console.log(
        `\n(a) Telas sem artigo (${uncoveredScoped.length}):\n  ` + uncoveredScoped.join("\n  "),
      );
    if (invalidModule.length)
      console.log(`\n(b) Artigos com module_key inválido:\n  ` + report.invalidModule.join("\n  "));
    if (badMeta.length)
      console.log(`\nArtigos com metadados incompletos:\n  ` + report.invalidMetadata.join("\n  "));
    if (missingSections.length)
      console.log(
        `\n(c) Artigos sem seções obrigatórias:\n` +
          missingSections.map((m) => `  ${m.file}: ${m.missing.join(", ")}`).join("\n"),
      );
  }
  const failed =
    uncoveredScoped.length + invalidModule.length + badMeta.length + missingSections.length > 0;
  process.exit(failed ? 1 : 0);
}

if (import.meta.main) main();
