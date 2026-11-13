import { describe, expect, it } from "vitest";
import {
  canCancelCallCampaign,
  canDeleteCallCampaign,
  canEditCallCampaign,
  summarizeCallAttempts,
} from "./status-label";

describe("controles da campanha de ligação", () => {
  it("edita só rascunho ou pausada", () => {
    expect(canEditCallCampaign("draft")).toBe(true);
    expect(canEditCallCampaign("paused")).toBe(true);
    expect(canEditCallCampaign("running")).toBe(false);
    expect(canEditCallCampaign("done")).toBe(false);
  });
  it("não exclui em andamento", () => {
    expect(canDeleteCallCampaign("running")).toBe(false);
    expect(canDeleteCallCampaign("paused")).toBe(true);
  });
  it("não encerra campanha já concluída", () => {
    expect(canCancelCallCampaign("done")).toBe(false);
    expect(canCancelCallCampaign("running")).toBe(true);
  });
  it("conta realizadas, sem sucesso e pendentes", () => {
    const s = summarizeCallAttempts([
      { campaign_id: "a", status: "completed", created_at: "2026-11-02" },
      { campaign_id: "a", status: "busy", created_at: "2026-11-01" },
      { campaign_id: "a", status: "no_answer", created_at: "2026-11-03" },
      { campaign_id: "a", status: "queued", created_at: "2026-11-04" },
      { campaign_id: "a", status: "canceled", created_at: "2026-11-05" },
    ]).get("a");
    expect(s).toEqual({ done: 1, failed: 2, pending: 1, total: 5, startedAt: "2026-11-01", nextAt: "2026-11-04" });
  });
});
