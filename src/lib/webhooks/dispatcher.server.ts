// Dispatcher de webhooks de saída + helper para enfileirar eventos.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function sign(secret: string, body: string) {
  const { createHmac } = await import("node:crypto");
  return createHmac("sha256", secret).update(body).digest("hex");
}

export async function enqueueWebhookEvent(
  ownerId: string,
  eventType: string,
  payload: Record<string, unknown>,
) {
  const { data: hooks } = await supabaseAdmin
    .from("outbound_webhooks")
    .select("id")
    .eq("owner_id", ownerId)
    .eq("active", true)
    .contains("events", [eventType]);
  if (!hooks || hooks.length === 0) return;
  const rows = hooks.map((h) => ({
    owner_id: ownerId,
    webhook_id: h.id as string,
    event_type: eventType,
    payload: payload as never,
    status: "pending" as const,
    next_retry_at: new Date().toISOString(),
  }));
  await supabaseAdmin.from("webhook_deliveries").insert(rows);
}

const MAX_ATTEMPTS = 5;

export async function runWebhookDispatch() {
  const now = new Date().toISOString();
  const { data: pending } = await supabaseAdmin
    .from("webhook_deliveries")
    .select("id, webhook_id, event_type, payload, attempt")
    .in("status", ["pending", "failed"])
    .lte("next_retry_at", now)
    .order("created_at", { ascending: true })
    .limit(50);
  if (!pending || pending.length === 0) return { processed: 0 };

  let processed = 0;
  for (const d of pending) {
    const { data: hook } = await supabaseAdmin
      .from("outbound_webhooks")
      .select("url, secret, active")
      .eq("id", d.webhook_id as string)
      .maybeSingle();
    if (!hook || !hook.active) {
      await supabaseAdmin
        .from("webhook_deliveries")
        .update({ status: "dead" })
        .eq("id", d.id as string);
      continue;
    }
    const body = JSON.stringify({
      event: d.event_type,
      data: d.payload,
      timestamp: new Date().toISOString(),
    });
    const signature = sign(hook.secret as string, body);
    let status = 0,
      text = "";
    try {
      const res = await fetch(hook.url as string, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Event": d.event_type as string,
          "X-Webhook-Signature": signature,
        },
        body,
      });
      status = res.status;
      text = (await res.text()).slice(0, 2000);
    } catch (e) {
      text = (e as Error).message.slice(0, 2000);
    }
    const ok = status >= 200 && status < 300;
    const attempt = ((d.attempt as number) ?? 0) + 1;
    const newStatus = ok ? "success" : attempt >= MAX_ATTEMPTS ? "dead" : "failed";
    const backoffMin = Math.min(60, Math.pow(2, attempt));
    await supabaseAdmin
      .from("webhook_deliveries")
      .update({
        attempt,
        status: newStatus,
        response_status: status || null,
        response_body: text,
        next_retry_at:
          ok || newStatus === "dead"
            ? null
            : new Date(Date.now() + backoffMin * 60_000).toISOString(),
        delivered_at: ok ? new Date().toISOString() : null,
      })
      .eq("id", d.id as string);
    processed++;
  }
  return { processed };
}
