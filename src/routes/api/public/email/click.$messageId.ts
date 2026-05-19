import { createFileRoute } from "@tanstack/react-router";
import { recordTrackingEvent } from "@/lib/email-tracking.server";

function safeRedirect(target: string | null): string {
  if (!target) return "https://wktechnology.lovable.app";
  try {
    const u = new URL(target);
    if (u.protocol === "http:" || u.protocol === "https:") return u.toString();
  } catch {
    /* ignore */
  }
  return "https://wktechnology.lovable.app";
}

export const Route = createFileRoute("/api/public/email/click/$messageId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const url = new URL(request.url);
        const target = safeRedirect(url.searchParams.get("u"));
        const id = params.messageId ?? "";
        if (/^[0-9a-f-]{36}$/i.test(id)) {
          try {
            await recordTrackingEvent({
              messageId: id,
              eventType: "click",
              url: target,
              ip:
                request.headers.get("cf-connecting-ip") ||
                request.headers.get("x-forwarded-for") ||
                null,
              userAgent: request.headers.get("user-agent"),
            });
          } catch (e) {
            console.error("[email click] track error", e);
          }
        }
        return new Response(null, {
          status: 302,
          headers: { Location: target, "Cache-Control": "no-store" },
        });
      },
    },
  },
});
