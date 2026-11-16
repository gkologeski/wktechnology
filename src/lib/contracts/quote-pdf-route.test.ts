import { afterEach, beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ row: null as unknown, eq: vi.fn(), render: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => (config: unknown) => config }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({
        eq: (...args: unknown[]) => {
          m.eq(...args);
          return { maybeSingle: async () => ({ data: m.row, error: null }) };
        },
      }),
    }),
  },
}));
vi.mock("./quote-pdf.server", () => ({ renderQuotePdf: m.render }));
import { Route } from "@/routes/api/public/quotes/$token.pdf";
const get = (
  Route as unknown as {
    server: { handlers: { GET: (args: { params: { token: string } }) => Promise<Response> } };
  }
).server.handlers.GET;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("BROWSERLESS_TOKEN", "test-renderer");
  m.render.mockResolvedValue(new Uint8Array([1, 2, 3]));
  m.row = { id: "Q", number: "42", status: "accepted" };
});
it("quote pdf exports only the matching published token", async () => {
  const r = await get({ params: { token: "a".repeat(32) } });
  expect(r.status).toBe(200);
  expect(m.eq).toHaveBeenCalledWith("public_token", "a".repeat(32));
  expect(m.render).toHaveBeenCalledWith(expect.anything(), "Q", "test-renderer");
});
it("quote pdf rejects missing token", async () => {
  expect((await get({ params: { token: "" } })).status).toBe(400);
  expect(m.render).not.toHaveBeenCalled();
});
it("quote pdf rejects draft document", async () => {
  m.row = { id: "Q", status: "draft" };
  expect((await get({ params: { token: "a".repeat(32) } })).status).toBe(403);
  expect(m.render).not.toHaveBeenCalled();
});
it("quote pdf rejects a token with no matching document", async () => {
  m.row = null;
  expect((await get({ params: { token: "foreign".repeat(8) } })).status).toBe(404);
  expect(m.render).not.toHaveBeenCalled();
});
it("quote pdf rejects a revoked token", async () => {
  m.row = null;
  expect((await get({ params: { token: "revoked".repeat(8) } })).status).toBe(404);
  expect(m.render).not.toHaveBeenCalled();
});

afterEach(() => vi.unstubAllEnvs());
