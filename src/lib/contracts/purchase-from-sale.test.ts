import { describe, expect, it } from "vitest";
import { purchaseTitle } from "./purchase-from-sale.server";

describe("purchaseTitle", () => {
  it("prefixa contratos de compra com [COMPRA] e o fornecedor", () => {
    expect(purchaseTitle("[VENDA] NEXID", "Am IT")).toBe("[COMPRA] Am IT — NEXID");
  });
  it("aceita venda sem título", () => {
    expect(purchaseTitle(null, "Fulano")).toBe("[COMPRA] Fulano");
  });
});
