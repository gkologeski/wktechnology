// Release 16 — Marketplace & Integrações: server functions.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";

export const listMarketplaceApps = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        category: z.string().max(60).optional(),
        search: z.string().max(120).optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const workspaceId = await resolveActiveWorkspace(context.userId);
    let q = context.supabase
      .from("marketplace_apps")
      .select("*")
      .eq("active", true)
      .order("sort_order", { ascending: true });
    if (data.category) q = q.eq("category", data.category);
    if (data.search) q = q.ilike("name", `%${data.search}%`);
    const { data: apps, error } = await q;
    if (error) throw new Error(error.message);

    const { data: installs } = await context.supabase
      .from("marketplace_installations")
      .select("app_slug,status,last_test_ok,last_test_at,installed_at")
      .eq("workspace_id", workspaceId);
    const map = new Map((installs ?? []).map((i) => [i.app_slug, i]));
    return {
      apps: (apps ?? []).map((a) => ({ ...a, installation: map.get(a.slug) ?? null })),
    };
  });

export const getMarketplaceApp = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { slug: string }) => z.object({ slug: z.string().min(1).max(80) }).parse(d))
  .handler(async ({ data, context }) => {
    const workspaceId = await resolveActiveWorkspace(context.userId);
    const { data: app, error } = await context.supabase
      .from("marketplace_apps")
      .select("*")
      .eq("slug", data.slug)
      .eq("active", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!app) throw new Error("App não encontrado");
    const { data: install } = await context.supabase
      .from("marketplace_installations")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("app_slug", data.slug)
      .maybeSingle();
    return { app, installation: install ?? null };
  });

export const installMarketplaceApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        slug: z.string().min(1).max(80),
        config: z.record(z.string(), z.any()).default({}),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const workspaceId = await resolveActiveWorkspace(context.userId);
    const { data: row, error } = await context.supabase
      .from("marketplace_installations")
      .upsert(
        {
          workspace_id: workspaceId,
          owner_id: workspaceId,
          app_slug: data.slug,
          config: data.config,
          status: "active",
          installed_by: context.userId,
          installed_at: new Date().toISOString(),
        },
        { onConflict: "workspace_id,app_slug" },
      )
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { installation: row };
  });

export const uninstallMarketplaceApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { slug: string }) => z.object({ slug: z.string().min(1).max(80) }).parse(d))
  .handler(async ({ data, context }) => {
    const workspaceId = await resolveActiveWorkspace(context.userId);
    const { error } = await context.supabase
      .from("marketplace_installations")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("app_slug", data.slug);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const testMarketplaceConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { slug: string }) => z.object({ slug: z.string().min(1).max(80) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const workspaceId = await resolveActiveWorkspace(context.userId);
    let ok = true;
    let error_text: string | null = null;
    try {
      if (data.slug === "slack") {
        const { data: si } = await supabaseAdmin
          .from("slack_integrations")
          .select("access_token")
          .eq("workspace_id", workspaceId)
          .maybeSingle();
        if (!si?.access_token) throw new Error("Webhook URL não configurado");
        const r = await fetch(si.access_token, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: "✅ Teste de conexão do CRM" }),
        });
        if (!r.ok) throw new Error(`Slack respondeu ${r.status}`);
      }
    } catch (e) {
      ok = false;
      error_text = e instanceof Error ? e.message : String(e);
    }
    await context.supabase
      .from("marketplace_installations")
      .update({
        last_test_at: new Date().toISOString(),
        last_test_ok: ok,
        last_test_error: error_text,
        status: ok ? "active" : "error",
      })
      .eq("workspace_id", workspaceId)
      .eq("app_slug", data.slug);
    return { ok, error: error_text };
  });
