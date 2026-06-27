// POST /api/public/hunting/templates — lista templates de mensagem do workspace.
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { authenticateApiKey, requireScope } from "@/lib/api-keys/auth.server";
import { corsPreflight, jsonResponse } from "@/lib/ats/hunting-public.server";

export const Route = createFileRoute("/api/public/hunting/templates")({
  server: {
    handlers: {
      OPTIONS: () => corsPreflight(),
      POST: async ({ request }) => {
        const auth = await authenticateApiKey(request);
        if (!auth) return jsonResponse({ error: "unauthorized" }, { status: 401 });
        const denied = requireScope(auth, "read");
        if (denied) return denied;

        const { data, error } = await supabaseAdmin
          .from("ats_hunting_templates")
          .select("id, name, channel, subject, body, is_default")
          .eq("owner_id", auth.ownerId)
          .order("is_default", { ascending: false })
          .order("created_at", { ascending: false });
        if (error) return jsonResponse({ error: error.message }, { status: 400 });
        return jsonResponse({ templates: data ?? [] });
      },
    },
  },
});
