// Cron tick — drains queued prospecting_call_attempts (up to N per run).
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { cronBearerToken, requireCronAuth } from "@/lib/cron-auth.server";
import { startVapiCall } from "@/lib/prospecting-campaigns.functions";
import { runCronWithLogging } from "@/lib/cron-observability.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabaseAdmin as any;

const BATCH = 10;
const ACTIVE_ATTEMPT_STATUSES = ["queued", "ringing", "in_progress"];

async function pauseCampaignIfIdle(campaignId: string) {
  const { count } = await sb
    .from("prospecting_call_attempts")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .in("status", ACTIVE_ATTEMPT_STATUSES);
  if ((count ?? 0) === 0) {
    await sb
      .from("prospecting_campaigns")
      .update({ status: "paused" })
      .eq("id", campaignId)
      .eq("status", "running");
  }
}

function isInsideWindow(
  win: { start: string; end: string; timezone: string; days: number[] } | null,
): boolean {
  if (!win) return true;
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: win.timezone || "UTC",
      hour12: false,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
    const parts = fmt.formatToParts(new Date());
    const wd = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
    const hh = parts.find((p) => p.type === "hour")?.value ?? "00";
    const mm = parts.find((p) => p.type === "minute")?.value ?? "00";
    const dayIdx = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd);
    if (!win.days.includes(dayIdx)) return false;
    const cur = `${hh}:${mm}`;
    return cur >= win.start && cur <= win.end;
  } catch {
    return true;
  }
}

function pickWeighted<T extends { weight: number }>(arr: T[]): T | null {
  if (!arr.length) return null;
  const total = arr.reduce((s, v) => s + Math.max(0, v.weight), 0);
  if (total <= 0) return arr[0];
  let r = Math.random() * total;
  for (const v of arr) {
    r -= Math.max(0, v.weight);
    if (r <= 0) return v;
  }
  return arr[arr.length - 1];
}

export const Route = createFileRoute("/api/public/hooks/prospecting-dial-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = requireCronAuth(request);
        if (unauth) {
          const token = cronBearerToken(request);
          const { data: cronSetting } = await sb
            .from("app_settings")
            .select("value")
            .eq("key", "cron_secret")
            .maybeSingle();
          if (!cronSetting?.value || token !== cronSetting.value) return unauth;
        }

        const run = await runCronWithLogging("prospecting-dial-tick", async () => {
          const now = new Date().toISOString();
          const { data: queued } = await sb
            .from("prospecting_call_attempts")
            .select("id, workspace_id, campaign_id, lead_id, attempt_number")
            .eq("status", "queued")
            .lte("scheduled_at", now)
            .order("scheduled_at", { ascending: true })
            .limit(BATCH);

          const items = (queued ?? []) as Array<{
            id: string;
            workspace_id: string;
            campaign_id: string | null;
            lead_id: string | null;
            attempt_number: number;
          }>;
          let dialed = 0;
          const skipped: string[] = [];

          for (const it of items) {
            if (!it.lead_id || !it.campaign_id) {
              await sb
                .from("prospecting_call_attempts")
                .update({ status: "failed", ended_reason: "missing lead or campaign" })
                .eq("id", it.id);
              continue;
            }

            const { data: campaign } = await sb
              .from("prospecting_campaigns")
              .select("status, dialing_window, assignment_mode")
              .eq("id", it.campaign_id)
              .single();
            if (!campaign || campaign.status !== "running") {
              skipped.push(it.id);
              continue;
            }
            if (!isInsideWindow(campaign.dialing_window)) {
              skipped.push(it.id);
              continue;
            }

            const { data: variants } = await sb
              .from("prospecting_campaign_variants")
              .select("id, script_id, weight, segment_id")
              .eq("campaign_id", it.campaign_id);
            const vs = (variants ?? []) as Array<{
              id: string;
              script_id: string;
              weight: number;
              segment_id: string | null;
            }>;
            const chosen =
              campaign.assignment_mode === "weighted" ? pickWeighted(vs) : (vs[0] ?? null);
            if (!chosen) {
              await sb
                .from("prospecting_call_attempts")
                .update({ status: "failed", ended_reason: "no variants" })
                .eq("id", it.id);
              continue;
            }

            await sb
              .from("prospecting_call_attempts")
              .update({
                status: "ringing",
                variant_id: chosen.id,
                script_id: chosen.script_id,
                started_at: new Date().toISOString(),
              })
              .eq("id", it.id);

            const result = await startVapiCall({
              workspaceId: it.workspace_id,
              leadId: it.lead_id,
              scriptId: chosen.script_id,
              campaignId: it.campaign_id,
              variantId: chosen.id,
              attemptNumber: it.attempt_number,
              attemptId: it.id,
            });

            if (!result.ok) {
              await sb
                .from("prospecting_call_attempts")
                .update({ status: "failed", ended_reason: result.error ?? "unknown" })
                .eq("id", it.id);
              await pauseCampaignIfIdle(it.campaign_id);
            } else if (result.call_id) {
              await sb
                .from("prospecting_call_attempts")
                .update({ vapi_call_id: result.call_id })
                .eq("id", it.id);
              dialed += 1;
            }
          }

          return {
            dialed,
            considered: items.length,
            skipped: skipped.length,
          } as unknown as Record<string, unknown>;
        });
        if (run.status === "error")
          return Response.json({ ok: false, error: run.error }, { status: 500 });
        return Response.json({ ok: true, duration_ms: run.duration_ms, ...run.metrics });
      },
      GET: async () => Response.json({ ok: true, info: "POST with Bearer CRON_SECRET" }),
    },
  },
});
