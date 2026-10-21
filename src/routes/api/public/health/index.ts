// Liveness: confirma que o servidor responde. Sem banco, sem dados, sem segredos.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/health/")({
  server: {
    handlers: {
      GET: async () =>
        new Response(JSON.stringify({ status: "ok", time: new Date().toISOString() }), {
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        }),
    },
  },
});
