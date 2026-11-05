#!/usr/bin/env bun
// Gera o SQL de seed idempotente da Ajuda a partir de docs/help/<módulo>/*.md.
// Uso: bun scripts/help-seed-sql.ts crm > /tmp/help-crm.sql
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArticle } from "../tests/help-coverage/help-coverage";

const mod = process.argv[2];
if (!mod) throw new Error("Informe o módulo (ex.: crm)");
const dir = join(process.cwd(), "docs/help", mod);

// Dollar-quoting com tag única evita qualquer escape no Markdown.
const q = (v: string | undefined | null) => (v ? `$hlp$${v}$hlp$` : "NULL");

const rows = readdirSync(dir)
  .filter((f) => f.endsWith(".md"))
  .sort()
  .map((f) => parseArticle(f, readFileSync(join(dir, f), "utf8")))
  .map(({ meta, body }) => {
    if (meta.module_key !== mod) throw new Error(`module_key divergente em ${meta.slug}`);
    if (body.includes("$hlp$")) throw new Error(`Corpo com marcador reservado em ${meta.slug}`);
    return `(${[
      q(meta.module_key),
      q(meta.slug),
      q(meta.title),
      q(meta.summary ?? ""),
      q(body.trim()),
      q(meta.article_type),
      q(meta.route_pattern || null),
      q(meta.min_permission || null),
      q(meta.audience || "internal"),
      Number(meta.sort_order || 0),
      Number(meta.version || 1),
      meta.is_published === "false" ? "false" : "true",
    ].join(", ")})`;
  });

console.log(`INSERT INTO public.help_articles
  (module_key, slug, title, summary, body_md, article_type, route_pattern, min_permission, audience, sort_order, version, is_published)
VALUES
${rows.join(",\n")}
ON CONFLICT (module_key, slug) DO UPDATE SET
  title = EXCLUDED.title, summary = EXCLUDED.summary, body_md = EXCLUDED.body_md,
  article_type = EXCLUDED.article_type, route_pattern = EXCLUDED.route_pattern,
  min_permission = EXCLUDED.min_permission, audience = EXCLUDED.audience,
  sort_order = EXCLUDED.sort_order, version = EXCLUDED.version, is_published = EXCLUDED.is_published
WHERE public.help_articles.version < EXCLUDED.version
   OR public.help_articles.body_md IS DISTINCT FROM EXCLUDED.body_md;`);
