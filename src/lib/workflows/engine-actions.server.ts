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
import { handleContractAction } from "./engine/actions-contracts.server";
import { handleDeliveryAction } from "./engine/actions-delivery.server";
import { handleHiringAction } from "./engine/actions-hiring.server";
import { handleOffboardingAction } from "./engine/actions-offboarding.server";
import { handleSdrAction } from "./engine/actions-sdr.server";
import { deliveryChannel, guardedDelivery } from "./engine/delivery-guard.server";

export type { RunCtx, RunResult };

const HANDLERS: ActionHandler[] = [
  handleFieldAction,
  handleAssignAction,
  handleMessagingAction,
  handleActivityAction,
  handleCrmAction,
  handleAtsAction,
  handleRecordAction,
  handleContractAction,
  handleDeliveryAction,
  handleHiringAction,
  handleOffboardingAction,
  handleSdrAction,
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
      // Quadro de retomada vale só para o passo onde a execução foi pausada.
      const resume =
        i === startIndex && ctx.resumeFrames?.length ? ctx.resumeFrames.shift() : undefined;
      const outcome = await runControlAction(supabase, action, ctx, {
        index: i,
        stepPath,
        annotate,
        runActions,
        resume,
      });
      log.push(...outcome.logs);
      if (outcome.done) {
        const done = { ...outcome.done };
        // No caminho principal, leva junto o estado durável para a retomada.
        if (!pathPrefix && done.suspendedAt && ctx.state && Object.keys(ctx.state).length > 0)
          done.suspendedAt = { ...done.suspendedAt, state: ctx.state };
        return { log: rawLog, ...done };
      }
      continue;
    }

    const raw = deliveryChannel(action)
      ? await guardedDelivery(supabase, action, ctx, stepPath, () =>
          runAction(supabase, action, ctx, true),
        )
      : await runAction(supabase, action, ctx);
    const step = annotate(raw);
    if (step.suspend_until) {
      // Repete este mesmo passo depois (horário, cota ou nova tentativa).
      log.push(step);
      return {
        log: rawLog,
        hadError: false,
        suspendedAt: {
          runAtIso: step.suspend_until,
          resumeCursor: i,
          ...(!pathPrefix && ctx.state && Object.keys(ctx.state).length > 0
            ? { state: ctx.state }
            : {}),
        },
      };
    }
    log.push(step);
    if (!step.ok) return { log: rawLog, hadError: true };
  }
  return { log: rawLog, hadError: false };
}

async function runAction(
  supabase: SupabaseClient,
  action: RunnableAction,
  ctx: RunCtx,
  rethrow = false,
): Promise<LogStep> {
  const at = new Date().toISOString();
  try {
    for (const handler of HANDLERS) {
      const step = await handler(supabase, action, ctx, at);
      if (step) return step;
    }
    return { at, ok: false, action: "unknown", error: "Ação não suportada" };
  } catch (e) {
    // O guarda de envio precisa do erro original para classificar a falha.
    if (rethrow) throw e;
    return {
      at,
      ok: false,
      action: action.type,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
