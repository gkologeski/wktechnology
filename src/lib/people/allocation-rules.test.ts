import { describe, expect, it } from "vitest";
import { contractFieldError, groupProjectsByContract, splitsError } from "./allocation-rules";

describe("contractFieldError", () => {
  it("recusa contrato de compra no campo de prestação", () => {
    expect(contractFieldError("provider", { role: "client", document_kind: "main" })).toMatch(
      /apenas contratos de prestação/,
    );
  });
  it("recusa contrato de prestação no campo de compra", () => {
    expect(contractFieldError("purchase", { role: "provider", document_kind: "main" })).toMatch(
      /apenas contratos de compra/,
    );
  });
  it("recusa aditivo", () => {
    expect(contractFieldError("provider", { role: "provider", document_kind: "amendment" })).not.toBeNull();
  });
  it("aceita o papel correto", () => {
    expect(contractFieldError("provider", { role: "provider", document_kind: "main" })).toBeNull();
    expect(contractFieldError("purchase", { role: "client", document_kind: null })).toBeNull();
  });
});

describe("splitsError", () => {
  it("rateio vazio é permitido", () => expect(splitsError([])).toBeNull());
  it("60% + 40% é válido", () =>
    expect(splitsError([{ company_id: "a", pct: 60 }, { company_id: "b", pct: 40 }])).toBeNull());
  it("soma diferente de 100% é recusada", () =>
    expect(splitsError([{ company_id: "a", pct: 60 }, { company_id: "b", pct: 30 }])).toMatch(/90%/));
  it("empresa repetida é recusada", () =>
    expect(splitsError([{ company_id: "a", pct: 50 }, { company_id: "a", pct: 50 }])).toMatch(/mais de uma vez/));
});

describe("groupProjectsByContract", () => {
  const ps = [
    { id: "1", name: "X", contract_id: "c2" },
    { id: "2", name: "Y", contract_id: "c1" },
    { id: "3", name: "Z", contract_id: null },
  ];
  it("projetos do contrato de prestação vêm primeiro", () => {
    const g = groupProjectsByContract(ps, "c1");
    expect(g.fromContract.map((p) => p.id)).toEqual(["2"]);
    expect(g.others.map((p) => p.id)).toEqual(["1", "3"]);
  });
  it("sem contrato, tudo fica em outros", () =>
    expect(groupProjectsByContract(ps, null).others).toHaveLength(3));
});
