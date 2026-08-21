import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { authenticateApiKey, requireScope, unauthorized } from "@/lib/api-keys/auth.server";
import { jsonError } from "@/lib/api-keys/list-params.server";
import { MEETING_SELECT, syncMeetingActivity } from "@/lib/api-keys/meetings.server";

const CancelMeeting = z
  .object({ reason: z.string().max(500).optional() })
  .nullable()
  .optional();

export const Route = createFileRoute("/api/public/v1/meetings/$id/cancel")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const auth = await authenticateApiKey(request);
        if (!auth) return unauthorized();
        const denied = requireScope(auth, "write");
        if (denied) return denied;

        const body = await request.json().catch(() => null);
        const parsed = CancelMeeting.safeParse(body);
        if (!parsed.success) return jsonError("invalid_input", 400, parsed.error.flatten());
        const reason = parsed.data?.reason?.trim() || null;

        const { data: meeting } = await supabaseAdmin
          .from("meetings")
          .select(MEETING_SELECT)
          .eq("id", params.id)
          .eq("workspace_id", auth.workspaceId)
          .maybeSingle();
        if (!meeting) return jsonError("meeting_not_found", 404);

        // Idempotente: já cancelada devolve o estado atual.
        if (meeting.status === "canceled") return Response.json({ data: meeting });

        const now = new Date().toISOString();
        const { data: updated, error } = await supabaseAdmin
          .from("meetings")
          .update({ status: "canceled", ended_at: meeting.ended_at ?? now })
          .eq("id", meeting.id)
          .eq("workspace_id", auth.workspaceId)
          .select(MEETING_SELECT)
          .single();
        if (error) return jsonError(error.message, 400);

        await syncMeetingActivity(meeting.id, {
          subjectPrefix: "Cancelada",
          note: reason
            ? `Reunião cancelada via API pública. Motivo: ${reason}`
            : "Reunião cancelada via API pública.",
        });

        return Response.json({ data: updated });
      },
    },
  },
});
