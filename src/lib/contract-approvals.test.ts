import { describe, it, expect } from "vitest";
import { defaultStagesForRole } from "./contract-approvals.functions";

describe("defaultStagesForRole", () => {
  it("provider (venda) → legal → finance", () => {
    expect(defaultStagesForRole("provider")).toEqual(["legal", "finance"]);
  });

  it("client (compra) → purchasing → finance → legal", () => {
    expect(defaultStagesForRole("client")).toEqual(["purchasing", "finance", "legal"]);
  });

  it("retorna nova cópia (não referência compartilhada)", () => {
    const a = defaultStagesForRole("provider");
    const b = defaultStagesForRole("provider");
    a.push("purchasing");
    expect(b).toEqual(["legal", "finance"]);
  });
});
