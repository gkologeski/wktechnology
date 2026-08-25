import { describe, expect, it } from "vitest";

import {
  fileRowToEntry,
  mapEntry,
  mapEntryStatus,
  mapStatementTx,
  parseBrNumber,
  parseDateOnly,
  parseDelimited,
  suggestMapping,
} from "./contaazul-map";

describe("contaazul-map", () => {
  it("interpreta números em formato brasileiro e americano", () => {
    expect(parseBrNumber("1.234,56")).toBe(1234.56);
    expect(parseBrNumber("1234.56")).toBe(1234.56);
    expect(parseBrNumber("R$ 990,00")).toBe(990);
    expect(parseBrNumber("(120,50)")).toBe(-120.5);
    expect(parseBrNumber("abc")).toBeNull();
  });

  it("normaliza datas", () => {
    expect(parseDateOnly("25/08/2026")).toBe("2026-08-25");
    expect(parseDateOnly("2026-08-25T10:00:00Z")).toBe("2026-08-25");
    expect(parseDateOnly("")).toBeNull();
  });

  it("deriva situação quando o provedor não informa", () => {
    expect(mapEntryStatus(null, { amount: 100, paid: 100, dueDate: "2026-01-01" })).toBe("paid");
    expect(mapEntryStatus(null, { amount: 100, paid: 40, dueDate: "2026-01-01" })).toBe("partial");
    expect(
      mapEntryStatus(null, { amount: 100, paid: 0, dueDate: "2020-01-01", today: "2026-01-01" }),
    ).toBe("overdue");
    expect(mapEntryStatus("pago", { amount: 100, paid: 0, dueDate: "2026-01-01" })).toBe("paid");
  });

  it("mapeia um evento financeiro do Conta Azul", () => {
    const entry = mapEntry(
      {
        id: "abc-1",
        description: "Mensalidade",
        value: "1.500,00",
        due_date: "2026-09-10",
        status: "PENDING",
        category: { id: "cat-1" },
        cost_center: { id: "cc-1" },
        customer: { name: "ACME", document: "12.345.678/0001-99" },
      },
      "receivable",
      "2026-08-25",
    );
    expect(entry).not.toBeNull();
    expect(entry!.externalRef).toBe("contaazul:receivable:abc-1");
    expect(entry!.amount).toBe(1500);
    expect(entry!.status).toBe("open");
    expect(entry!.categoryExternalId).toBe("cat-1");
    expect(entry!.costCenterExternalId).toBe("cc-1");
    expect(entry!.counterpartyDoc).toBe("12345678000199");
  });

  it("classifica transações de extrato como entrada/saída", () => {
    expect(mapStatementTx({ id: "t1", value: "-50,00", date: "2026-01-05" })!.direction).toBe(
      "out",
    );
    expect(mapStatementTx({ id: "t2", value: "50,00", tipo: "CREDITO" })!.direction).toBe("in");
    expect(mapStatementTx({ value: 10 })).toBeNull();
  });

  it("faz parse de CSV com ponto e vírgula e sugere mapeamento", () => {
    const csv = 'Descrição;Valor;Vencimento\n"Serviço A";1.000,00;10/09/2026\n';
    const { headers, rows } = parseDelimited(csv);
    expect(headers).toEqual(["Descrição", "Valor", "Vencimento"]);
    expect(rows).toHaveLength(1);

    const mapping = suggestMapping(headers);
    expect(mapping.description).toBe(0);
    expect(mapping.amount).toBe(1);
    expect(mapping.due_date).toBe(2);

    const result = fileRowToEntry(rows[0]!, mapping, "payable", 2, "2026-08-25");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.entry.amount).toBe(1000);
      expect(result.entry.dueDate).toBe("2026-09-10");
      expect(result.entry.direction).toBe("payable");
    }
  });

  it("rejeita linhas sem campos obrigatórios", () => {
    const result = fileRowToEntry(
      ["", "", ""],
      { description: 0, amount: 1, due_date: 2 },
      "payable",
      3,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.length).toBeGreaterThan(0);
  });
});
