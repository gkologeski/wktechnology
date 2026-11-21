import { beforeEach, expect, it, vi } from "vitest";
import type { ApiAuthContext } from "@/lib/api-keys/auth.server";
const state = vi.hoisted(() => ({
  auth: null as ApiAuthContext | null,
  pipeline: null as { id: string } | null,
  pipelineError: false,
  insert: vi.fn(),
  eq: vi.fn(),
  post: undefined as undefined | ((args: { request: Request }) => Promise<Response>),
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: { server: { handlers: { POST: typeof state.post } } }) => {
    state.post = options.server.handlers.POST;
    return options;
  },
}));
vi.mock("@/lib/api-keys/auth.server", async (original) => ({
  ...(await original<typeof import("@/lib/api-keys/auth.server")>()),
  authenticateApiKey: async () => state.auth,
}));
vi.mock("@/lib/ats/public-api.server", () => ({
  isAtsPublicApiEnabled: async () => true,
  flagDisabled: () => new Response(null, { status: 403 }),
  badRequest: (error: unknown) => Response.json({ error }, { status: 400 }),
}));
vi.mock("@/lib/ats/audit.server", () => ({ recordAtsEvent: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      const chain = {
        select: () => chain,
        eq: (key: string, value: string) => {
          state.eq(key, value);
          return chain;
        },
        maybeSingle: async () => ({
          data: state.pipeline,
          error: state.pipelineError ? { message: "unavailable" } : null,
        }),
        insert: (payload: unknown) => {
          state.insert(table, payload);
          return chain;
        },
        single: async () => ({ data: { id: "job", status: "draft" }, error: null }),
      };
      return chain;
    },
  },
}));
import "@/routes/api/public/v1/ats/jobs";
const ws = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
  pipeline = "bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb";
beforeEach(() => {
  vi.clearAllMocks();
  state.auth = { ownerId: "user", workspaceId: ws, keyId: "key", scopes: ["write"] };
  state.pipeline = { id: pipeline };
  state.pipelineError = false;
});
async function submit() {
  if (!state.post) throw new Error("Missing handler");
  return state.post({
    request: new Request("https://app.example.invalid/api/public/v1/ats/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Synthetic job", status: "draft", pipeline_id: pipeline }),
    }),
  });
}
it("jobs pipeline permits the authenticated key workspace", async () => {
  expect((await submit()).status).toBe(200);
  expect(state.eq).toHaveBeenCalledWith("workspace_id", ws);
  expect(state.insert).toHaveBeenCalledWith(
    "ats_jobs",
    expect.objectContaining({ workspace_id: ws, pipeline_id: pipeline }),
  );
});
it("jobs pipeline rejects missing key before any insert", async () => {
  state.auth = null;
  expect((await submit()).status).toBe(401);
  expect(state.insert).not.toHaveBeenCalled();
});
it("jobs pipeline rejects a denied write scope", async () => {
  if (!state.auth) throw new Error("Missing fixture");
  state.auth.scopes = ["read"];
  expect((await submit()).status).toBe(403);
  expect(state.insert).not.toHaveBeenCalled();
});
it("jobs pipeline rejects foreign workspace references", async () => {
  state.pipeline = null;
  expect((await submit()).status).toBe(400);
  expect(state.insert).not.toHaveBeenCalled();
});
it("jobs pipeline rejects revoked or inactive authentication", async () => {
  state.auth = null;
  expect((await submit()).status).toBe(401);
  expect(state.eq).not.toHaveBeenCalled();
});
it("jobs pipeline fails closed on lookup errors", async () => {
  state.pipeline = null;
  state.pipelineError = true;
  expect((await submit()).status).toBe(400);
  expect(state.insert).not.toHaveBeenCalled();
});
