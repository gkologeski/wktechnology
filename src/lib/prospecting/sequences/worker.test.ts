import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SequenceNotStartedError } from "./runtime";
import { newDefinition } from "./draft";
import {
  processSequenceRun,
  tickProspectingSequences,
  type RuntimeContext,
  type SequencePorts,
  type SequenceRun,
} from "./worker.server";
const run: SequenceRun = {
  id: crypto.randomUUID(),
  workspace_id: crypto.randomUUID(),
  owner_id: crypto.randomUUID(),
  state: "active",
  cursor: 0,
  lease_token: crypto.randomUUID(),
  previous_at: null,
};
function harness() {
  const definition = newDefinition();
  definition.steps = [definition.steps[0]];
  const context: RuntimeContext = {
    run,
    definition,
    person: { id: crypto.randomUUID(), entity: "contact" },
    source: { email: "test@example.com", phones: [] },
    signals: {
      optedOut: false,
      replied: false,
      previousReplied: false,
      meetingBooked: false,
      callAnswered: false,
    },
  };
  const send = vi.fn(async () => "receipt"),
    prepare = vi.fn(async () => send),
    handoff = vi.fn(async () => {});
  const rpc = vi.fn(
    async (name: string): Promise<{ data: unknown; error: null | { message: string } }> => ({
      data:
        name === "prospecting_sequence_context"
          ? context
          : name === "prospecting_sequence_effect_begin"
            ? { id: "effect", token: "token" }
            : true,
      error: null as null | { message: string },
    }),
  );
  return {
    context,
    rpc,
    send,
    prepare,
    handoff,
    admin: { rpc } as unknown as SupabaseClient,
    ports: { prepare, handoff } satisfies SequencePorts,
  };
}
const now = new Date("2026-11-02T13:00:00Z");
describe("durable sequence worker", () => {
  it("allowed worker reserves before sending and persists provider receipt", async () => {
    const h = harness();
    expect(await processSequenceRun(h.admin, run, h.ports, now)).toMatchObject({
      status: "effect_succeeded",
    });
    expect(h.rpc.mock.calls.map(([n]) => n)).toEqual([
      "prospecting_sequence_context",
      "prospecting_sequence_effect_begin",
      "prospecting_sequence_effect_finish",
    ]);
    expect(h.send).toHaveBeenCalledOnce();
  });
  it("worker without current source access cannot prepare or send", async () => {
    const h = harness();
    h.rpc.mockResolvedValueOnce({ data: null as never, error: { message: "42501" } });
    expect(await processSequenceRun(h.admin, run, h.ports, now)).toMatchObject({
      status: "blocked",
    });
    expect(h.prepare).not.toHaveBeenCalled();
    expect(h.send).not.toHaveBeenCalled();
  });
  it("worker denied at last reservation never invokes provider", async () => {
    const h = harness();
    h.rpc.mockImplementation(async (n) => ({
      data: n === "prospecting_sequence_context" ? h.context : true,
      error: n === "prospecting_sequence_effect_begin" ? { message: "denied" } : null,
    }));
    await processSequenceRun(h.admin, run, h.ports, now);
    expect(h.prepare).toHaveBeenCalledOnce();
    expect(h.send).not.toHaveBeenCalled();
  });
  it("worker with stale or foreign lease cannot retrieve execution context", async () => {
    const h = harness();
    h.rpc.mockResolvedValueOnce({ data: null as never, error: { message: "lease unavailable" } });
    await processSequenceRun(
      h.admin,
      { ...run, workspace_id: crypto.randomUUID(), lease_token: crypto.randomUUID() },
      h.ports,
      now,
    );
    expect(h.send).not.toHaveBeenCalled();
  });
  it("worker for inactive owner stops before credentials or provider", async () => {
    const h = harness();
    h.rpc.mockResolvedValueOnce({ data: null as never, error: { message: "inactive subject" } });
    await processSequenceRun(h.admin, run, h.ports, now);
    expect(h.prepare).not.toHaveBeenCalled();
    expect(h.send).not.toHaveBeenCalled();
  });
  it("timeout after reservation becomes uncertain, never an automatic resend", async () => {
    const h = harness();
    h.send.mockRejectedValue(new Error("secret provider error"));
    expect(await processSequenceRun(h.admin, run, h.ports, now)).toMatchObject({
      status: "uncertain",
    });
    const args = h.rpc.mock.calls.at(-1) as unknown[];
    expect(JSON.stringify(args)).not.toContain("secret provider error");
    expect(h.send).toHaveBeenCalledOnce();
  });
  it("reply hands off and transitions without dispatching", async () => {
    const h = harness();
    h.context.signals.replied = true;
    await processSequenceRun(h.admin, run, h.ports, now);
    expect(h.handoff).toHaveBeenCalledOnce();
    expect(h.send).not.toHaveBeenCalled();
  });
  it("pacing defers the same step and never invokes its provider", async () => {
    const h = harness();
    h.rpc.mockImplementation(async (name) => ({
      data:
        name === "prospecting_sequence_context"
          ? h.context
          : name === "prospecting_sequence_effect_begin"
            ? { deferUntil: "2026-11-03T13:00:00Z", reason: "daily_account_limit" }
            : true,
      error: null,
    }));
    expect(await processSequenceRun(h.admin, run, h.ports, now)).toMatchObject({
      status: "deferred",
    });
    expect(h.send).not.toHaveBeenCalled();
    expect(h.rpc.mock.calls.at(-1)?.[0]).toBe("prospecting_sequence_transition");
  });
  it("tick budget releases untouched claims without calling a provider", async () => {
    const h = harness();
    h.rpc.mockImplementation(async (name) => ({
      data:
        name === "prospecting_sequence_projection_repair"
          ? { fixed: 0, failed: 0 }
          : name === "prospecting_sequence_wake_tasks"
            ? 0
            : name === "prospecting_sequence_claim"
              ? [run, { ...run, id: crypto.randomUUID() }]
              : 2,
      error: null,
    }));
    const result = await tickProspectingSequences(h.admin, h.ports, 5, 0);
    expect(result.processed).toBe(0);
    expect(result.deferredByBudget).toBe(2);
    expect(h.send).not.toHaveBeenCalled();
    expect(h.rpc.mock.calls.at(-1)?.[0]).toBe("prospecting_sequence_release_claims");
  });
  it("unresolved identity quarantine cannot reach the provider", async () => {
    const h = harness();
    h.rpc.mockImplementation(async (name) => ({
      data:
        name === "prospecting_sequence_context"
          ? h.context
          : name === "prospecting_sequence_effect_begin"
            ? { blockReason: "delivery_uncertain" }
            : true,
      error: null,
    }));
    expect(await processSequenceRun(h.admin, run, h.ports, now)).toMatchObject({
      status: "blocked",
    });
    expect(h.send).not.toHaveBeenCalled();
  });
  it("certified pre-transport change blocks safely without declaring an unknown delivery", async () => {
    const h = harness();
    h.send.mockRejectedValue(new SequenceNotStartedError("source_changed_before_send"));
    expect(await processSequenceRun(h.admin, run, h.ports, now)).toMatchObject({
      status: "blocked",
    });
    expect(h.rpc.mock.calls.at(-1)?.[0]).toBe("prospecting_sequence_effect_not_started");
    expect(h.rpc.mock.calls.some(([name]) => name === "prospecting_sequence_effect_finish")).toBe(
      false,
    );
  });
});
