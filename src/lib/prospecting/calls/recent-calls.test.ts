import { describe, expect, it } from "vitest";
import { selectRecentCalls } from "./recent-calls";

describe("selectRecentCalls", () => {
  it("tira da lista as tentativas ainda na fila", () => {
    const r = selectRecentCalls([
      { status: "queued", created_at: "2026-11-16T10:36:00Z" },
      {
        status: "completed",
        started_at: "2026-11-16T10:31:00Z",
        created_at: "2026-11-16T10:00:00Z",
      },
    ]);
    expect(r.map((x) => x.status)).toEqual(["completed"]);
  });
  it("ordena pela hora em que a ligação começou, não pela criação", () => {
    const r = selectRecentCalls([
      { status: "failed", started_at: "2026-11-16T10:30:00Z", created_at: "2026-11-16T10:35:00Z" },
      {
        status: "completed",
        started_at: "2026-11-16T10:34:00Z",
        created_at: "2026-11-16T10:00:00Z",
      },
    ]);
    expect(r[0].status).toBe("completed");
  });
});

import { callStatusView, callEndedReasonLabel } from "./recent-calls";
describe("callStatusView", () => {
  it("concluída com motivo de término é sucesso", () => {
    expect(callStatusView("completed", "customer-ended-call")).toEqual({
      tone: "signed",
      label: "Concluída",
    });
  });
  it("falha é erro", () => {
    expect(callStatusView("failed", "twilio-failed-to-connect-call").tone).toBe("failed");
  });
  it("não atendeu é aviso", () => {
    expect(callStatusView("completed", "customer-did-not-answer").tone).toBe("partial");
  });
  it("traduz motivo", () => {
    expect(callEndedReasonLabel("customer-ended-call")).toBe("Cliente desligou");
  });
});
