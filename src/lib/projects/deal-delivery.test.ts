import { describe, expect, it, vi } from "vitest";
import {
  PENDING_LABEL,
  deliveryHeadline,
  groupKeyFromLabel,
  groupLabel,
} from "./deal-delivery-labels";
import { handleDeliveryAction } from "@/lib/workflows/engine/actions-delivery.server";
import { parseActionAtDepth } from "@/lib/workflows/schemas";
import { ACTION_LABELS } from "@/lib/workflows/types";

const base = {
  deal: { id: "d", stage_type: "won" as const, closed_at: null, has_company: true, contracts: 0 },
  policy: { enabled: true, activated_at: "2026-10-20T00:00:00Z", allow_groups: true },
  job: null,
  projects: [],
};

describe("entrega do negócio — rótulos", () => {
  it("nome do grupo vira chave técnica aceita pelo banco", () => {
    expect(groupKeyFromLabel("Desenvolvimento Mobile")).toBe("desenvolvimento-mobile");
    expect(groupKeyFromLabel("Implantação – Fase 1")).toBe("implantacao-fase-1");
    expect(groupKeyFromLabel("   ")).toBe("");
    expect(groupKeyFromLabel("x".repeat(60))).toHaveLength(40);
    expect(groupKeyFromLabel("Desenvolvimento Mobile")).toMatch(/^[a-z0-9][a-z0-9_-]{0,39}$/);
  });

  it("sem grupo é entrega única", () => {
    expect(groupLabel("default")).toBe("Entrega única");
    expect(groupLabel(null)).toBe("Entrega única");
  });

  it("todas as pendências têm rótulo em PT-BR", () => {
    for (const v of Object.values(PENDING_LABEL)) expect(v.length).toBeGreaterThan(3);
  });

  it("ganho sem projeto com falha mostra perigo; com projeto mostra sucesso", () => {
    expect(deliveryHeadline({ ...base, job: { status: "failed" } as never }).tone).toBe("danger");
    expect(deliveryHeadline({ ...base, projects: [{}] as never }).tone).toBe("success");
    expect(
      deliveryHeadline({ ...base, policy: { ...base.policy, enabled: false } }).text,
    ).toContain("desligada");
  });
});

describe("ação de workflow ensure_deal_delivery", () => {
  const ctx = {
    entity: "deals" as const,
    entityId: "11111111-1111-1111-1111-111111111111",
    ownerId: "o",
    workspaceId: "22222222-2222-2222-2222-222222222222",
    after: null,
    before: null,
  };

  it("tem rótulo e passa no validador", () => {
    expect(ACTION_LABELS.ensure_deal_delivery).toBeTruthy();
    expect(parseActionAtDepth({ type: "ensure_deal_delivery" }, 0)).toEqual({
      type: "ensure_deal_delivery",
    });
  });

  it("envia ao banco o negócio e o workspace do run (nunca outro)", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        job_status: "done",
        results: [{ group: "default", project_id: "p1", action: "existing" }],
      },
      error: null,
    });
    const step = await handleDeliveryAction(
      { rpc } as never,
      { type: "ensure_deal_delivery" },
      ctx,
      "t",
    );
    expect(rpc).toHaveBeenCalledWith("deal_delivery_workflow_ensure", {
      p_deal: ctx.entityId,
      p_workspace: ctx.workspaceId,
    });
    expect(step?.detail).toMatchObject({ created: 0, existing: 1, project_ids: ["p1"] });
  });

  it("recusa workflows que não são de Negócios", async () => {
    const rpc = vi.fn();
    await expect(
      handleDeliveryAction(
        { rpc } as never,
        { type: "ensure_deal_delivery" },
        { ...ctx, entity: "leads" },
        "t",
      ),
    ).rejects.toThrow("Negócios");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("falha do provisionamento vira erro do passo (fica pendente no negócio)", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: { job_status: "failed", error: "x" }, error: null });
    await expect(
      handleDeliveryAction({ rpc } as never, { type: "ensure_deal_delivery" }, ctx, "t"),
    ).rejects.toThrow("x");
  });

  it("ignora outros tipos de passo", async () => {
    const rpc = vi.fn();
    expect(
      await handleDeliveryAction({ rpc } as never, { type: "wait", minutes: 1 } as never, ctx, "t"),
    ).toBeNull();
  });
});
