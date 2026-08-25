// Release 16 — Slack integration server functions.
// Modelo simplificado: usuário cola a Webhook URL (Incoming Webhook do Slack).
// O canal alvo é definido na própria URL. Para roteamento por evento, criamos
// `slack_event_routes` que sobrescrevem o canal default por tipo de evento.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
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
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const workspaceId = await resolveActiveWorkspace(context.userId);
    const [{ data: integ }, { data: routes }] = await Promise.all([
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
    return { integration: integ ?? null, routes: routes ?? [] };
  });

export const saveSlackIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        webhook_url: z.string().url(),
        team_name: z.string().max(120).optional(),
        default_channel_name: z.string().max(120).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const workspaceId = await resolveActiveWorkspace(context.userId);
    const { error } = await context.supabase.from("slack_integrations").upsert(
      {
        workspace_id: workspaceId,
        owner_id: workspaceId,
        access_token: data.webhook_url,
        team_name: data.team_name ?? null,
        default_channel_name: data.default_channel_name ?? null,
        installed_by: context.userId,
      },
      { onConflict: "workspace_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteSlackIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const workspaceId = await resolveActiveWorkspace(context.userId);
    await context.supabase.from("slack_event_routes").delete().eq("workspace_id", workspaceId);
    const { error } = await context.supabase
      .from("slack_integrations")
      .delete()
      .eq("workspace_id", workspaceId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const upsertSlackRoute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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
        owner_id: workspaceId,
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
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
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
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const workspaceId = await resolveActiveWorkspace(context.userId);
    const { data: si } = await supabaseAdmin
      .from("slack_integrations")
      .select("access_token")
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (!si?.access_token) throw new Error("Webhook URL não configurado");
    const r = await fetch(si.access_token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: "✅ *Teste do CRM*: integração Slack ativa.",
      }),
    });
    if (!r.ok) throw new Error(`Slack respondeu ${r.status}`);
    return { ok: true };
  });
