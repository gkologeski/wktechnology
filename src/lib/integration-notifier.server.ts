// Helper legado para integrações Zapier. Slack usa o ledger da NOTIFICA-CENTRAL.
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

// Slack runs exclusively through send_slack + the fenced notification ledger.
// This old helper has no workflow/run/source proof and must never post to Slack.

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
    await dispatchZapier(payload);
  } catch (e) {
    console.error("[integration-notifier] dispatch failed", e);
  }
}
