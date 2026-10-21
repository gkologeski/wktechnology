// API pública v1 — projetos visíveis ao dono da chave (somente leitura, sem custos).
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/v1/projects")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { handleListProjects } = await import("@/lib/projects/public-api.server");
        return handleListProjects(request);
      },
    },
  },
});
