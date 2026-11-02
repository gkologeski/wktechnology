import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { newDefinition, type SequenceStep } from "./draft";
import { sequenceDeliveryPorts } from "./delivery.server";
import type { EffectReservation, RuntimeContext } from "./worker.server";
const mocks = vi.hoisted(() => ({
  gmail: vi.fn(async () => ({ id: "gmail-id", threadId: "gmail-thread" })),
  mime: vi.fn(() => "MIME"),
  meta: vi.fn(async () => ({ wamid: "wamid", raw: {} })),
  templates: vi.fn(async () => ({
    source: "provider",
    items: [
      {
        name: "hello",
        language: "pt_BR",
        status: "APPROVED",
        components: [{ type: "BODY", text: "Oi {{1}}" }],
      },
    ],
  })),
}));
vi.mock("@/lib/gmail.server", () => ({
  gmailSendRaw: mocks.gmail,
  buildRawMime: mocks.mime,
  ensureAccessToken: vi.fn(async () => "fake-access-token"),
}));
vi.mock("@/lib/message-tokens-agent.server", () => ({
  loadAgentContext: vi.fn(async () => ({ name: "Test", email: "sender@example.test" })),
}));
vi.mock("@/lib/runtime-config.server", () => ({ publicAppOrigin: () => "https://example.test" }));
vi.mock("@/lib/whatsapp/meta-channel.server", () => ({
  resolveWaNumber: vi.fn(async () => ({
    phoneNumberId: "123456789",
    displayPhoneNumber: "+554861365335",
    provider: "cloud",
  })),
  metaSend: mocks.meta,
  applyPositionalTemplate: (s: string, a: string[]) =>
    s.replace(/\{\{(\d+)\}\}/g, (_, n) => a[Number(n) - 1]),
}));
vi.mock("@/lib/whatsapp/templates.server", () => ({ loadTemplateCatalog: mocks.templates }));
function fixture(channel: "email" | "whatsapp" = "email") {
  mocks.gmail.mockClear();
  mocks.meta.mockClear();
  mocks.mime.mockClear();
  mocks.templates.mockClear();
  const ctx: RuntimeContext = {
    run: {
      id: crypto.randomUUID(),
      workspace_id: crypto.randomUUID(),
      owner_id: crypto.randomUUID(),
      cursor: 0,
      state: "active",
      lease_token: crypto.randomUUID(),
      previous_at: null,
    },
    definition: newDefinition(),
    person: { id: crypto.randomUUID(), entity: "contact" },
    source: { email: "Ana@example.test", phones: ["+5548991104003"] },
    signals: {
      optedOut: false,
      replied: false,
      previousReplied: false,
      meetingBooked: false,
      callAnswered: false,
    },
  };
  const sourceKey = channel === "email" ? crypto.randomUUID() : "123456789";
  const step: Extract<SequenceStep, { type: "email" | "whatsapp" }> =
    channel === "email"
      ? {
          id: crypto.randomUUID(),
          title: "Email",
          type: "email" as const,
          accountId: crypto.randomUUID(),
          subject: "Hello",
          body: "Text",
          thread: "new" as const,
        }
      : {
          id: crypto.randomUUID(),
          title: "WhatsApp",
          type: "whatsapp" as const,
          accountId: crypto.randomUUID(),
          templateName: "hello",
          language: "pt_BR",
          variables: { "1": "Ana" },
          agentId: null,
        };
  const from = vi.fn((table: string) => {
    const response =
      table === "email_accounts"
        ? {
            id: sourceKey,
            workspace_id: ctx.run.workspace_id,
            owner_id: ctx.run.owner_id,
            email: "sender@example.test",
            status: "connected",
          }
        : { token: "fake-unsubscribe-token", reason: "__token__" };
    const chain = {
      select: () => chain,
      eq: () => chain,
      maybeSingle: async () => ({ data: response, error: null }),
    };
    return chain;
  });
  const rpc = vi.fn(
    async (name: string): Promise<{ data: unknown; error: null | { message: string } }> => ({
      data: name === "prospecting_sequence_delivery_access" ? { sourceKey } : "stored-id",
      error: null as null | { message: string },
    }),
  );
  const admin = { from, rpc } as unknown as SupabaseClient;
  const effect: EffectReservation = {
    id: crypto.randomUUID(),
    token: crypto.randomUUID(),
    sourceKey,
    source: structuredClone(ctx.source),
  };
  return {
    ctx,
    step,
    admin,
    rpc,
    from,
    effect,
    sourceKey,
    ports: sequenceDeliveryPorts(admin, async () => {}),
  };
}
describe("sequence provider delivery", () => {
  it("allowed email uses exact mailbox, recipient and durable receipt", async () => {
    const h = fixture();
    const send = await h.ports.prepare(h.ctx, h.step);
    expect(await send(h.effect)).toEqual({ receipt: "gmail-id", committed: true });
    expect(mocks.gmail).toHaveBeenCalledOnce();
    expect(mocks.mime).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["Ana@example.test"],
        messageId: `<seq-${h.effect.id}@techerp.invalid>`,
        bodyText: expect.stringContaining("/api/public/email/unsubscribe/"),
      }),
    );
    expect(h.rpc.mock.calls.at(-1)?.[0]).toBe("prospecting_sequence_delivery_commit");
  });
  it("delivery without channel permission stops before credentials", async () => {
    const h = fixture();
    h.rpc.mockResolvedValueOnce({
      data: null as never,
      error: { message: "missing channel permission" },
    });
    await expect(h.ports.prepare(h.ctx, h.step)).rejects.toThrow();
    expect(h.from).not.toHaveBeenCalled();
    expect(mocks.gmail).not.toHaveBeenCalled();
  });
  it("explicit deny stops provider preparation before reading the mailbox", async () => {
    const h = fixture();
    h.rpc.mockResolvedValueOnce({ data: null as never, error: { message: "explicit deny" } });
    await expect(h.ports.prepare(h.ctx, h.step)).rejects.toThrow();
    expect(h.from).not.toHaveBeenCalled();
    expect(mocks.meta).not.toHaveBeenCalled();
  });
  it("foreign account cannot pass scoped delivery access", async () => {
    const h = fixture("whatsapp");
    h.rpc.mockResolvedValueOnce({ data: null as never, error: { message: "foreign workspace" } });
    await expect(h.ports.prepare(h.ctx, h.step)).rejects.toThrow();
    expect(mocks.templates).not.toHaveBeenCalled();
    expect(mocks.meta).not.toHaveBeenCalled();
  });
  it("inactive actor cannot read transport credentials", async () => {
    const h = fixture();
    h.rpc.mockResolvedValueOnce({ data: null as never, error: { message: "inactive member" } });
    await expect(h.ports.prepare(h.ctx, h.step)).rejects.toThrow();
    expect(h.from).not.toHaveBeenCalled();
    expect(mocks.gmail).not.toHaveBeenCalled();
  });
  it("WhatsApp sends only the selected current approved template", async () => {
    const h = fixture("whatsapp");
    const send = await h.ports.prepare(h.ctx, h.step);
    expect(await send(h.effect)).toEqual({ receipt: "wamid", committed: true });
    expect(mocks.meta).toHaveBeenCalledWith(
      expect.objectContaining({ phoneNumberId: h.effect.sourceKey }),
      { to: "+5548991104003", template: { name: "hello", language: "pt_BR", variables: ["Ana"] } },
    );
  });
  it("local-only or unavailable catalog never authorizes a send", async () => {
    const h = fixture("whatsapp");
    mocks.templates.mockResolvedValueOnce({ source: "local", items: [] });
    await expect(h.ports.prepare(h.ctx, h.step)).rejects.toThrow();
    expect(mocks.meta).not.toHaveBeenCalled();
  });
  it("changed source after preparation never reaches Gmail", async () => {
    const h = fixture();
    const send = await h.ports.prepare(h.ctx, h.step);
    h.effect.source = { ...h.ctx.source, email: "other@example.test" };
    await expect(send(h.effect)).rejects.toThrow();
    expect(mocks.gmail).not.toHaveBeenCalled();
  });
  it("changed account after preparation never reaches Meta", async () => {
    const h = fixture("whatsapp");
    const send = await h.ports.prepare(h.ctx, h.step);
    h.effect.sourceKey = "different-number";
    await expect(send(h.effect)).rejects.toThrow();
    expect(mocks.meta).not.toHaveBeenCalled();
  });
  it("missing personalization value blocks the email instead of silently dropping it", async () => {
    const h = fixture();
    if (h.step.type === "email") h.step.body = "Hello {{unknown_private_field}}";
    await expect(h.ports.prepare(h.ctx, h.step)).rejects.toThrow();
    expect(mocks.gmail).not.toHaveBeenCalled();
  });
  it("provider receipt remains committed when Inbox projection fails", async () => {
    const h = fixture();
    h.rpc.mockImplementation(async (name) => ({
      data:
        name === "prospecting_sequence_delivery_access" ? { sourceKey: h.sourceKey } : "stored-id",
      error:
        name === "prospecting_sequence_delivery_commit"
          ? { message: "projection unavailable" }
          : null,
    }));
    const send = await h.ports.prepare(h.ctx, h.step);
    expect(await send(h.effect)).toEqual({
      receipt: "gmail-id",
      committed: true,
      projectionPending: true,
    });
    expect(h.rpc.mock.calls.map(([name]) => name)).toEqual([
      "prospecting_sequence_delivery_access",
      "prospecting_sequence_receipt_store",
      "prospecting_sequence_delivery_commit",
    ]);
    expect(mocks.gmail).toHaveBeenCalledOnce();
  });
  it("reply mode uses only the authorized same-account conversation reference", async () => {
    const h = fixture();
    if (h.step.type !== "email") throw Error("Email expected");
    h.step.thread = "reply";
    h.ctx.run.cursor = 1;
    h.ctx.definition.steps = [{ ...h.step, id: crypto.randomUUID(), thread: "new" }, h.step];
    const original = h.rpc.getMockImplementation()!;
    h.rpc.mockImplementation(async (name) =>
      name === "prospecting_sequence_reply_thread"
        ? ({
            data: { threadId: "authorized-thread", messageIdHeader: "<original@example.test>" },
            error: null,
          } as never)
        : original(name),
    );
    const send = await h.ports.prepare(h.ctx, h.step);
    await send(h.effect);
    expect(mocks.mime).toHaveBeenCalledWith(
      expect.objectContaining({ inReplyTo: "<original@example.test>" }),
    );
    expect(h.rpc).toHaveBeenCalledWith("prospecting_sequence_reply_thread", {
      p_run: h.ctx.run.id,
      p_lease: h.ctx.run.lease_token,
      p_recipient: "Ana@example.test",
    });
  });
  it("a changed or unreadable reply recipient never reaches Gmail", async () => {
    const h = fixture();
    if (h.step.type !== "email") throw Error("Email expected");
    h.step.thread = "reply";
    const original = h.rpc.getMockImplementation()!;
    h.rpc.mockImplementation(async (name) =>
      name === "prospecting_sequence_reply_thread"
        ? { data: null, error: { message: "recipient changed" } }
        : original(name),
    );
    await expect(h.ports.prepare(h.ctx, h.step)).rejects.toThrow("recipient changed");
    expect(mocks.gmail).not.toHaveBeenCalled();
  });
});
