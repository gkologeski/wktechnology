import { createFileRoute } from "@tanstack/react-router";
import { runAllAccountsSync } from "@/lib/gmail-sync.functions";

export const Route = createFileRoute("/api/public/hooks/email-sync-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Allow either an apikey header (Supabase anon) or service role header.
        const apikey = request.headers.get("apikey");
        const auth = request.headers.get("authorization") ?? "";
        const expectedAnon = process.env.SUPABASE_PUBLISHABLE_KEY;
        const expectedService = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const bearer = auth.replace(/^Bearer\s+/i, "");
        const ok =
          (!!expectedAnon && (apikey === expectedAnon || bearer === expectedAnon)) ||
          (!!expectedService && (apikey === expectedService || bearer === expectedService));
        if (!ok) return new Response("Unauthorized", { status: 401 });

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
