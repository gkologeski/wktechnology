import { publishedLandingStatus, decideLpCount } from "@/lib/security/public-capability-guards";
import { requireSalesPermission } from "@/lib/access-control/sales-permission.middleware";
import { recordUpdatePayload } from "@/lib/access-control/record-update-payload";
import { assertSalesArea, assertSalesRecord } from "@/lib/access-control/sales-core.server";
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
  .middleware([requireSalesPermission("techsales.marketing.landing_pages", "view")])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase.from("landing_pages") as any)
      .select("id,slug,title,status,views_count,conversions_count,published_at,updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { pages: (data ?? []) as any[] };
  });

export const getLandingPage = createServerFn({ method: "GET" })
  .middleware([requireSalesPermission("techsales.marketing.landing_pages", "view")])
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
  .middleware([requireSalesPermission("techsales.marketing.landing_pages", ["create", "update"])])
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
    if (data.status === "published") {
      await assertSalesArea(context.supabase, "techsales.marketing.landing_pages", "manage");
      if (data.id) await assertSalesRecord(context.supabase, "landing_pages", data.id, "manage");
    }
    const payload = {
      owner_id: context.userId,
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
        .update(recordUpdatePayload(payload))
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
  .middleware([requireSalesPermission("techsales.marketing.landing_pages", "delete")])
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
      .eq("status", publishedLandingStatus())
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
        visitor_id: z
          .string()
          .min(16)
          .max(100)
          .regex(/^[A-Za-z0-9_-]+$/),
        variant_id: z.string().uuid().optional(),
        view_ticket: z.string().max(200).optional(),
        utm: LpUtmSchema.optional(),
        metadata: LpMetadataSchema.optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: lp } = await (supabaseAdmin.from("landing_pages") as any)
      .select("owner_id,workspace_id")
      .eq("id", data.landing_page_id)
      .eq("status", publishedLandingStatus())
      .maybeSingle();
    if (!lp) return { ok: false };
    const ticketMod = await import("@/lib/security/lp-view-ticket");
    const secret = ticketMod.lpTicketSecret();
    // Conversão exige bilhete de visita emitido por este servidor (assinado, com permanência mínima).
    if (
      data.event_type === "conversion" &&
      !ticketMod.acceptLpConversion(data.view_ticket, data.landing_page_id, data.visitor_id)
    ) {
      return { ok: false };
    }
    const viewTicket =
      data.event_type === "view"
        ? ticketMod.issueLpViewTicket(secret, data.landing_page_id, data.visitor_id)
        : undefined;
    // Contadores públicos: cada visitante conta uma vez por tipo, e conversão exige visita anterior.
    const { data: prior } = await (supabaseAdmin.from("landing_page_events") as any)
      .select("event_type")
      .eq("landing_page_id", data.landing_page_id)
      .eq("visitor_id", data.visitor_id)
      .in("event_type", ["view", data.event_type])
      .limit(10);
    const seen = new Set(((prior ?? []) as Array<{ event_type: string }>).map((r) => r.event_type));
    const decision = decideLpCount(seen, data.event_type);
    if (decision === "reject") return { ok: false };
    if (decision === "skip") return { ok: true, view_ticket: viewTicket };
    await (supabaseAdmin.from("landing_page_events") as any).insert({
      owner_id: lp.owner_id,
      workspace_id: lp.workspace_id,
      landing_page_id: data.landing_page_id,
      variant_id: data.variant_id ?? null,
      event_type: data.event_type,
      visitor_id: data.visitor_id,
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
    return { ok: true, view_ticket: viewTicket };
  });
