// Rebuild the fixed server-side catalogue from the official Markdown sources.
import { writeFileSync } from "node:fs";
import { listArticles } from "../tests/help-coverage/help-coverage";

const rows = listArticles()
  .sort((a, b) => a.file.localeCompare(b.file))
  .map(({ meta, body }) => ({
    module_key: meta.module_key,
    slug: meta.slug,
    title: meta.title,
    summary: meta.summary ?? "",
    article_type: meta.article_type,
    route_pattern: meta.route_pattern || null,
    min_permission: meta.min_permission || null,
    audience: meta.audience || "internal",
    sort_order: Number(meta.sort_order || 0),
    version: Number(meta.version || 1),
    is_published: meta.is_published !== "false",
    body_md: body.trim(),
  }));
writeFileSync("src/lib/help/official-catalogue.json", JSON.stringify(rows, null, 2) + "\n");
console.log(`Catálogo oficial: ${rows.length} artigos.`);
