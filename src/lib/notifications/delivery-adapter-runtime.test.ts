import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NotificationDeliveryJob, NotificationPersonalDeliveryJob } from "./delivery-types";

const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(), cloud: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: mocks.from, rpc: mocks.rpc },
}));
vi.mock("@/lib/whatsapp/cloud-runtime.server", () => ({ sendCloudPayload: mocks.cloud }));
import {
  assertNotificationRuntimeJob,
  notificationAdapterDependencies as runtime,
} from "./delivery-adapter-runtime.server";

const job: NotificationPersonalDeliveryJob = {
  id: "22222222-2222-4222-8222-222222222222",
  token: "33333333-3333-4333-8333-333333333333",
  channel: "whatsapp",
  workspaceId: "11111111-1111-4111-8111-111111111111",
  workflowId: "44444444-4444-4444-8444-444444444444",
  runId: "55555555-5555-4555-8555-555555555555",
  recipientId: "66666666-6666-4666-8666-666666666666",
  idempotencyKey: "notification:fake-delivery:whatsapp",
  phone: "+14155552671",
  senderPhoneNumberId: "12345678901",
  templateName: "notification_update",
  templateLanguage: "pt_BR",
};
const sender = {
  phoneNumberId: job.senderPhoneNumberId!,
  workspaceId: job.workspaceId,
  displayPhoneNumber: "+14155552672",
  connectionId: "77777777-7777-4777-8777-777777777777",
  provider: "cloud" as const,
  qualityRating: "GREEN",
  status: "CONNECTED",
};
function historyDatabase(initial: Record<string, unknown>[] = []) {
  const rows = initial.map((row) => ({ ...row }));
  const upsert = vi.fn();
  const insert = vi.fn().mockResolvedValue({ error: null });
  const updates: Record<string, unknown>[] = [];
  mocks.from.mockImplementation((table) => {
    const filters: Record<string, unknown> = {};
    let patch: Record<string, unknown> | null = null;
    const matches = (row: Record<string, unknown>) =>
      Object.entries(filters).every(([key, value]) => row[key] === value);
    const q = {
      select: () => q,
      eq: (key: string, value: unknown) => {
        filters[key] = value;
        return q;
      },
      maybeSingle: async () => ({ data: rows.find(matches) ?? null, error: null }),
      upsert: async (row: Record<string, unknown>, options: unknown) => {
        upsert(row, options);
        if (
          !rows.some(
            (r) => r.contact_phone === row.contact_phone && r.twilio_number === row.twilio_number,
          )
        )
          rows.push({ id: "conversation-fake", ...row });
        return { error: null };
      },
      update: (value: Record<string, unknown>) => {
        patch = value;
        updates.push(value);
        return q;
      },
      then: (resolve: (value: { error: null }) => unknown) => {
        if (patch) rows.filter(matches).forEach((row) => Object.assign(row, patch));
        return resolve({ error: null });
      },
    };
    return table === "whatsapp_conversations" ? q : { insert };
  });
  return { rows, upsert, insert, updates };
}
function existingConversation(patch: Record<string, unknown> = {}) {
  return {
    id: "existing-conversation",
    workspace_id: job.workspaceId,
    owner_id: "original-owner",
    contact_phone: job.phone,
    twilio_number: sender.displayPhoneNumber,
    provider: "meta",
    wa_phone_number_id: sender.phoneNumberId,
    assigned_to: "existing-assignee",
    contact_id: "original-contact",
    ...patch,
  };
}
beforeEach(() => {
  vi.clearAllMocks();
});

describe("notification runtime writes are qualified by the fenced job", () => {
  it("accepts a canonical internal WhatsApp job without consulting provider configuration", () => {
    expect(assertNotificationRuntimeJob(job)).toEqual(job);
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.cloud).not.toHaveBeenCalled();
  });

  it.each([
    { channel: "email" },
    { workspaceId: "other-workspace" },
    { token: "not-a-token" },
    { phone: "14155552671" },
    { phone: "+14155552671 ext 4" },
    { senderPhoneNumberId: null },
    { idempotencyKey: "" },
  ])("rejects malformed runtime job before history or suppression writes: %j", async (patch) => {
    await expect(
      runtime.recordWhatsAppRefusal({ ...job, ...patch } as NotificationDeliveryJob, "131026"),
    ).rejects.toThrow();
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it.each([
    { ...sender, workspaceId: "another-workspace" },
    { ...sender, phoneNumberId: "9876543210" },
  ])("rejects cross-workspace or wrong-sender acceptance metadata", async (value) => {
    await expect(runtime.recordWhatsAppAcceptance(job, value, "wamid.fake")).rejects.toThrow(
      "Aceitação WhatsApp inválida",
    );
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("records only the exact sender, recipient and neutral body with source attempt evidence", async () => {
    const { upsert, insert } = historyDatabase();
    await runtime.recordWhatsAppAcceptance(job, sender, "wamid.fake");
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        workspace_id: job.workspaceId,
        contact_phone: job.phone,
        twilio_number: sender.displayPhoneNumber,
        wa_phone_number_id: job.senderPhoneNumberId,
      }),
      { onConflict: "contact_phone,twilio_number", ignoreDuplicates: true },
    );
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        workspace_id: job.workspaceId,
        direction: "outbound",
        from_number: sender.displayPhoneNumber,
        to_number: job.phone,
        status: "accepted",
        wa_message_id: "wamid.fake",
        body: "Há uma atualização solicitada no TechERP.",
        raw: {
          source: {
            origin: "notification_center",
            notification_delivery_id: job.id,
            idempotency_key: job.idempotencyKey,
            attempt_token: job.token,
          },
        },
      }),
    );
  });

  it("preserves existing owner, assignee, entity links and provider without an upsert", async () => {
    const initial = existingConversation();
    const db = historyDatabase([initial]);
    await runtime.recordWhatsAppAcceptance(job, sender, "wamid.fake");
    expect(db.upsert).not.toHaveBeenCalled();
    expect(db.rows[0]).toMatchObject(initial);
    expect(db.updates).toEqual([
      {
        last_message_at: expect.any(String),
        last_message_preview: "Há uma atualização solicitada no TechERP.",
      },
    ]);
    expect(db.insert).toHaveBeenCalledWith(
      expect.objectContaining({ conversation_id: initial.id }),
    );
  });

  it.each([
    { workspace_id: "foreign-workspace" },
    { provider: "twilio", wa_phone_number_id: null },
    { wa_phone_number_id: "other-sender" },
  ])("does not take over a conversation on a global legacy-key conflict: %j", async (patch) => {
    const initial = existingConversation(patch);
    const db = historyDatabase([initial]);
    await expect(runtime.recordWhatsAppAcceptance(job, sender, "wamid.fake")).rejects.toThrow(
      "Histórico indisponível",
    );
    expect(db.rows).toEqual([initial]);
    expect(db.insert).not.toHaveBeenCalled();
    expect(db.updates).toEqual([]);
    for (const [, options] of db.upsert.mock.calls)
      expect(options).toEqual({
        onConflict: "contact_phone,twilio_number",
        ignoreDuplicates: true,
      });
  });

  it.each(["131026", "131049"] as const)(
    "uses the existing service RPC for known rejection %s",
    async (code) => {
      mocks.rpc.mockResolvedValue({ error: null });
      await runtime.recordWhatsAppRefusal(job, code);
      expect(mocks.rpc).toHaveBeenCalledWith("wa_record_suppression", {
        p_ws: job.workspaceId,
        p_phone: job.phone,
        p_code: code,
        p_at: expect.any(String),
      });
    },
  );

  it("rejects unsupported suppression codes rather than interpreting arbitrary text", async () => {
    await expect(runtime.recordWhatsAppRefusal(job, "100" as never)).rejects.toThrow(
      "Recusa de destinatário inválida",
    );
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("does not load the Cloud transport when the required worker callback is missing", async () => {
    await expect(
      runtime.sendCloud(job.workspaceId, job.senderPhoneNumberId!, {}, undefined as never),
    ).rejects.toThrow("Autorização de envio indisponível");
    expect(mocks.cloud).not.toHaveBeenCalled();
  });

  it("passes the callback unchanged to the final canonical provider boundary", async () => {
    const beforeSend = vi.fn().mockResolvedValue(undefined);
    mocks.cloud.mockResolvedValue({ messages: [{ id: "wamid.fake" }] });
    await runtime.sendCloud(
      job.workspaceId,
      job.senderPhoneNumberId!,
      { type: "template" },
      beforeSend,
    );
    expect(mocks.cloud).toHaveBeenCalledWith(
      job.workspaceId,
      job.senderPhoneNumberId,
      { type: "template" },
      { beforeSend },
    );
  });
});
