import { authorizeWorkflowStep, sanitizeWorkflowSnapshot } from "./engine/authorization.server";
import { workflowEventWorkspace } from "./engine/workspace-payload";
// Ciclo de execução do motor: enfileiramento, runs, ticks de fila e de tempo.
// Extraído de engine.server.ts sem mudança de comportamento.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { WorkflowAction, WorkflowCondition, WorkflowEntity, WorkflowTrigger } from "./types";
import { hydrateTriggerAssociations } from "./hydrate-associations.server";
import { hydrateDealLineItems } from "./line-items.server";
import { type AnyRow, evalConditions } from "./engine-shared.server";
import { type RunResult, runActions } from "./engine-actions.server";

export interface EventRow {
  id: string;
  owner_id: string;
  workspace_id?: string | null;
  entity: WorkflowEntity;
  entity_id: string;
  event_type: string;
  before: AnyRow | null;
  after: AnyRow | null;
  resume_workflow_id?: string | null;
  resume_cursor?: number | null;
  workflow_version?: number | null;
}

interface WorkflowRow {
  id: string;
  owner_id: string;
  workspace_id: string;
  entity: WorkflowEntity;
  trigger: WorkflowTrigger;
  actions: WorkflowAction[];
  goal_filters?: WorkflowCondition[] | null;
  execution_user_id?: string | null;
  published_version?: number;
}

/** Entidades cujos workflows valem para todo o workspace (ciclo de contratação). */
const WORKSPACE_SCOPED_ENTITIES = new Set<WorkflowEntity>(["ats_applications", "people"]);

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

async function workflowSourceAllowed(
  supabase: SupabaseClient,
  wf: WorkflowRow,
  event: EventRow,
): Promise<boolean> {
  try {
    await authorizeWorkflowStep(
      supabase,
      {
        entity: event.entity,
        entityId: event.entity_id,
        ownerId: wf.execution_user_id ?? wf.owner_id,
        workspaceId: wf.workspace_id,
        after: event.after,
        before: event.before,
        workflowId: wf.id,
        workflowVersion: wf.published_version,
      },
      undefined,
      JSON.stringify({ t: wf.trigger, a: wf.actions, g: wf.goal_filters }),
    );
    return true;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Execução não autorizada.";
    await supabase.from("workflow_runs").insert({
      workspace_id: wf.workspace_id,
      owner_id: wf.owner_id,
      workflow_id: wf.id,
      event_id: event.id,
      entity: event.entity,
      entity_id: event.entity_id,
      status: "error",
      error: reason,
      log: [{ at: new Date().toISOString(), ok: false, action: "permission_check", error: reason }],
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
    } as never);
    return false;
  }
}

export async function processEvent(
  supabase: SupabaseClient,
  event: EventRow,
  allowedWorkflowIds?: string[],
) {
  const sourceWorkspace = workflowEventWorkspace(event);
  if (
    event.resume_workflow_id &&
    allowedWorkflowIds &&
    !allowedWorkflowIds.includes(event.resume_workflow_id)
  )
    return;
  // Caso 1: retomada (delay) → executa apenas o workflow indicado a partir do cursor.
  if (event.resume_workflow_id && typeof event.resume_cursor === "number") {
    const { data: wf } = await supabase
      .from("workflows")
      .select(
        "id, owner_id, execution_user_id, published_version, workspace_id, entity, trigger, actions, goal_filters",
      )
      .eq("enabled", true)
      .eq("status", "published")
      .eq("id", event.resume_workflow_id)
      .eq("workspace_id", sourceWorkspace)
      .maybeSingle();
    if (wf) {
      const wfr = wf as WorkflowRow;
      if (event.workflow_version !== wfr.published_version) {
        const reason = "Versão do workflow mudou após a pausa; retomada bloqueada.";
        const now = new Date().toISOString();
        const { error: logError } = await supabase.from("workflow_runs").insert({
          workspace_id: sourceWorkspace,
          owner_id: wfr.execution_user_id ?? wfr.owner_id,
          workflow_id: wfr.id,
          event_id: event.id,
          entity: event.entity,
          entity_id: event.entity_id,
          status: "error",
          error: reason,
          started_at: now,
          finished_at: now,
          log: [{ at: now, ok: false, action: "version_check", error: reason }],
        } as never);
        if (logError && logError.code !== "23505") throw new Error(logError.message);
        await supabase.from("workflow_events").update({ processed_at: now }).eq("id", event.id);
        return;
      }
      if (!(await workflowSourceAllowed(supabase, wfr, event))) return;
      const wfJson = JSON.stringify({ t: wfr.trigger, a: wfr.actions });
      const hydratedAfter = await hydrateDealLineItems(
        supabase,
        event.entity,
        sanitizeWorkflowSnapshot(
          await hydrateTriggerAssociations(supabase, event.entity, event.after, wfJson),
        ),
        wfJson,
      );

      const { data: run } = await supabase
        .from("workflow_runs")
        .insert({
          workspace_id: sourceWorkspace,
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
        const { after: cleanAfter, state, frames } = splitResumeData(hydratedAfter);
        const res = await runActions(
          supabase,
          wfr.actions ?? [],
          {
            entity: event.entity,
            entityId: event.entity_id,
            ownerId: wfr.execution_user_id ?? wfr.owner_id,
            workspaceId: wfr.workspace_id,
            after: cleanAfter,
            before: event.before,
            workflowId: wfr.id,
            workflowVersion: wfr.published_version,
            runId: run.id as string,
            state,
            resumeFrames: frames,
          },
          event.resume_cursor,
        );
        await finishRun(supabase, run.id, res, event, wfr.id, wfr.published_version);
      }
    }
    if (!allowedWorkflowIds)
      await supabase
        .from("workflow_events")
        .update({ processed_at: new Date().toISOString() })
        .eq("id", event.id);
    return;
  }

  // Caso 2: evento normal (created/updated/stage_changed).
  // Contratação/desligamento valem para o workspace inteiro (qualquer recrutador
  // ou gestor dispara o fluxo do admin); demais entidades mantêm o escopo por dono.
  const byWorkspace = WORKSPACE_SCOPED_ENTITIES.has(event.entity);
  let wfQuery = supabase
    .from("workflows")
    .select(
      "id, owner_id, execution_user_id, published_version, workspace_id, entity, trigger, actions, goal_filters",
    )
    .eq("entity", event.entity)
    .eq("workspace_id", sourceWorkspace)
    .eq("enabled", true)
    .eq("status", "published");
  wfQuery = byWorkspace ? wfQuery : wfQuery.eq("owner_id", event.owner_id);
  if (allowedWorkflowIds) wfQuery = wfQuery.in("id", allowedWorkflowIds);
  const { data: workflows } = await wfQuery;

  for (const wf of (workflows ?? []) as WorkflowRow[]) {
    if (!(await workflowSourceAllowed(supabase, wf, event))) continue;
    const trig = wf.trigger ?? ({} as WorkflowTrigger);
    if (trig.event && trig.event !== event.event_type) continue;

    // Hidrata associações do gatilho (empresa, contato, negócio…) antes de
    // avaliar condições e executar ações, para resolver `{{company.name}}`.
    const wfJson = JSON.stringify({ t: trig, a: wf.actions, g: wf.goal_filters });
    const hydratedAfter = await hydrateDealLineItems(
      supabase,
      event.entity,
      sanitizeWorkflowSnapshot(
        await hydrateTriggerAssociations(supabase, event.entity, event.after, wfJson),
      ),
      wfJson,
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
        workspace_id: sourceWorkspace,
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
    if (insErr || !run) {
      // Dedupe (23505) é esperado; qualquer outro erro precisa aparecer.
      if (insErr && insErr.code !== "23505")
        console.error("[workflows] falha ao criar run:", insErr.code, insErr.message);
      continue;
    }

    const res = await runActions(supabase, wf.actions ?? [], {
      entity: event.entity,
      entityId: event.entity_id,
      // Passos rodam com o dono do workflow (permissões do admin que o publicou).
      ownerId: wf.execution_user_id ?? wf.owner_id,
      workspaceId: wf.workspace_id,
      after: hydratedAfter,
      before: event.before,
      workflowId: wf.id,
      workflowVersion: wf.published_version,
      runId: run.id as string,
    });
    await finishRun(supabase, run.id, res, event, wf.id, wf.published_version);
  }

  if (!allowedWorkflowIds)
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
  workflowVersion?: number,
) {
  // Se aguardando aprovação, deixa run em estado waiting (será retomado por decideApproval).
  if (res.waitingApproval) {
    // Aprovação dentro de um caminho: a retomada precisa voltar ao mesmo ponto.
    if (res.waitingApproval.resumePath?.length) {
      const { data: appr } = await supabase
        .from("workflow_approvals")
        .select("event_snapshot")
        .eq("id", res.waitingApproval.approvalId)
        .maybeSingle();
      const snap = ((appr as { event_snapshot?: Record<string, unknown> } | null)?.event_snapshot ??
        {}) as Record<string, unknown>;
      const snapAfter = (snap["after"] as Record<string, unknown> | null) ?? {};
      await supabase
        .from("workflow_approvals")
        .update({
          resume_cursor: res.waitingApproval.resumeCursor,
          event_snapshot: {
            ...snap,
            after: { ...stripResumeKeys(snapAfter), __wf_path: res.waitingApproval.resumePath },
          },
        } as never)
        .eq("id", res.waitingApproval.approvalId);
    }
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
      workspace_id: workflowEventWorkspace(event),
      owner_id: event.owner_id,
      entity: event.entity,
      entity_id: event.entity_id,
      event_type: event.event_type,
      before: event.before,
      after: {
        ...stripResumeKeys((event.after ?? {}) as Record<string, unknown>),
        ...(res.suspendedAt.waitState ? { __wf_wait: res.suspendedAt.waitState } : {}),
        ...(res.suspendedAt.state ? { __wf_state: res.suspendedAt.state } : {}),
        ...(res.suspendedAt.resumePath?.length ? { __wf_path: res.suspendedAt.resumePath } : {}),
      },
      run_at: res.suspendedAt.runAtIso,
      resume_workflow_id: workflowId,
      workflow_version: workflowVersion,
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

export async function tickWorkflows(
  supabase: SupabaseClient,
  limit = 50,
  scope?: { workspaceId: string; eventIds: string[]; workflowIds: string[] },
) {
  const nowIso = new Date().toISOString();
  let query = supabase
    .from("workflow_events")
    .select(
      "id, owner_id, workspace_id, entity, entity_id, event_type, before, after, resume_workflow_id, resume_cursor, workflow_version",
    )
    .is("processed_at", null)
    .lte("run_at", nowIso)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (scope) query = query.eq("workspace_id", scope.workspaceId).in("id", scope.eventIds);
  const { data: events, error } = await query;
  if (error) throw new Error(error.message);

  const results: Array<{ id: string; ok: boolean; error?: string }> = [];
  for (const ev of (events ?? []) as EventRow[]) {
    try {
      await processEvent(supabase, ev, scope?.workflowIds);
      results.push({ id: ev.id, ok: true });
    } catch (e) {
      results.push({ id: ev.id, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return { processed: results.length, results };
}

// Os triggers baseados em tempo vivem em engine-time-triggers.server.ts.
const RESUME_KEYS = ["__wf_wait", "__wf_state", "__wf_path"] as const;

/** Remove dados internos de retomada antes de reaproveitar o `after`. */
export function stripResumeKeys(after: Record<string, unknown>): Record<string, unknown> {
  const out = { ...after };
  for (const k of RESUME_KEYS) delete out[k];
  return out;
}

/** Separa estado durável e quadros de retomada do `after` do evento. */
export function splitResumeData(after: unknown): {
  after: Record<string, unknown> | null;
  state: Record<string, unknown>;
  frames: { key: string; cursor: number }[];
} {
  if (!after || typeof after !== "object")
    return { after: (after as null) ?? null, state: {}, frames: [] };
  const a = after as Record<string, unknown>;
  const state =
    a["__wf_state"] && typeof a["__wf_state"] === "object"
      ? { ...(a["__wf_state"] as Record<string, unknown>) }
      : {};
  const frames = Array.isArray(a["__wf_path"])
    ? (a["__wf_path"] as unknown[]).filter(
        (f): f is { key: string; cursor: number } =>
          !!f &&
          typeof (f as { key?: unknown }).key === "string" &&
          typeof (f as { cursor?: unknown }).cursor === "number",
      )
    : [];
  // `__wf_wait` legado continua no after: o bloco de espera o consome e remove.
  const { __wf_state: _s, __wf_path: _p, ...rest } = a;
  void _s;
  void _p;
  return { after: rest, state, frames };
}

export { tickTimeTriggers } from "./engine-time-triggers.server";
