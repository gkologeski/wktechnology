import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { authenticateApiKey, requireScope, unauthorized } from "@/lib/api-keys/auth.server";
import { jsonError } from "@/lib/api-keys/list-params.server";
import { MEETING_SELECT, syncMeetingActivity } from "@/lib/api-keys/meetings.server";

const RescheduleMeeting = z.object({
  scheduled_at: z.string().min(10).max(64),
  duration_minutes: z.number().int().min(5).max(24 * 60).optional(),
  reason: z.string().max(500).optional(),
});

export const Route = createFileRoute("/api/public/v1/meetings/$id/reschedule")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const auth = await authenticateApiKey(request);
        if (!auth) return unauthorized();
        const denied = requireScope(auth, "write");
        if (denied) return denied;

        const body = await request.json().catch(() => null);
        const parsed = RescheduleMeeting.safeParse(body);
        if (!parsed.success) return jsonError("invalid_input", 400, parsed.error.flatten());
        const input = parsed.data;

        const scheduledAt = new Date(input.scheduled_at);
        if (Number.isNaN(scheduledAt.getTime()))
          return jsonError("invalid_input", 400, {
            fieldErrors: { scheduled_at: ["Data inválida (use ISO 8601)."] },
          });

        const { data: meeting } = await supabaseAdmin
          .from("meetings")
          .select(MEETING_SELECT)
          .eq("id", params.id)
          .eq("workspace_id", auth.workspaceId)
          .maybeSingle();
        if (!meeting) return jsonError("meeting_not_found", 404);

        if (meeting.status === "cancelled") return jsonError("meeting_canceled", 409);
        if (meeting.status === "ended" || meeting.ended_at)
          return jsonError("meeting_already_ended", 409);

        const patch: { scheduled_at: string; status: string; expires_at?: string } = {
          scheduled_at: scheduledAt.toISOString(),
          status: "scheduled",
        };
        if (input.duration_minutes) {
          patch.expires_at = new Date(
            scheduledAt.getTime() + input.duration_minutes * 60_000,
          ).toISOString();
        }

        const { data: updated, error } = await supabaseAdmin
          .from("meetings")
          .update(patch)
          .eq("id", meeting.id)
          .eq("workspace_id", auth.workspaceId)
          .select(MEETING_SELECT)
          .single();
        if (error) return jsonError(error.message, 400);

        const previous = meeting.scheduled_at
          ? new Date(meeting.scheduled_at as string).toISOString()
          : "sem data";
        await syncMeetingActivity(meeting.id, {
          subjectPrefix: "Reagendada",
          note: `Reunião reagendada via API pública: ${previous} → ${scheduledAt.toISOString()}.${
            input.reason ? ` Motivo: ${input.reason.trim()}` : ""
          }`,
          dueDate: scheduledAt.toISOString(),
        });

        const origin = new URL(request.url).origin;
        return Response.json({
          data: {
            ...updated,
            join_url: updated.public_token ? `${origin}/meet/${updated.public_token}` : null,
          },
        });
      },
    },
  },
});
