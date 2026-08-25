import { createFileRoute } from "@tanstack/react-router";
import { recordTrackingEvent, verifyTrackedUrl } from "@/lib/email-tracking.server";

const FALLBACK = "https://app.wktechnology.com.br";

function parseTarget(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol === "http:" || u.protocol === "https:") return u.toString();
  } catch {
    /* ignore */
  }
  return null;
}

export const Route = createFileRoute("/api/public/email/click/$messageId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const url = new URL(request.url);
        const rawTarget = url.searchParams.get("u");
        const sig = url.searchParams.get("s") ?? "";
        const id = params.messageId ?? "";

        const candidate = parseTarget(rawTarget);
        const isValidId = /^[0-9a-f-]{36}$/i.test(id);
        const isSigned = !!candidate && isValidId && !!sig && verifyTrackedUrl(id, candidate, sig);

        // Only redirect to URLs we signed at send-time. Anything else falls
        // back to the app root so the endpoint can't be used as an open redirect.
        const target = isSigned ? (candidate as string) : FALLBACK;

        if (isValidId && isSigned) {
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
