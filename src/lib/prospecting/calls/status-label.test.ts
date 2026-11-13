import { describe, expect, it } from "vitest";
import { callCampaignChecklist, callCampaignStatusLabel } from "./status-label";

const base = {
  hasAudience: true,
  variants: [
    { script_id: "a", weight: 60 },
    { script_id: "b", weight: 40 },
  ],
  weighted: true,
  days: [1],
  start: "09:00",
  end: "18:00",
};
describe("checklist da campanha de ligação", () => {
  it("libera quando tudo está pronto", () =>
    expect(callCampaignChecklist(base).every((c) => c.ok)).toBe(true));
  it("bloqueia pesos que não somam 100%", () =>
    expect(
      callCampaignChecklist({ ...base, variants: [{ script_id: "a", weight: 50 }] })[1]!.ok,
    ).toBe(false));
  it("bloqueia sem público", () =>
    expect(callCampaignChecklist({ ...base, hasAudience: false })[0]!.ok).toBe(false));
  it("bloqueia sem dias", () =>
    expect(callCampaignChecklist({ ...base, days: [] })[2]!.ok).toBe(false));
  it("situação em português", () => expect(callCampaignStatusLabel("paused")).toBe("Pausada"));
});
