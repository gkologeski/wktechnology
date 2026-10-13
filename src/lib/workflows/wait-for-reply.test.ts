import { describe, expect, it } from "vitest";
import { decideWait, resolveWaitState, timeoutMs, WAIT_POLL_MS } from "./wait-for-reply";
import { collectSdrAgentIds } from "./flow-checks";
import { parseActionsAtDepth } from "./schemas";

const t0 = new Date("2026-10-13T10:00:00Z");

describe("aguardar resposta", () => {
  it("prazo de 2 dias", () => {
    const s = resolveWaitState(null, 3, t0, timeoutMs(2, "days"));
    expect(s.deadline).toBe("2026-10-15T10:00:00.000Z");
  });
  it("resposta segue pelo ramo respondeu", () => {
    const s = resolveWaitState(null, 0, t0, timeoutMs(1, "hours"));
    expect(decideWait(s, true, t0).kind).toBe("replied");
  });
  it("sem resposta antes do prazo volta a conferir em 10 min", () => {
    const s = resolveWaitState(null, 0, t0, timeoutMs(1, "days"));
    const d = decideWait(s, false, t0);
    expect(d.kind).toBe("suspend");
    if (d.kind === "suspend")
      expect(new Date(d.runAtIso).getTime() - t0.getTime()).toBe(WAIT_POLL_MS);
  });
  it("prazo esgotado segue pelo ramo sem resposta", () => {
    const s = resolveWaitState(null, 0, t0, timeoutMs(1, "hours"));
    expect(decideWait(s, false, new Date("2026-10-13T11:00:00Z")).kind).toBe("timeout");
  });
  it("retomada mantém o início original da espera do mesmo passo", () => {
    const prior = {
      cursor: 2,
      started_at: "2026-10-12T00:00:00Z",
      deadline: "2026-10-14T00:00:00Z",
    };
    expect(resolveWaitState(prior, 2, t0, 1).started_at).toBe(prior.started_at);
    expect(resolveWaitState(prior, 5, t0, 1).started_at).toBe(t0.toISOString());
  });
  it("é aceito também dentro de caminhos", () => {
    const wait = {
      type: "wait_for_reply",
      channels: ["email"],
      timeout_amount: 1,
      timeout_unit: "days",
      then: [],
      else: [],
    };
    expect(() => parseActionsAtDepth([wait], 0)).not.toThrow();
    expect(() =>
      parseActionsAtDepth([{ type: "branch_if", filters: [], then: [wait], else: [] }], 0),
    ).not.toThrow();
  });
  it("ligar agente sem escolher bloqueia publicação", () => {
    expect(collectSdrAgentIds([{ type: "sdr_agent", mode: "on" }]).missing).toBe(true);
    expect(collectSdrAgentIds([{ type: "sdr_agent", mode: "off" }]).missing).toBe(false);
  });
});
