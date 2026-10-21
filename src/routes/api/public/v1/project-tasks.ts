// API pública v1 — tarefas de projeto visíveis ao dono da chave (somente leitura).
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/v1/project-tasks")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { handleListTasks } = await import("@/lib/projects/public-api.server");
        return handleListTasks(request);
      },
    },
  },
});
