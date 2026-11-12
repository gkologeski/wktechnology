import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ row: null as unknown, filters: [] as unknown[][] }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const b = { middleware: () => b, inputValidator: () => b, handler: (fn: unknown) => fn };
    return b;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("./account-access.middleware", () => ({ requireLinkedinPermission: () => ({}) }));
vi.mock("@/lib/active-workspace.server", () => ({
  resolveActiveWorkspace: async () => "workspace",
}));
vi.mock("@/lib/app-url", () => ({ getAppUrl: () => "https://example.test" }));
import { reconcileLinkedinAccount } from "./accounts.functions";
function run(data: unknown) {
  const query = {
    select: () => query,
    eq: (...x: unknown[]) => {
      state.filters.push(x);
      return query;
    },
    order: () => query,
    limit: () => query,
    maybeSingle: async () => ({ data: state.row, error: null }),
  };
  return (reconcileLinkedinAccount as unknown as (v: unknown) => Promise<unknown>)({
    context: { userId: "owner", supabase: { from: () => query } },
    data,
  });
}
beforeEach(() => {
  state.filters = [];
  state.row = { id: "account", status: "pending", connect_token: "issued" };
});
it("binds reconciliation lookup to active workspace and authenticated owner", async () => {
  await run({ state: "issued" });
  expect(state.filters).toContainEqual(["workspace_id", "workspace"]);
  expect(state.filters).toContainEqual(["owner_id", "owner"]);
});
it("never adopts the latest global provider account from a redirect alone", async () => {
  await expect(run({ state: "issued" })).resolves.toEqual({
    ok: false,
    reason: "provider_confirmation_pending",
  });
});
it("rejects missing state before provider lookup", async () => {
  await expect(run({})).resolves.toEqual({ ok: false, reason: "state_mismatch" });
});
it("rejects wrong state even for an already connected account", async () => {
  state.row = { status: "connected", unipile_account_id: "provider-id", connect_token: "issued" };
  await expect(run({ state: "forged" })).resolves.toEqual({ ok: false, reason: "state_mismatch" });
});
it("accepts an account already confirmed by the authenticated provider callback", async () => {
  state.row = { status: "connected", unipile_account_id: "provider-id", connect_token: "issued" };
  await expect(run({ state: "issued" })).resolves.toEqual({ ok: true, already: true });
});
