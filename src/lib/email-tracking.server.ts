// Server-only helpers for email open/click tracking.
import { createHmac, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export function trackingBaseUrl(): string {
  return (
    process.env.APP_BASE_URL ||
    process.env.PUBLIC_APP_URL ||
    "https://app.wktechnology.com.br"
  ).replace(/\/+$/, "");
}

function trackingSecret(): string {
  return (
    process.env.EMAIL_TRACKING_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "lovable-email-tracking-fallback"
  );
}

export function signTrackedUrl(messageId: string, url: string): string {
  return createHmac("sha256", trackingSecret())
    .update(`${messageId}:${url}`)
    .digest("hex")
    .slice(0, 32);
}

export function verifyTrackedUrl(messageId: string, url: string, sig: string): boolean {
  const expected = signTrackedUrl(messageId, url);
  if (sig.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

const TRANSPARENT_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

export function pixelResponse() {
  return new Response(TRANSPARENT_GIF, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Content-Length": String(TRANSPARENT_GIF.length),
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

export function injectTracking(opts: { messageId: string; bodyHtml?: string; bodyText?: string }): {
  html: string;
  text: string;
} {
  const base = trackingBaseUrl();
  const text = opts.bodyText ?? (opts.bodyHtml ? opts.bodyHtml.replace(/<[^>]+>/g, " ") : "");
  const sourceHtml = opts.bodyHtml ?? `<p>${escapeHtml(text).replace(/\n/g, "<br>")}</p>`;

  // Rewrite <a href="..."> to go through the click tracker.
  const rewritten = sourceHtml.replace(
    /(<a\b[^>]*\bhref\s*=\s*)(["'])(.*?)\2/gi,
    (_m, prefix: string, quote: string, url: string) => {
      const trimmed = url.trim();
      if (
        !trimmed ||
        trimmed.startsWith("#") ||
        trimmed.startsWith("mailto:") ||
        trimmed.startsWith("tel:") ||
        trimmed.startsWith(`${base}/api/public/email/`)
      ) {
        return `${prefix}${quote}${url}${quote}`;
      }
      const sig = signTrackedUrl(opts.messageId, trimmed);
      const tracked = `${base}/api/public/email/click/${opts.messageId}?u=${encodeURIComponent(trimmed)}&s=${sig}`;
      return `${prefix}${quote}${tracked}${quote}`;
    },
  );

  const pixel = `<img src="${base}/api/public/email/pixel/${opts.messageId}.gif" width="1" height="1" alt="" style="display:none;border:0;outline:none;text-decoration:none" />`;
  const html = rewritten.includes("</body>")
    ? rewritten.replace("</body>", `${pixel}</body>`)
    : rewritten + pixel;

  return { html, text };
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function recordTrackingEvent(opts: {
  messageId: string;
  eventType: "open" | "click";
  url?: string;
  ip?: string | null;
  userAgent?: string | null;
}) {
  // Look up message to get owner_id and ensure it exists.
  const { data: msg } = await supabaseAdmin
    .from("email_messages")
    .select("id, owner_id, open_count, click_count, first_opened_at")
    .eq("id", opts.messageId)
    .maybeSingle();
  if (!msg) return;

  await supabaseAdmin.from("email_tracking_events").insert({
    owner_id: msg.owner_id,
    message_id: msg.id,
    event_type: opts.eventType,
    url: opts.url ?? null,
    ip: opts.ip ?? null,
    user_agent: opts.userAgent ?? null,
  });

  if (opts.eventType === "open") {
    await supabaseAdmin
      .from("email_messages")
      .update({
        open_count: (msg.open_count ?? 0) + 1,
        first_opened_at: msg.first_opened_at ?? new Date().toISOString(),
      })
      .eq("id", msg.id);
  } else {
    await supabaseAdmin
      .from("email_messages")
      .update({ click_count: (msg.click_count ?? 0) + 1 })
      .eq("id", msg.id);
  }
}
