// GET /api/public/refer/$slug — dados públicos do programa de indicação.
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const Route = createFileRoute("/api/public/refer/$slug")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      GET: async ({ params }) => {
        const { data, error } = await supabaseAdmin
          .from("ats_referral_programs_public")
          .select("id, public_slug, name, landing_headline, landing_body, terms_url")
          .eq("public_slug", params.slug)
          .maybeSingle();
        if (error) return Response.json({ error: error.message }, { status: 500, headers: cors });
        if (!data) return Response.json({ error: "Not found" }, { status: 404, headers: cors });
        return Response.json({ program: data }, { headers: cors });
      },
    },
  },
});
