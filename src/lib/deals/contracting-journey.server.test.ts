import { beforeEach, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
const mocks = vi.hoisted(() => ({ record: vi.fn(), workspace: vi.fn() }));
vi.mock("@/lib/access-control/sales-core.server", () => ({ assertSalesRecord: mocks.record }));
vi.mock("@/lib/access-control/enforce.server", () => ({ getActiveWorkspaceId: mocks.workspace }));
import { loadDealContractingJourney } from "./contracting-journey.server";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.workspace.mockResolvedValue("ws");
});
function fixture(denied = false, queryError = false) {
  const filters: unknown[][] = [];
  const from = vi.fn((table: string) => {
    const chain: any = {
      select: vi.fn(() => chain),
      eq: vi.fn((...v: unknown[]) => {
        filters.push(v);
        return chain;
      }),
      order: vi.fn(() => chain),
      limit: vi.fn(async () => ({
        data: [{ id: table }],
        error: queryError ? { message: "statement timeout" } : null,
      })),
    };
    return chain;
  });
  const rpc = vi.fn(async (_fn: string, args: { r: string }) => ({
    data: null,
    error:
      denied && args.r === "techcontracts.contract_drafts"
        ? { code: "42501", message: "denied" }
        : null,
  }));
  return { client: { from, rpc } as unknown as SupabaseClient, from, rpc, filters };
}
it("journey read allows an authorized visible deal with explicit workspace predicates", async () => {
  const f = fixture();
  const d = await loadDealContractingJourney(f.client, "u", "deal");
  expect(mocks.record).toHaveBeenCalledWith(f.client, "deals", "deal", "view");
  expect(f.filters.filter((v) => v[0] === "workspace_id")).toHaveLength(4);
  expect(f.filters).toContainEqual(["deal_id", "deal"]);
  expect(d.access.drafts).toBe(true);
  expect(f.filters).toContainEqual(["role", "provider"]);
  expect(f.filters).toContainEqual(["document_kind", "main"]);
});
for (const reason of [
  "missing permission",
  "explicit deny",
  "foreign workspace",
  "inactive membership",
])
  it("journey read rejects " + reason + " before document queries", async () => {
    const f = fixture();
    mocks.record.mockRejectedValueOnce(new Error(reason));
    await expect(loadDealContractingJourney(f.client, "u", "deal")).rejects.toThrow(reason);
    expect(f.from).not.toHaveBeenCalled();
  });
it("journey read marks restricted optional data instead of querying it", async () => {
  const f = fixture(true);
  const d = await loadDealContractingJourney(f.client, "u", "deal");
  expect(d.access.drafts).toBe(false);
  expect(f.from).not.toHaveBeenCalledWith("contract_drafts");
});
it("journey read surfaces query failures instead of manufacturing an empty stage", async () => {
  const f = fixture(false, true);
  await expect(loadDealContractingJourney(f.client, "u", "deal")).rejects.toThrow(
    "statement timeout",
  );
});
it("journey read never requests bodies or public tokens in the summary", async () => {
  const f = fixture();
  await loadDealContractingJourney(f.client, "u", "deal");
  for (const call of f.from.mock.results) {
    expect(call.value.select.mock.calls[0][0]).not.toMatch(/body_html|public_token|file_path/);
  }
});
