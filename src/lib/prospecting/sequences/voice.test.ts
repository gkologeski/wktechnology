import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { newDefinition } from "./draft";
import {
  prepareSequenceVoice,
  handleSequenceVoiceEvent,
  reconcileSequenceVoice,
} from "./voice.server";
import type { RuntimeContext } from "./worker.server";
vi.mock("@/lib/runtime-config.server", () => ({
  publicAppOrigin: () => "https://erp.example.test",
}));
const uuid = () => crypto.randomUUID();
function fixture(failure?: string) {
  const cfg = {
    sourceKey: uuid(),
    script: {
      id: uuid(),
      name: "Voice",
      firstMessage: "Olá {{lead.name}}",
      prompt: "WK {{lead.company}}",
      voiceId: "voice",
      voiceProvider: "elevenlabs",
    },
    model: "gpt-4o-mini",
    maxDurationSeconds: 600,
    language: "pt-BR",
  };
  const ctx: RuntimeContext = {
    run: {
      id: uuid(),
      workspace_id: uuid(),
      owner_id: uuid(),
      cursor: 0,
      state: "active",
      lease_token: uuid(),
      previous_at: null,
    },
    definition: newDefinition(),
    person: { entity: "contact", id: uuid() },
    source: { email: null, phones: ["+5548991104003"] },
    signals: {
      optedOut: false,
      replied: false,
      previousReplied: false,
      meetingBooked: false,
      callAnswered: false,
    },
  };
  const rpc = vi.fn(
    async (name: string): Promise<{ data: unknown; error: null | { message: string } }> => ({
      data: name === "prospecting_sequence_voice_access" ? structuredClone(cfg) : true,
      error: failure ? { message: failure } : null,
    }),
  );
  const admin = { rpc } as unknown as SupabaseClient;
  const effect = {
    id: uuid(),
    token: uuid(),
    sourceKey: cfg.sourceKey,
    source: structuredClone(ctx.source),
  };
  return { cfg, ctx, rpc, admin, effect };
}
beforeEach(() => {
  vi.stubEnv("VAPI_API_KEY", "fake-only");
  vi.stubEnv("VAPI_WEBHOOK_SECRET", "fake-webhook");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ id: uuid() })),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it("voice allowed actor reserves exact sender and persists receipt before activity", async () => {
  const h = fixture(),
    send = await prepareSequenceVoice(h.admin, h.ctx);
  const result = await send(h.effect);
  expect(result).toMatchObject({ committed: true });
  expect(fetch).toHaveBeenCalledOnce();
  expect(fetch).toHaveBeenCalledWith(
    "https://api.vapi.ai/call",
    expect.objectContaining({ redirect: "manual", signal: expect.any(AbortSignal) }),
  );
  const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
  expect(body.customer.number).toBe("+5548991104003");
  expect(body.metadata.techerpSequenceEffect).toBe(h.effect.id);
  expect(h.rpc.mock.calls.map(([name]) => name)).toEqual([
    "prospecting_sequence_voice_access",
    "prospecting_sequence_voice_access",
    "prospecting_sequence_receipt_store",
    "prospecting_sequence_delivery_commit",
  ]);
  expect(JSON.stringify(h.rpc.mock.calls)).not.toContain("fake-webhook");
});
it("voice rejects missing_permission before credentials or transport", async () => {
  const h = fixture("missing_permission");
  await expect(prepareSequenceVoice(h.admin, h.ctx)).rejects.toThrow("missing_permission");
  expect(fetch).not.toHaveBeenCalled();
});
it("voice rejects explicit_deny before credentials or transport", async () => {
  const h = fixture("explicit_deny");
  await expect(prepareSequenceVoice(h.admin, h.ctx)).rejects.toThrow("explicit_deny");
  expect(fetch).not.toHaveBeenCalled();
});
it("voice rejects foreign_workspace before credentials or transport", async () => {
  const h = fixture("foreign_workspace");
  await expect(prepareSequenceVoice(h.admin, h.ctx)).rejects.toThrow("foreign_workspace");
  expect(fetch).not.toHaveBeenCalled();
});
it("voice rejects inactive_member before credentials or transport", async () => {
  const h = fixture("inactive_member");
  await expect(prepareSequenceVoice(h.admin, h.ctx)).rejects.toThrow("inactive_member");
  expect(fetch).not.toHaveBeenCalled();
});
it("voice rechecks source and configuration after reservation without sending", async () => {
  const h = fixture(),
    send = await prepareSequenceVoice(h.admin, h.ctx);
  h.cfg.sourceKey = uuid();
  await expect(send(h.effect)).rejects.toThrow("sender_changed_before_send");
  expect(fetch).not.toHaveBeenCalled();
});
it("voice never retries an unknown provider result", async () => {
  const h = fixture(),
    send = await prepareSequenceVoice(h.admin, h.ctx);
  vi.mocked(fetch).mockRejectedValueOnce(new Error("timeout"));
  await expect(send(h.effect)).rejects.toThrow("timeout");
  expect(fetch).toHaveBeenCalledOnce();
  expect(h.rpc.mock.calls.some(([n]) => n === "prospecting_sequence_receipt_store")).toBe(false);
});
it("voice preserves a durable receipt if the activity projection fails", async () => {
  const h = fixture(),
    original = h.rpc.getMockImplementation()!;
  h.rpc.mockImplementation(async (name) =>
    name === "prospecting_sequence_delivery_commit"
      ? { data: null, error: { message: "projection" } }
      : original(name),
  );
  const result = await (await prepareSequenceVoice(h.admin, h.ctx))(h.effect);
  expect(result).toMatchObject({ projectionPending: true, committed: true });
  expect(fetch).toHaveBeenCalledOnce();
});
it("voice callback ignores legacy calls and records only verified sequence identities", async () => {
  const h = fixture();
  expect(await handleSequenceVoiceEvent(h.admin, { call: { id: uuid() } })).toBe(false);
  expect(h.rpc).not.toHaveBeenCalled();
  const call = {
    id: uuid(),
    phoneNumberId: h.cfg.sourceKey,
    customer: { number: "+5548991104003" },
    metadata: { techerpSequenceEffect: h.effect.id },
    startedAt: new Date().toISOString(),
  };
  expect(
    await handleSequenceVoiceEvent(h.admin, {
      type: "end-of-call-report",
      endedReason: "customer-ended-call",
      call,
    }),
  ).toBe(true);
  expect(h.rpc).toHaveBeenCalledWith(
    "prospecting_sequence_voice_event",
    expect.objectContaining({ p_effect: h.effect.id, p_terminal: true, p_outcome: "answered" }),
  );
});
it("ambiguous ended status waits for the actual final call report", async () => {
  const h = fixture();
  await handleSequenceVoiceEvent(h.admin, {
    type: "status-update",
    status: "ended",
    call: {
      id: uuid(),
      phoneNumberId: h.cfg.sourceKey,
      customer: { number: "+5548991104003" },
      metadata: { techerpSequenceEffect: h.effect.id },
    },
  });
  expect(h.rpc).toHaveBeenCalledWith(
    "prospecting_sequence_voice_event",
    expect.objectContaining({ p_terminal: false, p_outcome: null }),
  );
});

it("voice reconciliation only reads known accepted call IDs and never posts a call", async () => {
  const h = fixture(),
    id = uuid(),
    original = h.rpc.getMockImplementation()!;
  h.rpc.mockImplementation(async (name) =>
    name === "prospecting_sequence_voice_pending"
      ? { data: [{ effect_id: h.effect.id, call_id: id }], error: null }
      : original(name),
  );
  vi.mocked(fetch).mockResolvedValueOnce(
    Response.json({
      id,
      status: "ended",
      endedReason: "customer-did-not-answer",
      phoneNumberId: h.cfg.sourceKey,
      customer: { number: "+5548991104003" },
      metadata: { techerpSequenceEffect: h.effect.id },
    }),
  );
  expect(await reconcileSequenceVoice(h.admin)).toEqual({ checked: 1, failed: 0 });
  expect(fetch).toHaveBeenCalledWith(
    `https://api.vapi.ai/call/${id}`,
    expect.objectContaining({ redirect: "manual" }),
  );
  expect(vi.mocked(fetch).mock.calls[0][1]?.method).toBeUndefined();
  expect(h.rpc).toHaveBeenCalledWith(
    "prospecting_sequence_voice_event",
    expect.objectContaining({ p_outcome: "no_answer", p_terminal: true }),
  );
});
it("voice reconciliation refuses a returned call for another effect", async () => {
  const h = fixture(),
    id = uuid(),
    original = h.rpc.getMockImplementation()!;
  h.rpc.mockImplementation(async (name) =>
    name === "prospecting_sequence_voice_pending"
      ? { data: [{ effect_id: h.effect.id, call_id: id }], error: null }
      : original(name),
  );
  vi.mocked(fetch).mockResolvedValueOnce(
    Response.json({ id, metadata: { techerpSequenceEffect: uuid() } }),
  );
  expect(await reconcileSequenceVoice(h.admin)).toEqual({ checked: 0, failed: 1 });
  expect(h.rpc.mock.calls.some(([n]) => n === "prospecting_sequence_voice_event")).toBe(false);
});
