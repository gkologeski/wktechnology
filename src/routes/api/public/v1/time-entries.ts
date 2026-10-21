// API pública v1 — apontamentos do TechProjects.
// GET (escopo read) e POST (escopo write) executam no banco como o DONO da chave: mesma RLS,
// negações, membership ativo e regras do ciclo 3 (vínculo, sobreposição, competência fechada,
// rascunho). POST exige Idempotency-Key (ou external_id): mesmo conteúdo repete a resposta,
// conteúdo diferente com a mesma chave é recusado (409). Contrato: docs/api-publica-v1.md §11.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/v1/time-entries")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { handleListEntries } = await import("@/lib/projects/public-api.server");
        return handleListEntries(request);
      },
      POST: async ({ request }) => {
        const { handleCreateEntry } = await import("@/lib/projects/public-api.server");
        return handleCreateEntry(request);
      },
    },
  },
});
