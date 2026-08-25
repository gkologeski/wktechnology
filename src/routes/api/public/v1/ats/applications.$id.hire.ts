import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { authenticateApiKey, requireScope, unauthorized } from "@/lib/api-keys/auth.server";
import { flagDisabled, isAtsPublicApiEnabled, notFound } from "@/lib/ats/public-api.server";
import { recordAtsEvent } from "@/lib/ats/audit.server";
import { wonAtsStageValue } from "@/lib/ats/stages";

export const Route = createFileRoute("/api/public/v1/ats/applications/$id/hire")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const auth = await authenticateApiKey(request);
        if (!auth) return unauthorized();
        if (!(await isAtsPublicApiEnabled(auth.ownerId))) return flagDisabled();
        const denied = requireScope(auth, "write");
        if (denied) return denied;
        const id = params.id;
        const { data: app } = await supabaseAdmin
          .from("ats_applications")
          .select("id, owner_id, job_id, candidate_id, status")
          .eq("id", id)
          .eq("owner_id", auth.ownerId)
          .maybeSingle();
        if (!app) return notFound();
        if (app.status === "hired") {
          return Response.json({ data: app, already_hired: true });
        }
        const nowIso = new Date().toISOString();
        // Etapa de contratação do pipeline da vaga (fallback: slug padrão).
        let hiredStage = "profissional_contratado";
        const { data: job } = await supabaseAdmin
          .from("ats_jobs")
          .select("pipeline_id")
          .eq("id", app.job_id as string)
          .maybeSingle();
        if (job?.pipeline_id) {
          const { data: pipeline } = await supabaseAdmin
            .from("ats_pipelines")
            .select("stages")
            .eq("id", job.pipeline_id as string)
            .maybeSingle();
          hiredStage = wonAtsStageValue(pipeline?.stages) ?? hiredStage;
        }
        const { data: updated, error } = await supabaseAdmin
          .from("ats_applications")
          .update({ status: "hired", stage_value: hiredStage, moved_at: nowIso })
          .eq("id", id)
          .eq("owner_id", auth.ownerId)
          .select("id, job_id, candidate_id, status, stage_value, moved_at")
          .single();
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });
        await recordAtsEvent(supabaseAdmin, {
          ownerId: auth.ownerId,
          name: "ats.candidate.hired",
          entityType: "application",
          entityId: id,
          payload: {
            source: "public_api",
            key_id: auth.keyId,
            job_id: app.job_id,
            candidate_id: app.candidate_id,
          },
          dedupeKey: `ats.candidate.hired:${id}`,
        });
        return Response.json({ data: updated });
      },
    },
  },
});
