// Server functions for Knowledge Base.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "artigo";

// ========== ADMIN ==========

export const listKbCategoriesAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ws = await resolveActiveWorkspace(context.userId);
    const { data, error } = await supabaseAdmin.from("kb_categories")
      .select("id, name, slug, description, position")
      .eq("owner_id", ws).order("position", { ascending: true }).order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertKbCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    id: z.string().uuid().optional(),
    name: z.string().min(1).max(100),
    slug: z.string().max(80).optional(),
    description: z.string().max(500).optional().nullable(),
    position: z.number().int().min(0).max(9999).default(0),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const ws = await resolveActiveWorkspace(context.userId);
    const slug = data.slug || slugify(data.name);
    const payload = { owner_id: ws, name: data.name, slug, description: data.description ?? null, position: data.position };
    if (data.id) {
      const { error } = await supabaseAdmin.from("kb_categories").update(payload).eq("id", data.id).eq("owner_id", ws);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supabaseAdmin.from("kb_categories").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteKbCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const ws = await resolveActiveWorkspace(context.userId);
    await supabaseAdmin.from("kb_categories").delete().eq("id", data.id).eq("owner_id", ws);
    return { ok: true };
  });

export const listKbArticlesAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ws = await resolveActiveWorkspace(context.userId);
    const { data, error } = await supabaseAdmin.from("kb_articles")
      .select("id, title, slug, excerpt, category_id, published, published_at, views, updated_at")
      .eq("owner_id", ws).order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getKbArticleAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const ws = await resolveActiveWorkspace(context.userId);
    const { data: row, error } = await supabaseAdmin.from("kb_articles")
      .select("*").eq("id", data.id).eq("owner_id", ws).maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Artigo não encontrado.");
    return row;
  });

export const upsertKbArticle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    id: z.string().uuid().optional(),
    title: z.string().min(2).max(200),
    slug: z.string().max(80).optional(),
    excerpt: z.string().max(500).optional().nullable(),
    body: z.string().max(50000).default(""),
    category_id: z.string().uuid().nullable().optional(),
    published: z.boolean().default(false),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const ws = await resolveActiveWorkspace(context.userId);
    const slug = data.slug || slugify(data.title);
    const payload: Record<string, unknown> = {
      owner_id: ws, title: data.title, slug, excerpt: data.excerpt ?? null,
      body: data.body, category_id: data.category_id ?? null, published: data.published,
    };
    if (data.published) payload.published_at = new Date().toISOString();
    if (data.id) {
      const { error } = await supabaseAdmin.from("kb_articles").update(payload).eq("id", data.id).eq("owner_id", ws);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supabaseAdmin.from("kb_articles").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteKbArticle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const ws = await resolveActiveWorkspace(context.userId);
    await supabaseAdmin.from("kb_articles").delete().eq("id", data.id).eq("owner_id", ws);
    return { ok: true };
  });

// ========== PÚBLICO (qualquer um) ==========

export const listKbPublic = createServerFn({ method: "GET" })
  .handler(async () => {
    // Lista todos os artigos publicados de todos workspaces (KB pública multi-tenant simples)
    const [cats, arts] = await Promise.all([
      supabaseAdmin.from("kb_categories").select("id, name, slug, description, owner_id").order("position"),
      supabaseAdmin.from("kb_articles").select("id, title, slug, excerpt, category_id, published_at, views, owner_id")
        .eq("published", true).order("published_at", { ascending: false }).limit(500),
    ]);
    return { categories: cats.data ?? [], articles: arts.data ?? [] };
  });

export const getKbArticlePublic = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ slug: z.string().min(1).max(80) }).parse(i))
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin.from("kb_articles")
      .select("id, title, slug, excerpt, body, category_id, published_at, views")
      .eq("published", true).eq("slug", data.slug).limit(1).maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Artigo não encontrado.");
    // Increment views (best-effort)
    await supabaseAdmin.from("kb_articles").update({ views: (row.views ?? 0) + 1 }).eq("id", row.id);
    return row;
  });
