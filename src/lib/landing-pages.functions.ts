import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const SlugSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9-]+$/);

async function activeWorkspace(supabase: any, userId: string): Promise<string> {
  const { data } = await supabase
    .from("profiles")
    .select("active_workspace_id")
    .eq("id", userId)
    .maybeSingle();
  if (!data?.active_workspace_id) throw new Error("Workspace ativo não encontrado");
  return data.active_workspace_id as string;
}

export const listLandingPages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase.from("landing_pages") as any)
      .select("id,slug,title,status,views_count,conversions_count,published_at,updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { pages: (data ?? []) as any[] };
  });

export const getLandingPage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await (context.supabase.from("landing_pages") as any)
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    return { page: row };
  });

export const saveLandingPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        slug: SlugSchema,
        title: z.string().min(1).max(200),
        description: z.string().max(500).optional().nullable(),
        blocks: z.array(z.any()).default([]),
        theme: z.record(z.any()).default({}),
        seo: z.record(z.any()).default({}),
        status: z.enum(["draft", "published", "archived"]).default("draft"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const ws = await activeWorkspace(context.supabase, context.userId);
    const payload = {
      owner_id: ws,
      workspace_id: ws,
      slug: data.slug,
      title: data.title,
      description: data.description ?? null,
      blocks: data.blocks,
      theme: data.theme,
      seo: data.seo,
      status: data.status,
      published_at: data.status === "published" ? new Date().toISOString() : null,
    };
    if (data.id) {
      const { error } = await (context.supabase.from("landing_pages") as any)
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await (context.supabase.from("landing_pages") as any)
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const deleteLandingPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase.from("landing_pages") as any)
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getPublishedBySlug = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => z.object({ slug: SlugSchema }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Projeção mínima: sem owner_id/assigned_to nem contadores internos.
    const { data: row } = await (supabaseAdmin.from("landing_pages") as any)
      .select("id,title,description,blocks,theme,seo,slug")
      .eq("slug", data.slug)
      .eq("status", "published")
      .maybeSingle();
    return { page: row };
  });

const LpMetadataSchema = z
  .record(z.union([z.string().max(500), z.number(), z.boolean(), z.null()]))
  .refine((o) => Object.keys(o).length <= 20, { message: "metadata: too many keys" });
const LpUtmSchema = z
  .record(z.string().max(200))
  .refine((o) => Object.keys(o).length <= 10, { message: "utm: too many keys" });

export const trackLpEvent = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        landing_page_id: z.string().uuid(),
        event_type: z.enum(["view", "conversion", "click"]),
        visitor_id: z.string().max(100).optional(),
        variant_id: z.string().uuid().optional(),
        utm: LpUtmSchema.optional(),
        metadata: LpMetadataSchema.optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: lp } = await (supabaseAdmin.from("landing_pages") as any)
      .select("owner_id")
      .eq("id", data.landing_page_id)
      .maybeSingle();
    if (!lp) return { ok: false };
    await (supabaseAdmin.from("landing_page_events") as any).insert({
      owner_id: lp.owner_id,
      workspace_id: lp.owner_id,
      landing_page_id: data.landing_page_id,
      variant_id: data.variant_id ?? null,
      event_type: data.event_type,
      visitor_id: data.visitor_id ?? null,
      utm: data.utm ?? null,
      metadata: data.metadata ?? {},
    });
    const col =
      data.event_type === "conversion"
        ? "conversions_count"
        : data.event_type === "view"
          ? "views_count"
          : null;
    if (col) {
      const { data: cur } = await (supabaseAdmin.from("landing_pages") as any)
        .select(col)
        .eq("id", data.landing_page_id)
        .single();
      const v = ((cur as Record<string, number> | null)?.[col] ?? 0) + 1;
      await (supabaseAdmin.from("landing_pages") as any)
        .update({ [col]: v })
        .eq("id", data.landing_page_id);
    }
    return { ok: true };
  });
