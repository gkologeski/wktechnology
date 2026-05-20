import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { authenticateApiKey, requireScope, unauthorized } from "@/lib/api-keys/auth.server";

export const Route = createFileRoute("/api/public/v1/deals")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await authenticateApiKey(request);
        if (!auth) return unauthorized();
        const denied = requireScope(auth, "read");
        if (denied) return denied;
        const url = new URL(request.url);
        const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);
        const { data } = await supabaseAdmin
          .from("deals")
          .select("id, name, amount, stage, stage_id, created_at")
          .eq("owner_id", auth.ownerId)
          .order("created_at", { ascending: false })
          .limit(limit);
        return Response.json({ data: data ?? [] });
      },
    },
  },
});
