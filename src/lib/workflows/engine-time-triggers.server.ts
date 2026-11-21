// Fase 5c — Triggers baseados em tempo.
// Varre workflows com trigger.time_based e enfileira eventos sintéticos
// para registros que atendem à condição temporal. Usa workflow_time_cursors
// para não redisparar. Extraído de engine-runtime.server.ts sem mudança de
// comportamento.
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { workRpc } from "@/lib/access-control/work-core.server";
import { isWorkflowReadonlySource, type WorkflowEntity, type WorkflowTrigger } from "./types";
import { sanitizeWorkflowSnapshot } from "./engine/authorization.server";
import { evalConditions } from "./engine-shared.server";
import { tickWorkflows } from "./engine-runtime.server";

export async function tickTimeTriggers(supabase: SupabaseClient, limitPerWf = 100) {
  const businessLimit = Math.min(200, z.number().int().min(1).parse(limitPerWf));
  const schedules = z
    .object({
      digests_queued: z.number().int().min(0),
      followups_queued: z.number().int().min(0),
      suppressed: z.number().int().min(0),
    })
    .parse(await workRpc(supabase, "notification_schedule_tick", { p_limit: businessLimit }));
  const business = z
    .object({ enqueued: z.number().int().min(0) })
    .parse(await workRpc(supabase, "notification_business_due_tick", { p_limit: businessLimit }));
  const { data: workflows, error } = await supabase
    .from("workflows")
    .select("id, workspace_id, owner_id, entity, trigger")
    .eq("enabled", true)
    .eq("status", "published");
  if (error) throw new Error(error.message);

  let enqueued = business.enqueued;
  const wfResults: Array<{ workflow_id: string; matched: number; enqueued: number }> = [];
  for (const wf of (workflows ?? []) as Array<{
    id: string;
    owner_id: string;
    workspace_id: string;
    entity: WorkflowEntity;
    trigger: WorkflowTrigger | null;
  }>) {
    if (!wf.workspace_id) throw new Error("Workflow sem workspace de origem.");
    const trig = wf.trigger ?? ({} as WorkflowTrigger);
    // Named deadline events are minted and deduplicated by the private SQL producer.
    if (trig.notification_event || isWorkflowReadonlySource(wf.entity)) continue;
    const tb = trig.time_based;
    if (!tb) continue;
    const mult = tb.unit === "minutes" ? 60_000 : tb.unit === "hours" ? 3_600_000 : 86_400_000;
    const thresholdMs = Date.now() - tb.amount * mult;
    const thresholdIso = new Date(thresholdMs).toISOString();

    // Campo de referência por kind
    const field =
      tb.kind === "no_activity_for"
        ? "updated_at"
        : tb.kind === "stuck_in_stage_for"
          ? "moved_at"
          : (tb.field ?? "updated_at");

    const q = supabase
      .from(wf.entity as never)
      .select("*")
      .eq("owner_id", wf.owner_id)
      .eq("workspace_id", wf.workspace_id)
      .lte(field, thresholdIso)
      .limit(limitPerWf);
    const { data: records, error: recErr } = await q;
    if (recErr) {
      wfResults.push({ workflow_id: wf.id, matched: 0, enqueued: 0 });
      continue;
    }

    let localEnqueued = 0;
    const rows = sanitizeWorkflowSnapshot(
      (records ?? []) as Array<Record<string, unknown>>,
      wf.entity,
    );
    for (const rec of rows) {
      // Aplica filtros do trigger + do time_based
      const filters = [...(trig.filters ?? []), ...(tb.filters ?? [])];
      if (!evalConditions(filters, rec, null)) continue;

      // Confere cursor
      const { data: cursor } = await supabase
        .from("workflow_time_cursors")
        .select("last_fired_at")
        .eq("workflow_id", wf.id)
        .eq("entity_id", rec.id as string)
        .maybeSingle();
      const refIso = rec[field] as string | null | undefined;
      if (
        cursor &&
        refIso &&
        new Date(cursor.last_fired_at).getTime() >= new Date(refIso).getTime()
      ) {
        continue; // já disparou depois da última mudança do campo de referência
      }

      const { error: evErr } = await supabase.from("workflow_events").insert({
        workspace_id: wf.workspace_id,
        owner_id: wf.owner_id,
        entity: wf.entity,
        entity_id: rec.id as string,
        event_type: trig.event ?? "updated",
        after: rec as never,
        before: null,
      } as never);
      if (evErr) continue;

      await supabase.from("workflow_time_cursors").upsert({
        workflow_id: wf.id,
        entity_id: rec.id as string,
        owner_id: wf.owner_id,
        last_fired_at: new Date().toISOString(),
      } as never);
      localEnqueued += 1;
      enqueued += 1;
    }
    wfResults.push({ workflow_id: wf.id, matched: rows.length, enqueued: localEnqueued });
  }
  // Processa imediatamente os eventos gerados
  const tickRes =
    enqueued > 0 ? await tickWorkflows(supabase, Math.min(enqueued, 200)) : { processed: 0 };
  return { enqueued, processed: tickRes.processed, workflows: wfResults, schedules };
}
