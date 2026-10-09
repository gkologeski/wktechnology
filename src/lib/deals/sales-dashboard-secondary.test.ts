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
        g({
          n: 300,
          stage_id: "q",
          converted: true,
          has_deal_ref: true,
          linked: true,
          deal_stage_id: "w",
          deal_value: 9000,
        }),
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

import { computeHotScore } from "./hot-score";
import type { Deal } from "@/lib/db-types";
import type { Pipeline } from "@/lib/pipelines";

// Referência independente para o ranking feito no banco (0091, sales_dashboard_hot_score).
// Os valores esperados vieram da mesma fixture gerada por generate_series no banco
// (12.000 candidatos, sem gravar em tabelas): soma 468.829, soma ponderada 2.810.759.970 (após 0092).
describe("ranking de avançados no banco = computeHotScore", () => {
  it("12.000 candidatos: mesmos scores e mesmo top 8 com desempate estável", () => {
    const now = Date.parse("2026-10-09T12:00:00Z");
    const base = Date.parse("2026-10-09T00:00:00Z");
    const rows = Array.from({ length: 12000 }, (_, k) => {
      const i = k + 1;
      const prob = (i * 37) % 101;
      const ecd =
        i % 7 === 0
          ? null
          : new Date(base + (((i * 13) % 140) - 40) * 86400000).toISOString().slice(0, 10);
      const upd = new Date(now - ((i * 29) % 3000) * 3600000).toISOString();
      const value = ((i * 53) % 9) * 1000;
      const id = String(i).padStart(6, "0");
      const pipeline = {
        id: "p",
        name: "p",
        stages: [{ value: "s", label: "s", type: "open", probability: prob }],
      } as unknown as Pipeline;
      const score = computeHotScore({
        deal: {
          stage: "s",
          stage_id: "s",
          expected_close_date: ecd,
          updated_at: upd,
        } as unknown as Deal,
        pipeline,
        now,
      });
      return { i, id, value, score };
    });
    expect(rows.reduce((t, r) => t + r.score, 0)).toBe(468829);
    expect(rows.reduce((t, r) => t + r.score * r.i, 0)).toBe(2810759970);
    const top8 = [...rows]
      .sort((a, b) => b.score - a.score || b.value - a.value || a.id.localeCompare(b.id))
      .slice(0, 8)
      .map((r) => r.id);
    expect(top8).toEqual([
      "002080",
      "006625",
      "004979",
      "009524",
      "000939",
      "005484",
      "010362",
      "001777",
    ]);
  });
});
