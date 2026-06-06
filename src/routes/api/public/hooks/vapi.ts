// Vapi webhook — receives status-update, end-of-call-report, transcript events.
// Auth: header `x-vapi-secret`/signature or Vapi assistant.server.secret payload
// compared against VAPI_WEBHOOK_SECRET.
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { isRetriableEndedReason } from "@/lib/prospecting-ended-reason";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabaseAdmin as any;

const ACTIVE_ATTEMPT_STATUSES = ["queued", "ringing", "in_progress"];
const STOPPING_ATTEMPT_STATUSES = ["failed", "no_answer", "busy", "canceled"];

async function maybeRequeueAttempt(row: {
  id: string;
  workspace_id: string;
  campaign_id: string | null;
  lead_id: string | null;
  attempt_number: number | null;
} | null, endedReason: string | null): Promise<boolean> {
  if (!row?.campaign_id || !row.lead_id) return false;
  if (!isRetriableEndedReason(endedReason)) return false;

  const { data: c } = await sb
    .from("prospecting_campaigns")
    .select("status, max_attempts, retry_interval_minutes")
    .eq("id", row.campaign_id)
    .maybeSingle();
  if (!c) return false;
  const maxAttempts = (c.max_attempts as number | undefined) ?? 1;
  const retryMin = (c.retry_interval_minutes as number | undefined) ?? 240;
  const current = row.attempt_number ?? 1;
  if (current >= maxAttempts) return false;

  // Conta tentativas existentes do lead para evitar duplicar enfileiramento.
  const { data: existing } = await sb
    .from("prospecting_call_attempts")
    .select("status, attempt_number")
    .eq("campaign_id", row.campaign_id)
    .eq("lead_id", row.lead_id);
  const rows = (existing ?? []) as Array<{ status: string; attempt_number: number | null }>;
  const hasPending = rows.some((r) => ACTIVE_ATTEMPT_STATUSES.includes(r.status));
  if (hasPending) return false;
  const highest = rows.reduce((m, r) => Math.max(m, r.attempt_number ?? 0), 0);
  if (highest >= maxAttempts) return false;

  const scheduledAt = new Date(Date.now() + retryMin * 60_000).toISOString();
  await sb.from("prospecting_call_attempts").insert({
    workspace_id: row.workspace_id,
    owner_id: row.workspace_id,
    campaign_id: row.campaign_id,
    lead_id: row.lead_id,
    status: "queued",
    attempt_number: highest + 1,
    scheduled_at: scheduledAt,
  });

  // Garante que a campanha siga ativa para o cron pegar o próximo tick.
  await sb
    .from("prospecting_campaigns")
    .update({ status: "running" })
    .eq("id", row.campaign_id)
    .in("status", ["paused", "done"]);
  return true;
}

async function settleCampaignIfIdle(campaignId: string | null | undefined, attemptStatus: unknown) {
  if (!campaignId || typeof attemptStatus !== "string") return;
  const { count } = await sb
    .from("prospecting_call_attempts")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .in("status", ACTIVE_ATTEMPT_STATUSES);
  if ((count ?? 0) > 0) return;

  const nextStatus = attemptStatus === "completed" ? "done" : STOPPING_ATTEMPT_STATUSES.includes(attemptStatus) ? "paused" : null;
  if (!nextStatus) return;
  await sb.from("prospecting_campaigns").update({ status: nextStatus }).eq("id", campaignId).eq("status", "running");
}

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
          .select("id, workspace_id, campaign_id, lead_id, summary")
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

        await settleCampaignIfIdle(row?.campaign_id as string | null | undefined, updates.status);

        return Response.json({ ok: true });
      },
      GET: async () => Response.json({ ok: true, info: "Vapi webhook — POST with x-vapi-secret header" }),
    },
  },
});
