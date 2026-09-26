import { describe, expect, it } from "vitest";
import { normalizeLeadChannel, resolveJourneyStage } from "./lead-journey";

const stages = [
  { value: "new", label: "Novo", type: "open" as const },
  { value: "contact", label: "Em contato", type: "open" as const },
  { value: "won", label: "Oportunidade", type: "won" as const },
  { value: "lost", label: "Desqualificado", type: "lost" as const },
];

describe("normalizeLeadChannel", () => {
  it.each([
    ["prospecting", "prospecting"],
    ["DIRECT_TRAFFIC", "website"],
    ["Google Ads", "paid"],
    ["ORGANIC_SEARCH", "organic"],
    ["Indicação", "referral"],
    ["OFFLINE", "offline"],
    ["HubSpot import", "import"],
    [null, "unknown"],
  ])("agrupa %s como %s", (source, expected) => {
    expect(normalizeLeadChannel(source)).toBe(expected);
  });
});

describe("resolveJourneyStage", () => {
  it("prioriza stage_id configurado", () => {
    expect(resolveJourneyStage({ stage_id: "contact", status: "new" }, stages)?.value).toBe(
      "contact",
    );
  });
  it("mapeia status legado qualificado para etapa ganha", () => {
    expect(resolveJourneyStage({ stage_id: null, status: "qualified" }, stages)?.value).toBe("won");
  });
});
