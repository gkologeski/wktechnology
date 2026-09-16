// Regressão: execução que termina sem executar nenhuma ação precisa registrar
// `no_op` + motivo em PT-BR, para não parecer "Concluída" com sucesso silencioso.
import { describe, expect, it } from "vitest";
import { runControlAction } from "./engine/actions-control.server";
import type { RunCtx } from "./engine/run-context";
import type { WorkflowAction } from "./types";
import { LINE_ITEMS_KEY } from "./line-items";

const ctx = (after: Record<string, unknown>): RunCtx =>
  ({
    entity: "deals",
    entityId: "deal-1",
    workspaceId: "ws-1",
    ownerId: "user-1",
    after,
    before: null,
    vars: {},
  }) as unknown as RunCtx;

const opts = {
  index: 0,
  stepPath: "1",
  annotate: (s: unknown) => s as never,
  runActions: async () => ({ log: [], hadError: false }),
} as never;

describe("switch_by_value sem ação", () => {
  it("marca no_op e explica a falta de itens do negócio", async () => {
    const action = {
      type: "switch_by_value",
      field: "line_items.service_catalog_id",
      cases: [{ value: "svc-ct", actions: [] }],
      default: [],
    } as unknown as WorkflowAction;

    const out = await runControlAction(
      null as never,
      action as never,
      ctx({ [LINE_ITEMS_KEY]: [] }),
      opts,
    );
    const detail = out.logs[0]?.detail as { no_op?: boolean; reason?: string };
    expect(detail.no_op).toBe(true);
    expect(detail.reason).toContain("itens de linha");
  });

  it("não marca no_op quando o caminho padrão tem passos", async () => {
    const action = {
      type: "switch_by_value",
      field: "line_items.service_catalog_id",
      cases: [],
      default: [{ type: "set_field", field: "name", value: "x" }],
    } as unknown as WorkflowAction;

    const out = await runControlAction(
      null as never,
      action as never,
      ctx({ [LINE_ITEMS_KEY]: [] }),
      opts,
    );
    const detail = out.logs[0]?.detail as { no_op?: boolean };
    expect(detail.no_op).toBeUndefined();
  });
});
