import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ producer: vi.fn(), sdr: vi.fn() }));
vi.mock("@/lib/workflows/whatsapp-inbound.server", () => ({
  recordWorkflowWhatsAppReceived: state.producer,
}));
vi.mock("@/lib/prospecting/sdr/ingest.server", () => ({ ingestInboundForSdr: state.sdr }));
vi.mock("@/lib/inbox/identity-resolution.server", () => ({
  identityColumns: () => ({}),
  resolveInboxIdentity: vi.fn(),
}));
vi.mock("@/lib/inbox-auto-assignment.server", () => ({ autoAssignInboxConversation: vi.fn() }));
vi.mock("@/lib/inbox/ai-suggestions.server", () => ({ suggestCompanyLeft: vi.fn() }));
vi.mock("./inbound-media.server", () => ({ storeInboundMedia: vi.fn() }));
vi.mock("./notification-receipt.server", () => ({
  assertCloudInboundEnabled: vi.fn(),
  verifiedCloudReceipt: vi.fn(),
  assertCloudReceiptProjection: vi.fn(),
  recordNotificationCloudReceipt: vi.fn(),
}));
import { processEvent } from "./webhook-processor.server";

const W = "aaaaaaaa-1111-4111-8111-111111111111",
  M = "bbbbbbbb-1111-4111-8111-111111111111";
const H = "cccccccc-1111-4111-8111-111111111111",
  C = "dddddddd-1111-4111-8111-111111111111";
function database(duplicate: boolean) {
  const updates: Record<string, unknown>[] = [],
    inserts: Record<string, unknown>[] = [],
    timeline: string[] = [];
  const admin = {
    from: vi.fn((table: string) => {
      let columns = "",
        operation = "select";
      const q = {
        select(value: string) {
          columns = value;
          return q;
        },
        eq() {
          return q;
        },
        in() {
          return q;
        },
        order() {
          return q;
        },
        limit() {
          return q;
        },
        upsert() {
          operation = "upsert";
          return q;
        },
        insert(value: Record<string, unknown>) {
          inserts.push(value);
          operation = "insert";
          timeline.push("message_insert");
          return q;
        },
        update(value: Record<string, unknown>) {
          updates.push(value);
          operation = "update";
          return q;
        },
        maybeSingle: async () => ({
          data:
            table === "whatsapp_messages"
              ? duplicate
                ? { id: M, workspace_id: W, conversation_id: C, body: "synthetic inbound" }
                : null
              : table === "wa_cloud_numbers"
                ? { workspace_id: W }
                : columns.startsWith("contact_id")
                  ? { contact_id: "existing-contact" }
                  : null,
          error: null,
        }),
        single: async () => ({
          data:
            table === "whatsapp_conversations"
              ? { id: C, assigned_to: "existing-owner", origin_campaign_id: null }
              : { id: M },
          error: null,
        }),
        then(resolve: (value: unknown) => unknown) {
          return Promise.resolve({ data: operation === "update" ? [] : null, error: null }).then(
            resolve,
          );
        },
      };
      return q;
    }),
  };
  return { admin, updates, inserts, timeline };
}
function receipt(cloud: boolean) {
  return {
    id: H,
    event: "whatsapp.message",
    attempts: 0,
    payload: {
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { display_phone_number: "554830121055", phone_number_id: "1234567890" },
                ...(cloud ? { _verified_workspace_id: W, _verified_connection_id: C } : {}),
                messages: [
                  {
                    id: "wamid.synthetic",
                    from: "5548999999999",
                    type: "text",
                    timestamp: "1795266000",
                    text: { body: "synthetic inbound" },
                  },
                ],
              },
            },
          ],
        },
      ],
    },
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  state.producer.mockResolvedValue(M);
  state.sdr.mockResolvedValue({});
});

it.each([false, true])(
  "persists the WhatsApp occurrence before acknowledging a fresh signed transport projection (cloud=%s)",
  async (cloud) => {
    const db = database(false);
    state.producer.mockImplementation(async () => {
      db.timeline.push("event_producer");
      return M;
    });
    expect(await processEvent(db.admin, receipt(cloud))).toBe(true);
    expect(state.producer).toHaveBeenCalledExactlyOnceWith(db.admin, M, H);
    expect(db.timeline).toEqual(["message_insert", "event_producer"]);
    expect(db.inserts).toEqual([
      expect.objectContaining({
        direction: "inbound",
        wa_message_id: "wamid.synthetic",
        workspace_id: W,
      }),
    ]);
    expect(db.updates.at(-1)).toMatchObject({
      processed_at: expect.any(String),
      processing_error: null,
      workspace_id: W,
    });
  },
);
it.each([false, true])(
  "reconciles an existing WhatsApp message on webhook retry without inserting another message (cloud=%s)",
  async (cloud) => {
    const db = database(true);
    state.producer.mockResolvedValue(null);
    expect(await processEvent(db.admin, receipt(cloud))).toBe(true);
    expect(state.producer).toHaveBeenCalledExactlyOnceWith(db.admin, M, H);
    expect(db.inserts).toHaveLength(0);
    expect(state.sdr).toHaveBeenCalledOnce();
  },
);
it("keeps a persisted inbound message retryable when durable occurrence storage fails", async () => {
  const db = database(false);
  state.producer.mockRejectedValue(new Error("event store unavailable"));
  expect(await processEvent(db.admin, receipt(true))).toBe(false);
  expect(db.inserts).toHaveLength(1);
  expect(db.updates.at(-1)).toMatchObject({
    attempts: 1,
    processing_error: "event store unavailable",
    next_attempt_at: expect.any(String),
  });
  expect(db.updates.at(-1)).not.toHaveProperty("processed_at");
  expect(state.sdr).not.toHaveBeenCalled();
});
it("does not acknowledge a redelivery until occurrence reconciliation succeeds", async () => {
  const db = database(true);
  state.producer.mockRejectedValue(new Error("reconciliation unavailable"));
  expect(await processEvent(db.admin, receipt(false))).toBe(false);
  expect(db.inserts).toHaveLength(0);
  expect(db.updates.at(-1)).not.toHaveProperty("processed_at");
});
it("never mints an inbound workflow occurrence from a status-only or unrelated webhook event", async () => {
  for (const event of ["whatsapp.status", "unrelated"]) {
    const db = database(true);
    const row = receipt(true);
    row.event = event;
    row.payload.entry[0].changes[0].value.messages = [];
    expect(await processEvent(db.admin, row)).toBe(true);
  }
  expect(state.producer).not.toHaveBeenCalled();
  expect(state.sdr).not.toHaveBeenCalled();
});
