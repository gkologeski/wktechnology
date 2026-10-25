import { workRpc } from "@/lib/access-control/work-core.server";
// Controle de fluxo dos workflows: espera, ramificações, escolha por valor,
// espera até data e aprovação. Extraído de runActions sem mudança de
// comportamento (mesmos logs, mesma ordem, mesmos motivos de parada).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { WorkflowAction } from "../types";
import { type LogStep, evalConditions, getField, renderTokens } from "../engine-shared.server";
import {
  isLineItemField,
  lineItemCaseMatches,
  lineItemValue,
  lineItemsOf,
  type LineItemRow,
} from "../line-items";
import type { ResumeFrame, RunCtx, RunResult } from "./run-context";

/** Ações que alteram o fluxo da lista de passos. */
export type ControlAction = Extract<
  WorkflowAction,
  | { type: "delay" }
  | { type: "branch_if" }
  | { type: "wait_for_reply" }
  | { type: "switch_by_value" }
  | { type: "branch_multi" }
  | { type: "delay_until_date" }
  | { type: "approval_step" }
  | { type: "parallel" }
>;

export function isControlAction(action: WorkflowAction): action is ControlAction {
  return (
    action.type === "delay" ||
    action.type === "branch_if" ||
    action.type === "wait_for_reply" ||
    action.type === "switch_by_value" ||
    action.type === "branch_multi" ||
    action.type === "delay_until_date" ||
    action.type === "approval_step" ||
    action.type === "parallel"
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
  /** Quadro de retomada deste passo (só quando a execução volta para dentro dele). */
  resume?: ResumeFrame;
  runActions: (
    supabase: SupabaseClient,
    actions: WorkflowAction[],
    ctx: RunCtx,
    startIndex?: number,
    pathPrefix?: string,
  ) => Promise<RunResult>;
}

/**
 * Executa um caminho. Pausas internas (espera, aguardar resposta, aprovação)
 * sobem com o quadro {caminho, passo} para a retomada voltar ao mesmo ponto.
 */
async function runBranch(
  supabase: SupabaseClient,
  actions: WorkflowAction[],
  ctx: RunCtx,
  pathPrefix: string,
  logs: LogStep[],
  frame: { index: number; key: string; startCursor?: number },
  runActions: ControlOpts["runActions"],
): Promise<ControlOutcome> {
  const branchRes = await runActions(supabase, actions, ctx, frame.startCursor ?? 0, pathPrefix);
  logs.push(...branchRes.log);
  if (branchRes.hadError) return { logs, done: { hadError: true } };
  if (branchRes.suspendedAt) {
    const s = branchRes.suspendedAt;
    return {
      logs,
      done: {
        hadError: false,
        suspendedAt: {
          runAtIso: s.runAtIso,
          resumeCursor: frame.index,
          resumePath: [{ key: frame.key, cursor: s.resumeCursor }, ...(s.resumePath ?? [])],
        },
      },
    };
  }
  if (branchRes.waitingApproval) {
    const w = branchRes.waitingApproval;
    return {
      logs,
      done: {
        hadError: false,
        waitingApproval: {
          approvalId: w.approvalId,
          resumeCursor: frame.index,
          resumePath: [{ key: frame.key, cursor: w.resumeCursor }, ...(w.resumePath ?? [])],
        },
      },
    };
  }
  return { logs };
}

/** Registro da retomada de um caminho já escolhido (sem reavaliar condições). */
function resumedStep(action: string, key: string, annotate: (s: LogStep) => LogStep): LogStep {
  return annotate({
    at: new Date().toISOString(),
    ok: true,
    action,
    detail: { resumed: true, branch: key },
  });
}

export async function runControlAction(
  supabase: SupabaseClient,
  action: ControlAction,
  ctx: RunCtx,
  { index, stepPath, annotate, runActions, resume }: ControlOpts,
): Promise<ControlOutcome> {
  const logs: LogStep[] = [];

  // Retomada dentro de um caminho já escolhido: segue dele, sem reavaliar.
  if (resume && action.type !== "parallel") {
    const list = branchByKey(action, resume.key);
    if (list) {
      logs.push(resumedStep(action.type, resume.key, annotate));
      return runBranch(
        supabase,
        list,
        ctx,
        `${stepPath}.${prefixForKey(resume.key)}`,
        logs,
        { index, key: resume.key, startCursor: resume.cursor },
        runActions,
      );
    }
  }

  if (action.type === "parallel") {
    const { runParallel } = await import("./actions-parallel.server");
    return runParallel(supabase, action, ctx, { index, stepPath, annotate, runActions });
  }

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
    const noOp = !passes && branchActions.length === 0;
    logs.push(
      annotate({
        at: new Date().toISOString(),
        ok: true,
        action: "branch_if",
        detail: {
          branch: branchName,
          filters,
          ...(noOp
            ? {
                no_op: true,
                reason:
                  "As condições não foram atendidas e o caminho 'senão' está vazio: nada foi executado.",
              }
            : {}),
        },
      }),
    );
    return runBranch(
      supabase,
      branchActions,
      ctx,
      `${stepPath}.${branchName}`,
      logs,
      { index, key: branchName },
      runActions,
    );
  }

  // Aguardar resposta: verifica recebimento real; segue por "respondeu",
  // "sem resposta" (prazo) ou pausa e volta a conferir no próximo ciclo.
  if (action.type === "wait_for_reply") {
    const { resolveWaitState, decideWait, timeoutMs } = await import("../wait-for-reply");
    const { hasReplySince } = await import("./actions-sdr.server");
    const now = new Date();
    const waitKey = `wait:${stepPath}`;
    const legacy = stepPath.includes(".") ? undefined : ctx.after?.["__wf_wait"];
    const state = resolveWaitState(
      ctx.state?.[waitKey] ?? legacy,
      index,
      now,
      timeoutMs(action.timeout_amount, action.timeout_unit),
    );
    const reply = await hasReplySince(supabase, ctx, action.channels, state.started_at);
    const decision = decideWait(state, reply.replied, now);
    if (decision.kind === "suspend") {
      (ctx.state = ctx.state ?? {})[waitKey] = state;
      logs.push(
        annotate({
          at: now.toISOString(),
          ok: true,
          action: "wait_for_reply",
          detail: { waiting: true, deadline: state.deadline, next_check: decision.runAtIso },
        }),
      );
      return {
        logs,
        done: {
          hadError: false,
          suspendedAt: { runAtIso: decision.runAtIso, resumeCursor: index, waitState: state },
        },
      };
    }
    const branchName = decision.kind === "replied" ? "then" : "else";
    logs.push(
      annotate({
        at: now.toISOString(),
        ok: true,
        action: "wait_for_reply",
        detail: {
          outcome: decision.kind,
          channel: reply.channel ?? null,
          started_at: state.started_at,
        },
      }),
    );
    // Retomada posterior não deve reutilizar o estado desta espera.
    if (ctx.state) delete ctx.state[waitKey];
    if (ctx.after && "__wf_wait" in ctx.after) {
      const { __wf_wait: _drop, ...rest } = ctx.after as Record<string, unknown>;
      void _drop;
      ctx.after = rest;
    }
    return runBranch(
      supabase,
      action[branchName] ?? [],
      ctx,
      `${stepPath}.${branchName}`,
      logs,
      { index, key: branchName },
      runActions,
    );
  }

  // Switch por valor: escolhe primeiro case cujo value bate, ou default.
  if (action.type === "switch_by_value") {
    const onLineItems = isLineItemField(action.field);
    const items = onLineItems ? lineItemsOf(ctx.after) : [];
    const v = onLineItems
      ? items.map((it: LineItemRow) => lineItemValue(it, action.field))
      : getField(ctx.after, action.field);
    const matched = onLineItems
      ? action.cases.find((c) =>
          lineItemCaseMatches(ctx.after, action.field, c.value, action.match ?? "any"),
        )
      : action.cases.find((c) => c.value === v);
    const branchActions = matched ? matched.actions : (action.default ?? []);
    // Nenhum case bateu e o caminho padrão está vazio: nada será executado.
    // Explicamos o motivo em PT-BR para não falhar em silêncio.
    const noOp = !matched && branchActions.length === 0;
    const reason = !noOp
      ? undefined
      : onLineItems && items.length === 0
        ? "O negócio não tem itens de linha, então nenhuma opção foi escolhida e o caminho padrão está vazio: nada foi executado."
        : "Nenhuma opção bateu com o valor do campo e o caminho padrão está vazio: nada foi executado.";
    logs.push(
      annotate({
        at: new Date().toISOString(),
        ok: true,
        action: "switch_by_value",
        detail: {
          field: action.field,
          value: v,
          matched: matched ? (matched.label ?? String(matched.value)) : "default",
          ...(noOp ? { no_op: true, reason } : {}),
        },
      }),
    );
    const caseIdx = matched ? action.cases.indexOf(matched) : -1;
    return runBranch(
      supabase,
      branchActions,
      ctx,
      `${stepPath}.${matched ? "case" : "default"}`,
      logs,
      { index, key: matched ? `case:${caseIdx}` : "default" },
      runActions,
    );
  }

  // Ramificação múltipla: executa 1ª branch cujos filtros passam, ou else.
  if (action.type === "branch_multi") {
    const matched = action.branches.find((b) =>
      evalConditions(b.filters, ctx.after, ctx.before, ctx.vars),
    );
    const branchActions = matched ? matched.actions : (action.else ?? []);
    const noOp = !matched && branchActions.length === 0;
    logs.push(
      annotate({
        at: new Date().toISOString(),
        ok: true,
        action: "branch_multi",
        detail: {
          matched: matched ? (matched.label ?? "branch") : "else",
          ...(noOp
            ? {
                no_op: true,
                reason:
                  "Nenhuma ramificação bateu e o ramo 'senão' está vazio: nada foi executado.",
              }
            : {}),
        },
      }),
    );
    const branchIdx = matched ? action.branches.indexOf(matched) : -1;
    return runBranch(
      supabase,
      branchActions,
      ctx,
      `${stepPath}.${matched ? "branch" : "else"}`,
      logs,
      { index, key: matched ? `branch:${branchIdx}` : "else" },
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
  if (
    !(await workRpc<boolean>(supabase, "sales_workflow_approval_recipient", {
      p_workflow: ctx.workflowId,
      p_user: approver,
      p_entity: ctx.entity,
      p_id: ctx.entityId,
      p_version: ctx.workflowVersion ?? null,
    }))
  )
    throw new Error(
      "Aprovador inativo, sem permissão de decisão ou sem acesso ao registro de origem.",
    );
  const { data: appr, error: apprErr } = await supabase
    .from("workflow_approvals")
    .insert({
      owner_id: ctx.ownerId,
      workflow_id: ctx.workflowId ?? null,
      run_id: ctx.runId ?? null,
      entity: ctx.entity,
      entity_id: ctx.entityId,
      requested_by: ctx.ownerId,
      workflow_version: ctx.workflowVersion,
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

/** Lista de ações do caminho indicado pelo quadro de retomada. */
function branchByKey(action: ControlAction, key: string): WorkflowAction[] | null {
  if (action.type === "branch_if" || action.type === "wait_for_reply") {
    if (key === "then") return action.then ?? [];
    if (key === "else") return action.else ?? [];
  }
  if (action.type === "switch_by_value") {
    if (key === "default") return action.default ?? [];
    const m = /^case:(\d+)$/.exec(key);
    if (m) return action.cases[Number(m[1])]?.actions ?? null;
  }
  if (action.type === "branch_multi") {
    if (key === "else") return action.else ?? [];
    const m = /^branch:(\d+)$/.exec(key);
    if (m) return action.branches[Number(m[1])]?.actions ?? null;
  }
  return null;
}

/** Mantém os mesmos prefixos de `step_path` usados na primeira passagem. */
function prefixForKey(key: string): string {
  if (key.startsWith("case:")) return "case";
  if (key.startsWith("branch:")) return "branch";
  return key;
}
