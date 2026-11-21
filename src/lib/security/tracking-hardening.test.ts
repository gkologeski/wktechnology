import { afterEach, beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  record: vi.fn(),
  handler: undefined as
    | undefined
    | ((args: { request: Request; params: { messageId: string } }) => Promise<Response>),
}));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {} }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: { server: { handlers: { GET: typeof state.handler } } }) => {
    state.handler = options.server.handlers.GET;
    return options;
  },
}));
vi.mock("@/lib/email-tracking.server", async (original) => ({
  ...(await original<typeof import("@/lib/email-tracking.server")>()),
  recordTrackingEvent: state.record,
}));
import {
  injectTracking,
  signTrackedUrl,
  verifyOpenPixel,
  verifyTrackedUrl,
  OPEN_PIXEL_SCOPE,
} from "@/lib/email-tracking.server";
import "@/routes/api/public/email/pixel.$messageId";
const id = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("EMAIL_TRACKING_SECRET", "synthetic-test-tracking-secret");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
});
afterEach(() => vi.unstubAllEnvs());
async function request(sig: string) {
  if (!state.handler) throw new Error("Missing handler");
  return state.handler({
    request: new Request(`https://app.example.invalid/api/public/email/pixel/${id}.gif?s=${sig}`),
    params: { messageId: `${id}.gif` },
  });
}
it("tracking permits a correctly signed message capability", async () => {
  const response = await request(signTrackedUrl(id, OPEN_PIXEL_SCOPE));
  expect(response.status).toBe(200);
  expect(state.record).toHaveBeenCalledWith(
    expect.objectContaining({ messageId: id, eventType: "open" }),
  );
});
it("tracking rejects a missing capability without changing records", async () => {
  expect((await request("")).headers.get("Content-Type")).toBe("image/gif");
  expect(state.record).not.toHaveBeenCalled();
});
it("tracking rejects an invalid signature without changing records", async () => {
  await request("0".repeat(32));
  expect(state.record).not.toHaveBeenCalled();
});
it("tracking rejects a foreign message capability", async () => {
  await request(signTrackedUrl("bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb", OPEN_PIXEL_SCOPE));
  expect(state.record).not.toHaveBeenCalled();
});
it("tracking rejects capabilities after the secret is revoked", async () => {
  const signature = signTrackedUrl(id, OPEN_PIXEL_SCOPE);
  vi.stubEnv("EMAIL_TRACKING_SECRET", "rotated-test-secret");
  await request(signature);
  expect(state.record).not.toHaveBeenCalled();
});
it("tracking isolates click and open scopes", () => {
  expect(verifyOpenPixel(id, signTrackedUrl(id, "https://example.invalid"))).toBe(false);
  expect(
    verifyTrackedUrl(id, "https://example.invalid", signTrackedUrl(id, OPEN_PIXEL_SCOPE)),
  ).toBe(false);
  expect(injectTracking({ messageId: id, bodyHtml: "<p>Hello</p>" }).html).toContain(
    `.gif?s=${signTrackedUrl(id, OPEN_PIXEL_SCOPE)}`,
  );
});
it("tracking fails closed without a secret but preserves email delivery", () => {
  vi.stubEnv("EMAIL_TRACKING_SECRET", "");
  expect(verifyOpenPixel(id, "0".repeat(32))).toBe(false);
  expect(injectTracking({ messageId: id, bodyHtml: "<p>Hello</p>", bodyText: "Hello" })).toEqual({
    html: "<p>Hello</p>",
    text: "Hello",
  });
});
