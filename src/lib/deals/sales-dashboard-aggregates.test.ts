import { describe, expect, it } from "vitest";
import {
  dashboardStageParameters,
  parseDealDashboardAggregates,
} from "./sales-dashboard-aggregates";

describe("dashboard aggregate contract", () => {
  it("preserves exact integer counts and decimal values returned by Postgres", () => {
    const parsed = parseDealDashboardAggregates({
      open_count: 3001,
      pipeline_value: "12345.67",
      forecast_count: 25,
      stages: { discovery: { count: 3001, value: "12345.67" } },
    });
    expect(parsed?.open_count).toBe(3001);
    expect(parsed?.pipeline_value).toBe(12345.67);
    expect(parsed?.stages.discovery).toEqual({ count: 3001, value: 12345.67 });
  });

  it("derives stage arrays and probabilities from the selected pipeline", () => {
    const result = dashboardStageParameters([
      { value: "new", label: "Novo", type: "open", probability: 10 },
      { value: "won", label: "Ganho", type: "won", probability: 100 },
      { value: "lost", label: "Perdido", type: "lost", probability: 0 },
    ]);
    expect(result).toEqual({
      open: ["new"],
      won: ["won"],
      lost: ["lost"],
      probabilities: { new: 10, won: 100, lost: 0 },
    });
  });
});
