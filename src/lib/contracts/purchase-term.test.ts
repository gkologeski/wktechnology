import { describe, expect, it } from "vitest";
import { suggestPurchaseTerm } from "./purchase-term";

describe("suggestPurchaseTerm", () => {
  it("usa o fim mais tardio entre venda, aditivo e projeto (caso NEXID)", () => {
    const r = suggestPurchaseTerm(
      [
        { starts_at: "2026-10-02", ends_at: "2026-12-04" },
        { starts_at: "2026-11-17", ends_at: "2026-12-24" },
        { starts_at: null, ends_at: null },
      ],
      "2026-11-23",
    );
    expect(r).toEqual({ starts_at: "2026-11-23", ends_at: "2026-12-24" });
  });
  it("mantém início futuro da venda", () => {
    expect(suggestPurchaseTerm([{ starts_at: "2027-01-10", ends_at: "2027-06-30" }], "2026-11-23"))
      .toEqual({ starts_at: "2027-01-10", ends_at: "2027-06-30" });
  });
  it("deixa o fim vazio quando todos os prazos já passaram ou não existem", () => {
    expect(suggestPurchaseTerm([{ starts_at: "2026-01-01", ends_at: "2026-03-01" }], "2026-11-23").ends_at).toBeNull();
    expect(suggestPurchaseTerm([], "2026-11-23")).toEqual({ starts_at: "2026-11-23", ends_at: null });
  });
});
