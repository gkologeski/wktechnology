import { createFileRoute } from "@tanstack/react-router";
import { pixelResponse, recordTrackingEvent } from "@/lib/email-tracking.server";

export const Route = createFileRoute("/api/public/email/pixel/$messageId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const raw = params.messageId ?? "";
        const id = raw.replace(/\.gif$/i, "");
        if (/^[0-9a-f-]{36}$/i.test(id)) {
          try {
            await recordTrackingEvent({
              messageId: id,
              eventType: "open",
              ip:
                request.headers.get("cf-connecting-ip") ||
                request.headers.get("x-forwarded-for") ||
                null,
              userAgent: request.headers.get("user-agent"),
            });
          } catch (e) {
            console.error("[email pixel] track error", e);
          }
        }
        return pixelResponse();
      },
    },
  },
});
