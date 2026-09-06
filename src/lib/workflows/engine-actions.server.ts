// Execução das ações de workflow (runActions).
// O controle de fluxo vive em engine/actions-control.server.ts e cada grupo de
// ações em engine/actions-*.server.ts. Comportamento e logs inalterados.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { WorkflowAction } from "./types";
import { ACTION_LABELS } from "./types";
import type { AnyRow, LogStep } from "./engine-shared.server";
import type { ActionHandler, RunCtx, RunResult, RunnableAction } from "./engine/run-context";
import { isControlAction, runControlAction } from "./engine/actions-control.server";
import { handleFieldAction } from "./engine/actions-fields.server";
import { handleAssignAction } from "./engine/actions-assign.server";
import { handleMessagingAction } from "./engine/actions-messaging.server";
import { handleActivityAction } from "./engine/actions-activities.server";
import { handleCrmAction } from "./engine/actions-crm.server";
import { handleAtsAction } from "./engine/actions-ats.server";
import { handleRecordAction } from "./engine/actions-records.server";

export type { RunCtx, RunResult };

const HANDLERS: ActionHandler[] = [
  handleFieldAction,
  handleAssignAction,
  handleMessagingAction,
  handleActivityAction,
  handleCrmAction,
  handleAtsAction,
  handleRecordAction,
];

export async function runActions(
  supabase: SupabaseClient,
  actions: WorkflowAction[],
  ctx: RunCtx,
  startIndex = 0,
  pathPrefix = "",
): Promise<RunResult> {
  const rawLog: LogStep[] = [];
  let currentStep = -1;
  // Registra a saída de cada passo em `ctx.vars.steps.N`, permitindo que
  // condições posteriores referenciem `{{steps.N.campo}}`.
  const log = new Proxy(rawLog, {
    get(target, prop, receiver) {
      if (prop === "push") {
        return (...items: LogStep[]) => {
          for (const item of items) {
            if (currentStep < 0 || !item?.ok) continue;
            const vars = (ctx.vars = ctx.vars ?? {});
            const steps = (vars.steps = (vars.steps as AnyRow) ?? {}) as AnyRow;
            steps[String(currentStep)] = (item.detail as AnyRow) ?? {};
          }
          return Array.prototype.push.apply(target, items);
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  }) as LogStep[];

  for (let i = startIndex; i < actions.length; i++) {
    const action = actions[i];
    currentStep = i;
    const stepPath = pathPrefix ? `${pathPrefix}.${i + 1}` : String(i + 1);
    const annotate = (step: LogStep): LogStep => ({
      ...step,
      action_label:
        ACTION_LABELS[step.action as keyof typeof ACTION_LABELS] ??
        step.action_label ??
        step.action,
      step_path: step.step_path ?? stepPath,
    });

    if (isControlAction(action)) {
      const outcome = await runControlAction(supabase, action, ctx, {
        index: i,
        stepPath,
        annotate,
        runActions,
      });
      log.push(...outcome.logs);
      if (outcome.done) return { log: rawLog, ...outcome.done };
      continue;
    }

    const step = annotate(await runAction(supabase, action, ctx));
    log.push(step);
    if (!step.ok) return { log: rawLog, hadError: true };
  }
  return { log: rawLog, hadError: false };
}

async function runAction(
  supabase: SupabaseClient,
  action: RunnableAction,
  ctx: RunCtx,
): Promise<LogStep> {
  const at = new Date().toISOString();
  try {
    for (const handler of HANDLERS) {
      const step = await handler(supabase, action, ctx, at);
      if (step) return step;
    }
    return { at, ok: false, action: "unknown", error: "Ação não suportada" };
  } catch (e) {
    return {
      at,
      ok: false,
      action: action.type,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
