import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function cors(extra: Record<string, string> = {}) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    ...extra,
  };
}

export const Route = createFileRoute("/api/public/forms/$slug")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors() }),
      GET: async ({ params }) => {
        const { data, error } = await supabaseAdmin
          .from("forms")
          .select("id, name, slug, fields, success_message, active")
          .eq("slug", params.slug)
          .maybeSingle();
        if (error) return Response.json({ error: error.message }, { status: 500, headers: cors() });
        if (!data || !data.active) return Response.json({ error: "Not found" }, { status: 404, headers: cors() });
        return Response.json(
          { id: data.id, name: data.name, slug: data.slug, fields: data.fields, success_message: data.success_message },
          { headers: cors({ "Cache-Control": "public, max-age=60" }) },
        );
      },
    },
  },
});
