import { describe, expect, it } from "vitest";

import {
  LINE_ITEMS_KEY,
  isLineItemField,
  lineItemServiceNames,
  lineItemTokenValues,
  lineItemTotal,
  lineItemsSummary,
  workflowUsesLineItems,
} from "./line-items";
import { evalFilter } from "./engine-shared.server";

const items = [
  {
    service_catalog_id: "svc-1",
    service_name: "Hunting",
    seniority: "senior",
    quantity: 2,
    unit_price: 1000,
    discount_pct: 10,
  },
  {
    service_catalog_id: "svc-2",
    service_name: "Fábrica de Software",
    seniority: "pleno",
    quantity: 1,
    unit_price: 500,
  },
];

const deal = { id: "d1", [LINE_ITEMS_KEY]: items };

describe("line items — campos virtuais", () => {
  it("identifica campos de item", () => {
    expect(isLineItemField("line_items.seniority")).toBe(true);
    expect(isLineItemField("stage")).toBe(false);
  });

  it("calcula total com desconto percentual", () => {
    expect(lineItemTotal(items[0]!)).toBe(1800);
    expect(lineItemTotal(items[1]!)).toBe(500);
  });

  it("resume serviços e tokens", () => {
    expect(lineItemServiceNames(items)).toEqual(["Hunting", "Fábrica de Software"]);
    expect(lineItemTokenValues(items)["line_items_count"]).toBe(2);
    expect(lineItemsSummary(items).split("\n")).toHaveLength(2);
  });

  it("detecta uso no JSON do workflow", () => {
    expect(workflowUsesLineItems('{"field":"line_items.seniority"}')).toBe(true);
    expect(workflowUsesLineItems('{"body":"{{deal.services}}"}')).toBe(true);
    expect(workflowUsesLineItems('{"field":"stage"}')).toBe(false);
  });
});

describe("line items — avaliação de condições", () => {
  it("qualquer item atende", () => {
    expect(
      evalFilter({ field: "line_items.service_name", op: "eq", value: "Hunting" }, deal, null),
    ).toBe(true);
  });

  it("todos os itens precisam atender", () => {
    expect(
      evalFilter(
        { field: "line_items.service_name", op: "eq", value: "Hunting", match: "all" },
        deal,
        null,
      ),
    ).toBe(false);
    expect(
      evalFilter(
        { field: "line_items.quantity", op: "gt", value: 0, match: "all" },
        deal,
        null,
      ),
    ).toBe(true);
  });

  it("conta itens do negócio", () => {
    expect(evalFilter({ field: "line_items.count", op: "eq", value: 2 }, deal, null)).toBe(true);
  });

  it("negócio sem itens só atende 'está vazio'", () => {
    const empty = { id: "d2", [LINE_ITEMS_KEY]: [] };
    expect(evalFilter({ field: "line_items.service_name", op: "is_empty" }, empty, null)).toBe(true);
    expect(
      evalFilter({ field: "line_items.service_name", op: "eq", value: "Hunting" }, empty, null),
    ).toBe(false);
  });

  it("compara valores numéricos do item", () => {
    expect(evalFilter({ field: "line_items.total", op: "gt", value: 1500 }, deal, null)).toBe(true);
    expect(
      evalFilter({ field: "line_items.total", op: "gt", value: 1500, match: "all" }, deal, null),
    ).toBe(false);
  });
});
