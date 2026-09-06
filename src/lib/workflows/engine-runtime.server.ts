// Ciclo de execução do motor: enfileiramento, runs, ticks de fila e de tempo.
// Extraído de engine.server.ts sem mudança de comportamento.
import type { SupabaseClient } from "@supabase/supabase-js";
import { applyRotation } from "@/lib/rotation/engine.server";
import type {
  WorkflowAction,
  WorkflowCondition,
  WorkflowEntity,
  WorkflowFilter,
  WorkflowTrigger,
} from "./types";
import { isFilterGroup } from "./types";
import { ACTION_LABELS } from "./types";
import { getPath } from "@/lib/message-tokens";
import { renderWorkflowTokens, toStr } from "./render-tokens";
import { hydrateTriggerAssociations } from "./hydrate-associations.server";
import { checkLeadDuplicate } from "@/lib/leads/lead-duplicate-check";
import {
  type AnyRow,
  type LogStep,
  evalConditions,
  getField,
} from "./engine-shared.server";
import { runActions } from "./engine-actions.server";

async function alreadyEnrolled(
  supabase: SupabaseClient,
  workflowId: string,
  entity: WorkflowEntity,
  entityId: string,
): Promise<boolean> {
  // Verifica se este workflow já rodou com sucesso para este record
  // (join workflow_runs -> workflow_events por event_id).
  const { data } = await supabase
    .from("workflow_runs")
    .select("id, workflow_events!inner(entity, entity_id)")
    .eq("workflow_id", workflowId)
    .eq("status", "success")
    .eq("workflow_events.entity", entity)
    .eq("workflow_events.entity_id", entityId)
    .limit(1);
  return (data ?? []).length > 0;
}

export async function processEvent(supabase: SupabaseClient, event: EventRow) {
  // Caso 1: retomada (delay) → executa apenas o workflow indicado a partir do cursor.
  if (event.resume_workflow_id && typeof event.resume_cursor === "number") {
    const { data: wf } = await supabase
      .from("workflows")
      .select("id, owner_id, entity, trigger, actions, goal_filters")
      .eq("id", event.resume_workflow_id)
      .maybeSingle();
    if (wf) {
      const wfr = wf as WorkflowRow;
      const hydratedAfter = await hydrateTriggerAssociations(
        supabase,
        event.entity,
        event.after,
        JSON.stringify({ t: wfr.trigger, a: wfr.actions }),
      );

      const { data: run } = await supabase
        .from("workflow_runs")
        .insert({
          owner_id: wfr.owner_id,
          workflow_id: wfr.id,
          event_id: event.id,
          entity: event.entity,
          entity_id: event.entity_id,
          status: "running",
          started_at: new Date().toISOString(),
        } as never)
        .select("id")
        .single();
      if (run) {
        const res = await runActions(
          supabase,
          wfr.actions ?? [],
          {
            entity: event.entity,
            entityId: event.entity_id,
            ownerId: event.owner_id,
            workspaceId: wfr.workspace_id,
            after: hydratedAfter,
            before: event.before,
            workflowId: wfr.id,
            runId: run.id as string,
          },
          event.resume_cursor,
        );
        await finishRun(supabase, run.id, res, event, wfr.id);
      }
    }
    await supabase
      .from("workflow_events")
      .update({ processed_at: new Date().toISOString() })
      .eq("id", event.id);
    return;
  }

  // Caso 2: evento normal (created/updated/stage_changed).
  const { data: workflows } = await supabase
    .from("workflows")
    .select("id, owner_id, entity, trigger, actions, goal_filters")
    .eq("owner_id", event.owner_id)
    .eq("entity", event.entity)
    .eq("enabled", true)
    .eq("status", "published");

  for (const wf of (workflows ?? []) as WorkflowRow[]) {
    const trig = wf.trigger ?? ({} as WorkflowTrigger);
    if (trig.event && trig.event !== event.event_type) continue;

    // Hidrata associações do gatilho (empresa, contato, negócio…) antes de
    // avaliar condições e executar ações, para resolver `{{company.name}}`.
    const hydratedAfter = await hydrateTriggerAssociations(
      supabase,
      event.entity,
      event.after,
      JSON.stringify({ t: trig, a: wf.actions }),
    );

    const filters = trig.filters ?? [];
    const passes = evalConditions(filters, hydratedAfter, event.before);
    if (!passes) continue;

    // Fase 3 — critérios de meta: se todos passam, o registro já atingiu o objetivo
    // e é removido do workflow (sem novas execuções).
    const goalFilters = trig.goal_filters ?? wf.goal_filters ?? [];
    if (goalFilters.length > 0 && evalConditions(goalFilters, hydratedAfter, event.before)) {
      continue;
    }

    // Re-enrollment: se desabilitado e já existe run bem-sucedido, pula.
    // Se habilitado, só reprocessa quando o evento atual está na lista permitida.
    const reenroll = trig.reenroll;
    if (!reenroll?.enabled) {
      const enrolled = await alreadyEnrolled(supabase, wf.id, event.entity, event.entity_id);
      if (enrolled) continue;
    } else if (
      reenroll.events &&
      reenroll.events.length > 0 &&
      !reenroll.events.includes(event.event_type as WorkflowTrigger["event"])
    ) {
      const enrolled = await alreadyEnrolled(supabase, wf.id, event.entity, event.entity_id);
      if (enrolled) continue;
    }

    // dedupe via unique (workflow_id, event_id)
    const { data: run, error: insErr } = await supabase
      .from("workflow_runs")
      .insert({
        owner_id: wf.owner_id,
        workflow_id: wf.id,
        event_id: event.id,
        entity: event.entity,
        entity_id: event.entity_id,
        status: "running",
        started_at: new Date().toISOString(),
      } as never)
      .select("id")
      .single();
    if (insErr || !run) continue;

    const res = await runActions(supabase, wf.actions ?? [], {
      entity: event.entity,
      entityId: event.entity_id,
      ownerId: event.owner_id,
      workspaceId: wf.workspace_id,
      after: hydratedAfter,
      before: event.before,
      workflowId: wf.id,
      runId: run.id as string,
    });
    await finishRun(supabase, run.id, res, event, wf.id);
  }

  await supabase
    .from("workflow_events")
    .update({ processed_at: new Date().toISOString() })
    .eq("id", event.id);
}

async function finishRun(
  supabase: SupabaseClient,
  runId: string,
  res: RunResult,
  event: EventRow,
  workflowId?: string,
) {
  // Se aguardando aprovação, deixa run em estado waiting (será retomado por decideApproval).
  if (res.waitingApproval) {
    await supabase
      .from("workflow_runs")
      .update({
        status: "waiting_approval" as never,
        log: res.log,
        finished_at: null,
      })
      .eq("id", runId);
    return;
  }
  // Se suspenso por delay, agenda novo evento de retomada.
  if (res.suspendedAt && workflowId) {
    await supabase.from("workflow_events").insert({
      owner_id: event.owner_id,
      entity: event.entity,
      entity_id: event.entity_id,
      event_type: event.event_type,
      before: event.before,
      after: event.after,
      run_at: res.suspendedAt.runAtIso,
      resume_workflow_id: workflowId,
      resume_cursor: res.suspendedAt.resumeCursor,
    } as never);
    await supabase
      .from("workflow_runs")
      .update({
        status: "success",
        log: res.log,
        finished_at: new Date().toISOString(),
      })
      .eq("id", runId);
    return;
  }
  await supabase
    .from("workflow_runs")
    .update({
      status: res.hadError ? "error" : "success",
      log: res.log,
      error: res.hadError ? (res.log[res.log.length - 1]?.error ?? null) : null,
      finished_at: new Date().toISOString(),
    })
    .eq("id", runId);
}

export async function tickWorkflows(supabase: SupabaseClient, limit = 50) {
  const nowIso = new Date().toISOString();
  const { data: events, error } = await supabase
    .from("workflow_events")
    .select(
      "id, owner_id, entity, entity_id, event_type, before, after, resume_workflow_id, resume_cursor",
    )
    .is("processed_at", null)
    .lte("run_at", nowIso)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);

  const results: Array<{ id: string; ok: boolean; error?: string }> = [];
  for (const ev of (events ?? []) as EventRow[]) {
    try {
      await processEvent(supabase, ev);
      results.push({ id: ev.id, ok: true });
    } catch (e) {
      results.push({ id: ev.id, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return { processed: results.length, results };
}

// ============================================================================
// Fase 5c — Triggers baseados em tempo.
// Varre workflows com trigger.time_based e enfileira eventos sintéticos
// para registros que atendem à condição temporal. Usa workflow_time_cursors
// para não redisparar.
// ============================================================================
export async function tickTimeTriggers(supabase: SupabaseClient, limitPerWf = 100) {
  const { data: workflows, error } = await supabase
    .from("workflows")
    .select("id, owner_id, entity, trigger")
    .eq("enabled", true)
    .eq("status", "published");
  if (error) throw new Error(error.message);

  let enqueued = 0;
  const wfResults: Array<{ workflow_id: string; matched: number; enqueued: number }> = [];
  for (const wf of (workflows ?? []) as Array<{
    id: string;
    owner_id: string;
    entity: WorkflowEntity;
    trigger: WorkflowTrigger | null;
  }>) {
    const trig = wf.trigger ?? ({} as WorkflowTrigger);
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
      .lte(field, thresholdIso)
      .limit(limitPerWf);
    const { data: records, error: recErr } = await q;
    if (recErr) {
      wfResults.push({ workflow_id: wf.id, matched: 0, enqueued: 0 });
      continue;
    }

    let localEnqueued = 0;
    const rows = (records ?? []) as Array<Record<string, unknown>>;
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
  return { enqueued, processed: tickRes.processed, workflows: wfResults };
}
