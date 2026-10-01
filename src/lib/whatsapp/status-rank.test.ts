import { describe, expect, it } from "vitest";
import { shouldApplyStatus } from "./status-rank";

describe("shouldApplyStatus", () => {
  it("avança", () => {
    expect(shouldApplyStatus("accepted", "sent")).toBe(true);
    expect(shouldApplyStatus("sent", "read")).toBe(true);
  });
  it("não regride", () => {
    expect(shouldApplyStatus("read", "sent")).toBe(false);
    expect(shouldApplyStatus("delivered", "delivered")).toBe(false);
    expect(shouldApplyStatus("delivered", "failed")).toBe(false);
  });
  it("aplica falha em mensagem ainda não entregue", () => {
    expect(shouldApplyStatus("accepted", "failed")).toBe(true);
    expect(shouldApplyStatus("failed", "sent")).toBe(false);
  });
});
