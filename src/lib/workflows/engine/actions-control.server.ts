// Controle de fluxo dos workflows: espera, ramificações, escolha por valor,
// espera até data e aprovação. Extraído de runActions sem mudança de
// comportamento (mesmos logs, mesma ordem, mesmos motivos de parada).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { WorkflowAction } from "../types";
import { type LogStep, evalConditions, getField, renderTokens } from "../engine-shared.server";
import type { RunCtx, RunResult } from "./run-context";

/** Ações que alteram o fluxo da lista de passos. */
export type ControlAction = Extract<
  WorkflowAction,
  | { type: "delay" }
  | { type: "branch_if" }
  | { type: "switch_by_value" }
  | { type: "branch_multi" }
  | { type: "delay_until_date" }
  | { type: "approval_step" }
>;

export function isControlAction(action: WorkflowAction): action is ControlAction {
  return (
    action.type === "delay" ||
    action.type === "branch_if" ||
    action.type === "switch_by_value" ||
    action.type === "branch_multi" ||
    action.type === "delay_until_date" ||
    action.type === "approval_step"
  );
}

export interface ControlOutcome {
  /** Logs a empilhar, na ordem original. */
  logs: LogStep[];
  /** Quando presente, a execução da lista de passos termina aqui. */
  done?: Pick<RunResult, "hadError" | "suspendedAt" | "waitingApproval">;
}

export interface ControlOpts {
  index: number;
  stepPath: string;
  annotate: (step: LogStep) => LogStep;
  runActions: (
    supabase: SupabaseClient,
    actions: WorkflowAction[],
    ctx: RunCtx,
    startIndex?: number,
    pathPrefix?: string,
  ) => Promise<RunResult>;
}

/** Executa uma ramificação e resolve o resultado no formato de ControlOutcome. */
async function runBranch(
  supabase: SupabaseClient,
  actions: WorkflowAction[],
  ctx: RunCtx,
  pathPrefix: string,
  logs: LogStep[],
  notResumableError: string,
  runActions: ControlOpts["runActions"],
): Promise<ControlOutcome> {
  const branchRes = await runActions(supabase, actions, ctx, 0, pathPrefix);
  logs.push(...branchRes.log);
  if (branchRes.hadError) return { logs, done: { hadError: true } };
  if (branchRes.suspendedAt) {
    // Delays dentro de branches não são retomáveis nesta versão — reportamos e paramos.
    logs.push({
      at: new Date().toISOString(),
      ok: false,
      action: "delay",
      error: notResumableError,
    });
    return { logs, done: { hadError: true } };
  }
  return { logs };
}

export async function runControlAction(
  supabase: SupabaseClient,
  action: ControlAction,
  ctx: RunCtx,
  { index, stepPath, annotate, runActions }: ControlOpts,
): Promise<ControlOutcome> {
  const logs: LogStep[] = [];

  // Delay: agenda retomada e para aqui.
  if (action.type === "delay") {
    const mult =
      action.unit === "minutes" ? 60_000 : action.unit === "hours" ? 3_600_000 : 86_400_000;
    const ms = Math.max(1, action.amount) * mult;
    const runAtIso = new Date(Date.now() + ms).toISOString();
    logs.push(
      annotate({
        at: new Date().toISOString(),
        ok: true,
        action: "delay",
        detail: { amount: action.amount, unit: action.unit, resume_at: runAtIso },
      }),
    );
    return {
      logs,
      done: { hadError: false, suspendedAt: { runAtIso, resumeCursor: index + 1 } },
    };
  }

  // Branch: filtra e executa then/else recursivamente.
  if (action.type === "branch_if") {
    const filters = action.filters ?? [];
    const passes = evalConditions(filters, ctx.after, ctx.before, ctx.vars);
    const branchName = passes ? "then" : "else";
    const branchActions = passes ? (action.then ?? []) : (action.else ?? []);
    logs.push(
      annotate({
        at: new Date().toISOString(),
        ok: true,
        action: "branch_if",
        detail: { branch: branchName, filters },
      }),
    );
    return runBranch(
      supabase,
      branchActions,
      ctx,
      `${stepPath}.${branchName}`,
      logs,
      "Delays dentro de ramificações ainda não são retomáveis",
      runActions,
    );
  }

  // Switch por valor: escolhe primeiro case cujo value bate, ou default.
  if (action.type === "switch_by_value") {
    const v = getField(ctx.after, action.field);
    const matched = action.cases.find((c) => c.value === v);
    const branchActions = matched ? matched.actions : (action.default ?? []);
    logs.push(
      annotate({
        at: new Date().toISOString(),
        ok: true,
        action: "switch_by_value",
        detail: {
          field: action.field,
          value: v,
          matched: matched ? (matched.label ?? String(matched.value)) : "default",
        },
      }),
    );
    return runBranch(
      supabase,
      branchActions,
      ctx,
      `${stepPath}.${matched ? "case" : "default"}`,
      logs,
      "Delays dentro de switch_by_value ainda não são retomáveis",
      runActions,
    );
  }

  // Ramificação múltipla: executa 1ª branch cujos filtros passam, ou else.
  if (action.type === "branch_multi") {
    const matched = action.branches.find((b) =>
      evalConditions(b.filters, ctx.after, ctx.before, ctx.vars),
    );
    const branchActions = matched ? matched.actions : (action.else ?? []);
    logs.push(
      annotate({
        at: new Date().toISOString(),
        ok: true,
        action: "branch_multi",
        detail: { matched: matched ? (matched.label ?? "branch") : "else" },
      }),
    );
    return runBranch(
      supabase,
      branchActions,
      ctx,
      `${stepPath}.${matched ? "branch" : "else"}`,
      logs,
      "Delays dentro de branch_multi ainda não são retomáveis",
      runActions,
    );
  }

  // Delay até data específica (campo do registro + offset).
  if (action.type === "delay_until_date") {
    const raw = getField(ctx.after, action.field);
    const base = raw ? new Date(String(raw)) : null;
    if (!base || Number.isNaN(base.getTime())) {
      logs.push({
        at: new Date().toISOString(),
        ok: false,
        action: "delay_until_date",
        error: `campo ${action.field} não é uma data válida`,
      });
      return { logs, done: { hadError: true } };
    }
    const mult =
      action.offset_unit === "minutes"
        ? 60_000
        : action.offset_unit === "hours"
          ? 3_600_000
          : 86_400_000;
    const target = new Date(base.getTime() + (action.offset_amount ?? 0) * mult);
    if (target.getTime() <= Date.now()) {
      logs.push({
        at: new Date().toISOString(),
        ok: true,
        action: "delay_until_date",
        detail: { target: target.toISOString(), skipped: "já no passado" },
      });
      return { logs };
    }
    const runAtIso = target.toISOString();
    logs.push({
      at: new Date().toISOString(),
      ok: true,
      action: "delay_until_date",
      detail: { field: action.field, resume_at: runAtIso },
    });
    return {
      logs,
      done: { hadError: false, suspendedAt: { runAtIso, resumeCursor: index + 1 } },
    };
  }

  // Approval step: cria linha em workflow_approvals e suspende o run.
  const title = (renderTokens(action.title, ctx.after, ctx.vars) as string) || "Aprovação";
  const note = action.note ? (renderTokens(action.note, ctx.after, ctx.vars) as string) : null;
  const approver = action.approver_user_id?.trim() || ctx.ownerId;
  const { data: appr, error: apprErr } = await supabase
    .from("workflow_approvals")
    .insert({
      owner_id: ctx.ownerId,
      workflow_id: ctx.workflowId ?? null,
      run_id: ctx.runId ?? null,
      entity: ctx.entity,
      entity_id: ctx.entityId,
      requested_by: ctx.ownerId,
      approver_user_id: approver,
      resume_cursor: index + 1,
      status: "pending",
      title,
      note,
      event_snapshot: { after: ctx.after, before: ctx.before, vars: ctx.vars ?? null } as never,
    } as never)
    .select("id")
    .single();
  if (apprErr || !appr) {
    logs.push({
      at: new Date().toISOString(),
      ok: false,
      action: "approval_step",
      error: apprErr?.message ?? "falha ao criar aprovação",
    });
    return { logs, done: { hadError: true } };
  }
  // Notifica o aprovador.
  await supabase.from("notifications").insert({
    owner_id: ctx.ownerId,
    user_id: approver,
    type: "workflow",
    title: `Aprovação necessária: ${title}`,
    body: note ?? "Uma execução de workflow aguarda sua decisão.",
    entity: "workflows",
    entity_id: ctx.workflowId ?? null,
  } as never);
  logs.push({
    at: new Date().toISOString(),
    ok: true,
    action: "approval_step",
    detail: { approval_id: appr.id, approver, title },
  });
  return {
    logs,
    done: {
      hadError: false,
      waitingApproval: { approvalId: appr.id as string, resumeCursor: index + 1 },
    },
  };
}
