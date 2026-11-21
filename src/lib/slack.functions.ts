import { assertSalesRecord } from "@/lib/access-control/sales-core.server";
import { requireSalesPermission } from "@/lib/access-control/sales-permission.middleware";
// Release 16 — Slack integration server functions.
// Modelo simplificado: usuário cola a Webhook URL (Incoming Webhook do Slack).
// O canal é fixo na URL. Rotas antigas são preservadas para consulta; envios
// coletivos usam exclusivamente o ledger e o modelo protegido da NOTIFICA-CENTRAL.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";

export const SLACK_EVENT_TYPES = [
  "lead.created",
  "lead.assigned",
  "deal.created",
  "deal.won",
  "deal.lost",
  "ticket.created",
  "ticket.urgent",
  "mention",
] as const;

const EventZ = z.enum(SLACK_EVENT_TYPES);

export const getSlackIntegration = createServerFn({ method: "GET" })
  .middleware([requireSalesPermission("system.integrations", "view")])
  .handler(async ({ context }) => {
    const workspaceId = await resolveActiveWorkspace(context.userId);
    const [integrationResult, routesResult] = await Promise.all([
      context.supabase
        .from("slack_integrations")
        .select(
          "id, workspace_id, owner_id, team_name, team_id, default_channel_id, default_channel_name, installed_by, created_at, updated_at",
        )
        .eq("workspace_id", workspaceId)
        .maybeSingle(),
      context.supabase
        .from("slack_event_routes")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("event_type"),
    ]);
    if (integrationResult.error || routesResult.error)
      throw new Error("Não foi possível consultar a integração Slack.");
    return { integration: integrationResult.data ?? null, routes: routesResult.data ?? [] };
  });

export const saveSlackIntegration = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("system.integrations", ["create", "update"])])
  .inputValidator((d) =>
    z
      .object({
        webhook_url: z
          .string()
          .max(500)
          .regex(
            /^https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+$/,
            "Use uma URL oficial de Incoming Webhook do Slack, sem parâmetros.",
          ),
        team_name: z.string().max(120).optional(),
        default_channel_name: z.string().max(120).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { workRpc } = await import("@/lib/access-control/work-core.server");
    await workRpc<string>(context.supabase, "sales_configure_slack", {
      p_url: data.webhook_url,
      p_team: data.team_name ?? null,
      p_channel: data.default_channel_name ?? null,
    });
    return { ok: true };
  });

export const deleteSlackIntegration = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("system.integrations", "delete")])
  .handler(async ({ context }) => {
    const workspaceId = await resolveActiveWorkspace(context.userId);
    const routes = await context.supabase
      .from("slack_event_routes")
      .delete()
      .eq("workspace_id", workspaceId);
    if (routes.error) throw new Error("Não foi possível remover as rotas antigas do Slack.");
    const { error } = await context.supabase
      .from("slack_integrations")
      .delete()
      .eq("workspace_id", workspaceId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const upsertSlackRoute = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("system.integrations", ["create", "update"])])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().optional(),
        event_type: EventZ,
        channel_id: z.string().min(1).max(120),
        channel_name: z.string().max(120).optional(),
        enabled: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    if (data.id) await assertSalesRecord(context.supabase, "slack_event_routes", data.id, "update");

    const workspaceId = await resolveActiveWorkspace(context.userId);
    if (data.id) {
      const { error } = await context.supabase
        .from("slack_event_routes")
        .update({
          event_type: data.event_type,
          channel_id: data.channel_id,
          channel_name: data.channel_name ?? null,
          enabled: data.enabled,
        })
        .eq("id", data.id)
        .eq("workspace_id", workspaceId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase.from("slack_event_routes").insert({
        workspace_id: workspaceId,
        owner_id: context.userId,
        event_type: data.event_type,
        channel_id: data.channel_id,
        channel_name: data.channel_name ?? null,
        enabled: data.enabled,
      });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteSlackRoute = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("system.integrations", "delete")])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    if (data.id) await assertSalesRecord(context.supabase, "slack_event_routes", data.id, "delete");

    const workspaceId = await resolveActiveWorkspace(context.userId);
    const { error } = await context.supabase
      .from("slack_event_routes")
      .delete()
      .eq("id", data.id)
      .eq("workspace_id", workspaceId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sendSlackTest = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("system.integrations", "manage")])
  .handler(async ({ context }) => {
    const workspaceId = await resolveActiveWorkspace(context.userId);
    const { data: visible, error } = await context.supabase
      .from("slack_integrations")
      .select("id")
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (error || !visible) throw new Error("Integração indisponível.");
    await assertSalesRecord(context.supabase, "slack_integrations", visible.id, "manage");
    // Configuration-only: no credentials are read and no untracked POST is allowed.
    // A real acceptance is recorded only by the guarded workflow worker.
    return { ok: true, configurationOnly: true };
  });
