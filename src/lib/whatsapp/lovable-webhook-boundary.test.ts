import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  from: vi.fn(),
  upsert: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  single: vi.fn(),
  process: vi.fn(),
  pending: vi.fn(),
  media: vi.fn(),
  completed: false,
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => options,
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: mock.from },
}));
vi.mock("./webhook-processor.server", () => ({
  processEvent: mock.process,
  processPending: mock.pending,
}));
vi.mock("./inbound-media.server", () => ({ processPendingInboundMedia: mock.media }));

// The route imports the installed Lovable verifier unchanged. These tests sign
// timestamp + exact body bytes and exercise its real HMAC/replay-window checks.
import { Route } from "@/routes/api/public/whatsapp/webhook";

const SECRET = "synthetic-lovable-webhook-key";
const deliveryId = "synthetic-lovable-delivery";
const payload = {
  object: "whatsapp_business_account",
  entry: [
    {
      id: "1234567890",
      changes: [
        {
          field: "messages",
          value: {
            metadata: { phone_number_id: "9876543210" },
            messages: [{ id: "wamid.synthetic", type: "text", text: { body: "synthetic" } }],
          },
        },
      ],
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("WHATSAPP_API_KEY", SECRET);
  mock.completed = false;
  const query = { upsert: mock.upsert, select: mock.select, eq: mock.eq, single: mock.single };
  mock.from.mockReturnValue(query);
  mock.select.mockReturnValue(query);
  mock.eq.mockReturnValue(query);
  mock.upsert.mockResolvedValue({ error: null });
  mock.single.mockImplementation(async () => ({
    data: {
      id: "synthetic-webhook-event",
      event: "whatsapp.message",
      payload,
      attempts: 0,
      processed_at: mock.completed ? "2026-11-21T12:00:00Z" : null,
    },
    error: null,
  }));
  mock.process.mockResolvedValue(true);
  mock.pending.mockResolvedValue(undefined);
  mock.media.mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllEnvs());

async function signedRequest(
  options: {
    body?: string;
    signatureBody?: string;
    secret?: string;
    timestamp?: string;
    omit?: string[];
  } = {},
) {
  const body = options.body ?? JSON.stringify(payload);
  const timestamp = options.timestamp ?? String(Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", options.secret ?? SECRET)
    .update(`${timestamp}.${options.signatureBody ?? body}`)
    .digest("hex");
  const headers = new Headers({
    "x-lovable-signature": `sha256=${signature}`,
    "x-lovable-timestamp": timestamp,
    "x-lovable-delivery": deliveryId,
    "x-lovable-event": "whatsapp.message",
  });
  for (const header of options.omit ?? []) headers.delete(header);
  return new Request("https://example.test/api/public/whatsapp/webhook", {
    method: "POST",
    body,
    headers,
  });
}
async function receive(options: Parameters<typeof signedRequest>[0] = {}) {
  return (
    Route as unknown as {
      server: { handlers: { POST: (context: { request: Request }) => Promise<Response> } };
    }
  ).server.handlers.POST({ request: await signedRequest(options) });
}
function expectNoPersistenceOrProcessing() {
  expect(mock.from).not.toHaveBeenCalled();
  expect(mock.upsert).not.toHaveBeenCalled();
  expect(mock.process).not.toHaveBeenCalled();
  expect(mock.pending).not.toHaveBeenCalled();
  expect(mock.media).not.toHaveBeenCalled();
}

describe("Lovable webhook HTTP boundary using the real installed HMAC verifier", () => {
  it("persists and processes an authenticated delivery through the durable journal", async () => {
    expect((await receive()).status).toBe(200);
    expect(mock.from).toHaveBeenCalledWith("whatsapp_webhook_events");
    expect(mock.upsert).toHaveBeenCalledExactlyOnceWith(
      { delivery_id: deliveryId, event: "whatsapp.message", payload },
      { onConflict: "delivery_id", ignoreDuplicates: true },
    );
    expect(mock.eq).toHaveBeenCalledWith("delivery_id", deliveryId);
    expect(mock.process).toHaveBeenCalledExactlyOnceWith(
      expect.anything(),
      expect.objectContaining({ id: "synthetic-webhook-event", payload }),
    );
    expect(mock.pending).toHaveBeenCalledWith(expect.anything(), 5);
    expect(mock.media).toHaveBeenCalledWith(expect.anything(), 2);
  });

  it("rejects altered body bytes before persistence or processing", async () => {
    expect(
      (
        await receive({
          body: JSON.stringify({ ...payload, altered: true }),
          signatureBody: JSON.stringify(payload),
        })
      ).status,
    ).toBe(401);
    expectNoPersistenceOrProcessing();
  });

  it.each(["x-lovable-signature", "x-lovable-timestamp"])(
    "rejects a missing %s before persistence or processing",
    async (header) => {
      expect((await receive({ omit: [header] })).status).toBe(401);
      expectNoPersistenceOrProcessing();
    },
  );

  it("rejects a signature from a different secret before persistence or processing", async () => {
    expect((await receive({ secret: "different-synthetic-key" })).status).toBe(401);
    expectNoPersistenceOrProcessing();
  });

  it("rejects a correctly signed delivery outside the SDK replay window", async () => {
    expect((await receive({ timestamp: String(Math.floor(Date.now() / 1000) - 301) })).status).toBe(
      401,
    );
    expectNoPersistenceOrProcessing();
  });

  it.each(["x-lovable-delivery", "x-lovable-event"])(
    "rejects a verified delivery missing %s before persistence or processing",
    async (header) => {
      expect((await receive({ omit: [header] })).status).toBe(400);
      expectNoPersistenceOrProcessing();
    },
  );

  it("does not process a completed duplicate delivery again", async () => {
    mock.completed = true;
    expect((await receive()).status).toBe(200);
    expect(mock.upsert).toHaveBeenCalledExactlyOnceWith(
      { delivery_id: deliveryId, event: "whatsapp.message", payload },
      { onConflict: "delivery_id", ignoreDuplicates: true },
    );
    expect(mock.process).not.toHaveBeenCalled();
  });
});
