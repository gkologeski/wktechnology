import { describe, expect, it } from "vitest";

import {
  mapCaEventStatus,
  matchByName,
  matchPeople,
  normCompanyName,
  reconcileEntries,
  type ReconEntry,
} from "./contaazul-reconcile";

const e = (over: Partial<ReconEntry> & { id: string }): ReconEntry => ({
  direction: "receivable",
  dueDate: "2026-01-10",
  amountCents: 10000,
  description: "Mensalidade",
  counterparty: "Cliente A",
  status: "paid",
  ...over,
});

describe("reconcileEntries", () => {
  it("casa o lançamento da planilha com o da API sem criar duplicidade", () => {
    const r = reconcileEntries([e({ id: "L1" })], [e({ id: "A1", description: "MENSALIDADE" })]);
    expect(r.matched).toEqual([
      { apiId: "A1", localId: "L1", tier: "exact", statusDiffers: false },
    ]);
    expect(r.apiOnly).toEqual([]);
    expect(r.localOnly).toEqual([]);
  });

  it("pareia repetições idênticas uma a uma e marca a sobra da API como nova", () => {
    const local = [e({ id: "L1" }), e({ id: "L2" })];
    const api = [e({ id: "A1" }), e({ id: "A2" }), e({ id: "A3" })];
    const r = reconcileEntries(local, api);
    expect(r.matched).toHaveLength(2);
    expect(r.apiOnly).toEqual(["A3"]);
  });

  it("mesma data e valor com vários candidatos diferentes vai para revisão", () => {
    const local = [e({ id: "L1", description: "X", counterparty: "P" }), e({ id: "L2", description: "Y", counterparty: "Q" })];
    const api = [e({ id: "A1", description: "Z", counterparty: "R" }), e({ id: "A2", description: "W", counterparty: "S" })];
    const r = reconcileEntries(local, api);
    expect(r.matched).toEqual([]);
    expect(r.review).toEqual([{ apiIds: ["A1", "A2"], localIds: ["L1", "L2"] }]);
  });

  it("mantém como só-local o que não existe na API (nada é apagado)", () => {
    const r = reconcileEntries([e({ id: "L1", amountCents: 999 })], []);
    expect(r.localOnly).toEqual(["L1"]);
  });

  it("não cruza a receber com a pagar", () => {
    const r = reconcileEntries([e({ id: "L1", direction: "payable" })], [e({ id: "A1" })]);
    expect(r.matched).toEqual([]);
    expect(r.apiOnly).toEqual(["A1"]);
    expect(r.localOnly).toEqual(["L1"]);
  });
});

describe("mapCaEventStatus", () => {
  it("perdido no Conta Azul vira cancelado, não atrasado", () => {
    expect(mapCaEventStatus("LOST", 0, 100)).toBe("cancelled");
  });
  it("quitado vira pago e pendente com pagamento parcial vira parcial", () => {
    expect(mapCaEventStatus("ACQUITTED", 100, 100)).toBe("paid");
    expect(mapCaEventStatus("PENDING", 40, 100)).toBe("partial");
  });
});

describe("matchPeople", () => {
  const companies = [
    { id: "C1", name: "Acme Tecnologia Ltda", cnpj: "12.345.678/0001-90" },
    { id: "C2", name: "Beta", cnpj: null },
    { id: "C3", name: "Beta S/A", cnpj: null },
  ];
  const contacts = [{ id: "P1", fullName: "Ana Souza", email: "ana@x.com" }];

  it("vincula empresa pelo CNPJ antes do nome", () => {
    const [m] = matchPeople(
      [{ id: "X", name: "Outro nome", kind: "company", document: "12345678000190", email: null }],
      companies,
      contacts,
    );
    expect(m).toEqual({ personId: "X", outcome: "linked", by: "document", localId: "C1" });
  });

  it("nome com mais de uma empresa possível vai para revisão", () => {
    const [m] = matchPeople(
      [{ id: "X", name: "BETA", kind: "company", document: null, email: null }],
      companies,
      contacts,
    );
    expect(m).toMatchObject({ outcome: "review", localIds: ["C2", "C3"] });
  });

  it("pessoa física casa pelo e-mail e sem candidato é nova", () => {
    const res = matchPeople(
      [
        { id: "X", name: "A. Souza", kind: "person", document: null, email: "ANA@x.com" },
        { id: "Y", name: "Novo", kind: "person", document: null, email: null },
      ],
      companies,
      contacts,
    );
    expect(res[0]).toMatchObject({ outcome: "linked", by: "email", localId: "P1" });
    expect(res[1]).toEqual({ personId: "Y", outcome: "new" });
  });

  it("remove sufixo societário ao comparar nomes", () => {
    expect(normCompanyName("Acme Tecnologia LTDA - ME")).toBe("acme tecnologia");
  });
});

describe("matchByName", () => {
  it("vincula pelo nome sem acento/caixa e marca novo quando não existe", () => {
    const r = matchByName(
      [
        { id: "r1", name: "Receitas de Serviços" },
        { id: "r2", name: "Nova" },
      ],
      [{ id: "l1", name: "receitas de servicos" }],
    );
    expect(r.map((x) => x.outcome)).toEqual(["linked", "new"]);
  });
});
