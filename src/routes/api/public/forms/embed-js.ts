import { createFileRoute } from "@tanstack/react-router";
import { getRequestHost } from "@tanstack/react-start/server";
import { buildFormEmbedScript, normalizeTurnstileSiteKey } from "@/lib/forms/embed-script";

export const Route = createFileRoute("/api/public/forms/embed-js")({
  server: {
    handlers: {
      GET: async () => {
        const host = getRequestHost();
        const origin = `https://${host}`;
        // Chave pública do Turnstile (não é segredo); sem ela o envio é recusado.
        const siteKey = normalizeTurnstileSiteKey(process.env["TURNSTILE_SITE_KEY"]);
        return new Response(buildFormEmbedScript(origin, siteKey), {
          status: 200,
          headers: {
            "Content-Type": "application/javascript; charset=utf-8",
            "Cache-Control": "public, max-age=300",
            "Access-Control-Allow-Origin": "*",
          },
        });
      },
    },
  },
});
