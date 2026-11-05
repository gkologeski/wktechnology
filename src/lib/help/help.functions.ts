// Server functions da Área de Ajuda e Treinamento.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  filterReadableArticles,
  loadHelpAccessInput,
  readableHelpModules,
} from "@/lib/help/help-access.server";
import { canEditHelp, canReadHelpModule } from "@/lib/help/help-access";
import { pickRouteArticle } from "@/lib/help/help-route-match";

const ARTICLE_COLUMNS =
  "id, module_key, slug, title, summary, article_type, route_pattern, min_permission, audience, sort_order, version, is_published, updated_at";

export type HelpArticleRow = {
  id: string;
  module_key: string;
  slug: string;
  title: string;
  summary: string;
  article_type: string;
  route_pattern: string | null;
  min_permission: string | null;
  audience: string;
  sort_order: number;
  version: number;
  is_published: boolean;
  updated_at: string;
};

export const getHelpHome = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const access = await loadHelpAccessInput(context.supabase, context.userId);
    const modules = readableHelpModules(access);
    if (modules.length === 0) return { modules, recent: [], quickstarts: [], counts: {} };
    const { data, error } = await context.supabase
      .from("help_articles")
      .select(ARTICLE_COLUMNS)
      .in("module_key", modules)
      .eq("is_published", true)
      .order("updated_at", { ascending: false })
      .limit(500);
    if (error) throw new Error("Não foi possível carregar a Ajuda.");
    const rows = filterReadableArticles((data ?? []) as HelpArticleRow[], access);
    const counts: Record<string, number> = {};
    for (const r of rows) counts[r.module_key] = (counts[r.module_key] ?? 0) + 1;
    return {
      modules,
      recent: rows.slice(0, 8),
      quickstarts: rows.filter((r) => r.article_type === "quickstart"),
      counts,
    };
  });

export const searchHelp = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ q: z.string().trim().min(2).max(200) }).parse(i))
  .handler(async ({ data, context }) => {
    const access = await loadHelpAccessInput(context.supabase, context.userId);
    const { data: rows, error } = await context.supabase.rpc("help_search", {
      _q: data.q,
      _limit: 30,
    });
    if (error) throw new Error("Não foi possível pesquisar na Ajuda.");
    type Hit = {
      id: string;
      module_key: string;
      slug: string;
      title: string;
      summary: string;
      article_type: string;
      snippet: string;
    };
    return ((rows ?? []) as Hit[]).filter((r) => canReadHelpModule(r.module_key, access));
  });

export const getHelpModule = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ module: z.string().max(40) }).parse(i))
  .handler(async ({ data, context }) => {
    const access = await loadHelpAccessInput(context.supabase, context.userId);
    if (!canReadHelpModule(data.module, access)) return { allowed: false, articles: [] };
    const { data: rows, error } = await context.supabase
      .from("help_articles")
      .select(ARTICLE_COLUMNS)
      .eq("module_key", data.module)
      .order("sort_order")
      .order("title");
    if (error) throw new Error("Não foi possível carregar o módulo.");
    return {
      allowed: true,
      articles: filterReadableArticles((rows ?? []) as HelpArticleRow[], access),
    };
  });

export const getHelpArticle = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ module: z.string().max(40), slug: z.string().max(120) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const access = await loadHelpAccessInput(context.supabase, context.userId);
    if (!canReadHelpModule(data.module, access))
      return { allowed: false, article: null, related: [] };
    const { data: row, error } = await context.supabase
      .from("help_articles")
      .select(`${ARTICLE_COLUMNS}, body_md`)
      .eq("module_key", data.module)
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw new Error("Não foi possível carregar o artigo.");
    const visible = row
      ? filterReadableArticles([row as HelpArticleRow & { body_md: string }], access)
      : [];
    const article = visible[0] ?? null;
    if (!article) return { allowed: true, article: null, related: [] };
    const { data: rel } = await context.supabase
      .from("help_articles")
      .select(ARTICLE_COLUMNS)
      .eq("module_key", data.module)
      .eq("is_published", true)
      .neq("id", article.id)
      .order("sort_order")
      .limit(6);
    return {
      allowed: true,
      article,
      related: filterReadableArticles((rel ?? []) as HelpArticleRow[], access),
    };
  });

export const getHelpForRoute = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ path: z.string().min(1).max(300) }).parse(i))
  .handler(async ({ data, context }) => {
    const access = await loadHelpAccessInput(context.supabase, context.userId);
    const modules = readableHelpModules(access);
    let match: HelpArticleRow | null = null;
    if (modules.length > 0) {
      const { data: rows, error } = await context.supabase
        .from("help_articles")
        .select(ARTICLE_COLUMNS)
        .in("module_key", modules)
        .eq("is_published", true)
        .not("route_pattern", "is", null)
        .limit(1000);
      if (error) throw new Error("Não foi possível consultar a Ajuda desta tela.");
      match = pickRouteArticle(
        filterReadableArticles((rows ?? []) as HelpArticleRow[], access),
        data.path,
      );
    }
    if (!match && access.membershipStatus === "active") {
      await context.supabase
        .from("help_route_misses")
        .insert({ route: data.path, user_id: context.userId });
    }
    return { article: match };
  });

export const submitHelpFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        articleId: z.string().uuid(),
        useful: z.boolean(),
        comment: z.string().trim().max(2000).optional().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const access = await loadHelpAccessInput(context.supabase, context.userId);
    const { data: row } = await context.supabase
      .from("help_articles")
      .select("module_key, min_permission, is_published, audience")
      .eq("id", data.articleId)
      .maybeSingle();
    if (
      !row ||
      filterReadableArticles([row as Parameters<typeof filterReadableArticles>[0][number]], access)
        .length === 0
    ) {
      throw new Error("Artigo indisponível.");
    }
    const { error } = await context.supabase.from("help_feedback").insert({
      article_id: data.articleId,
      user_id: context.userId,
      useful: data.useful,
      comment: data.comment || null,
    });
    if (error) throw new Error("Não foi possível registrar sua avaliação.");
    return { ok: true, canEdit: canEditHelp(access) };
  });
