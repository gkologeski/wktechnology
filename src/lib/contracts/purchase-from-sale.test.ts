import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { purchaseFromSale, purchaseTitle } from "./purchase-from-sale.server";

const mocks = vi.hoisted(() => ({
  workspace: vi.fn().mockResolvedValue("aaaaaaaa-0000-4000-8000-00000000000a"),
  permission: vi.fn().mockResolvedValue(undefined),
  create: vi.fn().mockResolvedValue({ contract: { id: "purchase" } }),
}));
vi.mock("@/lib/active-workspace.server", () => ({ resolveActiveWorkspace: mocks.workspace }));
vi.mock("@/lib/access-control/enforce.server", () => ({ assertAnyPermission: mocks.permission }));
vi.mock("@/lib/contracts/contract-create.server", () => ({ createContractShared: mocks.create }));

describe("purchaseTitle", () => {
  it("prefixa contratos de compra com [COMPRA] e o fornecedor", () => {
    expect(purchaseTitle("[VENDA] NEXID — 111 horas", "Am IT")).toBe("[COMPRA] Am IT");
  });
  it("aceita venda sem título", () => {
    expect(purchaseTitle(null, "Fulano")).toBe("[COMPRA] Fulano");
  });
});

it("creates the supplier contract independently while retaining the internal parent", async () => {
  const sale = {
    id: "sale",
    title: "[VENDA] Cliente — aditivo 111 horas",
    role: "provider",
    document_kind: "main",
    workspace_id: "aaaaaaaa-0000-4000-8000-00000000000a",
    proposal_id: "customer-proposal",
    quote_id: "customer-quote",
    deal_id: "customer-deal",
    contracting_legal_entity_id: "wk-entity",
    currency: "BRL",
    starts_at: null,
    ends_at: null,
  };
  const responses = [
    { data: sale },
    { data: { id: "supplier", name: "Prestadora" } },
    { data: [] },
    { data: [] },
  ];
  const from = vi.fn(() => {
    const response = responses.shift();
    const builder: Record<string, unknown> = {};
    for (const method of ["select", "eq", "or", "neq", "not"])
      builder[method] = vi.fn(() => builder);
    builder.maybeSingle = vi.fn().mockResolvedValue(response);
    builder.then = (resolve: (result: unknown) => unknown) =>
      Promise.resolve(response).then(resolve);
    return builder;
  });
  await purchaseFromSale({ from } as unknown as SupabaseClient, "actor", {
    saleContractId: "sale",
    counterpartyKind: "company",
    companyId: "supplier",
  });
  expect(mocks.create).toHaveBeenLastCalledWith(
    expect.anything(),
    expect.objectContaining({
      kind: "client",
      fields: expect.objectContaining({
        title: "[COMPRA] Prestadora",
        parent_contract_id: "sale",
        contracting_legal_entity_id: "wk-entity",
        proposal_id: null,
        quote_id: null,
        deal_id: null,
        total_value: 0,
      }),
    }),
  );
  expect(mocks.create.mock.lastCall?.[1].fields.title).not.toContain("111 horas");
});
