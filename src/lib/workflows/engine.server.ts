// Workflow engine: executa eventos pendentes da fila workflow_events.
// Roda no servidor (chamado pelo endpoint /api/public/hooks/workflows-tick).
import type { SupabaseClient } from "@supabase/supabase-js";
import { applyRotation } from "@/lib/rotation/engine.server";
import type { WorkflowAction, WorkflowEntity, WorkflowFilter, WorkflowTrigger } from "./types";

type AnyRow = Record<string, unknown>;
type LogStep = { at: string; ok: boolean; action: string; detail?: unknown; error?: string };

function assignFieldFor(entity: WorkflowEntity): string {
  switch (entity) {
    case "tickets":
      return "assignee_id";
    case "ats_jobs":
      return "recruiter_id";
    case "ats_interviews":
      return "interviewer_id";
    case "ats_applications":
    case "ats_candidates":
    default:
      return "owner_id";
  }
}

function notificationLinkFor(entity: WorkflowEntity, entityId: string): string | null {
  switch (entity) {
    case "deals":
      return `/deals?id=${entityId}`;
    case "leads":
      return `/leads?id=${entityId}`;
    case "contacts":
      return `/contacts?id=${entityId}`;
    case "companies":
      return `/companies?id=${entityId}`;
    case "tickets":
      return `/tickets?id=${entityId}`;
    case "ats_jobs":
      return `/ats/jobs?id=${entityId}`;
    case "ats_candidates":
      return `/ats/candidates?id=${entityId}`;
    case "ats_applications":
      return `/ats/applications/${entityId}`;
    case "ats_interviews":
      return `/ats/interviews?id=${entityId}`;
    default:
      return null;
  }
}

function getField(obj: AnyRow | null | undefined, path: string): unknown {
  if (!obj) return undefined;
  return path.split(".").reduce<unknown>((acc, k) => {
    if (acc && typeof acc === "object") return (acc as AnyRow)[k];
    return undefined;
  }, obj);
}

function toStr(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  return JSON.stringify(v);
}

function renderTokens(input: unknown, after: AnyRow | null): unknown {
  if (typeof input !== "string") return input;
  return input.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key) => toStr(getField(after, String(key))));
}

function evalFilter(f: WorkflowFilter, after: AnyRow | null, before: AnyRow | null): boolean {
  const v = getField(after, f.field);
  switch (f.op) {
    case "eq":
      return v === f.value;
    case "neq":
      return v !== f.value;
    case "in": {
      const list = Array.isArray(f.value)
        ? f.value
        : String(f.value ?? "")
            .split(",")
            .map((s) => s.trim());
      return list.includes(v as never);
    }
    case "contains":
      return typeof v === "string" && v.toLowerCase().includes(String(f.value ?? "").toLowerCase());
    case "gt":
      return typeof v === "number" && typeof f.value === "number" && v > f.value;
    case "lt":
      return typeof v === "number" && typeof f.value === "number" && v < f.value;
    case "changed_to": {
      const prev = getField(before, f.field);
      return v === f.value && prev !== f.value;
    }
    case "is_empty":
      return v == null || v === "";
    case "is_not_empty":
      return v != null && v !== "";
    default:
      return false;
  }
}

interface RunCtx {
  entity: WorkflowEntity;
  entityId: string;
  ownerId: string;
  after: AnyRow | null;
  before: AnyRow | null;
}

interface RunResult {
  log: LogStep[];
  hadError: boolean;
  // Se != null, execução foi suspensa para retomar depois desse índice na lista de ações.
  suspendedAt?: { runAtIso: string; resumeCursor: number };
}

async function runActions(
  supabase: SupabaseClient,
  actions: WorkflowAction[],
  ctx: RunCtx,
  startIndex = 0,
): Promise<RunResult> {
  const log: LogStep[] = [];
  for (let i = startIndex; i < actions.length; i++) {
    const action = actions[i];

    // Delay: agenda retomada e para aqui.
    if (action.type === "delay") {
      const mult =
        action.unit === "minutes" ? 60_000 : action.unit === "hours" ? 3_600_000 : 86_400_000;
      const ms = Math.max(1, action.amount) * mult;
      const runAtIso = new Date(Date.now() + ms).toISOString();
      log.push({
        at: new Date().toISOString(),
        ok: true,
        action: "delay",
        detail: { amount: action.amount, unit: action.unit, resume_at: runAtIso },
      });
      return { log, hadError: false, suspendedAt: { runAtIso, resumeCursor: i + 1 } };
    }

    // Branch: filtra e executa then/else recursivamente.
    if (action.type === "branch_if") {
      const filters = action.filters ?? [];
      const passes = filters.length === 0 || filters.every((f) => evalFilter(f, ctx.after, ctx.before));
      const branchName = passes ? "then" : "else";
      const branchActions = passes ? action.then ?? [] : action.else ?? [];
      log.push({
        at: new Date().toISOString(),
        ok: true,
        action: "branch_if",
        detail: { branch: branchName, filters },
      });
      const branchRes = await runActions(supabase, branchActions, ctx);
      log.push(...branchRes.log);
      if (branchRes.hadError) return { log, hadError: true };
      if (branchRes.suspendedAt) {
        // Delays dentro de branches não são retomáveis nesta versão — reportamos e paramos.
        log.push({
          at: new Date().toISOString(),
          ok: false,
          action: "delay",
          error: "Delays dentro de ramificações ainda não são retomáveis",
        });
        return { log, hadError: true };
      }
      continue;
    }

    const step = await runAction(supabase, action, ctx);
    log.push(step);
    if (!step.ok) return { log, hadError: true };
  }
  return { log, hadError: false };
}

async function runAction(
  supabase: SupabaseClient,
  action: Exclude<WorkflowAction, { type: "delay" } | { type: "branch_if" }>,
  ctx: RunCtx,
): Promise<LogStep> {
  const at = new Date().toISOString();
  try {
    switch (action.type) {
      case "set_field": {
        const value = renderTokens(action.value, ctx.after);
        const { error } = await supabase
          .from(ctx.entity)
          .update({ [action.field]: value })
          .eq("id", ctx.entityId);
        if (error) throw new Error(error.message);
        return { at, ok: true, action: "set_field", detail: { field: action.field, value } };
      }
      case "assign_to": {
        const assignField = assignFieldFor(ctx.entity);
        const { error } = await supabase
          .from(ctx.entity)
          .update({ [assignField]: action.user_id })
          .eq("id", ctx.entityId);
        if (error) throw new Error(error.message);
        return {
          at,
          ok: true,
          action: "assign_to",
          detail: { user_id: action.user_id, field: assignField },
        };
      }
      case "rotate_assign": {
        if (ctx.entity !== "leads" && ctx.entity !== "deals" && ctx.entity !== "tickets") {
          throw new Error("rotate_assign suporta apenas leads/deals/tickets");
        }
        const r = await applyRotation(supabase, action.rule_id, ctx.entity, ctx.entityId);
        return {
          at,
          ok: true,
          action: "rotate_assign",
          detail: { rule_id: action.rule_id, assigned_to: r.user_id },
        };
      }
      case "create_activity": {
        const subject = renderTokens(action.subject, ctx.after) as string;
        const body = action.body ? (renderTokens(action.body, ctx.after) as string) : null;
        const due = action.due_in_days
          ? new Date(Date.now() + action.due_in_days * 86_400_000).toISOString()
          : null;
        const baseRow: Record<string, unknown> = {
          owner_id: ctx.ownerId,
          type: action.activity_type ?? "task",
          subject,
          body,
          due_date: due,
        };
        if (ctx.entity === "leads") baseRow.related_lead_id = ctx.entityId;
        else if (ctx.entity === "contacts") baseRow.related_contact_id = ctx.entityId;
        else if (ctx.entity === "companies") baseRow.related_company_id = ctx.entityId;
        else if (ctx.entity === "deals") baseRow.related_deal_id = ctx.entityId;
        const { error } = await supabase.from("activities").insert(baseRow as never);
        if (error) throw new Error(error.message);
        return { at, ok: true, action: "create_activity", detail: { subject } };
      }
      case "add_to_sequence": {
        const { error } = await supabase.from("sequence_enrollments").insert({
          owner_id: ctx.ownerId,
          sequence_id: action.sequence_id,
          entity_id: ctx.entityId,
          status: "active",
          next_run_at: new Date().toISOString(),
        });
        if (error) throw new Error(error.message);
        return {
          at,
          ok: true,
          action: "add_to_sequence",
          detail: { sequence_id: action.sequence_id },
        };
      }
      case "send_notification": {
        const title = renderTokens(action.title, ctx.after) as string;
        const body = action.body ? (renderTokens(action.body, ctx.after) as string) : null;
        const targetUserId = action.user_id?.trim() ? action.user_id : ctx.ownerId;
        const link = notificationLinkFor(ctx.entity, ctx.entityId);
        const { error } = await supabase.from("notifications").insert({
          owner_id: ctx.ownerId,
          user_id: targetUserId,
          type: "workflow",
          title,
          body,
          link,
          entity: ctx.entity,
          entity_id: ctx.entityId,
        } as never);
        if (error) throw new Error(error.message);
        return { at, ok: true, action: "send_notification", detail: { title, user_id: targetUserId } };
      }
      case "webhook": {
        const payload = action.payload
          ? JSON.parse(toStr(renderTokens(JSON.stringify(action.payload), ctx.after)))
          : { entity: ctx.entity, entity_id: ctx.entityId, after: ctx.after };
        const res = await fetch(action.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(`Webhook respondeu ${res.status}`);
        return { at, ok: true, action: "webhook", detail: { url: action.url, status: res.status } };
      }
      case "create_ats_job": {
        const after = ctx.after ?? {};
        const title = (renderTokens(action.title, ctx.after) as string) ||
          `Vaga para ${String((after as AnyRow).name ?? "")}`.trim();
        let pipelineId: string | null = null;
        const { data: pipe } = await supabase
          .from("ats_pipelines")
          .select("id")
          .eq("owner_id", ctx.ownerId)
          .order("is_default", { ascending: false })
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (pipe) pipelineId = pipe.id as string;
        else {
          const { data: created, error: pErr } = await supabase
            .from("ats_pipelines")
            .insert({ owner_id: ctx.ownerId, name: "Pipeline padrão", is_default: true, stages: [] } as never)
            .select("id")
            .single();
          if (pErr) throw new Error(pErr.message);
          pipelineId = created.id as string;
        }
        const headcount = action.headcount && action.headcount > 0 ? action.headcount : 1;
        const slugBase = title
          .toLowerCase()
          .normalize("NFD")
          .replace(/\p{Diacritic}/gu, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");
        const createdIds: string[] = [];
        for (let i = 0; i < headcount; i++) {
          const slug = `${slugBase}-${Date.now().toString(36)}-${i}`;
          const { data: inserted, error } = await supabase
            .from("ats_jobs")
            .insert({
              owner_id: ctx.ownerId,
              pipeline_id: pipelineId,
              title,
              slug,
              status: "draft",
              deal_id: ctx.entity === "deals" ? ctx.entityId : null,
              company_id:
                (((after as AnyRow).company_id as string) ??
                  (ctx.entity === "companies" ? ctx.entityId : null)) as string | null,
              hiring_manager_id: action.hiring_manager_id ?? null,
              recruiter_id: action.recruiter_id ?? null,
              metadata: action.department ? { department: action.department } : {},
            } as never)
            .select("id")
            .single();
          if (error) throw new Error(error.message);
          createdIds.push(inserted.id as string);
        }
        if (action.notify_user_id) {
          await supabase.from("notifications").insert({
            owner_id: ctx.ownerId,
            user_id: action.notify_user_id,
            type: "workflow",
            title: `Nova vaga em rascunho: ${title}`,
            body: `Origem: ${ctx.entity}. Revise e publique para abrir a vaga.`,
            link: `/ats/jobs`,
            entity: "ats_jobs",
            entity_id: createdIds[0] ?? null,
          } as never);
        }
        return { at, ok: true, action: "create_ats_job", detail: { ids: createdIds, headcount } };
      }
      case "advance_ats_application_stage": {
        if (ctx.entity !== "ats_applications") {
          throw new Error("advance_ats_application_stage exige workflow sobre Aplicações (ATS)");
        }
        const stageValue = renderTokens(action.stage_value, ctx.after) as string;
        if (!stageValue) throw new Error("stage_value obrigatório");
        const { error } = await supabase
          .from("ats_applications")
          .update({ stage_value: stageValue, moved_at: new Date().toISOString() })
          .eq("id", ctx.entityId);
        if (error) throw new Error(error.message);
        return {
          at,
          ok: true,
          action: "advance_ats_application_stage",
          detail: { stage_value: stageValue },
        };
      }
      case "create_ats_candidate": {
        const fullName = (renderTokens(action.full_name, ctx.after) as string).trim();
        if (!fullName) throw new Error("full_name obrigatório");
        const email = action.email
          ? ((renderTokens(action.email, ctx.after) as string) || null)
          : null;
        const phone = action.phone
          ? ((renderTokens(action.phone, ctx.after) as string) || null)
          : null;
        const { data: inserted, error } = await supabase
          .from("ats_candidates")
          .insert({
            owner_id: ctx.ownerId,
            full_name: fullName,
            email,
            phone,
            source: action.source ?? "workflow",
          } as never)
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        return {
          at,
          ok: true,
          action: "create_ats_candidate",
          detail: { id: inserted.id, full_name: fullName },
        };
      }
      case "assign_recruiter": {
        const target =
          action.target && action.target !== "auto"
            ? action.target
            : ctx.entity === "ats_jobs"
              ? "job"
              : ctx.entity === "ats_candidates"
                ? "candidate"
                : ctx.entity === "ats_applications"
                  ? "application"
                  : ctx.entity === "ats_interviews"
                    ? "interview"
                    : "job";
        const table =
          target === "job"
            ? "ats_jobs"
            : target === "candidate"
              ? "ats_candidates"
              : target === "application"
                ? "ats_applications"
                : "ats_interviews";
        const column =
          target === "job"
            ? "recruiter_id"
            : target === "interview"
              ? "interviewer_id"
              : "owner_id";
        const { error } = await supabase
          .from(table)
          .update({ [column]: action.user_id })
          .eq("id", ctx.entityId);
        if (error) throw new Error(error.message);
        return {
          at,
          ok: true,
          action: "assign_recruiter",
          detail: { target, user_id: action.user_id, column },
        };
      }
      default: {
        const _exhaustive: never = action;
        void _exhaustive;
        return { at, ok: false, action: "unknown", error: "Ação não suportada" };
      }
    }
  } catch (e) {
    return {
      at,
      ok: false,
      action: action.type,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

interface EventRow {
  id: string;
  owner_id: string;
  entity: WorkflowEntity;
  entity_id: string;
  event_type: string;
  before: AnyRow | null;
  after: AnyRow | null;
  resume_workflow_id?: string | null;
  resume_cursor?: number | null;
}

interface WorkflowRow {
  id: string;
  owner_id: string;
  entity: WorkflowEntity;
  trigger: WorkflowTrigger;
  actions: WorkflowAction[];
}

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
      .select("id, owner_id, entity, trigger, actions")
      .eq("id", event.resume_workflow_id)
      .maybeSingle();
    if (wf) {
      const wfr = wf as WorkflowRow;
      const { data: run } = await supabase
        .from("workflow_runs")
        .insert({
          owner_id: wfr.owner_id,
          workflow_id: wfr.id,
          event_id: event.id,
          status: "running",
          started_at: new Date().toISOString(),
        })
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
            after: event.after,
            before: event.before,
          },
          event.resume_cursor,
        );
        await finishRun(supabase, run.id, res, event);
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
    .select("id, owner_id, entity, trigger, actions")
    .eq("owner_id", event.owner_id)
    .eq("entity", event.entity)
    .eq("enabled", true);

  for (const wf of (workflows ?? []) as WorkflowRow[]) {
    const trig = wf.trigger ?? ({} as WorkflowTrigger);
    if (trig.event && trig.event !== event.event_type) continue;
    const filters = trig.filters ?? [];
    const passes = filters.every((f) => evalFilter(f, event.after, event.before));
    if (!passes) continue;

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
        status: "running",
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (insErr || !run) continue;

    const res = await runActions(supabase, wf.actions ?? [], {
      entity: event.entity,
      entityId: event.entity_id,
      ownerId: event.owner_id,
      after: event.after,
      before: event.before,
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
