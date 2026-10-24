import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { authenticateApiKey, requireScope, unauthorized } from "@/lib/api-keys/auth.server";
import { flagDisabled, isAtsPublicApiEnabled, notFound } from "@/lib/ats/public-api.server";
import { recordAtsEvent } from "@/lib/ats/audit.server";
import { offerRpc } from "@/lib/ats/offer-rpc.server";
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
          .eq("workspace_id", auth.workspaceId)
          .maybeSingle();
        if (!app) return notFound();

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
        let updated: { id: string; status: string; already_hired: boolean };
        try {
          updated = await offerRpc(supabaseAdmin, "ats_api_confirm_hire", {
            _id: id,
            _key: auth.keyId,
            _stage: hiredStage,
          });
        } catch {
          return Response.json(
            { error: "Sem permissão para confirmar esta contratação." },
            { status: 403 },
          );
        }
        if (updated.already_hired) return Response.json({ data: updated, already_hired: true });
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
