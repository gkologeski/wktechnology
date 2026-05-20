import { createFileRoute } from "@tanstack/react-router";
import { tickAllCalendars } from "@/lib/calendar/engine.server";

export const Route = createFileRoute("/api/public/hooks/calendar-tick")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const res = await tickAllCalendars();
          return Response.json({ ok: true, ...res });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return Response.json({ ok: false, error: msg }, { status: 500 });
        }
      },
      GET: async () => Response.json({ ok: true, hint: "POST to run" }),
    },
  },
});
