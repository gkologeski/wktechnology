import type { SupabaseClient } from "@supabase/supabase-js";
import { requireCronAuth } from "@/lib/cron-auth.server";
import { runCronWithLogging } from "@/lib/cron-observability.server";
import { tickSequences } from "@/lib/sequences/engine.server";
import { tickSequenceSubscriptions } from "./dynamic.server";
import { reconcileSequenceVoice } from "./voice.server";
import { sequenceDeliveryPorts } from "./delivery.server";
import { sequenceHandoff } from "./handoff.server";
import { tickProspectingSequences } from "./worker.server";
/** Authenticated service entry; each subject is reauthorized again inside the worker. */
export async function scheduledSequenceTick(request: Request, admin: SupabaseClient) {
  const unauthenticated = requireCronAuth(request);
  if (unauthenticated) return unauthenticated;
  const run = await runCronWithLogging("sequences-tick", async () => {
    const failed: string[] = [],
      metrics: Record<string, unknown> = {};
    const stage = async (name: string, task: () => Promise<unknown>) => {
      try {
        metrics[name] = await task();
      } catch {
        failed.push(name);
      }
    };
    // Recover facts, then enroll, then execute. A failed independent stage cannot starve the others.
    await stage("voiceRecovery", () => reconcileSequenceVoice(admin));
    await stage("dynamicAudience", () => tickSequenceSubscriptions(admin));
    await stage("prospecting", async () => {
      const result = await tickProspectingSequences(
        admin,
        sequenceDeliveryPorts(admin, sequenceHandoff(admin)),
        5,
        20_000,
      );
      const statuses: Record<string, number> = {};
      for (const item of result.results) statuses[item.status] = (statuses[item.status] || 0) + 1;
      return {
        processed: result.processed,
        deferredByBudget: result.deferredByBudget,
        repaired: result.repaired,
        released: result.released,
        awakened: result.awakened,
        replied: result.replied,
        statuses,
      };
    });
    await stage("legacy", async () => {
      const result = await tickSequences(admin, 100);
      return { processed: result.processed, failed: result.results.filter((r) => !r.ok).length };
    });
    // Only stable stage names reach logs/HTTP; provider payloads, IDs and credentials never do.
    if (failed.length) throw new Error(`sequence_tick_stages_unavailable:${failed.join(",")}`);
    return metrics;
  });
  if (run.status === "error")
    return Response.json({ ok: false, error: run.error }, { status: 500 });
  return Response.json({ ok: true, duration_ms: run.duration_ms, ...run.metrics });
}
