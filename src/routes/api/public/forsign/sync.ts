import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

// Rotina periódica: confere no ForSign os envios ainda pendentes (caso um aviso se perca).
export const Route = createFileRoute("/api/public/forsign/sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        const { syncPending } = await import("@/lib/integrations/forsign/forsign-service.server");
        return Response.json(await syncPending());
      },
    },
  },
});
