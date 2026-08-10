import { describe, expect, it } from "vitest";
import {
  scoreContractForPerson,
  scoreContractTitleForPerson,
  splitContractsByPersonMatch,
} from "@/lib/contracts/title-match";

describe("scoreContractTitleForPerson", () => {
  it("ignora acentos e prefixos entre colchetes", () => {
    expect(
      scoreContractTitleForPerson("[PRESTAÇÃO] ACME X JOAO DA SILVA — 2026", "João da Silva"),
    ).toBe(100);
  });

  it("pontua mais alto quando o nome completo aparece", () => {
    const full = scoreContractTitleForPerson("ACME X MARIA SOUZA LIMA", "Maria Souza Lima");
    const partial = scoreContractTitleForPerson("ACME X MARIA SOUZA", "Maria Souza Lima");
    expect(full).toBeGreaterThan(partial);
    expect(partial).toBeGreaterThan(0);
  });

  it("pontua pouco quando só o primeiro nome bate", () => {
    expect(scoreContractTitleForPerson("ACME X MARIA PEREIRA", "Maria Souza Lima")).toBe(25);
  });

  it("retorna 0 sem correspondência ou sem nome", () => {
    expect(scoreContractTitleForPerson("[COMPRA] ACME X BETA", "Maria Souza Lima")).toBe(0);
    expect(scoreContractTitleForPerson("ACME X MARIA", "")).toBe(0);
  });
});

describe("splitContractsByPersonMatch", () => {
  it("coloca os prováveis primeiro preservando ordem em empates", () => {
    const items = [
      { id: "1", title: "[PRESTAÇÃO] ACME X BETA" },
      { id: "2", title: "[PRESTAÇÃO] ACME X MARIA SOUZA LIMA" },
      { id: "3", title: "[PRESTAÇÃO] ACME X MARIA SOUZA" },
    ];
    const { likely, others } = splitContractsByPersonMatch(
      items,
      "Maria Souza Lima",
      (c) => c.title,
    );
    expect(likely.map((c) => c.id)).toEqual(["2", "3"]);
    expect(others.map((c) => c.id)).toEqual(["1"]);
  });
});

describe("scoreContractForPerson", () => {
  const person = {
    name: "Maria Souza Lima",
    docs: ["123.456.789-09"],
    companyNames: ["MSL Serviços Ltda"],
  };

  it("prioriza CPF/CNPJ igual ao da contraparte", () => {
    const r = scoreContractForPerson(
      { title: "[PRESTAÇÃO] ACME X FORNECEDOR", counterpartyDocs: ["12345678909"] },
      person,
    );
    expect(r.score).toBe(100);
    expect(r.reason).toBe("CPF/CNPJ da contraparte");
  });

  it("reconhece documento presente no título", () => {
    const r = scoreContractForPerson({ title: "CPS 123.456.789-09 X ACME" }, person);
    expect(r.score).toBe(98);
  });

  it("usa a contraparte quando o título não tem o nome", () => {
    const r = scoreContractForPerson(
      { title: "[PRESTAÇÃO] ACME X CONTRATADA", counterpartyName: "MSL Serviços Ltda" },
      person,
    );
    expect(r.score).toBeGreaterThan(60);
    expect(r.reason).toBe("Contraparte semelhante");
  });

  it("mantém o fallback pelo título", () => {
    const r = scoreContractForPerson({ title: "ACME X MARIA SOUZA LIMA" }, person);
    expect(r.reason).toBe("Nome no título");
    expect(r.score).toBe(90);
  });

  it("retorna zero sem qualquer sinal", () => {
    expect(scoreContractForPerson({ title: "ACME X BETA" }, person).score).toBe(0);
  });
});
