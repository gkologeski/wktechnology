import { beforeEach, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DealLineItemRow } from "./contract-create.server";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), defaults: vi.fn() }));
vi.mock("@/lib/access-control/work-core.server", () => ({ workRpc: mocks.rpc }));
vi.mock("./contract-defaults.server", () => ({ loadContractDefaults: mocks.defaults }));
import { createContractShared } from "./contract-create.server";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.defaults.mockResolvedValue({ general: {}, byKind: {} });
  mocks.rpc.mockResolvedValue({ contract: { id: "c" }, servicesCreated: 1 });
});
it("creates accepted commercial items and payment terms in one atomic operation", async () => {
  const accepted = {
    id: "accepted",
    name: "Escopo aceito",
    quantity: 2,
    unit_price: 100,
    cadence: "monthly",
    billing_model: "per_unit",
  } as DealLineItemRow;
  const mutable = { ...accepted, id: "changed", quantity: 99, unit_price: 900 };
  const client = {
    from: (table: string) => {
      const chain: any = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => ({
          data: {
            id: "deal",
            name: "Negócio",
            company_id: "company",
            currency: "BRL",
            value: 89100,
          },
          error: null,
        }),
        order: async () => ({ data: table === "deal_line_items" ? [mutable] : [], error: null }),
      };
      return chain;
    },
  } as unknown as SupabaseClient;
  const terms = { plan: "one_time", payments: [] };
  await createContractShared(client, {
    workspaceId: "ws",
    userId: "u",
    kind: "provider",
    dealId: "deal",
    fields: { title: "Contrato", total_value: 200 },
    items: [accepted],
    paymentTerms: terms,
  });
  const args = mocks.rpc.mock.calls[0][2];
  expect(mocks.rpc).toHaveBeenCalledTimes(1);
  expect(mocks.rpc.mock.calls[0][1]).toBe("contract_create_batch");
  expect(args.p_contract.total_value).toBe(200);
  expect(args.p_contract.monthly_value).toBe(200);
  expect(args.p_contract.payment_terms).toEqual(terms);
  expect(args.p_services[0].quantity).toBe(2);
  expect(args.p_services[0].unit_price).toBe(100);
});
