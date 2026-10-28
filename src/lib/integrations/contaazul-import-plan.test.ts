import { describe, expect, it } from "vitest";

import {
  caEventTargetStatus,
  cnpjOrNull,
  linkKey,
  mapCaEvent,
  mapCaTransfer,
  paymentParts,
  planCatalog,
  planEntries,
  planTransfers,
  splitPersonName,
  type CaEvent,
  type ExistingLink,
  type LocalEntry,
} from "./contaazul-import-plan";

const ev = (p: Partial<CaEvent> & { id: string }): CaEvent => ({
  direction: "receivable",
  dueDate: "2026-09-10",
  competenceDate: "2026-09-10",
  amount: 100,
  paid: 0,
  caStatus: "PENDING",
  description: "Mensalidade",
  categoryId: null,
  costCenterId: null,
  counterpartyId: null,
  counterpartyName: "Cliente A",
  ...p,
});
const loc = (p: Partial<LocalEntry> & { id: string }): LocalEntry => ({
  direction: "receivable",
  dueDate: "2026-09-10",
  amount: 100,
  paid: 0,
  description: "Mensalidade",
  counterparty: "Cliente A",
  status: "open",
  ...p,
});

describe("mapCaEvent", () => {
  it("lê o formato real do Conta Azul", () => {
    const e = mapCaEvent(
      {
        id: "x1",
        descricao: "SOLUTCOM",
        data_vencimento: "2014-07-10",
        data_competencia: "2014-06-10",
        status: "ACQUITTED",
        total: 319.99,
        pago: 319.99,
        categorias: [{ id: "c1", nome: "Receitas" }],
        centros_de_custo: [{ id: "cc1", nome: "GM" }],
        cliente: { id: "p1", nome: "E Do Brasil" },
      },
      "receivable",
    )!;
    expect(e).toMatchObject({
      dueDate: "2014-07-10",
      competenceDate: "2014-06-10",
      amount: 319.99,
      paid: 319.99,
      categoryId: "c1",
      costCenterId: "cc1",
      counterpartyId: "p1",
    });
    expect(caEventTargetStatus(e)).toBe("paid");
  });
  it("fornecedor é a contraparte de contas a pagar", () => {
    expect(
      mapCaEvent(
        { id: "y", data_vencimento: "2020-01-01", total: 5, fornecedor: { id: "f1", nome: "F" } },
        "payable",
      )?.counterpartyId,
    ).toBe("f1");
  });
  it("descarta item sem vencimento ou sem valor", () => {
    expect(mapCaEvent({ id: "z", total: 10 }, "payable")).toBeNull();
    expect(mapCaEvent({ id: "z", data_vencimento: "2020-01-01", total: 0 }, "payable")).toBeNull();
  });
  it("perdido no Conta Azul vira cancelado", () => {
    expect(caEventTargetStatus(ev({ id: "l", caStatus: "LOST" }))).toBe("cancelled");
    expect(caEventTargetStatus(ev({ id: "p", paid: 40 }))).toBe("partial");
    expect(caEventTargetStatus(ev({ id: "o", caStatus: "OVERDUE" }))).toBe("overdue");
  });
});

describe("planEntries", () => {
  it("vincula o mesmo lançamento sem criar outro", () => {
    const plan = planEntries([loc({ id: "L1" })], [ev({ id: "A1" })], new Map());
    expect(plan.match).toEqual([
      { apiId: "A1", localId: "L1", tier: "exact", topUpCents: 0, cancel: false },
    ]);
    expect(plan.create).toEqual([]);
  });
  it("baixa feita depois da planilha vira baixa nova no lançamento existente", () => {
    const plan = planEntries(
      [loc({ id: "L1" })],
      [ev({ id: "A1", paid: 100, caStatus: "ACQUITTED" })],
      new Map(),
    );
    expect(plan.match[0]!.topUpCents).toBe(10000);
  });
  it("não abate de novo o que já está baixado", () => {
    const plan = planEntries(
      [loc({ id: "L1", paid: 100, status: "paid" })],
      [ev({ id: "A1", paid: 100, caStatus: "ACQUITTED" })],
      new Map(),
    );
    expect(plan.match[0]!.topUpCents).toBe(0);
  });
  it("só no Conta Azul é criado", () => {
    const plan = planEntries([], [ev({ id: "A1" })], new Map());
    expect(plan.create).toEqual(["A1"]);
  });
  it("mesmo texto com outra data vai para revisão, não duplica", () => {
    const plan = planEntries(
      [loc({ id: "L1", dueDate: "2026-09-01" })],
      [ev({ id: "A1" })],
      new Map(),
    );
    expect(plan.create).toEqual([]);
    expect(plan.review).toEqual([{ apiId: "A1", reason: "date_changed", localIds: ["L1"] }]);
  });
  it("mesmo texto com outro valor vai para revisão", () => {
    const plan = planEntries([loc({ id: "L1", amount: 90 })], [ev({ id: "A1" })], new Map());
    expect(plan.review[0]).toMatchObject({ reason: "amount_changed" });
  });
  it("só data e valor iguais com texto diferente vai para revisão", () => {
    const plan = planEntries(
      [loc({ id: "L1", description: "Outra coisa", counterparty: "Outro" })],
      [ev({ id: "A1" })],
      new Map(),
    );
    expect(plan.match).toEqual([]);
    expect(plan.review[0]).toMatchObject({ apiId: "A1", reason: "ambiguous", localIds: ["L1"] });
  });
  it("execução repetida não reimporta o que já tem vínculo", () => {
    const links = new Map<string, ExistingLink>([
      [
        linkKey("receivable", "A1"),
        {
          entity: "receivable",
          contaazulId: "A1",
          status: "imported",
          decision: null,
          localId: "N1",
        },
      ],
    ]);
    const plan = planEntries([loc({ id: "N1" })], [ev({ id: "A1" })], links);
    expect(plan).toMatchObject({ match: [], create: [], review: [], skipped: 1 });
  });
  it("decisões da revisão são respeitadas", () => {
    const review = (
      id: string,
      decision: ExistingLink["decision"],
      localId: string | null = null,
    ): [string, ExistingLink] => [
      linkKey("receivable", id),
      { entity: "receivable", contaazulId: id, status: "review", decision, localId },
    ];
    const plan = planEntries(
      [loc({ id: "L1", description: "x", counterparty: "y" })],
      [ev({ id: "A1" }), ev({ id: "A2", amount: 7 }), ev({ id: "A3", amount: 8 })],
      new Map([review("A1", "same", "L1"), review("A2", "new"), review("A3", "ignore")]),
    );
    expect(plan.match.map((m) => [m.apiId, m.localId, m.tier])).toEqual([["A1", "L1", "manual"]]);
    expect(plan.create).toEqual(["A2"]);
    expect(plan.skipped).toBe(1);
  });
  it("perdido no Conta Azul em lançamento existente só é sinalizado", () => {
    const plan = planEntries([loc({ id: "L1" })], [ev({ id: "A1", caStatus: "LOST" })], new Map());
    expect(plan.match[0]).toMatchObject({ cancel: true, topUpCents: 0 });
  });
});

describe("transferências", () => {
  it("lê origem e destino", () => {
    const t = mapCaTransfer({
      id: "t1",
      valor: 50,
      data: "2018-12-10",
      origem: { conta_financeira: { id: "a" } },
      destino: { conta_financeira: { id: "b" } },
    })!;
    expect(t).toMatchObject({ fromAccountId: "a", toAccountId: "b", amount: 50 });
  });
  it("pareia por data e valor, um para um", () => {
    const local = [{ key: "p1", localId: "L1", date: "2020-01-01", amount: 10 }];
    const api = [
      {
        id: "t1",
        date: "2020-01-01",
        amount: 10,
        description: "",
        fromAccountId: null,
        toAccountId: null,
      },
      {
        id: "t2",
        date: "2020-01-01",
        amount: 10,
        description: "",
        fromAccountId: null,
        toAccountId: null,
      },
    ];
    expect(planTransfers(local, api, new Map())).toEqual({
      match: [{ apiId: "t1", localId: "L1" }],
      create: ["t2"],
      skipped: 0,
    });
  });
});

describe("cadastros auxiliares", () => {
  it("nome igual vincula, vários candidatos vão para revisão, ausente é criado", () => {
    const plan = planCatalog(
      "cost_center",
      [
        { id: "r1", name: "GM - RH" },
        { id: "r2", name: "Comercial" },
        { id: "r3", name: "Novo" },
      ],
      [
        { id: "l1", name: "GM – RH" },
        { id: "l2", name: "Comercial" },
        { id: "l3", name: "comercial" },
      ],
      new Map(),
    );
    expect(plan.match).toEqual([{ remoteId: "r1", localId: "l1" }]);
    expect(plan.review).toEqual([{ remoteId: "r2", localIds: ["l2", "l3"] }]);
    expect(plan.create).toEqual(["r3"]);
  });
});

describe("pessoas e baixas", () => {
  it("divide nome de pessoa sem inventar sobrenome", () => {
    expect(splitPersonName("Maria Eduarda Santos")).toEqual({
      first: "Maria",
      last: "Eduarda Santos",
    });
    expect(splitPersonName("Julio")).toEqual({ first: "Julio", last: null });
  });
  it("CNPJ só com 14 dígitos", () => {
    expect(cnpjOrNull("12.345.678/0001-90")).toBe("12345678000190");
    expect(cnpjOrNull("123.456.789-00")).toBeNull();
  });
  it("usa as baixas do detalhe quando somam o valor pago", () => {
    const detail = {
      baixas: [
        {
          data_pagamento: "2026-09-12",
          composicao_valor: { valor_liquido: 60 },
          conta_financeira: { id: "acc" },
        },
        { data_pagamento: "2026-09-20", composicao_valor: { valor_liquido: 40 } },
      ],
    };
    const r = paymentParts(detail, ev({ id: "A", paid: 100 }), 10000);
    expect(r.estimated).toBe(false);
    expect(r.parts).toEqual([
      { paidAt: "2026-09-12", cents: 6000, accountId: "acc" },
      { paidAt: "2026-09-20", cents: 4000, accountId: null },
    ]);
  });
  it("sem detalhe reconhecível usa o vencimento e marca como estimada", () => {
    expect(paymentParts(null, ev({ id: "A", paid: 100 }), 10000)).toEqual({
      parts: [{ paidAt: "2026-09-10", cents: 10000, accountId: null }],
      estimated: true,
    });
  });
  it("complemento de baixa usa a data da última baixa", () => {
    const detail = { baixas: [{ data_pagamento: "2026-09-12", valor: 100 }] };
    expect(paymentParts(detail, ev({ id: "A", paid: 100 }), 4000).parts).toEqual([
      { paidAt: "2026-09-12", cents: 4000, accountId: null },
    ]);
  });
});

describe("quitação com desconto e vendas", () => {
  it("quitado com pago menor que o total vira desconto e valor líquido", async () => {
    const { caDiscountCents, effectiveAmount } = await import("./contaazul-import-plan");
    const e = ev({ id: "D", amount: 167.54, paid: 148.35, caStatus: "ACQUITTED" });
    expect(caDiscountCents(e)).toBe(1919);
    expect(effectiveAmount(e)).toBe(148.35);
  });
  it("pagamento parcial em aberto não é desconto", async () => {
    const { caDiscountCents, effectiveAmount } = await import("./contaazul-import-plan");
    const e = ev({ id: "P", amount: 100, paid: 40, caStatus: "PENDING" });
    expect(caDiscountCents(e)).toBe(0);
    expect(effectiveAmount(e)).toBe(100);
  });
  it("lê a venda do Conta Azul com situação em português", async () => {
    const { mapCaSale } = await import("./contaazul-import-plan");
    const s = mapCaSale({
      id: "v1",
      numero: 103,
      data: "2021-01-23",
      tipo: "SALE",
      itens: "SERVICE",
      total: 1430.4,
      cliente: { id: "c1", nome: "Julio" },
      situacao: { nome: "APROVADO", descricao: "Aprovado" },
      criado_em: "2021-06-21T11:26:32.875",
    })!;
    expect(s).toMatchObject({ number: 103, date: "2021-01-23", total: 1430.4, customerId: "c1", statusLabel: "Aprovada" });
    expect(mapCaSale({ numero: 1 })).toBeNull();
  });
});
