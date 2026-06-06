// Vapi webhook — receives status-update, end-of-call-report, transcript events.
// Auth: header `x-vapi-secret`/signature or Vapi assistant.server.secret payload
// compared against VAPI_WEBHOOK_SECRET.
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabaseAdmin as any;

export const Route = createFileRoute("/api/public/hooks/vapi")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.VAPI_WEBHOOK_SECRET;
        if (!expected) return new Response("Server misconfigured", { status: 500 });
        const got = request.headers.get("x-vapi-secret") ?? request.headers.get("x-vapi-signature") ?? "";

        let body: { message?: Record<string, unknown> } & Record<string, unknown>;
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return new Response("Bad JSON", { status: 400 });
        }
        const msg = (body.message ?? body) as Record<string, unknown>;
        const payloadSecret = String(msg.secret ?? body.secret ?? "");
        if (got !== expected && payloadSecret !== expected) return new Response("Unauthorized", { status: 401 });

        const type = String(msg.type ?? "");
        const call = (msg.call as Record<string, unknown> | undefined) ?? undefined;
        const callId = (call?.id as string | undefined) ?? (msg.callId as string | undefined);
        if (!callId) return Response.json({ ok: true, skipped: "no call id" });

        const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

        if (type === "status-update") {
          const status = String(msg.status ?? "").toLowerCase();
          if (typeof msg.endedReason === "string") updates.ended_reason = msg.endedReason;
          const map: Record<string, string> = {
            queued: "queued",
            ringing: "ringing",
            "in-progress": "in_progress",
            forwarding: "in_progress",
            ended: "completed",
          };
          if (map[status]) updates.status = map[status];
          if (status === "ended") {
            updates.ended_at = new Date().toISOString();
            const reason = String(msg.endedReason ?? "").toLowerCase();
            if (reason.includes("no-answer")) updates.status = "no_answer";
            else if (reason.includes("busy")) updates.status = "busy";
            else if (reason.includes("failed") || reason.includes("error")) updates.status = "failed";
          }
        } else if (type === "end-of-call-report") {
          updates.status = "completed";
          updates.ended_at = new Date().toISOString();
          if (typeof msg.durationSeconds === "number") updates.duration_seconds = msg.durationSeconds;
          if (typeof msg.cost === "number") updates.cost_usd = msg.cost;
          const artifact = msg.artifact as Record<string, unknown> | undefined;
          if (artifact) {
            if (typeof artifact.recordingUrl === "string") updates.recording_url = artifact.recordingUrl;
            if (typeof artifact.transcript === "string") updates.transcript = artifact.transcript;
          }
          const analysis = msg.analysis as Record<string, unknown> | undefined;
          if (analysis) {
            if (typeof analysis.summary === "string") updates.summary = analysis.summary;
            if (typeof analysis.successEvaluation === "string")
              updates.success_evaluation = analysis.successEvaluation;
          }
          if (typeof msg.endedReason === "string") updates.ended_reason = msg.endedReason;

          const reason = String(msg.endedReason ?? "").toLowerCase();
          if (reason.includes("no-answer")) updates.status = "no_answer";
          else if (reason.includes("busy")) updates.status = "busy";
          else if (reason.includes("failed") || reason.includes("error")) updates.status = "failed";
        }

        const { data: row, error } = await sb
          .from("prospecting_call_attempts")
          .update(updates)
          .eq("vapi_call_id", callId)
          .select("id, workspace_id, lead_id, summary")
          .maybeSingle();
        if (error) {
          console.error("[vapi-hook]", error);
          return Response.json({ ok: false, error: error.message }, { status: 500 });
        }

        if (type === "end-of-call-report" && row?.lead_id) {
          await sb.from("activities").insert({
            workspace_id: row.workspace_id,
            owner_id: row.workspace_id,
            type: "call",
            related_lead_id: row.lead_id,
            subject: "Chamada do agente de voz (Vapi)",
            description: row.summary ?? (updates.transcript as string | undefined) ?? null,
          });
        }

        return Response.json({ ok: true });
      },
      GET: async () => Response.json({ ok: true, info: "Vapi webhook — POST with x-vapi-secret header" }),
    },
  },
});
