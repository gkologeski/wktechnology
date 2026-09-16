import { describe, expect, it } from "vitest";

import { renderActionValues } from "./engine/actions-records.server";
import type { RunCtx } from "./engine/run-context";

const ctx = {
  entity: "deals",
  entityId: "deal-1",
  ownerId: "user-1",
  workspaceId: "ws-1",
  after: { id: "deal-1", title: "Negócio", company_id: null },
  vars: {},
} as unknown as RunCtx;

describe("renderActionValues", () => {
  it("omite campos cuja variável não tem valor de origem", () => {
    const { rendered, skipped } = renderActionValues(
      { counterparty_company_id: "{{company_id}}", amendment_of_id: "{{amendment_of_id}}" },
      ctx,
    );
    expect(rendered).toEqual({});
    expect(skipped.sort()).toEqual(["amendment_of_id", "counterparty_company_id"]);
  });

  it("mantém valores fixos e variáveis resolvidas", () => {
    const { rendered, skipped } = renderActionValues(
      { status: "draft", payment_day: 10, deal_id: "{{id}}" },
      ctx,
    );
    expect(rendered).toEqual({ status: "draft", payment_day: 10, deal_id: "deal-1" });
    expect(skipped).toEqual([]);
  });

  it("preserva texto vazio digitado pelo usuário (sem variável)", () => {
    const { rendered } = renderActionValues({ notes: "" }, ctx);
    expect(rendered).toEqual({ notes: "" });
  });
});
