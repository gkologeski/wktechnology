import { createFileRoute } from "@tanstack/react-router";
import { tickRefreshDynamicSegments } from "@/lib/segments/engine.server";

export const Route = createFileRoute("/api/public/hooks/segments-tick")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const result = await tickRefreshDynamicSegments();
          return new Response(JSON.stringify({ ok: true, ...result }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          return new Response(JSON.stringify({ ok: false, error: message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
      GET: async () => {
        try {
          const result = await tickRefreshDynamicSegments();
          return new Response(JSON.stringify({ ok: true, ...result }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          return new Response(JSON.stringify({ ok: false, error: message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
