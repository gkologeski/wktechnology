import { describe, expect, it } from "vitest";
import { computePendingLinks, type PendingLinkSource } from "../pending-link";

function base(over: Partial<PendingLinkSource>): PendingLinkSource {
  return {
    id: "1",
    role: "provider",
    number: "C-1",
    title: "Contrato",
    status: "draft",
    starts_at: null,
    ends_at: null,
    parent_contract_id: null,
    document_kind: "main",
    amendment_of_id: null,
    metadata: null,
    ...over,
  };
}

describe("computePendingLinks", () => {
  it("cobra contrato de prestação sem contrato de compra vinculado", () => {
    const rows = computePendingLinks([base({ id: "p1" })]);
    expect(rows.map((r) => r.reason)).toEqual(["Sem contrato de compra vinculado"]);
  });

  it("não cobra aditivo que já tem contrato principal", () => {
    const rows = computePendingLinks([
      base({ id: "adt", document_kind: "amendment", amendment_of_id: "p1" }),
      base({ id: "p1", parent_contract_id: null }),
      base({ id: "cc", role: "client", parent_contract_id: "p1" }),
    ]);
    expect(rows.map((r) => r.id)).toEqual([]);
  });

  it("cobra aditivo sem contrato principal", () => {
    const rows = computePendingLinks([
      base({ id: "adt", document_kind: "amendment", amendment_of_id: null }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.reason).toBe("Aditivo sem contrato principal");
    expect(rows[0]?.document_kind).toBe("amendment");
  });

  it("filtra apenas aditivos quando role = amendment", () => {
    const rows = computePendingLinks(
      [
        base({ id: "p1" }),
        base({ id: "cc", role: "client" }),
        base({ id: "adt", document_kind: "amendment" }),
      ],
      { role: "amendment" },
    );
    expect(rows.map((r) => r.id)).toEqual(["adt"]);
  });

  it("respeita link_dismissed", () => {
    const rows = computePendingLinks([base({ id: "p1", metadata: { link_dismissed: true } })]);
    expect(rows).toHaveLength(0);
  });
});
