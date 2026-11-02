import type { SupabaseClient } from "@supabase/supabase-js";
import { workRpc } from "@/lib/access-control/work-core.server";
import { definitionSchema, type SequenceDefinition, type SequenceStep } from "./draft";
import { validateEmailAddress } from "@/lib/email-address";
import { pickWhatsAppNumber } from "@/lib/phone/whatsapp-e164";
import {
  decideExecution,
  type ExecutionDecision,
  type ExecutionSignals,
  type ExecutionState,
} from "./runtime";
export type SequenceRun = {
  id: string;
  workspace_id: string;
  owner_id: string;
  state: ExecutionState;
  cursor: number;
  lease_token: string;
  previous_at: string | null;
};
export type RuntimeContext = {
  run: SequenceRun;
  definition: SequenceDefinition;
  person: { id: string; entity: "lead" | "contact" };
  source: { email: string | null; phones: (string | null)[] };
  signals: Omit<ExecutionSignals, "hasEmail" | "hasWhatsApp">;
};
export type EffectReservation = { id: string; token: string; sourceKey: string | null };
export type SequencePorts = {
  /** Reads current provider configuration, no send. Failure is safe before reservation. */
  prepare: (
    context: RuntimeContext,
    step: SequenceStep,
  ) => Promise<
    (reservation: EffectReservation) => Promise<string | { receipt: string; committed: true }>
  >;
  handoff: (
    context: RuntimeContext,
    decision: Extract<ExecutionDecision, { kind: "stop" }>,
  ) => Promise<void>;
};
/** Worker cannot send without first committing a unique effect reservation. */
export async function processSequenceRun(
  admin: SupabaseClient,
  run: SequenceRun,
  ports: SequencePorts,
  now = new Date(),
) {
  let effect: EffectReservation | null = null;
  try {
    const ctx = await workRpc<RuntimeContext>(admin, "prospecting_sequence_context", {
      p_run: run.id,
      p_lease: run.lease_token,
    });
    ctx.definition = definitionSchema.parse(ctx.definition);
    const decision = decideExecution({
      runId: run.id,
      state: ctx.run.state,
      cursor: ctx.run.cursor,
      definition: ctx.definition,
      signals: {
        ...ctx.signals,
        hasEmail: validateEmailAddress(ctx.source.email).ok,
        hasWhatsApp: pickWhatsAppNumber(ctx.source.phones).status === "ok",
      },
      now,
      previousAt: ctx.run.previous_at ? new Date(ctx.run.previous_at) : null,
    });
    if (decision.kind === "effect") {
      const send = await ports.prepare(ctx, decision.step);
      effect = await workRpc<EffectReservation>(admin, "prospecting_sequence_effect_begin", {
        p_run: run.id,
        p_lease: run.lease_token,
        p_step: decision.step.id,
      });
      const result = await send(effect);
      const receipt = typeof result === "string" ? result : result.receipt;
      if (!receipt) throw new Error("provider_receipt_missing");
      const stored =
        typeof result !== "string" && result.committed
          ? true
          : await workRpc<boolean>(admin, "prospecting_sequence_effect_finish", {
              p_effect: effect.id,
              p_token: effect.token,
              p_provider: receipt,
              p_error: null,
            });
      if (!stored) throw new Error("provider_receipt_not_stored");
      return { id: run.id, status: "effect_succeeded" };
    }
    if (decision.kind === "stop" && (decision.state === "agent" || decision.state === "human"))
      await ports.handoff(ctx, decision);
    const advanced = await workRpc<boolean>(admin, "prospecting_sequence_transition", {
      p_run: run.id,
      p_lease: run.lease_token,
      p_state: decision.kind === "stop" ? decision.state : "active",
      p_cursor: decision.kind === "advance" ? decision.nextStep : ctx.run.cursor,
      p_due: decision.kind === "advance" ? decision.dueAt : now.toISOString(),
      p_reason: decision.reason,
    });
    return { id: run.id, status: advanced ? decision.kind : "stale_lease" };
  } catch {
    // Provider exceptions deliberately omit raw errors: they may contain addresses or secrets.
    if (effect)
      await workRpc(admin, "prospecting_sequence_effect_finish", {
        p_effect: effect.id,
        p_token: effect.token,
        p_provider: null,
        p_error: "provider_result_unknown",
      });
    else
      await workRpc(admin, "prospecting_sequence_transition", {
        p_run: run.id,
        p_lease: run.lease_token,
        p_state: "blocked",
        p_cursor: run.cursor,
        p_due: now.toISOString(),
        p_reason: "authorization_or_configuration_unavailable",
      });
    return { id: run.id, status: effect ? "uncertain" : "blocked" };
  }
}
export async function tickProspectingSequences(
  admin: SupabaseClient,
  ports: SequencePorts,
  limit = 20,
) {
  const runs = await workRpc<SequenceRun[]>(admin, "prospecting_sequence_claim", {
    p_limit: limit,
  });
  const results = [];
  for (const run of runs) results.push(await processSequenceRun(admin, run, ports));
  return { processed: results.length, results };
}
