import type { SupabaseClient } from "@supabase/supabase-js";
import { workRpc } from "@/lib/access-control/work-core.server";
import { definitionSchema, type SequenceDefinition, type SequenceStep } from "./draft";
import { isValidE164 } from "@/lib/phone/e164";
import { validateEmailAddress } from "@/lib/email-address";
import { pickWhatsAppNumber } from "@/lib/phone/whatsapp-e164";
import {
  decideExecution,
  SequenceNotStartedError,
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
  step_entered_at?: string;
  created_at?: string;
};
export type RuntimeContext = {
  run: SequenceRun;
  definition: SequenceDefinition;
  person: { id: string; entity: "lead" | "contact" };
  source: { email: string | null; phones: (string | null)[] };
  signals: Omit<ExecutionSignals, "hasEmail" | "hasWhatsApp" | "hasPhone">;
};
export type EffectReservation = {
  id: string;
  token: string;
  sourceKey: string | null;
  source?: RuntimeContext["source"];
};
export type SequencePorts = {
  /** Reads current provider configuration, no send. Failure is safe before reservation. */
  prepare: (
    context: RuntimeContext,
    step: SequenceStep,
  ) => Promise<
    (
      reservation: EffectReservation,
    ) => Promise<string | { receipt: string; committed: true; projectionPending?: boolean }>
  >;
  handoff: (
    context: RuntimeContext,
    decision: Extract<ExecutionDecision, { kind: "stop" }>,
  ) => Promise<void | { state: "human" | "agent" }>;
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
        hasPhone: ctx.source.phones.some((p) => !!p && isValidE164(p)),
        hasEmail: validateEmailAddress(ctx.source.email).ok,
        hasWhatsApp:
          pickWhatsAppNumber(ctx.source.phones.filter((p): p is string => !!p && isValidE164(p)))
            .status === "ok",
      },
      now,
      previousAt: new Date(
        ctx.run.step_entered_at || ctx.run.previous_at || ctx.run.created_at || now.toISOString(),
      ),
    });
    if (decision.kind === "effect") {
      const send = await ports.prepare(ctx, decision.step);
      const reservation = await workRpc<
        EffectReservation | { deferUntil: string; reason: string } | { blockReason: string }
      >(admin, "prospecting_sequence_effect_begin", {
        p_run: run.id,
        p_lease: run.lease_token,
        p_step: decision.step.id,
        p_prepared: {
          source: ctx.source,
          email: (() => {
            const e = validateEmailAddress(ctx.source.email);
            return e.ok ? e.value : null;
          })(),
          phones: ctx.source.phones.filter((p): p is string => !!p && isValidE164(p)),
          whatsapp: (() => {
            const p = pickWhatsAppNumber(
              ctx.source.phones.filter((n): n is string => !!n && isValidE164(n)),
            );
            return p.status === "ok" ? p.e164 : null;
          })(),
        },
      });
      if ("blockReason" in reservation) {
        await workRpc(admin, "prospecting_sequence_transition", {
          p_run: run.id,
          p_lease: run.lease_token,
          p_state: "blocked",
          p_cursor: ctx.run.cursor,
          p_due: now.toISOString(),
          p_reason: reservation.blockReason,
        });
        return { id: run.id, status: "blocked" };
      }
      if ("deferUntil" in reservation) {
        await workRpc(admin, "prospecting_sequence_transition", {
          p_run: run.id,
          p_lease: run.lease_token,
          p_state: "active",
          p_cursor: ctx.run.cursor,
          p_due: reservation.deferUntil,
          p_reason: reservation.reason,
        });
        return { id: run.id, status: "deferred" };
      }
      effect = reservation;
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
      return {
        id: run.id,
        status:
          typeof result !== "string" && result.projectionPending
            ? "projection_pending"
            : "effect_succeeded",
      };
    }
    if (decision.kind === "stop" && (decision.state === "agent" || decision.state === "human")) {
      const handoff = await ports.handoff(ctx, decision);
      if (handoff) decision.state = handoff.state;
    }
    const advanced = await workRpc<boolean>(admin, "prospecting_sequence_transition", {
      p_run: run.id,
      p_lease: run.lease_token,
      p_state: decision.kind === "stop" ? decision.state : "active",
      p_cursor: decision.kind === "advance" ? decision.nextStep : ctx.run.cursor,
      p_due: decision.kind === "advance" ? decision.dueAt : now.toISOString(),
      p_reason: decision.reason,
    });
    return { id: run.id, status: advanced ? decision.kind : "stale_lease" };
  } catch (error) {
    if (effect && error instanceof SequenceNotStartedError) {
      await workRpc(admin, "prospecting_sequence_effect_not_started", {
        p_effect: effect.id,
        p_token: effect.token,
        p_reason: error.code,
      });
      return { id: run.id, status: "blocked" };
    }
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
  limit = 5,
  budgetMs = 20_000,
) {
  const started = Date.now();
  const released = await workRpc<number>(admin, "prospecting_sequence_release_identities", {
    p_limit: 500,
  });
  const repair = await workRpc<{ fixed: number; failed: number }>(
    admin,
    "prospecting_sequence_projection_repair",
    { p_limit: 10 },
  );
  const replied = await workRpc<number>(admin, "prospecting_sequence_wake_replies", {
    p_limit: 100,
  });
  const awakened = await workRpc<number>(admin, "prospecting_sequence_wake_tasks", {
    p_limit: 100,
  });
  const runs = await workRpc<SequenceRun[]>(admin, "prospecting_sequence_claim", {
    p_limit: limit,
  });
  const results: Awaited<ReturnType<typeof processSequenceRun>>[] = [];
  let index = 0;
  const consume = async () => {
    while (index < runs.length && Date.now() - started < budgetMs) {
      const run = runs[index++];
      results.push(await processSequenceRun(admin, run, ports));
    }
  };
  try {
    const settled = await Promise.allSettled([consume(), consume()]);
    if (settled.some((r) => r.status === "rejected"))
      throw new Error("sequence_worker_unavailable");
  } finally {
    const remaining = runs.slice(index);
    if (remaining.length)
      await workRpc(admin, "prospecting_sequence_release_claims", {
        p_claims: remaining.map((r) => ({ id: r.id, token: r.lease_token })),
      });
  }
  return {
    processed: results.length,
    deferredByBudget: runs.length - index,
    repaired: repair,
    released,
    awakened,
    replied,
    results,
  };
}
