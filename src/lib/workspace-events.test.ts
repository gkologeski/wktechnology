import { describe, expect, it } from "vitest";
import { brandingRealtimeFilters, realtimeRetryDelay } from "./workspace-events";

describe("tempo real do White Label", () => {
  const ws = "6f1c2b9e-1111-4222-8333-444455556666";

  it("assina só as duas tabelas de branding, presas ao workspace carregado", () => {
    expect(brandingRealtimeFilters(ws)).toEqual([
      { table: "workspace_branding", filter: `workspace_id=eq.${ws}` },
      { table: "module_branding", filter: `workspace_id=eq.${ws}` },
    ]);
  });

  it("recusa workspace que não seja uuid (nada de filtro aberto ou injetado)", () => {
    expect(() => brandingRealtimeFilters("")).toThrow();
    expect(() => brandingRealtimeFilters(`${ws},workspace_id=neq.x`)).toThrow();
  });

  it("nova tentativa com espera crescente limitada a 60 s", () => {
    expect([0, 1, 2, 3, 4, 9].map(realtimeRetryDelay)).toEqual([
      5000, 10000, 20000, 40000, 60000, 60000,
    ]);
  });
});
