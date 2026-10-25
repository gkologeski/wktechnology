// Release 16 — Marketplace & Integrações: server functions.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSalesPermission } from "@/lib/access-control/sales-permission.middleware";
import { assertSalesRecord } from "@/lib/access-control/sales-core.server";
import { assertAffected } from "@/lib/access-control/rls-denied";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";

export const listMarketplaceApps = createServerFn({ method: "GET" })
  .middleware([requireSalesPermission("system.integrations", "view")])
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

    const { data: installs, error: installsError } = await context.supabase
      .from("marketplace_installations")
      .select("app_slug,status,last_test_ok,last_test_at,installed_at")
      .eq("workspace_id", workspaceId);
    if (installsError) throw installsError;
    const map = new Map((installs ?? []).map((i) => [i.app_slug, i]));
    return {
      apps: (apps ?? []).map((a) => ({ ...a, installation: map.get(a.slug) ?? null })),
    };
  });

export const getMarketplaceApp = createServerFn({ method: "GET" })
  .middleware([requireSalesPermission("system.integrations", "view")])
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
    const { data: install, error: installError } = await context.supabase
      .from("marketplace_installations")
      .select(
        "id,workspace_id,app_slug,status,last_test_at,last_test_ok,last_test_error,installed_at",
      )
      .eq("workspace_id", workspaceId)
      .eq("app_slug", data.slug)
      .maybeSingle();
    if (installError) throw installError;
    return { app, installation: install ?? null };
  });

export const installMarketplaceApp = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("system.integrations", ["create", "update"])])
  .inputValidator((d) =>
    z
      .object({
        slug: z.string().min(1).max(80),
        config: z.object({}).strict().default({}),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const workspaceId = await resolveActiveWorkspace(context.userId);
    const { data: app, error: appError } = await context.supabase
      .from("marketplace_apps")
      .select("slug")
      .eq("slug", data.slug)
      .eq("active", true)
      .maybeSingle();
    if (appError || !app) throw new Error("App não encontrado ou indisponível.");
    const { data: existing, error: existingError } = await context.supabase
      .from("marketplace_installations")
      .select("id,owner_id,installed_by")
      .eq("workspace_id", workspaceId)
      .eq("app_slug", data.slug)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing)
      await assertSalesRecord(context.supabase, "marketplace_installations", existing.id, "update");
    const { data: row, error } = await context.supabase
      .from("marketplace_installations")
      .upsert(
        {
          workspace_id: workspaceId,
          owner_id: existing?.owner_id ?? context.userId,
          app_slug: data.slug,
          status: "active",
          installed_by: existing?.installed_by ?? context.userId,
          installed_at: new Date().toISOString(),
        },
        { onConflict: "workspace_id,app_slug" },
      )
      .select(
        "id,workspace_id,app_slug,status,last_test_at,last_test_ok,last_test_error,installed_at",
      )
      .single();
    if (error) throw new Error(error.message);
    return { installation: row };
  });

export const uninstallMarketplaceApp = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("system.integrations", "delete")])
  .inputValidator((d: { slug: string }) => z.object({ slug: z.string().min(1).max(80) }).parse(d))
  .handler(async ({ data, context }) => {
    const workspaceId = await resolveActiveWorkspace(context.userId);
    const { data: removed, error } = await context.supabase
      .from("marketplace_installations")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("app_slug", data.slug)
      .select("id");
    if (error) throw new Error(error.message);
    assertAffected(removed);
    return { ok: true };
  });

export const testMarketplaceConnection = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("system.integrations", "manage")])
  .inputValidator((d: { slug: string }) => z.object({ slug: z.string().min(1).max(80) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const workspaceId = await resolveActiveWorkspace(context.userId);
    const { data: installation, error: installError } = await context.supabase
      .from("marketplace_installations")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("app_slug", data.slug)
      .single();
    if (installError) throw installError;
    await assertSalesRecord(
      context.supabase,
      "marketplace_installations",
      installation.id,
      "manage",
    );
    await assertSalesRecord(
      context.supabase,
      "marketplace_installations",
      installation.id,
      "update",
    );
    if (data.slug !== "slack")
      return {
        ok: false,
        error:
          "Este conector não oferece teste automático; confira a conexão nas configurações do serviço.",
      };
    let ok = true;
    let error_text: string | null = null;
    try {
      if (data.slug === "slack") {
        const { data: source, error: sourceError } = await context.supabase
          .from("slack_integrations")
          .select("id")
          .eq("workspace_id", workspaceId)
          .single();
        if (sourceError) throw new Error("Integração Slack indisponível.");
        await assertSalesRecord(context.supabase, "slack_integrations", source.id, "manage");
        const { data: si } = await supabaseAdmin
          .from("slack_integrations")
          .select("access_token")
          .eq("workspace_id", workspaceId)
          .eq("id", source.id)
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
      error_text =
        "Não foi possível validar a conexão Slack. Confira a configuração e as permissões.";
    }
    const { data: updated, error: updateError } = await context.supabase
      .from("marketplace_installations")
      .update({
        last_test_at: new Date().toISOString(),
        last_test_ok: ok,
        last_test_error: error_text,
        status: ok ? "active" : "error",
      })
      .eq("workspace_id", workspaceId)
      .eq("app_slug", data.slug)
      .select("id");
    if (updateError) throw updateError;
    assertAffected(updated);
    return { ok, error: error_text };
  });
