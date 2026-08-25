// Suggest KB articles based on a free-text query (e.g. ticket subject+description).
// Simple ranking: workspace-scoped published articles, scored by token overlap on title/excerpt/body.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";

const STOPWORDS = new Set([
  "a",
  "o",
  "as",
  "os",
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
  "ou",
  "para",
  "por",
  "com",
  "sem",
  "em",
  "no",
  "na",
  "nos",
  "nas",
  "um",
  "uma",
  "uns",
  "umas",
  "que",
  "se",
  "ao",
  "aos",
  "à",
  "às",
  "é",
  "ser",
  "sou",
  "são",
  "foi",
  "ter",
  "ter",
  "tem",
  "esse",
  "isso",
  "isto",
  "esta",
  "este",
  "estes",
  "estas",
  "meu",
  "minha",
  "seu",
  "sua",
  "the",
  "and",
  "or",
  "of",
  "to",
  "in",
  "on",
  "at",
  "for",
  "with",
  "is",
  "are",
  "be",
  "this",
  "that",
  "my",
  "your",
]);

function tokens(s: string): string[] {
  return (s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

export const suggestKbArticles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        query: z.string().max(4000).default(""),
        limit: z.number().int().min(1).max(10).default(5),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ws = await resolveActiveWorkspace(context.userId);
    const qTokens = tokens(data.query);
    if (qTokens.length === 0) return [];
    const { data: rows, error } = await supabaseAdmin
      .from("kb_articles")
      .select("id, title, slug, excerpt, body, views")
      .eq("owner_id", ws)
      .eq("published", true)
      .limit(200);
    if (error) throw new Error(error.message);
    const qSet = new Set(qTokens);
    const scored = (rows ?? [])
      .map((a) => {
        const titleT = tokens(a.title);
        const bodyT = tokens(`${a.excerpt ?? ""} ${(a.body ?? "").slice(0, 4000)}`);
        let score = 0;
        for (const t of titleT) if (qSet.has(t)) score += 3;
        for (const t of bodyT) if (qSet.has(t)) score += 1;
        return {
          id: a.id,
          title: a.title,
          slug: a.slug,
          excerpt: a.excerpt,
          views: a.views,
          score,
        };
      })
      .filter((a) => a.score > 0)
      .sort((a, b) => b.score - a.score || (b.views ?? 0) - (a.views ?? 0))
      .slice(0, data.limit);
    return scored;
  });
