import { beforeEach, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ session: vi.fn(), rpc: vi.fn(), from: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => (options: unknown) => options }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: mock.from, rpc: mock.rpc },
}));
import { Route } from "@/routes/api/public/widget/messages";

const session = "ab111111-1111-4111-8111-111111111111";
const requestId = "bc111111-1111-4111-8111-111111111111";
const messageId = "cd111111-1111-4111-8111-111111111111";
const input = {
  session_id: session,
  visitor_id: "visitor_test_1",
  request_id: requestId,
  body: "Teste local",
};
const handler = (
  Route as unknown as {
    server: { handlers: { POST: (args: { request: Request }) => Promise<Response> } };
  }
).server.handlers.POST;
function send(data: unknown = input) {
  return handler({
    request: new Request("http://localhost/api/public/widget/messages", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mock.from.mockImplementation(() => ({
    select: () => ({ eq: () => ({ maybeSingle: mock.session }) }),
  }));
  mock.session.mockResolvedValue({
    data: { id: session, visitor_id: input.visitor_id, owner_id: "workspace", status: "open" },
  });
  mock.rpc.mockResolvedValue({ data: messageId, error: null });
});

it("widget permits the matching visitor capability through the atomic RPC", async () => {
  expect((await send()).status).toBe(200);
  expect(mock.rpc).toHaveBeenCalledWith("widget_inbound_commit", {
    p_session: session,
    p_visitor: input.visitor_id,
    p_request: requestId,
    p_body: input.body,
  });
});
it("widget rejects missing visitor capability before persistence", async () => {
  expect((await send({ ...input, visitor_id: undefined })).status).toBe(400);
  expect(mock.rpc).not.toHaveBeenCalled();
});
it("widget rejects an invalid visitor capability before persistence", async () => {
  expect((await send({ ...input, visitor_id: "wrong_visitor" })).status).toBe(403);
  expect(mock.rpc).not.toHaveBeenCalled();
});
it("widget rejects another conversation capability before persistence", async () => {
  mock.session.mockResolvedValue({ data: { visitor_id: "foreign_visitor" } });
  expect((await send()).status).toBe(403);
  expect(mock.rpc).not.toHaveBeenCalled();
});
it("widget rejects a revoked session capability before persistence", async () => {
  mock.session.mockResolvedValue({ data: null });
  expect((await send()).status).toBe(403);
  expect(mock.rpc).not.toHaveBeenCalled();
});
it("widget retry preserves its request UUID and returns the same confirmed ID", async () => {
  const first = await (await send()).json();
  const second = await (await send()).json();
  expect(first.message_id).toBe(messageId);
  expect(second.message_id).toBe(first.message_id);
  expect(mock.rpc).toHaveBeenCalledTimes(2);
  expect(mock.rpc.mock.calls[0]).toEqual(mock.rpc.mock.calls[1]);
});
it("widget persistence failure is retryable without exposing the database diagnostic", async () => {
  mock.rpc.mockResolvedValue({ data: null, error: { message: "private diagnostic" } });
  const response = await send();
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("private diagnostic");
});
it("a thrown transport failure stays retryable and does not expose private diagnostics", async () => {
  mock.rpc.mockRejectedValue(new Error("private transport diagnostic"));
  const response = await send();
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("private transport diagnostic");
});
it("already-open legacy widgets retain session-bound sending without an attempt field", async () => {
  expect((await send({ ...input, request_id: undefined })).status).toBe(200);
  expect(mock.rpc).toHaveBeenCalledWith("widget_inbound_commit", {
    p_session: session,
    p_visitor: input.visitor_id,
    p_body: input.body,
    p_request: expect.stringMatching(/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i),
  });
});
it("an invalid explicit attempt UUID is rejected rather than replaced", async () => {
  expect((await send({ ...input, request_id: "invalid" })).status).toBe(400);
  expect(mock.rpc).not.toHaveBeenCalled();
});
it("a successful transport without a confirmed message ID is not reported as sent", async () => {
  mock.rpc.mockResolvedValue({ data: null, error: null });
  const response = await send();
  expect(response.status).toBe(503);
  expect(await response.json()).not.toHaveProperty("ok", true);
});
