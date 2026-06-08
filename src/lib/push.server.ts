// Server-only helper para enviar Web Push via Web Crypto (compatível com Workers).
import { buildPushPayload } from "@block65/webcrypto-web-push";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type Subscription = {
  endpoint: string;
  expirationTime: null;
  keys: { p256dh: string; auth: string };
};

export type PushEventType = "mention" | "assignment" | "sla" | "message" | "task" | "deal";

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
};

function getVapid() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@wktechnology.com.br";
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject };
}

export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY ?? null;
}

async function sendOne(sub: Subscription, payload: PushPayload, vapid: { publicKey: string; privateKey: string; subject: string }) {
  const req = await buildPushPayload(
    { data: JSON.stringify(payload), options: { ttl: 60 } },
    sub,
    vapid
  );
  const res = await fetch(req.url, { method: req.method, headers: req.headers, body: req.body });
  return { ok: res.ok, status: res.status, endpoint: sub.endpoint };
}

/**
 * Envia push para todos os dispositivos do user que aceitam esse tipo de evento.
 * Remove silenciosamente subscriptions inválidas (404/410).
 */
export async function sendPushToUser(userId: string, eventType: PushEventType, payload: PushPayload) {
  const vapid = getVapid();
  if (!vapid) {
    console.warn("[push] VAPID keys missing — skipping notification");
    return { sent: 0, skipped: true };
  }
  const { data: subs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth, preferences, enabled")
    .eq("user_id", userId)
    .eq("enabled", true);
  if (!subs || subs.length === 0) return { sent: 0, skipped: false };

  let sent = 0;
  const stale: string[] = [];
  await Promise.all(subs.map(async (s) => {
    const prefs = (s.preferences ?? {}) as Record<string, boolean>;
    if (prefs[eventType] === false) return;
    try {
      const r = await sendOne(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload,
        vapid
      );
      if (r.ok) {
        sent++;
        await supabaseAdmin.from("push_subscriptions").update({ last_used_at: new Date().toISOString() }).eq("id", s.id);
      } else if (r.status === 404 || r.status === 410) {
        stale.push(s.endpoint);
      }
    } catch (err) {
      console.error("[push] send error", err);
    }
  }));
  if (stale.length > 0) {
    await supabaseAdmin.from("push_subscriptions").delete().in("endpoint", stale);
  }
  return { sent, skipped: false };
}
