import { expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sequenceHandoff } from "./handoff.server";
import type { RuntimeContext } from "./worker.server";
const ctx = {
  run: { id: crypto.randomUUID(), lease_token: crypto.randomUUID() },
} as RuntimeContext;
it("handoff confirms only the selected SQL-authorized outcome", async () => {
  const rpc = vi.fn(async () => ({ data: "human", error: null }));
  await expect(
    sequenceHandoff({ rpc } as unknown as SupabaseClient)(ctx, {
      kind: "stop",
      state: "agent",
      reason: "reply",
      agentId: "selected",
    }),
  ).resolves.toEqual({ state: "human" });
  expect(rpc).toHaveBeenCalledWith("prospecting_sequence_handoff", {
    p_run: ctx.run.id,
    p_lease: ctx.run.lease_token,
    p_mode: "agent",
    p_agent: "selected",
  });
});
it("handoff refuses missing permission without a fallback send", async () => {
  const rpc = vi.fn(async () => ({ data: null, error: { message: "missing permission" } }));
  await expect(
    sequenceHandoff({ rpc } as unknown as SupabaseClient)(ctx, {
      kind: "stop",
      state: "human",
      reason: "reply",
    }),
  ).rejects.toThrow();
  expect(rpc).toHaveBeenCalledOnce();
});
it("handoff preserves explicit deny refusal", async () => {
  const rpc = vi.fn(async () => ({ data: null, error: { message: "explicit deny" } }));
  await expect(
    sequenceHandoff({ rpc } as unknown as SupabaseClient)(ctx, {
      kind: "stop",
      state: "human",
      reason: "reply",
    }),
  ).rejects.toThrow();
  expect(rpc).toHaveBeenCalledOnce();
});
it("handoff refuses foreign source workspace", async () => {
  const rpc = vi.fn(async () => ({ data: null, error: { message: "foreign workspace" } }));
  await expect(
    sequenceHandoff({ rpc } as unknown as SupabaseClient)(ctx, {
      kind: "stop",
      state: "human",
      reason: "reply",
    }),
  ).rejects.toThrow();
  expect(rpc).toHaveBeenCalledOnce();
});
it("handoff refuses inactive execution owner", async () => {
  const rpc = vi.fn(async () => ({ data: null, error: { message: "inactive member" } }));
  await expect(
    sequenceHandoff({ rpc } as unknown as SupabaseClient)(ctx, {
      kind: "stop",
      state: "human",
      reason: "reply",
    }),
  ).rejects.toThrow();
  expect(rpc).toHaveBeenCalledOnce();
});
it("handoff rejects an absent confirmation", async () => {
  const rpc = vi.fn(async () => ({ data: null, error: null }));
  await expect(
    sequenceHandoff({ rpc } as unknown as SupabaseClient)(ctx, {
      kind: "stop",
      state: "human",
      reason: "reply",
    }),
  ).rejects.toThrow("handoff_not_confirmed");
});
