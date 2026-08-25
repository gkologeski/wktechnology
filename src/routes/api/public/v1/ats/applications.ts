import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { authenticateApiKey, requireScope, unauthorized } from "@/lib/api-keys/auth.server";
import { flagDisabled, isAtsPublicApiEnabled } from "@/lib/ats/public-api.server";

const SELECT =
  "id, job_id, candidate_id, stage_value, status, source, position, ai_match_score, applied_at, moved_at, created_at, updated_at";

export const Route = createFileRoute("/api/public/v1/ats/applications")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await authenticateApiKey(request);
        if (!auth) return unauthorized();
        if (!(await isAtsPublicApiEnabled(auth.ownerId))) return flagDisabled();
        const denied = requireScope(auth, "read");
        if (denied) return denied;
        const url = new URL(request.url);
        const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);
        const jobId = url.searchParams.get("job_id");
        const status = url.searchParams.get("status");
        let q = supabaseAdmin
          .from("ats_applications")
          .select(SELECT)
          .eq("owner_id", auth.ownerId)
          .order("created_at", { ascending: false })
          .limit(limit);
        if (jobId) q = q.eq("job_id", jobId);
        if (status) q = q.eq("status", status);
        const { data, error } = await q;
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });
        return Response.json({ data: data ?? [] });
      },
    },
  },
});
