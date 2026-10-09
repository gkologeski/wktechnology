import { describe, expect, it } from "vitest";
import type { PipelineStage } from "@/lib/pipelines";
import {
  advancedStageIds,
  parseDashboardSecondary,
  summarizeLeadJourney,
  type JourneyGroup,
} from "./sales-dashboard-secondary";

const dealStages = [
  { value: "a", label: "A", type: "open", probability: 20 },
  { value: "b", label: "B", type: "open", probability: 60 },
  { value: "w", label: "Ganho", type: "won", probability: 100 },
  { value: "l", label: "Perdido", type: "lost", probability: 0 },
] as PipelineStage[];
const leadStages = [
  { value: "n", label: "Novo", type: "open" },
  { value: "q", label: "Qualificado", type: "won" },
] as PipelineStage[];

const g = (p: Partial<JourneyGroup>): JourneyGroup => ({
  source: "apollo",
  status: "new",
  stage_id: "n",
  converted: false,
  has_deal_ref: false,
  linked: false,
  deal_stage: null,
  deal_stage_id: null,
  n: 0,
  deal_value: 0,
  ...p,
});

describe("dashboard secundário", () => {
  it("fase avançada = etapas abertas com probabilidade >= 60%", () => {
    expect(advancedStageIds(dealStages)).toEqual(["b"]);
  });

  it("jornada soma grupos acima do antigo teto de 10.000 leads", () => {
    const r = summarizeLeadJourney(
      [
        g({ n: 12000 }),
        g({ n: 300, stage_id: "q", converted: true, has_deal_ref: true, linked: true, deal_stage_id: "w", deal_value: 9000 }),
        g({ n: 50, converted: true, has_deal_ref: true, linked: false }),
      ],
      leadStages,
      dealStages,
      null,
    );
    expect(r.totalLeads).toBe(12350);
    expect(r.qualified).toBe(350);
    expect(r.opportunities).toBe(300);
    expect(r.sales).toBe(300);
    expect(r.revenue).toBe(9000);
    expect(r.attributionCoverage).toBeCloseTo((300 / 350) * 100);
  });

  it("filtro de canal restringe totais mas mantém ranking de canais", () => {
    const r = summarizeLeadJourney(
      [g({ n: 10, source: "apollo" }), g({ n: 5, source: "site" })],
      leadStages,
      dealStages,
      "website",
    );
    expect(r.totalLeads).toBe(5);
    expect(r.channels.map((c) => c.leads)).toEqual([10, 5]);
  });

  it("resposta inválida não vira painel zerado", () => {
    expect(parseDashboardSecondary(null)).toBeNull();
    expect(parseDashboardSecondary([])).toBeNull();
  });
});
