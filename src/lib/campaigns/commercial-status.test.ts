import { describe, expect, it } from "vitest";
import {
  commercialBlock,
  dealState,
  splitCommercial,
  type CommercialFlag,
} from "./commercial-status";

const both = { excludeCustomers: true, excludeOpenDeals: true };
describe("bloqueio comercial das campanhas", () => {
  it("estágios", () => {
    expect(dealState("won")).toBe("won");
    expect(dealState("lost")).toBe("lost");
    expect(dealState("negotiation")).toBe("open");
  });
  it("cliente ganho é bloqueado", () => {
    expect(commercialBlock(new Set<CommercialFlag>(["customer"]), both)).toBe("customer");
  });
  it("negociação aberta é bloqueada (caso Leandro)", () => {
    expect(commercialBlock(new Set<CommercialFlag>(["open_deal"]), both)).toBe("open_deal");
  });
  it("negócio perdido continua recebendo", () => {
    expect(commercialBlock(new Set(), both)).toBeNull();
    expect(commercialBlock(undefined, both)).toBeNull();
  });
  it("opção desligada não bloqueia", () => {
    expect(
      commercialBlock(new Set<CommercialFlag>(["open_deal"]), {
        excludeCustomers: true,
        excludeOpenDeals: false,
      }),
    ).toBeNull();
  });
  it("liberação manual inclui", () => {
    const flags = new Map<string, Set<CommercialFlag>>([
      ["+5548999642929", new Set<CommercialFlag>(["open_deal"])],
    ]);
    const r = splitCommercial(
      [{ phone: "+5548999642929" }, { phone: "+5511999990000" }],
      (i) => i.phone,
      flags,
      both,
      new Set(),
    );
    expect(r.removed.map((x) => x.phone)).toEqual(["+5548999642929"]);
    const r2 = splitCommercial(
      [{ phone: "+5548999642929" }],
      (i) => i.phone,
      flags,
      both,
      new Set(["+5548999642929"]),
    );
    expect(r2.kept[0].overrideCommercial).toBe(true);
  });
});
