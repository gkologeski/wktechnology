// Contrato OpenAPI da API pública v1 do TechProjects (documento estático, sem dados).
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/v1/openapi.json")({
  server: {
    handlers: {
      GET: async () => {
        const { PROJECTS_OPENAPI } = await import("@/lib/projects/public-api.openapi");
        return new Response(JSON.stringify(PROJECTS_OPENAPI), {
          headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
        });
      },
    },
  },
});
