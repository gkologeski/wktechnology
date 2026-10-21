// Readiness: confirma que o banco responde (consulta mínima a um catálogo global, sem linhas de
// cliente). Devolve só situação e latência; nunca mensagens internas, PII ou segredos.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/health/ready")({
  server: {
    handlers: {
      GET: async () => {
        const started = Date.now();
        let db: "ok" | "fail" = "fail";
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { error } = await supabaseAdmin
            .from("modules")
            .select("id", { head: true, count: "exact" })
            .limit(1);
          db = error ? "fail" : "ok";
        } catch {
          db = "fail";
        }
        const body = {
          status: db === "ok" ? "ready" : "degraded",
          checks: { database: db },
          latency_ms: Date.now() - started,
          time: new Date().toISOString(),
        };
        console.log(JSON.stringify({ evt: "health.ready", ...body }));
        return new Response(JSON.stringify(body), {
          status: db === "ok" ? 200 : 503,
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
