import { createFileRoute } from "@tanstack/react-router";
import { runAllAccountsSync } from "@/lib/gmail-sync.functions";
import { requireCronAuth } from "@/lib/cron-auth.server";

export const Route = createFileRoute("/api/public/hooks/email-sync-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = requireCronAuth(request);
        if (unauth) return unauth;
        try {
          const summary = await runAllAccountsSync();
          return Response.json({ ok: true, ...summary });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("[email-sync-tick] error", msg);
          return Response.json({ ok: false, error: msg }, { status: 500 });
        }
      },
    },
  },
});
