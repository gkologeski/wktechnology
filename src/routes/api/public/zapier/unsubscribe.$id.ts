// Release 16 — Zapier unsubscribe (REST hook).
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { authenticateApiKey, requireScope, unauthorized } from "@/lib/api-keys/auth.server";

export const Route = createFileRoute("/api/public/zapier/unsubscribe/$id")({
  server: {
    handlers: {
      DELETE: async ({ request, params }) => {
        const auth = await authenticateApiKey(request);
        if (!auth) return unauthorized();
        const denied = requireScope(auth, "write");
        if (denied) return denied;
        const id = String(params.id ?? "");
        if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "invalid_id" }, { status: 400 });
        const { error } = await supabaseAdmin
          .from("zapier_subscriptions")
          .delete()
          .eq("id", id)
          .eq("workspace_id", auth.ownerId);
        if (error) return Response.json({ error: error.message }, { status: 400 });
        return Response.json({ ok: true });
      },
    },
  },
});
