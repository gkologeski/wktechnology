// Release 16 — Helper para disparar eventos para integrações (Slack + Zapier).
// Chame `triggerIntegrationEvent` quando algo relevante acontece no workspace.
// Idempotência e fila ficam a cargo do chamador.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type IntegrationEventPayload = {
  workspaceId: string;
  event: string;
  title: string;
  summary?: string;
  url?: string;
  data?: Record<string, unknown>;
};

async function dispatchSlack(payload: IntegrationEventPayload) {
  const { data: integ } = await supabaseAdmin
    .from("slack_integrations")
    .select("access_token,default_channel_id")
    .eq("workspace_id", payload.workspaceId)
    .maybeSingle();
  if (!integ?.access_token) return;

  const { data: routes } = await supabaseAdmin
    .from("slack_event_routes")
    .select("channel_id,enabled")
    .eq("workspace_id", payload.workspaceId)
    .eq("event_type", payload.event)
    .eq("enabled", true);

  const text =
    `*${payload.title}*` +
    (payload.summary ? `\n${payload.summary}` : "") +
    (payload.url ? `\n<${payload.url}|Abrir no CRM>` : "");

  const body: Record<string, unknown> = { text };
  // Se houver rotas específicas com channel_id, mandamos uma por canal (apenas
  // útil quando a integração é OAuth-based; com Webhook URL o canal é fixo).
  if (routes && routes.length > 0) {
    for (const r of routes) {
      await fetch(integ.access_token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, channel: r.channel_id }),
      }).catch(() => {});
    }
  } else {
    await fetch(integ.access_token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => {});
  }
}

async function dispatchZapier(payload: IntegrationEventPayload) {
  const { data: subs } = await supabaseAdmin
    .from("zapier_subscriptions")
    .select("id,target_url")
    .eq("workspace_id", payload.workspaceId)
    .eq("event", payload.event)
    .eq("active", true);
  if (!subs || subs.length === 0) return;

  await Promise.all(
    subs.map(async (s) => {
      try {
        const r = await fetch(s.target_url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: payload.event,
            title: payload.title,
            summary: payload.summary,
            url: payload.url,
            data: payload.data ?? {},
            workspace_id: payload.workspaceId,
            occurred_at: new Date().toISOString(),
          }),
        });
        await supabaseAdmin
          .from("zapier_subscriptions")
          .update({
            last_delivery_at: new Date().toISOString(),
            last_delivery_status: r.status,
            // 410 Gone = Zapier removeu o Zap → desativa
            active: r.status !== 410,
          })
          .eq("id", s.id);
      } catch {
        await supabaseAdmin
          .from("zapier_subscriptions")
          .update({
            last_delivery_at: new Date().toISOString(),
            last_delivery_status: 0,
          })
          .eq("id", s.id);
      }
    }),
  );
}

export async function triggerIntegrationEvent(payload: IntegrationEventPayload) {
  try {
    await Promise.all([dispatchSlack(payload), dispatchZapier(payload)]);
  } catch (e) {
    console.error("[integration-notifier] dispatch failed", e);
  }
}
