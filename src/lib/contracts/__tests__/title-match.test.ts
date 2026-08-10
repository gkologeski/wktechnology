import { describe, expect, it } from "vitest";
import {
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
    const { likely, others } = splitContractsByPersonMatch(items, "Maria Souza Lima", (c) => c.title);
    expect(likely.map((c) => c.id)).toEqual(["2", "3"]);
    expect(others.map((c) => c.id)).toEqual(["1"]);
  });
});
