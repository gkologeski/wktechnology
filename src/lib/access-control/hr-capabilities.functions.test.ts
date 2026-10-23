import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), auth: {} }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: mocks.auth }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    middleware: (middleware: unknown[]) => ({
      inputValidator: (validate: (input: unknown) => unknown) => ({
        handler: (handler: (args: unknown) => unknown) => async (input: unknown) => {
          expect(middleware).toContain(mocks.auth);
          return handler({ data: validate(input), context: { supabase: { rpc: mocks.rpc } } });
        },
      }),
    }),
  }),
}));
import { getHrCapabilities } from "./hr-capabilities.functions";
const call = getHrCapabilities as unknown as (input: unknown) => Promise<unknown>;
const id = "95000000-0000-4000-8000-000000000002";
beforeEach(() => vi.clearAllMocks());
it("uses only authenticated caller context and bounded ids", async () => {
  mocks.rpc.mockResolvedValue({ data: [{ id, can_view: true }], error: null });
  await call({ resource: "people", ids: [id], workspace_id: "foreign", actor_id: "other" });
  expect(mocks.rpc).toHaveBeenCalledWith("hr_record_capabilities", {
    _resource: "people",
    _ids: [id],
  });
});
it.each([
  { resource: "unknown", ids: [] },
  { resource: "people", ids: ["bad-id"] },
  { resource: "people", ids: Array(201).fill(id) },
])("rejects invalid/unbounded input before RPC: %j", async (input) => {
  await expect(call(input)).rejects.toThrow();
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("an RPC failure discards cached-looking results", async () => {
  mocks.rpc.mockResolvedValue({
    data: [{ id, can_view: true }],
    error: { message: "Unavailable" },
  });
  await expect(call({ resource: "people", ids: [id] })).rejects.toThrow("verificar");
});
