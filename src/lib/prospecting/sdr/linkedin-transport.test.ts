import { beforeEach, expect, it, vi } from "vitest";
const calls = vi.hoisted(() => ({ load: vi.fn(), send: vi.fn() }));
vi.mock("@/lib/unipile/client.server", () => ({
  loadAccountCtx: calls.load,
  sendLinkedinChatReply: calls.send,
  normalizeSendMessageResult: (r: { id?: string }) => ({ messageId: r.id ?? null, chatId: null }),
  UnipileError: class extends Error {
    code: string;
    retryAfterMs: number;
    constructor() {
      super("quota");
      this.code = "rate_limited";
      this.retryAfterMs = 120000;
    }
  },
}));
import { deliverServiceJob } from "./service-transports.server";
const session = {
  id: "session",
  workspace_id: "workspace",
  source_id: "conversation",
  channel: "linkedin",
} as never;
const job = {
  id: "job",
  workspace_id: "workspace",
  lease_token: "lease",
  send_token: "send-token",
  draft_text: "Teste de atendimento",
  draft_payload: {},
} as never;
let cv: Record<string, unknown>;
let db: any;
beforeEach(() => {
  vi.clearAllMocks();
  cv = { account_id: "account", owner_id: "owner", provider_chat_id: "exact-chat", status: "open" };
  calls.load.mockResolvedValue({
    accountId: "account",
    ownerId: "owner",
    unipileAccountId: "provider",
  });
  calls.send.mockResolvedValue({ id: "message" });
  const query: any = {
    select: () => query,
    eq: () => query,
    update: () => query,
    single: async () => ({ data: cv, error: null }),
    then: (resolve: any) => Promise.resolve({ data: null, error: null }).then(resolve),
  };
  db = {
    from: vi.fn(() => query),
    rpc: vi.fn(async (name: string) => ({
      data: name === "service_agent_guard" ? "ok" : "outbound",
      error: null,
    })),
  };
});
it("replies in the exact personal chat and commits only after confirmed acceptance", async () => {
  await expect(deliverServiceJob(db, session, job, {} as never)).resolves.toEqual({
    providerId: "message",
  });
  expect(calls.load).toHaveBeenCalledWith("owner", "workspace");
  expect(calls.send.mock.calls[0][1]).toMatchObject({
    chatId: "exact-chat",
    requestKey: "sdr:job",
    text: "Teste de atendimento",
  });
  expect(db.rpc).toHaveBeenCalledWith("service_agent_complete_linkedin", {
    p_job: "job",
    p_send_token: "send-token",
    p_provider_id: "message",
  });
});
it("never sends through a replaced account or closed conversation", async () => {
  calls.load.mockResolvedValue({ accountId: "other" });
  await expect(deliverServiceJob(db, session, job, {} as never)).rejects.toMatchObject({
    beforeProvider: true,
  });
  cv.status = "closed";
  await expect(deliverServiceJob(db, session, job, {} as never)).rejects.toMatchObject({
    beforeProvider: true,
  });
  expect(calls.send).not.toHaveBeenCalled();
});
it("rechecks job authorization immediately before external delivery", async () => {
  db.rpc
    .mockResolvedValueOnce({ data: "ok", error: null })
    .mockResolvedValueOnce({ data: "ownership_changed", error: null });
  await expect(deliverServiceJob(db, session, job, {} as never)).rejects.toMatchObject({
    serviceGuard: true,
  });
  expect(calls.send).not.toHaveBeenCalled();
});
it("defers provider backpressure without confirming or blindly retrying", async () => {
  const { UnipileError } = await import("@/lib/unipile/client.server");
  calls.send.mockRejectedValue(new (UnipileError as any)());
  await expect(deliverServiceJob(db, session, job, {} as never)).rejects.toMatchObject({
    beforeProvider: true,
    deferMs: 120000,
  });
  expect(db.rpc.mock.calls.some((c: any[]) => c[0] === "service_agent_complete_linkedin")).toBe(
    false,
  );
  expect(calls.send).toHaveBeenCalledTimes(1);
});
